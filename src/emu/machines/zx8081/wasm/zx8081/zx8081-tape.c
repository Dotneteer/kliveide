/*
 * ZX80/ZX81 tape: a `.O`/`.P` file played as real-time pulses into EAR (port $FE bit 7), the ROM's
 * automatic motor control, and the fast-load traps.
 *
 * The pulse train is CLK's `Storage/Tape/Formats/ZX80O81P.cpp` (MIT; Copyright (c) 2015 Thomas Harte - the full notice
 * is in zx8081.c and THIRD_PARTY_NOTICES.md): 1 s of silence, then each byte MSB first, every bit a 1300 us gap followed by 4 waves
 * for a 0 or 9 for a 1, each wave 150 us high and 150 us low; silence after the last byte. It is
 * synthesized here from the file bytes, which the host uploads once (`zx8081TapeDataPtr`), rather
 * than uploaded as a pulse list - a 16K program would be millions of pulses.
 *
 * Fast load reads the same bytes straight into the ROM's LOAD routine at three call sites of
 * IN-BYTE (§9.2). The ZX81 ROM's (checked against the ROM listing):
 * - $0347 NEXT-PROG waits for the tape signal to time out: simulated as the timeout (A = 0 and on at
 *   $0360, `CP D`), which goes on to the name, or resets the machine when there is none to wait for;
 * - $0366 IN-NAME reads a name byte into C, resuming at $0369;
 * - $037C IN-PROG reads a program byte into C, resuming at $037F (`LD (HL),C`).
 * A `.P` file has no name, so the host puts the nameless marker $80 in front of it, which `LOAD ""`
 * accepts. The ZX80 ROM's trap is CLK's: at $0220 the byte goes to (HL) and execution resumes at
 * $0248. When the bytes run out the traps stop, and the ROM sees a silent tape.
 */

#define ZX8081_TAPE_LEADER_TACTS 3250000u /* 1 s */
#define ZX8081_TAPE_GAP_TACTS 4225u       /* 1300 us */
#define ZX8081_TAPE_HALF_WAVE_TACTS 488u  /* 150 us (487.5 T) */

static uint32_t zx8081TapeLength;
static uint8_t zx8081TapeEar;
static uint8_t zx8081TapeMotor;

/* The host's play/stop and the options */
static uint8_t zx8081TapePlaying;
static uint8_t zx8081TapeAutoMotor = 1u;
static uint8_t zx8081TapeFastLoad = 1u;

/* The pulse synthesizer */
static uint32_t zx8081TapePulsePos;   /* the next byte to play */
static uint8_t zx8081TapeByte;
static uint8_t zx8081TapeBit;         /* 0-7, MSB first */
static uint8_t zx8081TapeWave;        /* 0: the gap; 1..n: waves */
static uint8_t zx8081TapeHalf;        /* 0: the high half of a wave next, 1: the low half */
static uint8_t zx8081TapeStarted;
static int32_t zx8081TapeRemaining;

/* The fast-load stream */
static uint32_t zx8081TapeFastPos;
static uint32_t zx8081TapeTraps;

/* Auto-RUN: the host arms it with a load; the core reports when the ROM finished the load */
static uint8_t zx8081AutoRunArmed;
static uint8_t zx8081AutoRunHit;

static void zx8081TapeResetPlayback(void) {
  zx8081TapePulsePos = 0u;
  zx8081TapeBit = 0u;
  zx8081TapeWave = 0u;
  zx8081TapeHalf = 0u;
  zx8081TapeStarted = 0u;
  zx8081TapeRemaining = 0;
  zx8081TapeEar = 0u;
  zx8081TapeMotor = 0u;
  zx8081TapeFastPos = 0u;
}

/*
 * The next pulse: its level goes to EAR, its length (T-states) is returned. As CLK's serialiser: a
 * 1300 us low gap before every bit (not only every byte) - the ROM ends a bit on a long enough low
 * run (IN-BYTE's TRAILER/COUNTER loop) - then the bit's waves, high half first.
 */
static uint32_t zx8081TapeNextPulse(void) {
  if (!zx8081TapeStarted) {
    zx8081TapeStarted = 1u;
    zx8081TapeEar = 0u;
    return ZX8081_TAPE_LEADER_TACTS;
  }
  if (zx8081TapeWave == 0u) {
    if (zx8081TapeBit == 0u) {
      if (zx8081TapePulsePos >= zx8081TapeLength) {
        /* Past the last byte: silence */
        zx8081TapeEar = 0u;
        return ZX8081_TAPE_LEADER_TACTS;
      }
      zx8081TapeByte = zx8081TapeData[zx8081TapePulsePos++];
    }
    zx8081TapeWave = 1u;
    zx8081TapeHalf = 0u;
    zx8081TapeEar = 0u;
    return ZX8081_TAPE_GAP_TACTS;
  }
  if (zx8081TapeHalf == 0u) {
    zx8081TapeHalf = 1u;
    zx8081TapeEar = 1u;
    return ZX8081_TAPE_HALF_WAVE_TACTS;
  }
  zx8081TapeHalf = 0u;
  zx8081TapeEar = 0u;
  const uint8_t waves = (zx8081TapeByte & (0x80u >> zx8081TapeBit)) ? 9u : 4u;
  zx8081TapeWave++;
  if (zx8081TapeWave > waves) {
    zx8081TapeBit = (uint8_t)((zx8081TapeBit + 1u) & 7u);
    zx8081TapeWave = 0u;
  }
  return ZX8081_TAPE_HALF_WAVE_TACTS;
}

