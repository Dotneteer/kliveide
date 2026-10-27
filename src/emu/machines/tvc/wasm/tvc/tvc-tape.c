/*
 * The TVC's cassette (`.plans/VIDEOTON_TVC_PLAN.md` §9; rtvc/info/tvc.md "Cassette Interface" and
 * "CAS Cassette Representation"). The hardware is plain: the ROM does all the coding.
 *
 *   input   port 59h bit 5 (ECIN): the squared tape signal
 *   output  a flip-flop that any access to ports 50h-57h toggles
 *   motor   port 05h bits 7-6: the recorder runs while either is set
 *
 * PLAYING. The host turns a `.cas` file into a tape program (`TvcCasFile.ts`), a list of 32-bit
 * words, so a file of tens of kilobytes needs no sample buffer:
 *
 *   0x0nnnnnnn  silence: n T-states without an edge (the input reads low)
 *   0x4hhhhcccc runs:     cccc full cycles, each a high half and a low half of hhhh T-states
 *   0x8000bbbb  a byte:   eight cycles, LSB first; a 0 bit is 779 + 779 T, a 1 bit 567 + 567 T
 *
 * The tape's time advances with the machine's while the motor runs. It is brought up to date
 * lazily: when the input is read, when the motor changes, at the end of a frame.
 *
 * RECORDING (SAVE). While the motor runs, every toggle of the output ends a half-period. The decoder
 * measures the pilot (a run of equal halves), finds the sync (two halves longer than 1.4 pilot halves)
 * and from the next half on pairs the halves into bits: a cycle longer than 1.03 pilot cycles is a 0,
 * a shorter one a 1. Working on halves keeps the pairing right whatever the signal did before. The thresholds are relative, because the ROM times its cycles with the sound timer: on this
 * core (the first sound interrupt 16 divider periods after a restart, plan Q2) it writes cycles of
 * 1,466 T (pilot), 1,210 T (1), 1,722 T (0) and 2,298 T (sync), where the established converter's
 * are 1,276, 1,134, 1,558 and 2,410 T. Both sit on the same side of every threshold. Bytes go LSB first into the save buffer, each block
 * as a 2-byte length and its bytes, from its first byte after the sync (the 00h before 6Ah
 * included). A pause longer than 4 pilots ends a block. When the motor stops, the blocks are
 * published as a new revision; the host builds the `.cas` from them.
 */

#define TVC_TAPE_CAPACITY 0x20000u
#define TVC_SAVE_CAPACITY 0x18000u
#define TVC_TAPE_OP_SILENCE 0u
#define TVC_TAPE_OP_CYCLES 1u
#define TVC_TAPE_OP_BYTE 2u
#define TVC_TAPE_BIT0_HALF 779u
#define TVC_TAPE_BIT1_HALF 567u

static uint32_t tvcTapeProgram[TVC_TAPE_CAPACITY];
static uint32_t tvcTapeLength;
static uint8_t tvcTapePlaying;
/* The tape's position: the current op, inside it the half-period and its length, and how much is left */
static uint32_t tvcTapeOp;
static uint32_t tvcTapeHalfIndex;
static uint32_t tvcTapeHalfLeft;
static uint8_t tvcTapeLevel;
/* The half-T time the tape was last brought up to date */
static uint32_t tvcTapeLastHalf;

static uint8_t tvcSaveData[TVC_SAVE_CAPACITY];
static uint32_t tvcSaveLength;
static uint32_t tvcSavedLength;
static uint32_t tvcSavedRevision;
/* The decoder: the last toggle's time, the half waiting for its pair, the pilot, the state */
static uint32_t tvcSaveLastToggle;
static uint32_t tvcSavePendingHalf;
static uint32_t tvcSavePilot;
static uint32_t tvcSavePilotRun;
static uint32_t tvcSaveBlockStart;
static uint8_t tvcSaveState;
static uint8_t tvcSaveBits;
static uint8_t tvcSaveBitCount;
static uint8_t tvcSaveHadMotor;
/* Diagnostics (`tvcTapeGetSaveDiagnostic`): toggles seen, cycles decoded, blocks started, the shortest and longest cycle */
static uint32_t tvcSaveDiag[5];
#define TVC_SAVE_IDLE 0u
#define TVC_SAVE_PILOT 1u
#define TVC_SAVE_DATA 2u
#define TVC_SAVE_SYNC 3u

static inline uint8_t tvcTapeMotor(void) { return (tvcPort05 & 0xc0u) != 0u; }

/* The number of half-periods of op `op`, and the length of its half-period `index` */
static uint32_t tvcTapeHalves(uint32_t op) {
  const uint32_t word = tvcTapeProgram[op];
  switch (word >> 30) {
    case TVC_TAPE_OP_SILENCE: return 1u;
    case TVC_TAPE_OP_CYCLES: return (word & 0xffffu) * 2u;
    default: return 16u;
  }
}

