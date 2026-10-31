/*
 * The Enterprise's cassette (plan §9.3; DAVE_MEMORY_IO.md §6.1, §6.3, §7.2-§7.4). The hardware is plain:
 * EXOS does all the coding.
 *
 *   input   port B6h bit 7, the data comparator, and bit 6, the level comparator: both read 1 with no
 *           signal (the input low), 0 while the signal is high
 *   output  DAVE's left output: EXOS writes the waveform through the left D/A (A7h bit 3 set, the level
 *           in A8h)
 *   motor   port B5h bit 6 (REM1) or bit 7 (REM2): the recorder runs while either is set
 *
 * PLAYING. The host turns a tape file into a tape program (`EpTapeFile.ts`), a list of 32-bit words, so
 * a file of tens of kilobytes needs no sample buffer. Every half-period starts with an edge (the level
 * toggles); the level is low when the tape starts.
 *
 *   0x0nnnnnnn  silence: n T-states without an edge (the level holds)
 *   0x4hhhhcccc halves:  cccc half-periods of hhhh T-states each
 *   0x80000sbb  a byte:  eight full cycles, LSB first, at EXOS's fast timings (s = 0: a 1 is 688 + 688 T,
 *                        a 0 1008 + 1008 T) or its slow ones (s = 1: 1600 + 1600 and 2400 + 2400 T)
 *   0xCnnnnnnn  an edge, then n T-states without one (a long half-period of a recorded signal)
 *
 * The tape's time advances with the machine's while the motor runs. It is brought up to date lazily:
 * when the input is read, when the motor changes, when the host asks.
 *
 * RECORDING (SAVE). While a motor runs, every change of the left output's level (high: D/A mode with a
 * nonzero A8h) ends a half-period; its length goes into a ring of bytes in units of 16 T (1-254; 255 is
 * anything longer). A motor stopping after a run with edges writes 0, the end of a chunk. The host reads
 * the ring as it grows (`epTapeGetSavedLength` counts every byte ever written), decodes the chunks and
 * publishes a file once it is whole; the core writes nothing back, so nothing here is volatile.
 */

#define EP_TAPE_CAPACITY 0x40000u
#define EP_SAVE_CAPACITY 0x10000u
#define EP_TAPE_OP_SILENCE 0u
#define EP_TAPE_OP_HALVES 1u
#define EP_TAPE_OP_BYTE 2u
#define EP_TAPE_OP_EDGE 3u
/* EXOS's bit half-periods (DAVE_MEMORY_IO.md §7.4): fast 344 / 504 us, slow 800 / 1200 us per cycle */
#define EP_TAPE_FAST_BIT1_HALF 688u
#define EP_TAPE_FAST_BIT0_HALF 1008u
#define EP_TAPE_SLOW_BIT1_HALF 1600u
#define EP_TAPE_SLOW_BIT0_HALF 2400u
/* The recording's unit: 16 T-states */
#define EP_SAVE_UNIT_SHIFT 4u

static uint32_t epTapeProgram[EP_TAPE_CAPACITY];
static uint32_t epTapeLength;
static uint8_t epTapePlaying;
/* The tape's position: the current op, inside it the half-period and how much of it is left */
static uint32_t epTapeOp;
static uint32_t epTapeHalfIndex;
static uint32_t epTapeHalfLeft;
static uint8_t epTapeLevel;
/* The half-T time the tape was last brought up to date */
static uint32_t epTapeLastHalf;

/* The recording: a ring of half-periods, every byte ever written counted, the motor stops counted */
static uint8_t epSaveRing[EP_SAVE_CAPACITY];
static uint32_t epSaveCount;
static uint32_t epSaveChunks;
static uint32_t epSaveLastEdge;
static uint8_t epSaveLevel;
static uint8_t epSaveHadEdge;
static uint8_t epSaveMotor;

static inline uint8_t epTapeMotor(void) { return (epPortB5 & 0xc0u) != 0u; }

/* The number of half-periods of op `op`, and the length of its half-period `index` */
static uint32_t epTapeHalves(uint32_t op) {
  const uint32_t word = epTapeProgram[op];
  switch (word >> 30) {
    case EP_TAPE_OP_HALVES: return word & 0xffffu;
    case EP_TAPE_OP_BYTE: return 16u;
    default: return 1u;
  }
}

static uint32_t epTapeHalfLength(uint32_t op, uint32_t index) {
  const uint32_t word = epTapeProgram[op];
  switch (word >> 30) {
    case EP_TAPE_OP_HALVES: return (word >> 16) & 0x3fffu;
    case EP_TAPE_OP_BYTE: {
      const uint32_t one = (word >> (index >> 1)) & 1u;
      if (word & 0x100u) return one ? EP_TAPE_SLOW_BIT1_HALF : EP_TAPE_SLOW_BIT0_HALF;
      return one ? EP_TAPE_FAST_BIT1_HALF : EP_TAPE_FAST_BIT0_HALF;
    }
    default: return word & 0x3fffffffu;
  }
}