static void ZX8081_NOINLINE zx8081TapeAdvance(uint32_t value) {
  zx8081TapeRemaining -= (int32_t)value;
  while (zx8081TapeRemaining <= 0) {
    zx8081TapeRemaining += (int32_t)zx8081TapeNextPulse();
  }
}

/* The motor: the host's play, gated by the ROM's LOAD routine when automatic control is on */
static inline void zx8081TapeAfterInstruction(void) {
  uint8_t motor = zx8081TapePlaying && zx8081TapeLength > 0u;
  if (motor && zx8081TapeAutoMotor) {
    const uint16_t pc = cpu.pc;
    motor = zx8081RomIsZx81 ? (pc >= 0x0340u && pc < 0x03c3u) : (pc >= 0x0206u && pc < 0x024du);
  }
  zx8081TapeMotor = motor;
  if (!motor) zx8081TapeEar = 0u;
  if (zx8081AutoRunArmed && cpu.pc == (zx8081RomIsZx81 ? 0x06d1u : 0x0203u)) {
    zx8081AutoRunArmed = 0u;
    zx8081AutoRunHit = 1u;
  }
}

/* At an instruction boundary: runs a fast-load trap when the PC is at one. Returns 1 if it did. */
static uint8_t zx8081TapeTryTrap(void) {
  if (!zx8081TapeFastLoad || zx8081TapeLength == 0u || cpu.prefix != PREFIX_NONE) return 0u;
  const uint16_t pc = cpu.pc;
  if (zx8081RomIsZx81) {
    if (pc == 0x0347u) {
      if (zx8081TapeFastPos >= zx8081TapeLength) return 0u;
      cpu.af.bytes.high = 0x00u;
      cpu.pc = 0x0360u;
    } else if (pc == 0x0366u || pc == 0x037cu) {
      if (zx8081TapeFastPos >= zx8081TapeLength) return 0u;
      cpu.bc.bytes.low = zx8081TapeData[zx8081TapeFastPos++];
      cpu.pc = (uint16_t)(pc + 3u);
    } else {
      return 0u;
    }
  } else {
    if (pc != 0x0220u || zx8081TapeFastPos >= zx8081TapeLength) return 0u;
    zx8081CpuWriteMemory(cpu.hl.word, zx8081TapeData[zx8081TapeFastPos++]);
    cpu.pc = 0x0248u;
  }
  zx8081TapeTraps++;
  /* A NOP's time, so the frame keeps moving */
  zx8081AdvanceTacts(4u);
  return 1u;
}

/* The host has written `length` bytes at `zx8081TapeDataPtr()` (a `.P` with its $80 marker) */
void zx8081TapeSetLength(uint32_t length) {
  zx8081TapeLength = length < ZX8081_TAPE_CAPACITY ? length : ZX8081_TAPE_CAPACITY;
  zx8081TapeResetPlayback();
}
void zx8081TapeRewind(void) { zx8081TapeResetPlayback(); }
void zx8081TapeSetPlaying(uint32_t playing) { zx8081TapePlaying = playing != 0u; }
uint32_t zx8081TapeGetPlaying(void) { return zx8081TapePlaying; }
void zx8081TapeSetAutoMotor(uint32_t on) { zx8081TapeAutoMotor = on != 0u; }
void zx8081TapeSetFastLoad(uint32_t on) { zx8081TapeFastLoad = on != 0u; }
uint32_t zx8081TapeGetLength(void) { return zx8081TapeLength; }
uint32_t zx8081TapeGetPulsePosition(void) { return zx8081TapePulsePos; }
uint32_t zx8081TapeGetFastPosition(void) { return zx8081TapeFastPos; }
uint32_t zx8081TapeGetTraps(void) { return zx8081TapeTraps; }
uint32_t zx8081TapeGetEar(void) { return zx8081TapeEar; }
uint32_t zx8081TapeGetMotor(void) { return zx8081TapeMotor; }
void zx8081ArmAutoRun(uint32_t armed) {
  zx8081AutoRunArmed = armed != 0u;
  zx8081AutoRunHit = 0u;
}
/* Whether the ROM finished a load since the last call (and clears it) */
uint32_t zx8081TakeAutoRunHit(void) {
  const uint32_t hit = zx8081AutoRunHit;
  zx8081AutoRunHit = 0u;
  return hit;
}