static uint32_t tvcTapeHalfLength(uint32_t op, uint32_t index) {
  const uint32_t word = tvcTapeProgram[op];
  switch (word >> 30) {
    case TVC_TAPE_OP_SILENCE: return word & 0x3fffffffu;
    case TVC_TAPE_OP_CYCLES: return (word >> 16) & 0x3fffu;
    default: return ((word >> (index >> 1)) & 1u) ? TVC_TAPE_BIT1_HALF : TVC_TAPE_BIT0_HALF;
  }
}

/* Moves to half-period `index` of op `op` (or the end of the tape) and sets the input's level */
static void tvcTapeEnter(uint32_t op, uint32_t index) {
  while (op < tvcTapeLength && index >= tvcTapeHalves(op)) {
    op++;
    index = 0u;
  }
  tvcTapeOp = op;
  tvcTapeHalfIndex = index;
  if (op >= tvcTapeLength) {
    tvcTapePlaying = 0u;
    tvcTapeLevel = 0u;
    return;
  }
  tvcTapeHalfLeft = tvcTapeHalfLength(op, index);
  // --- Silence reads low; a cycle's first half is high, its second low
  tvcTapeLevel = (tvcTapeProgram[op] >> 30) == TVC_TAPE_OP_SILENCE ? 0u : (uint8_t)((index & 1u) == 0u);
}

/* Brings the tape up to now: it moves only while it plays and the motor runs */
static void tvcTapeUpdate(void) {
  const uint32_t now = tvcHalfClock;
  uint32_t elapsed = (now - tvcTapeLastHalf) >> 1;
  tvcTapeLastHalf += elapsed << 1;
  if (!tvcTapePlaying || !tvcTapeMotor()) return;
  while (elapsed > 0u && tvcTapePlaying) {
    if (elapsed < tvcTapeHalfLeft) {
      tvcTapeHalfLeft -= elapsed;
      return;
    }
    elapsed -= tvcTapeHalfLeft;
    tvcTapeEnter(tvcTapeOp, tvcTapeHalfIndex + 1u);
  }
}

/* Port 59h bit 5 */
static uint8_t tvcTapeInput(void) {
  tvcTapeUpdate();
  return tvcTapeLevel;
}

/* The motor bits change (port 05h): the tape is brought up to now under the old state first */
static void tvcTapeBeforeMotorChange(void) { tvcTapeUpdate(); }

// -----------------------------------------------------------------------------
// Recording
// -----------------------------------------------------------------------------

static void tvcSaveEndBlock(void) {
  if (tvcSaveState == TVC_SAVE_DATA) {
    const uint32_t length = tvcSaveLength - tvcSaveBlockStart - 2u;
    tvcSaveData[tvcSaveBlockStart] = (uint8_t)length;
    tvcSaveData[tvcSaveBlockStart + 1u] = (uint8_t)(length >> 8);
  }
  tvcSaveState = TVC_SAVE_IDLE;
  tvcSavePilotRun = 0u;
  tvcSavePilot = 0u;
  tvcSavePendingHalf = 0u;
}

/* One half-period of `half` T-states from the output */
static void tvcSaveHalf(uint32_t half) {
  tvcSaveDiag[1]++;
  if (tvcSaveDiag[3] == 0u || half < tvcSaveDiag[3]) tvcSaveDiag[3] = half;
  if (half > tvcSaveDiag[4]) tvcSaveDiag[4] = half;
  switch (tvcSaveState) {
    case TVC_SAVE_IDLE:
    case TVC_SAVE_PILOT:
      // --- The pilot: a run of halves within 1/8 of each other; a half over 1.4 pilots is the sync's first
      if (tvcSavePilotRun >= 128u && half * 10u > tvcSavePilot * 14u) {
        tvcSaveState = TVC_SAVE_SYNC;
        return;
      }
      if (tvcSavePilotRun > 0u && half * 8u > tvcSavePilot * 7u && half * 8u < tvcSavePilot * 9u) {
        tvcSavePilot = (tvcSavePilot * 15u + half) / 16u;
        tvcSavePilotRun++;
      } else {
        tvcSavePilot = half;
        tvcSavePilotRun = 1u;
      }
      tvcSaveState = TVC_SAVE_PILOT;
      return;
    case TVC_SAVE_SYNC:
      // --- The sync's second half: the block starts with the next cycle
      if (tvcSaveLength + 2u >= TVC_SAVE_CAPACITY) {
        tvcSaveState = TVC_SAVE_IDLE;
        return;
      }
      tvcSaveBlockStart = tvcSaveLength;
      tvcSaveLength += 2u;
      tvcSaveBits = 0u;
      tvcSaveBitCount = 0u;
      tvcSavePendingHalf = 0u;
      tvcSaveState = TVC_SAVE_DATA;
      tvcSaveDiag[2]++;
      return;
    default:
      if (tvcSavePendingHalf == 0u) {
        tvcSavePendingHalf = half;
        return;
      }
      // --- A cycle longer than 1.03 pilot cycles is a 0
      const uint32_t cycle = tvcSavePendingHalf + half;
      tvcSavePendingHalf = 0u;
      tvcSaveBits |= (uint8_t)((cycle * 100u < tvcSavePilot * 206u ? 1u : 0u) << tvcSaveBitCount);
      if (++tvcSaveBitCount == 8u) {
        if (tvcSaveLength < TVC_SAVE_CAPACITY) tvcSaveData[tvcSaveLength++] = tvcSaveBits;
        tvcSaveBits = 0u;
        tvcSaveBitCount = 0u;
      }
      return;
  }
}