/* Moves to half-period `index` of op `op` (or the end of the tape); an op other than silence starts with an edge */
static void epTapeEnter(uint32_t op, uint32_t index) {
  while (op < epTapeLength && index >= epTapeHalves(op)) {
    op++;
    index = 0u;
  }
  epTapeOp = op;
  epTapeHalfIndex = index;
  if (op >= epTapeLength) {
    epTapePlaying = 0u;
    epTapeLevel = 0u;
    return;
  }
  epTapeHalfLeft = epTapeHalfLength(op, index);
  if ((epTapeProgram[op] >> 30) != EP_TAPE_OP_SILENCE) epTapeLevel ^= 1u;
  if (epTapeHalfLeft == 0u) epTapeHalfLeft = 1u;
}

/* Brings the tape up to now: it moves only while it plays and the motor runs */
static void epTapeUpdate(void) {
  const uint32_t now = epHalfClock;
  uint32_t elapsed = (now - epTapeLastHalf) >> 1;
  epTapeLastHalf += elapsed << 1;
  if (!epTapePlaying || !epTapeMotor()) return;
  while (elapsed > 0u && epTapePlaying) {
    if (elapsed < epTapeHalfLeft) {
      epTapeHalfLeft -= elapsed;
      return;
    }
    elapsed -= epTapeHalfLeft;
    epTapeEnter(epTapeOp, epTapeHalfIndex + 1u);
  }
}

/* B6h bits 7-6: the data and level comparators, both 1 while the input is low */
static uint8_t epTapeInputBits(void) {
  epTapeUpdate();
  return epTapeLevel ? 0x00u : 0xc0u;
}

// -----------------------------------------------------------------------------
// Recording
// -----------------------------------------------------------------------------

static inline void epSaveWrite(uint8_t value) {
  epSaveRing[epSaveCount & (EP_SAVE_CAPACITY - 1u)] = value;
  epSaveCount++;
}

/* The left output's level as the tape sees it: high while the left D/A outputs a nonzero level */
static inline uint8_t epSaveOutputLevel(void) { return (epDaveReg[7] & 0x08u) != 0u && (epDaveReg[8] & 0x3fu) != 0u; }

/* A write to A7h or A8h: while a motor runs, a change of the output's level ends a half-period */
static void epTapeAfterDaveWrite(void) {
  const uint8_t level = epSaveOutputLevel();
  if (level == epSaveLevel) return;
  epSaveLevel = level;
  if (!epSaveMotor) return;
  const uint32_t now = epHalfClock;
  const uint32_t units = ((now - epSaveLastEdge) >> 1) >> EP_SAVE_UNIT_SHIFT;
  epSaveLastEdge = now;
  // --- The first edge of a run starts its first half-period
  if (!epSaveHadEdge) {
    epSaveHadEdge = 1u;
    return;
  }
  epSaveWrite(units == 0u ? 1u : units > 254u ? 255u : (uint8_t)units);
}

/* The motor bits change (B5h): the tape is brought up to now under the old state first */
static void epTapeBeforeMotorChange(void) { epTapeUpdate(); }

/* After the change: a motor starting begins a recording run, one stopping ends a chunk */
static void epTapeAfterMotorChange(void) {
  const uint8_t motor = epTapeMotor();
  if (motor == epSaveMotor) return;
  epSaveMotor = motor;
  if (motor) {
    epSaveHadEdge = 0u;
    epSaveLastEdge = epHalfClock;
    return;
  }
  if (epSaveHadEdge) {
    epSaveWrite(0u);
    epSaveChunks++;
  }
  epSaveHadEdge = 0u;
}

static void epTapeReset(void) {
  epTapeLastHalf = epHalfClock;
  epTapeLevel = 0u;
  epTapePlaying = epTapeLength > 0u;
  epTapeEnter(0u, 0u);
  epSaveLevel = 0u;
  epSaveHadEdge = 0u;
  epSaveMotor = 0u;
  epSaveLastEdge = epHalfClock;
}

uint32_t epTapeProgramPtr(void) { return (uint32_t)(uintptr_t)epTapeProgram; }
uint32_t epGetTapeCapacity(void) { return EP_TAPE_CAPACITY; }
/* A new tape of `words` program words (0 empties the deck), rewound */
void epTapeSetLength(uint32_t words) {
  epTapeLength = words > EP_TAPE_CAPACITY ? EP_TAPE_CAPACITY : words;
  epTapeLastHalf = epHalfClock;
  epTapeLevel = 0u;
  epTapePlaying = epTapeLength > 0u;
  epTapeEnter(0u, 0u);
}
void epTapeRewind(void) { epTapeSetLength(epTapeLength); }
uint32_t epTapeGetPlaying(void) { return epTapePlaying; }
uint32_t epTapeGetMotor(void) { return epTapeMotor(); }
uint32_t epTapeGetPosition(void) { return epTapeOp; }
/* The input's level as the tape last left it (1 high), without bringing the tape up to date */
uint32_t epTapeGetLevel(void) { return epTapeLevel; }
uint32_t epTapeSavedDataPtr(void) { return (uint32_t)(uintptr_t)epSaveRing; }
uint32_t epTapeGetSaveCapacity(void) { return EP_SAVE_CAPACITY; }
/* Every byte the recording has written (the ring holds the last `epTapeGetSaveCapacity`) */
uint32_t epTapeGetSavedLength(void) { return epSaveCount; }
/* The chunks recorded: motor stops after a run with edges */
uint32_t epTapeGetSavedRevision(void) { return epSaveChunks; }
