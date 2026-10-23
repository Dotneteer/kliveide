/*
 * The HT-1080Z tape (`.plans/HT1080Z_PLAN.md` §8-9; `_input/ht1080z/STORAGE_FIRMWARE_SOFTWARE.md` §3):
 * a `.cas` image played as real-time pulses into the cassette-in latch, the ROM-trap fast load, and
 * SAVE captured as a `.cas`.
 *
 * A `.cas` is the bit stream the ROM wrote, MSB first, leader and sync included. The host uploads its
 * bytes once (`ht1080zTapeDataPtr`); the core synthesizes the pulses from them.
 *
 * Real time. Each bit is a cell that starts with a clock pulse; a 1 adds a data pulse in the middle.
 * The timing is the ROM's own writer's, counted on the Series II ROM (§17): a pulse is +227 T, -227 T,
 * then silence (CTPULS 01D9h); the data pulse starts 1,763 T after the clock pulse; a cell is 3,557 T
 * with a data pulse and 3,570 T without (the byte writer at 0264h). The cassette-in latch is set where
 * a pulse swings negative, 227 T into it (MAME sets it on that crossing). The tape moves while the
 * recorder's motor runs - port FF bit 2, which the ROM sets at 0215h and clears at 01F8h - or while F1
 * holds it on, and the host's play is pressed. CTBIT (0241h) clears the latch about 906 T after a
 * clock pulse and samples it about 2,476 T after, so the data pulse's edge at 1,990 T falls well
 * inside its window.
 *
 * A `.cas` holds the bits only, not the pauses between them, and one pause matters: after the A5h
 * sync the ROM's reader draws `**` and returns to CLOAD or SYSTEM before it reads again, about
 * 2,100 T, longer than a cell's slack - on a real tape CSAVE was still evaluating the name there. The
 * player therefore leaves 1 ms of silence after every sync it plays (00 00 00 A5h at any bit
 * position), as MAME's CAS player does "while the ROM is busy".
 *
 * Fast load (§9). The ROM's cassette reads all go through CTBIT (0241h, a bit into A by `RLA`) and its
 * byte loop (0235h, eight of them); the sync search (0296h) calls CTBIT. With fast load on, the core
 * runs those two routines itself at their entry, from the same bit position the pulses use, so a fast
 * and a real-time load read the same bits. Only the ROM's routines are trapped: a custom loader in RAM
 * reads the pulses.
 *
 * SAVE. Every byte the ROM's writer (0264h) sends between the start of a recording (0284h, which
 * selects the recorder and writes the leader through 0287h) and the motor going off (01F8h) is
 * captured: the bytes are a `.cas` of what was saved, leader and sync included. With fast load on the
 * writer itself is skipped (it returns at once, every register kept, as it does); without it the ROM
 * writes its pulses in real time as well. The host publishes each finished recording.
 */

#define HT_TAPE_CAPACITY 0x40000u
#define HT_SAVE_CAPACITY 0x40000u

/* The pulse timing, in T-states from the cell's start (see above) */
#define HT_TAPE_CLOCK_EDGE 227u
#define HT_TAPE_DATA_EDGE (1763u + 227u)
#define HT_TAPE_CELL_ONE 3557u
#define HT_TAPE_CELL_ZERO 3570u
/* The silence after a sync: 1 ms */
#define HT_TAPE_SYNC_GAP 1774u
#define HT_TAPE_SYNC_PATTERN 0x000000a5u

/* The ROM's cassette routines (Series I/II and /64 share these addresses) */
#define HT_ROM_CTBIT 0x0241u
#define HT_ROM_READ_BYTE 0x0235u
#define HT_ROM_WRITE_BYTE 0x0264u
#define HT_ROM_RECORD_START 0x0284u
#define HT_ROM_MOTOR_OFF 0x01f8u
/*
 * The ROM's wait-for-key routine is `0049h: CALL 002Bh / OR A / RET NZ / JR 0049h`: the `JR` runs only
 * while BASIC waits for a key and none is pressed - at `>`, `READY ?`, `MEMORY SIZE?`, SYSTEM's `*?`
 */
#define HT_ROM_KEY_WAIT_LOOP 0x004eu

static uint8_t htTapeData[HT_TAPE_CAPACITY];
static uint8_t htSaveData[HT_SAVE_CAPACITY];

