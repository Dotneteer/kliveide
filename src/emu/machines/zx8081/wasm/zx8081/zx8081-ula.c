/*
 * The ZX80/ZX81 ULA: the line timer, HSYNC and VSYNC, the ZX81's NMI generator and WAIT, the INT on
 * A6 during refresh, the character fetch at refresh, and the ports. Ported from CLK
 * `Machines/Sinclair/ZX8081/ZX8081.cpp` (MIT; Copyright (c) 2015 Thomas Harte - the full notice is in zx8081.c and THIRD_PARTY_NOTICES.md), rewritten to
 * the shared Z80 core's hooks (`.plans/ZX8081_WASM_PLAN.md` §3, §6).
 */

/* The line timer, in T-states. The ZX81 wraps it every 207 T; the ZX80's runs on until an INT ack. */
static uint32_t zx8081Hcounter;
/* The next timer value at which something happens (HSYNC start or end, the ZX81 wrap) */
static uint32_t zx8081NextUlaEvent;
static uint32_t zx8081HsyncStart = ZX81_HSYNC_START;
static uint32_t zx8081HsyncEnd = ZX81_HSYNC_END;

/* The character row line (0-7): counts HSYNCs, reset by an OUT while the NMI generator is off */
static uint8_t zx8081LineCounter;

/* The ZX81's NMI generator: on with OUT ($FE), off with OUT ($FD) */
static uint8_t zx8081NmiEnabled;
/* The NMI line, asserted during HSYNC while the generator is on */
static uint8_t zx8081NmiLine;
/* The NMI edge, latched until the CPU acknowledges it (the Z80's NMI is edge-triggered) */
static uint8_t zx8081NmiLatched;

/* The INT the ULA raises for the next instruction boundary, and this instruction's candidate */
static uint8_t zx8081IntPending;
static uint8_t zx8081IntCandidateValid;
static uint32_t zx8081IntCandidateEndTact;

static void zx8081UlaComputeNextEvent(void) {
  if (zx8081Hcounter < zx8081HsyncStart) {
    zx8081NextUlaEvent = zx8081HsyncStart;
  } else if (zx8081Hcounter < zx8081HsyncEnd) {
    zx8081NextUlaEvent = zx8081HsyncEnd;
  } else {
    zx8081NextUlaEvent = zx8081IsZx81 ? ZX81_LINE_TACTS : 0xffffffffu;
  }
}

static void zx8081UlaReset(void) {
  zx8081HsyncStart = zx8081IsZx81 ? ZX81_HSYNC_START : ZX80_HSYNC_START;
  zx8081HsyncEnd = zx8081IsZx81 ? ZX81_HSYNC_END : ZX80_HSYNC_END;
  zx8081Hcounter = 0u;
  zx8081LineCounter = 0u;
  zx8081NmiEnabled = 0u;
  zx8081NmiLine = 0u;
  zx8081NmiLatched = 0u;
  zx8081IntPending = 0u;
  zx8081IntCandidateValid = 0u;
  zx8081M1Fetch = 0u;
  zx8081HasLatchedVideoByte = 0u;
  zx8081UlaComputeNextEvent();
}

/*
 * Advances the line timer T by T over `value` tacts that have just been added to `cpu.tacts`, firing
 * HSYNC's start and end (CLK l.125-145).
 */
static void ZX8081_NOINLINE zx8081UlaStep(uint32_t value) {
  uint32_t tact = cpu.tacts - value;
  for (uint32_t i = 0u; i < value; i++) {
    tact++;
    zx8081Hcounter++;
    if (zx8081Hcounter == zx8081HsyncStart) {
      zx8081Hsync = 1u;
      zx8081LineCounter = (uint8_t)((zx8081LineCounter + 1u) & 7u);
      if (zx8081NmiEnabled) {
        zx8081NmiLine = 1u;
        zx8081NmiLatched = 1u;
      }
    } else if (zx8081Hcounter == zx8081HsyncEnd) {
      zx8081Hsync = 0u;
      zx8081VideoHsyncEnd(tact);
      if (zx8081NmiEnabled) {
        zx8081NmiLine = 0u;
      }
    }
    if (zx8081IsZx81 && zx8081Hcounter >= ZX81_LINE_TACTS) {
      zx8081Hcounter = 0u;
    }
  }
  zx8081UlaComputeNextEvent();
}

/*
 * WAIT (CLK l.152): while the NMI generator is on and its line is asserted, and the CPU is not
 * HALTed, the ULA holds WAIT, which stretches the machine cycle to the end of HSYNC. Klive's delay
 * hooks run before the access; real WAIT is sampled at T2 - a difference of at most 2 T (§16).
 */
static inline void zx8081DrainWait(void) {
  while (zx8081NmiEnabled && zx8081NmiLine) {
    zx8081AdvanceTacts(1u);
  }
}

static void ZX8081_NOINLINE zx8081DelayMemory(void) {
  zx8081AdvanceTacts(3u);
  if (!cpu.halted) zx8081DrainWait();
}