/* An access to 50h-57h toggles the output: while the motor runs, it ends a half-period */
static void tvcTapeOutputToggle(void) {
  if (!tvcTapeMotor()) return;
  const uint32_t now = tvcHalfClock;
  const uint32_t half = (now - tvcSaveLastToggle) >> 1;
  tvcSaveLastToggle = now;
  tvcSaveHadMotor = 1u;
  tvcSaveDiag[0]++;
  // --- A pause (no edge for 8,000 T or 4 pilot halves) ends a block; the toggle after it starts a new half
  if (half > 8000u || (tvcSavePilot != 0u && half > tvcSavePilot * 4u)) {
    tvcSaveEndBlock();
    return;
  }
  tvcSaveHalf(half);
}

/*
 * The motor stops: an unfinished block ends. The ROM stops the motor between a file's header and its
 * data, so the recording is published only once it ends with a data block (00h 6Ah 00h): a header
 * waits for its data.
 */
static void tvcTapeAfterMotorChange(void) {
  if (tvcTapeMotor() || !tvcSaveHadMotor) return;
  tvcSaveHadMotor = 0u;
  const uint32_t lastBlock = tvcSaveBlockStart;
  const uint8_t ended = tvcSaveState == TVC_SAVE_DATA;
  tvcSaveEndBlock();
  if (ended && tvcSaveLength >= lastBlock + 5u && tvcSaveData[lastBlock + 2u] == 0x00u && tvcSaveData[lastBlock + 3u] == 0x6au &&
      tvcSaveData[lastBlock + 4u] == 0x00u) {
    tvcSavedLength = tvcSaveLength;
    tvcSavedRevision++;
    tvcSaveLength = 0u;
  }
}

static void tvcTapeReset(void) {
  tvcTapeLastHalf = tvcHalfClock;
  tvcTapePlaying = tvcTapeLength > 0u;
  tvcTapeEnter(0u, 0u);
  tvcSaveLength = 0u;
  tvcSavePilot = 0u;
  tvcSavePilotRun = 0u;
  tvcSavePendingHalf = 0u;
  tvcSaveState = TVC_SAVE_IDLE;
  tvcSaveHadMotor = 0u;
  tvcSaveLastToggle = tvcHalfClock;
}

uint32_t tvcTapeProgramPtr(void) { return (uint32_t)(uintptr_t)tvcTapeProgram; }
uint32_t tvcGetTapeCapacity(void) { return TVC_TAPE_CAPACITY; }
/* A new tape of `words` program words (0 empties the deck), rewound */
void tvcTapeSetLength(uint32_t words) {
  tvcTapeLength = words > TVC_TAPE_CAPACITY ? TVC_TAPE_CAPACITY : words;
  tvcTapeLastHalf = tvcHalfClock;
  tvcTapePlaying = tvcTapeLength > 0u;
  tvcTapeEnter(0u, 0u);
}
void tvcTapeRewind(void) {
  tvcTapeLastHalf = tvcHalfClock;
  tvcTapePlaying = tvcTapeLength > 0u;
  tvcTapeEnter(0u, 0u);
}
uint32_t tvcTapeGetPlaying(void) { return tvcTapePlaying; }
uint32_t tvcTapeGetMotor(void) { return tvcTapeMotor(); }
uint32_t tvcTapeGetPosition(void) { return tvcTapeOp; }
uint32_t tvcTapeSavedDataPtr(void) { return (uint32_t)(uintptr_t)tvcSaveData; }
uint32_t tvcTapeGetSaveCapacity(void) { return TVC_SAVE_CAPACITY; }
uint32_t tvcTapeGetSavedLength(void) { return tvcSavedLength; }
uint32_t tvcTapeGetSavedRevision(void) { return tvcSavedRevision; }
/* The SAVE decoder's diagnostics: 0 toggles, 1 cycles, 2 blocks, 3 shortest and 4 longest cycle (T), 5 the pilot */
uint32_t tvcTapeGetSaveDiagnostic(uint32_t index) { return index < 5u ? tvcSaveDiag[index] : tvcSavePilot; }