/* The image, in bits, and where the tape is: the next bit's index and the time into its cell */
static uint32_t htTapeLength;
static uint32_t htTapeBitPos;
static uint32_t htTapeCellTact;
static uint8_t htTapeClockSent;
static uint8_t htTapeDataSent;
/* The last 32 bits played, to find a sync; and the silence still to play after one */
static uint32_t htTapeRecentBits;
static uint32_t htTapeGapTacts;

/* The host's play, the F1 motor override, and fast load */
static uint8_t htTapePlaying;
static uint8_t htTapeMotorOverride;
static uint8_t htTapeFastLoad = 1u;
/* Counts the fast-load traps taken (for the tests and the IDE) */
static uint32_t htTapeTraps;

/* SAVE: whether a recording is open, its bytes, and how many recordings have finished */
static uint8_t htSaveOpen;
static uint32_t htSaveLength;
static uint32_t htSaveRevision;
static uint32_t htSavedLength;

/*
 * How many times BASIC has gone round its wait-for-key loop: the host types the tape-load flow's next
 * command once it grows, which means BASIC is idle at a prompt (`Ht1080zWasmV2Machine`)
 */
static uint32_t htKeyWaitLoops;

static inline uint8_t htTapeBitAt(uint32_t bit) {
  return (uint8_t)((htTapeData[bit >> 3] >> (7u - (bit & 7u))) & 1u);
}

/* Whether the tape moves: a tape in the deck, play pressed, and the motor on (or F1) */
static inline uint8_t htTapeRunning(void) {
  return htTapePlaying && htTapeLength > 0u && ((htPortFf & 0x04u) || htTapeMotorOverride);
}

static void htTapeResetPlayback(void) {
  htTapeBitPos = 0u;
  htTapeCellTact = 0u;
  htTapeClockSent = 0u;
  htTapeDataSent = 0u;
  htTapeRecentBits = 0xffffffffu;
  htTapeGapTacts = 0u;
}

/* A bit has been played: the next cell starts; after a sync, a silence first */
static inline void htTapeBitDone(uint8_t bit) {
  htTapeBitPos++;
  htTapeCellTact = 0u;
  htTapeClockSent = 0u;
  htTapeDataSent = 0u;
  htTapeRecentBits = (htTapeRecentBits << 1) | bit;
  if (htTapeRecentBits == HT_TAPE_SYNC_PATTERN) htTapeGapTacts = HT_TAPE_SYNC_GAP;
}

static void htTapeResetSave(void) {
  htSaveOpen = 0u;
  htSaveLength = 0u;
}

/* Real time: the pulse edges of the tacts just elapsed set the cassette-in latch */
static void HT_NOINLINE htTapeAdvance(uint32_t value) {
  while (value > 0u && htTapeBitPos < htTapeLength) {
    if (htTapeGapTacts > 0u) {
      const uint32_t quiet = htTapeGapTacts < value ? htTapeGapTacts : value;
      htTapeGapTacts -= quiet;
      value -= quiet;
      continue;
    }
    const uint8_t one = htTapeBitAt(htTapeBitPos);
    const uint32_t cell = one ? HT_TAPE_CELL_ONE : HT_TAPE_CELL_ZERO;
    const uint32_t step = cell - htTapeCellTact < value ? cell - htTapeCellTact : value;
    htTapeCellTact += step;
    value -= step;
    if (!htTapeClockSent && htTapeCellTact >= HT_TAPE_CLOCK_EDGE) {
      htTapeClockSent = 1u;
      htCassetteLatch = 1u;
    }
    if (one && !htTapeDataSent && htTapeCellTact >= HT_TAPE_DATA_EDGE) {
      htTapeDataSent = 1u;
      htCassetteLatch = 1u;
    }
    if (htTapeCellTact >= cell) htTapeBitDone(one);
  }
}

/* The next bit for a fast-load trap: the tape moves on by a whole cell */
static inline uint8_t htTapeTakeBit(void) {
  const uint8_t bit = htTapeBitAt(htTapeBitPos);
  htTapeBitDone(bit);
  /* No pause on the fast path: the ROM is not timing anything */
  htTapeGapTacts = 0u;
  return bit;
}

/* `RLA` with the new bit as the incoming carry, as CTBIT ends: S, Z and P/V kept, H and N cleared */
static inline void htTapeShiftIn(uint8_t bit) {
  const uint8_t a = cpu.af.bytes.high;
  const uint8_t result = (uint8_t)((a << 1) | bit);
  cpu.af.bytes.high = result;
  cpu.af.bytes.low = (uint8_t)((cpu.af.bytes.low & 0xc4u) | (result & 0x28u) | (a >> 7));
}

