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
 *
 * The ZX81 ROM's SAVE is captured as a `.P` file (the section "SAVE" below).
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

// -----------------------------------------------------------------------------
// SAVE: the ZX81 ROM's SAVE captured as a `.P` file
// -----------------------------------------------------------------------------

/*
 * The Spectrum cores decode their SAVE from the MIC pulses; the ZX81's tape signal is VSYNC, which the
 * ROM toggles for the picture too, so this capture listens one level up: at the byte each call of
 * OUT-BYTE sends. The ZX81 ROM's SAVE (checked against the ROM bytes):
 * - $02F6 SAVE: NAME ($03A8) checks the name (report F if empty) and turns the picture off;
 * - $02FF: the ~5 s lead-in, a delay loop counting DE down with a BREAK check;
 * - $030B OUT-NAME: OUT-BYTE for every name character, the last with bit 7 set;
 * - $0313: `LD HL,$4009`, then $0316 OUT-PROG: OUT-BYTE for every byte from VERSN up to E_LINE - 1
 *   (LOAD/SAVE at $01FC ends the loop when HL + 1 reaches E_LINE);
 * - $031E OUT-BYTE: sends the byte at (HL).
 * The bytes of OUT-PROG are exactly a `.P` file. A SAVE stopped by BREAK (report D) never completes
 * and is dropped. With fast load on, the lead-in is skipped and OUT-BYTE returns at once - the same
 * bytes, without the minutes of pulses a 16K program takes. A SAVE that ends is copied into the saved
 * buffers and the revision counted; the host publishes it when the revision changes.
 */

#define ZX8081_SAVE_NAME_CAPACITY 0x100u
#define ZX8081_SAVE_DATA_CAPACITY 0x10000u

#define ZX8081_SAVE_PHASE_NONE 0u
#define ZX8081_SAVE_PHASE_NAME 1u
#define ZX8081_SAVE_PHASE_PROGRAM 2u

/* The SAVE in progress */
static uint8_t zx8081SaveName[ZX8081_SAVE_NAME_CAPACITY];
static uint8_t zx8081SaveData[ZX8081_SAVE_DATA_CAPACITY];
static uint32_t zx8081SaveNameLength;
static uint32_t zx8081SaveDataLength;
static uint8_t zx8081SavePhase;
/* HL of the last byte recorded: an OUT-BYTE entered again at the same byte is not a new one */
static uint32_t zx8081SaveLastHl;

/* The last SAVE that ended */
static uint8_t zx8081SavedName[ZX8081_SAVE_NAME_CAPACITY];
static uint8_t zx8081SavedData[ZX8081_SAVE_DATA_CAPACITY];
static uint32_t zx8081SavedNameLength;
static uint32_t zx8081SavedDataLength;
static uint32_t zx8081SavedRevision;

static void zx8081SaveComplete(void) {
  for (uint32_t i = 0u; i < zx8081SaveNameLength; i++) zx8081SavedName[i] = zx8081SaveName[i];
  for (uint32_t i = 0u; i < zx8081SaveDataLength; i++) zx8081SavedData[i] = zx8081SaveData[i];
  zx8081SavedNameLength = zx8081SaveNameLength;
  zx8081SavedDataLength = zx8081SaveDataLength;
  zx8081SavedRevision++;
  zx8081SavePhase = ZX8081_SAVE_PHASE_NONE;
}

/* OUT-BYTE is about to send the byte at (HL): records it, and ends the SAVE at its last byte */
static void zx8081SaveRecordByte(void) {
  const uint16_t hl = cpu.hl.word;
  if (hl == zx8081SaveLastHl) return;
  zx8081SaveLastHl = hl;
  const uint8_t value = zx8081PeekMemory(hl);
  if (zx8081SavePhase == ZX8081_SAVE_PHASE_NAME) {
    if (zx8081SaveNameLength < ZX8081_SAVE_NAME_CAPACITY) zx8081SaveName[zx8081SaveNameLength++] = value;
    return;
  }
  if (zx8081SaveDataLength < ZX8081_SAVE_DATA_CAPACITY) zx8081SaveData[zx8081SaveDataLength++] = value;
  const uint32_t eLine = (uint32_t)zx8081PeekMemory(0x4014u) | ((uint32_t)zx8081PeekMemory(0x4015u) << 8);
  if ((uint32_t)hl + 1u >= eLine) zx8081SaveComplete();
}