static void ZX8081_NOINLINE zx8081DelayPort(void) {
  zx8081AdvanceTacts(4u);
  if (!cpu.halted) zx8081DrainWait();
}

/*
 * The NMI acknowledge, two tacts in (C3): WAIT holds it to the end of HSYNC - this is what makes the
 * picture jitter-free, since the CPU waits in HALT for this NMI. The core leaves HALT only after the
 * acknowledge's first tacts, but the halt line is already released here, so the WAIT applies.
 */
static void ZX8081_NOINLINE zx8081NmiAckWait(void) {
  zx8081DrainWait();
  zx8081NmiLatched = 0u;
}

/* The INT acknowledge resets the line timer (CLK l.200: "reset, then advanced twice" half-cycles) */
static void zx8081IntAck(void) {
  zx8081Hcounter = 1u;
  zx8081UlaComputeNextEvent();
}

/*
 * Every refresh (C1), with I:R before the increment:
 * - INT is wired to A6: when A6 is low, INT is asserted for the refresh. It takes effect only if the
 *   refresh ends the instruction, so the frame loop checks `cpu.tacts` against the candidate after
 *   the instruction (CLK's retroactive sample, l.214).
 * - a latched display byte becomes 8 pixels: the character's row from (I & $FE) + code * 8 + line,
 *   inverted unless bit 7 of the code is set (CLK l.218). In RAM the byte comes from the refresh
 *   address itself, as in CLK: the ULA substitutes A0-A8 for the ROM only (through its resistors), so
 *   RAM - internal or a pack - sees the CPU's own I:R. That is what WRX hi-res relies on.
 */
static void ZX8081_NOINLINE zx8081Refresh(uint16_t address) {
  if (!(address & 0x40u)) {
    zx8081IntCandidateEndTact = cpu.tacts + 1u;
    zx8081IntCandidateValid = 1u;
  }
  if (zx8081HasLatchedVideoByte) {
    const uint8_t code = zx8081LatchedVideoByte;
    const uint16_t charAddress = (uint16_t)((address & 0xfe00u) | ((code & 0x3fu) << 3) | zx8081LineCounter);
    const uint8_t mask = (code & 0x80u) ? 0x00u : 0xffu;
    const uint8_t pattern =
      charAddress < zx8081RamBase ? zx8081Rom[charAddress & zx8081RomMask] : zx8081Ram[address & zx8081RamMask];
    zx8081VideoOutputByte((uint8_t)(pattern ^ mask));
    zx8081HasLatchedVideoByte = 0u;
  }
}

/*
 * IN (only A0 is decoded): with A0 low, VSYNC starts (while the NMI generator is off) and the result
 * is the keyboard rows the high byte selects (bits 0-4, low = pressed), bit 5 set, bit 6 the TV
 * standard (0 on a US machine - "the US machine has an extra diode", ROM KEYBOARD; CLK always reads
 * 1) and bit 7 the tape signal. Other reads are $FF.
 */
static uint8_t zx8081CpuReadPort(uint16_t address) {
  uint8_t value = 0xffu;
  if (!(address & 1u)) {
    if (!zx8081NmiEnabled) {
      zx8081VideoSetVsync(1u);
    }
    const uint32_t selectedLines = (~(uint32_t)(address >> 8)) & 0xffu;
    value = (uint8_t)(~zx8081KeyboardSelectedLineValue[selectedLines] & 0x1fu) | 0x20u;
    if (!(zx8081IsZx81 && zx8081Ntsc)) value |= 0x40u;
    if (zx8081TapeEar) value |= 0x80u;
  }
  return value;
}

/*
 * OUT (any port; only A0 and A1 are decoded): with the NMI generator off, the line counter resets
 * and VSYNC ends. A1 low turns the generator off, A0 low on (ZX81 only); off also releases WAIT.
 */
static void zx8081CpuWritePort(uint16_t address, uint8_t value) {
  (void)value;
  if (!zx8081NmiEnabled) {
    zx8081LineCounter = 0u;
    zx8081VideoSetVsync(0u);
  }
  if (!(address & 2u)) {
    zx8081NmiEnabled = 0u;
    zx8081NmiLine = 0u;
  }
  if (!(address & 1u)) {
    zx8081NmiEnabled = zx8081IsZx81;
  }
}

/* The ULA panel and the tests */
uint32_t zx8081GetHcounter(void) { return zx8081Hcounter; }
uint32_t zx8081GetLineCounter(void) { return zx8081LineCounter; }
uint32_t zx8081GetNmiEnabled(void) { return zx8081NmiEnabled; }
uint32_t zx8081GetVsync(void) { return zx8081Vsync; }
uint32_t zx8081GetHsync(void) { return zx8081Hsync; }
uint32_t zx8081ReadPort(uint32_t address) { return zx8081CpuReadPort((uint16_t)address); }
void zx8081WritePort(uint32_t address, uint32_t value) { zx8081CpuWritePort((uint16_t)address, (uint8_t)value); }

/* After every instruction: the TV's horizontal flywheel, the tape motor */
static void zx8081AfterInstruction(void) {
  zx8081VideoCheckFlywheel();
  zx8081TapeAfterInstruction();
}
