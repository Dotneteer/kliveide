/*
 * DAVE: interrupts, timers and the system register (plan §8.1; DAVE_MEMORY_IO.md §4, §8).
 *
 * DAVE ticks at 250 kHz: its 8 MHz input divided by 32 (BFh bit 1 = 0), or by 48 with BFh bit 1 set
 * (a 12 MHz input on turbo machines; on a stock machine every DAVE frequency then drops to 2/3).
 *
 * Four interrupt latches, each with an enable and a reset (B4h):
 *   - the selectable source (A7h bits 6-5): 1 kHz, 50 Hz, tone channel 0 or tone channel 1;
 *   - 1 Hz;
 *   - INT1, wired to NICK's VINT (`epDaveSetInt1Level`);
 *   - INT2, the serial/net STATUS IN input: inert without a peripheral.
 * The timers latch on *every* toggle of their divider, so "1 kHz" is 1000 interrupts a second and the
 * B4h read shows the divider as a square wave at half that. 50 Hz is 5000 ticks (80 000 T), not locked
 * to the video frame. A tone channel's interrupt comes at each reload of its counter, 250 000 / (n + 1)
 * a second; a channel held by its sync bit does not count. INT1 and INT2 latch on an edge (D6, below).
 * The Z80's /INT is the OR of the latches: level-triggered, IM 1.
 *
 * B4h write: bits 0/2/4/6 enable the selectable source, 1 Hz, INT1 and INT2; a 1 in bits 1/3/5/7
 * clears that latch, and so does disabling the source. B4h read (the final chip's layout): bit 0 the
 * selectable divider, 1 its latch, 2 the 1 Hz divider, 3 its latch, 4 the INT1 input (1 while a VINT
 * line runs), 5 its latch, 6 the INT2 input, 7 its latch.
 *
 * Reset clears all 22 registers: every interrupt disabled, sound silent, BFh = 0 (every memory access
 * waits), B5h = 0.
 *
 * The VINT edge (plan §3.5, D6, Q1): NICK's /VIRQ falls at the start of a VINT block and rises at the
 * start of the line after it; DAVE latches INT1 on a falling edge. ep128emu, Xemu and the EXOS book's
 * appendix (IstvanV, from real-machine tests) put the interrupt at the end of the block, which both
 * hold if the board inverts /VIRQ on its way to DAVE. EP_VINT_AT_BLOCK_END chooses: 1 (the default)
 * latches when the VINT level ends, 0 when it begins.
 */

#define EP_VINT_AT_BLOCK_END 1

/* The sound generator's per-tick hooks (ep-audio.c) */
static void epAudioToneReload(uint32_t channel);
static void epAudioTick(void);

/* The sound registers A0h-AFh as last written (write-only; ep-audio.c reads them) */
static uint8_t epDaveReg[16];
/* The tick length in half-T units; BFh itself (`epDaveBf`) is declared in ep-memory.c */
static uint32_t epDaveTickHalves = EP_DAVE_TICK_HALVES;

/* B4h: the enables as written (bits 0/2/4/6) and the latches (bits 1/3/5/7) */
static uint8_t epIntEnable;
static uint8_t epIntLatch;
/* The dividers' square waves: bit 0 the selectable source's, bit 2 the 1 Hz one's */
static uint8_t epIntDividers;
/* The INT1 and INT2 inputs (1 = active) */
static uint8_t epInt1Level;
static uint8_t epInt2Level;

/* The timer chain: ticks to the next 1 kHz event, 1 kHz events to the next 50 Hz, 50 Hz to the next 1 Hz */
static uint16_t epDiv1k;
static uint8_t epDiv50;
static uint8_t epDiv1;

/* The tone channels' 12-bit down counters (the sound itself is ep-audio.c's) */
static uint16_t epToneCounter[3];

static inline uint32_t epToneCode(uint32_t channel) {
  return ((uint32_t)(epDaveReg[channel * 2u + 1u] & 0x0fu) << 8) | epDaveReg[channel * 2u];
}