/*
 * At an instruction boundary in the ZX81 ROM's SAVE ($02F6-$031E): follows the routine, records the
 * bytes OUT-BYTE sends, and with fast load skips the lead-in and the pulses. Returns 1 when it ran
 * the instruction in place of the CPU.
 */
static uint8_t zx8081TapeSaveTrap(void) {
  const uint16_t pc = cpu.pc;
  if (!zx8081RomIsZx81 || (uint16_t)(pc - 0x02f6u) > 0x28u || cpu.prefix != PREFIX_NONE) return 0u;
  switch (pc) {
    case 0x02f6u:
      /* SAVE: a new file; one stopped by BREAK earlier is forgotten */
      zx8081SavePhase = ZX8081_SAVE_PHASE_NAME;
      zx8081SaveNameLength = 0u;
      zx8081SaveDataLength = 0u;
      zx8081SaveLastHl = 0x10000u;
      return 0u;

    case 0x02ffu:
      /* The lead-in's delay loop: done at once (DE and B as the loop leaves them) */
      if (!zx8081TapeFastLoad || zx8081SavePhase != ZX8081_SAVE_PHASE_NAME) return 0u;
      cpu.de.word = 0u;
      cpu.bc.bytes.high = 0u;
      cpu.pc = 0x030bu;
      break;

    case 0x0313u:
      /* The name is out: the program follows from $4009 */
      if (zx8081SavePhase == ZX8081_SAVE_PHASE_NAME) {
        zx8081SavePhase = ZX8081_SAVE_PHASE_PROGRAM;
        zx8081SaveLastHl = 0x10000u;
      }
      return 0u;

    case 0x031eu: {
      if (zx8081SavePhase == ZX8081_SAVE_PHASE_NONE) return 0u;
      zx8081SaveRecordByte();
      if (!zx8081TapeFastLoad) return 0u;
      /* OUT-BYTE returned: E shifted empty, Z set (its RET Z); the callers use neither */
      const uint16_t sp = cpu.sp;
      cpu.pc = (uint16_t)(zx8081PeekMemory(sp) | (zx8081PeekMemory((uint16_t)(sp + 1u)) << 8));
      cpu.sp = (uint16_t)(sp + 2u);
      cpu.de.bytes.low = 0u;
      cpu.af.bytes.low |= FLAG_Z;
      break;
    }

    default:
      return 0u;
  }
  zx8081TapeTraps++;
  /* A NOP's time, so the frame keeps moving */
  zx8081AdvanceTacts(4u);
  return 1u;
}

/* A reset forgets a SAVE in progress (one that ended stays for the host) */
static void zx8081TapeResetSave(void) {
  zx8081SavePhase = ZX8081_SAVE_PHASE_NONE;
  zx8081SaveNameLength = 0u;
  zx8081SaveDataLength = 0u;
}

uint32_t zx8081TapeGetSavedRevision(void) { return zx8081SavedRevision; }
uint32_t zx8081TapeGetSavedNameLength(void) { return zx8081SavedNameLength; }
uint32_t zx8081TapeGetSavedDataLength(void) { return zx8081SavedDataLength; }
uint32_t zx8081TapeSavedNamePtr(void) { return (uint32_t)(uintptr_t)zx8081SavedName; }
uint32_t zx8081TapeSavedDataPtr(void) { return (uint32_t)(uintptr_t)zx8081SavedData; }
uint32_t zx8081TapeGetSaveNameCapacity(void) { return ZX8081_SAVE_NAME_CAPACITY; }
uint32_t zx8081TapeGetSaveDataCapacity(void) { return ZX8081_SAVE_DATA_CAPACITY; }
uint32_t zx8081TapeGetSavePhase(void) { return zx8081SavePhase; }

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