/* Returns from a trapped routine: the address it was called from */
static inline void htTapeReturn(void) {
  const uint8_t low = htPeekMemory(cpu.sp);
  const uint8_t high = htPeekMemory((uint16_t)(cpu.sp + 1u));
  cpu.sp = (uint16_t)(cpu.sp + 2u);
  cpu.pc = (uint16_t)(low | (high << 8));
  cpu.wz.word = cpu.pc;
}

/*
 * At an instruction boundary: SAVE's bookkeeping, and a fast-load or fast-save trap when the PC is at
 * one. Returns 1 when a trap ran the routine (the instruction is skipped).
 */
static uint8_t htTapeTryTrap(void) {
  if (cpu.prefix != PREFIX_NONE) return 0u;
  const uint16_t pc = cpu.pc;
  switch (pc) {
    case HT_ROM_KEY_WAIT_LOOP:
      htKeyWaitLoops++;
      return 0u;
    case HT_ROM_RECORD_START:
      htSaveOpen = 1u;
      htSaveLength = 0u;
      return 0u;
    case HT_ROM_MOTOR_OFF:
      if (htSaveOpen) {
        htSaveOpen = 0u;
        htSavedLength = htSaveLength;
        htSaveRevision++;
      }
      return 0u;
    case HT_ROM_WRITE_BYTE:
      if (htSaveOpen && htSaveLength < HT_SAVE_CAPACITY) htSaveData[htSaveLength++] = cpu.af.bytes.high;
      if (!htTapeFastLoad) return 0u;
      htTapeTraps++;
      htTapeReturn();
      return 1u;
    case HT_ROM_CTBIT:
      if (!htTapeFastLoad || htTapeLength == 0u || htTapeBitPos >= htTapeLength) return 0u;
      htTapeTraps++;
      htTapeShiftIn(htTapeTakeBit());
      htCassetteLatch = 0u;
      htTapeReturn();
      return 1u;
    case HT_ROM_READ_BYTE:
      if (!htTapeFastLoad || htTapeLength == 0u || htTapeLength - htTapeBitPos < 8u) return 0u;
      htTapeTraps++;
      for (uint32_t i = 0u; i < 8u; i++) htTapeShiftIn(htTapeTakeBit());
      htCassetteLatch = 0u;
      htTapeReturn();
      return 1u;
    default:
      return 0u;
  }
}

/* --- The host's side */
uint32_t ht1080zTapeDataPtr(void) { return (uint32_t)(uintptr_t)htTapeData; }
uint32_t ht1080zGetTapeCapacity(void) { return HT_TAPE_CAPACITY; }
/* A new image of `length` bytes is in the buffer: the tape is rewound */
void ht1080zTapeSetLength(uint32_t length) {
  htTapeLength = (length > HT_TAPE_CAPACITY ? HT_TAPE_CAPACITY : length) * 8u;
  htTapeResetPlayback();
}
void ht1080zTapeRewind(void) { htTapeResetPlayback(); }
void ht1080zTapeSetPlaying(uint32_t playing) { htTapePlaying = playing != 0u; }
void ht1080zTapeSetFastLoad(uint32_t on) { htTapeFastLoad = on != 0u; }
void ht1080zTapeSetMotorOverride(uint32_t on) { htTapeMotorOverride = on != 0u; }
uint32_t ht1080zTapeGetMotorOverride(void) { return htTapeMotorOverride; }
uint32_t ht1080zTapeGetPlaying(void) { return htTapePlaying; }
uint32_t ht1080zTapeGetLengthBits(void) { return htTapeLength; }
uint32_t ht1080zTapeGetBitPosition(void) { return htTapeBitPos; }
uint32_t ht1080zTapeGetTraps(void) { return htTapeTraps; }
uint32_t ht1080zTapeGetMotor(void) { return (htPortFf & 0x04u) || htTapeMotorOverride ? 1u : 0u; }
uint32_t ht1080zTapeGetRunning(void) { return htTapeRunning(); }

uint32_t ht1080zTapeSavedDataPtr(void) { return (uint32_t)(uintptr_t)htSaveData; }
uint32_t ht1080zTapeGetSaveCapacity(void) { return HT_SAVE_CAPACITY; }
uint32_t ht1080zTapeGetSavedRevision(void) { return htSaveRevision; }
uint32_t ht1080zTapeGetSavedLength(void) { return htSavedLength; }
uint32_t ht1080zTapeGetSaveOpen(void) { return htSaveOpen; }

uint32_t ht1080zGetKeyWaitLoops(void) { return htKeyWaitLoops; }