static inline uint8_t epDaveIntLine(void) { return epIntLatch != 0u; }

/* A selectable-source event: its divider toggles and, while enabled, its latch sets */
static inline void epIntSelectableEvent(void) {
  epIntDividers ^= 0x01u;
  if (epIntEnable & 0x01u) epIntLatch |= 0x02u;
}

/* One 250 kHz tick: the timer chain and the tone counters */
static void epDaveTick(void) {
  const uint8_t select = (uint8_t)((epDaveReg[7] >> 5) & 3u);
  // --- The 1 kHz / 50 Hz / 1 Hz chain
  if (--epDiv1k == 0u) {
    epDiv1k = 250u;
    if (select == 0u) epIntSelectableEvent();
    if (--epDiv50 == 0u) {
      epDiv50 = 20u;
      if (select == 1u) epIntSelectableEvent();
      if (--epDiv1 == 0u) {
        epDiv1 = 50u;
        epIntDividers ^= 0x04u;
        if (epIntEnable & 0x04u) epIntLatch |= 0x08u;
      }
    }
  }
  // --- The tone counters: a reload every n + 1 ticks; a channel held by its sync bit does not count
  for (uint32_t ch = 0u; ch < 3u; ch++) {
    if (epDaveReg[7] & (1u << ch)) {
      epToneCounter[ch] = (uint16_t)epToneCode(ch);
      continue;
    }
    if (epToneCounter[ch] == 0u) {
      epToneCounter[ch] = (uint16_t)epToneCode(ch);
      epAudioToneReload(ch);
      if (select == 2u + ch) epIntSelectableEvent();
    } else {
      epToneCounter[ch]--;
    }
  }
  epAudioTick();
}

/* NICK's VINT level (1 while a line with VINT set runs): INT1 latches on the edge D6 chooses */
static void epDaveSetInt1Level(uint8_t level) {
  if (level == epInt1Level) return;
  epInt1Level = level;
  const uint8_t edge = EP_VINT_AT_BLOCK_END ? (uint8_t)(level == 0u) : level;
  if (edge && (epIntEnable & 0x10u)) epIntLatch |= 0x20u;
}

static void epDaveWriteB4(uint8_t value) {
  epIntEnable = (uint8_t)(value & 0x55u);
  // --- A 1 in a reset bit clears its latch; a disabled source's latch is clear
  epIntLatch &= (uint8_t)~(value & 0xaau);
  epIntLatch &= (uint8_t)(epIntEnable << 1);
}

static uint8_t epDaveReadB4(void) {
  return (uint8_t)((epIntDividers & 0x05u) | epIntLatch | (epInt1Level ? 0x10u : 0u) | (epInt2Level ? 0x40u : 0u));
}

static void epDaveWriteBf(uint8_t value) {
  epDaveBf = value;
  epDaveTickHalves = (value & 0x02u) ? EP_DAVE_TICK_HALVES_12M : EP_DAVE_TICK_HALVES;
  epRemap();
}

static void epDaveReset(void) {
  for (uint32_t i = 0u; i < 16u; i++) epDaveReg[i] = 0u;
  for (uint32_t i = 0u; i < 3u; i++) epToneCounter[i] = 0u;
  epIntEnable = 0u;
  epIntLatch = 0u;
  epIntDividers = 0u;
  epInt1Level = 0u;
  epInt2Level = 0u;
  epDiv1k = 250u;
  epDiv50 = 20u;
  epDiv1 = 50u;
  epDaveWriteBf(0u);
}

uint32_t epGetDaveRegister(uint32_t index) { return epDaveReg[index & 15u]; }
uint32_t epGetIntEnable(void) { return epIntEnable; }
uint32_t epGetIntLatch(void) { return epIntLatch; }
uint32_t epGetB4(void) { return epDaveReadB4(); }
uint32_t epGetBf(void) { return epDaveBf; }
