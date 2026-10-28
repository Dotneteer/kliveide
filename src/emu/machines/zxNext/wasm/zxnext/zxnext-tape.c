#include "zxnext-tape.h"

/*
 * The ZX Spectrum Next's tape (`.plans/NEXT_TAPE_PLAN.md`).
 *
 * The player is the Spectrum cores' (`zx-spectrum-tape.c`): TAP/TZX blocks played while the ROM's
 * LD-BYTES runs, fast load by trapping it, SA-BYTES captured into a saved TZX. Its names stay its own
 * (`sp48*`): nothing else in this core uses them, and the exports below give them the Next's names.
 * What differs from a Spectrum:
 *
 * - **Time is real time.** The player measures pulses in 3.5 MHz T-states; here those are the 28 MHz
 *   master clock divided by 8, so a pulse keeps its length at any CPU speed and real-time loading
 *   fails above 3.5 MHz, as on the machine (the ROM's timing loops run faster than the tape).
 * - **The trap holds only while ROM 3 is what the CPU reads at $0000-$1FFF**: not the DivMMC or
 *   Multiface overlay (NextZXOS's own tape-from-SD support traps there first), not Layer 2, not RAM,
 *   not the Alt ROM. ROM 3 of `enNextZX.rom` has the 48K ROM's LD-BYTES byte for byte ($0556-$0604)
 *   and SA-BYTES at $04C2.
 * - **The player's level is the EAR socket, and the machine sees it through its input stage**
 *   (zxnext_top_issue4.vhd ~620-690): a debounce on the 1.75 MHz enable (the level must hold for two
 *   enables, so pulses under about 1.14 µs are lost), then a relaxation that turns a level held at 1
 *   into 0 after 64 enables of 512 clocks (about 1.15 ms). Idle, the result is 0. That *conditioned
 *   input* reaches port $FE bit 6 (XOR the Pi's EAR bit, ~3456) and the mixer's MIC line (XOR, ~6449).
 *
 * The input stage is stepped lazily, one 1.75 MHz enable at a time, up to the moment something reads it
 * (an instruction, a port read, an audio sample); while no tape plays and it has settled, it jumps.
 */

// ----------------------------------------------------------------------------
// The player's declarations, as a Spectrum core gives them (sp48.c)

#define SP48_TAPE_MAX_BLOCKS 512u
/* Smaller than a Spectrum's 4 MB / 1 MB: the core's memory is what every checkpoint copies (plan D3);
   the tape data is volatile in the build (left out of states: the inserted tape is media) */
#define SP48_TAPE_DATA_CAPACITY 0x100000u
#define SP48_TAPE_FILENAME_CAPACITY 260u
#define SP48_TAPE_SAVE_MAX_BLOCKS 64u
#define SP48_TAPE_SAVE_DATA_CAPACITY 0x40000u
#define SP48_TAPE_HEADER_PILOT_COUNT 8063u
#define SP48_TAPE_DATA_PILOT_COUNT 3223u
#define SP48_TAPE_MIN_SAVE_PILOT_PULSE_COUNT 3000u
#define SP48_TAPE_SAVE_PULSE_TOLERANCE 24u
#define SP48_TAPE_TOO_LONG_SAVE_PAUSE 3500000u
#define SP48_TAPE_PILOT_PULSE_LENGTH 2168u
#define SP48_TAPE_SYNC1_PULSE_LENGTH 667u
#define SP48_TAPE_SYNC2_PULSE_LENGTH 735u
#define SP48_TAPE_BIT0_PULSE_LENGTH 855u
#define SP48_TAPE_BIT1_PULSE_LENGTH 1710u
#define SP48_TAPE_TERM_SYNC_PULSE_LENGTH 947u
#define SP48_TAPE_LOAD_BYTES_ROUTINE 0x056cu
#define SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE 0x05b6u
#define SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE 0x05e2u
#define SP48_TAPE_SAVE_BYTES_ROUTINE 0x04c2u
#define SP48_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW 0x00000004u
#define SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW 0x00000008u
#define SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE 0x00000010u
#define SP48_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW 0x00000040u
#define SP48_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW 0x00000080u
#define SP48_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE 0x00000100u
#define SP48_TAPE_MODE_PASSIVE ZXNEXT_TAPE_MODE_PASSIVE
#define SP48_TAPE_MODE_LOAD ZXNEXT_TAPE_MODE_LOAD
#define SP48_TAPE_MODE_SAVE ZXNEXT_TAPE_MODE_SAVE
#define SP48_TAPE_PHASE_NONE 0u
#define SP48_TAPE_PHASE_PILOT 1u
#define SP48_TAPE_PHASE_SYNC 2u
#define SP48_TAPE_PHASE_DATA 3u
#define SP48_TAPE_PHASE_TERM_SYNC 4u
#define SP48_TAPE_PHASE_PAUSE 5u
#define SP48_TAPE_PHASE_COMPLETED 6u
#define SP48_TAPE_SAVE_PHASE_NONE 0u
#define SP48_TAPE_SAVE_PHASE_PILOT 1u
#define SP48_TAPE_SAVE_PHASE_SYNC1 2u
#define SP48_TAPE_SAVE_PHASE_SYNC2 3u
#define SP48_TAPE_SAVE_PHASE_DATA 4u
#define SP48_TAPE_SAVE_PHASE_ERROR 5u
#define SP48_TAPE_MIC_PULSE_NONE 0u
#define SP48_TAPE_MIC_PULSE_TOO_SHORT 1u
#define SP48_TAPE_MIC_PULSE_TOO_LONG 2u
#define SP48_TAPE_MIC_PULSE_PILOT 3u
#define SP48_TAPE_MIC_PULSE_SYNC1 4u
#define SP48_TAPE_MIC_PULSE_SYNC2 5u
#define SP48_TAPE_MIC_PULSE_BIT0 6u
#define SP48_TAPE_MIC_PULSE_BIT1 7u
#define SP48_TAPE_MIC_PULSE_TERM_SYNC 8u

typedef struct Sp48TapeBlock {
  uint32_t offset;
  uint32_t length;
  uint32_t pauseAfter;
  uint32_t pilotPulseLength;
  uint32_t sync1PulseLength;
  uint32_t sync2PulseLength;
  uint32_t zeroBitPulseLength;
  uint32_t oneBitPulseLength;
  uint32_t endSyncPulseLength;
  uint8_t lastByteUsedBits;
  uint32_t pilotPulseCount;
} Sp48TapeBlock;

typedef struct Sp48SavedTapeBlock {
  uint32_t offset;
  uint32_t length;
} Sp48SavedTapeBlock;

static Sp48TapeBlock sp48TapeBlocks[SP48_TAPE_MAX_BLOCKS];
static Sp48SavedTapeBlock sp48SavedTapeBlocks[SP48_TAPE_SAVE_MAX_BLOCKS];
static uint8_t sp48TapeData[SP48_TAPE_DATA_CAPACITY];
static uint8_t sp48TapeFileName[SP48_TAPE_FILENAME_CAPACITY];
static uint8_t sp48TapeSaveData[SP48_TAPE_SAVE_DATA_CAPACITY];
static uint32_t sp48TapeBlockCount;
static uint32_t sp48TapeDataLength;
static uint32_t sp48TapeCurrentBlockIndex;
static uint32_t sp48TapeUploadBlockCount;
static uint32_t sp48TapeUploadDataLength;
static uint8_t sp48TapeUploadActive;
static uint8_t sp48TapeLoaded;
static uint8_t sp48TapeEof;
static uint8_t sp48TapeMode;
static uint8_t sp48TapePlayPhase;
static uint32_t sp48TapeStartTact;
static uint32_t sp48TapePilotEndPos;
static uint32_t sp48TapeSync1EndPos;
static uint32_t sp48TapeSync2EndPos;
static uint32_t sp48TapeBitStartPos;
static uint32_t sp48TapeBitPulseLength;
static uint32_t sp48TapeDataIndex;
static uint8_t sp48TapeBitMask;
static uint32_t sp48TapeTermEndPos;
static uint32_t sp48TapePauseEndPos;
static uint8_t sp48TapeEarBit;
static uint32_t sp48TapeModeChangeCount;
static uint32_t sp48TapeLastModeChangeTact;
static uint32_t sp48TapeLastModeChangePc;
static uint32_t sp48TapeLoadStartCount;
static uint32_t sp48TapeSaveStartCount;
static uint8_t sp48TapeFastLoad = 1u;
static uint8_t sp48TapeSaveMicBit;
static uint8_t sp48TapeSavePhase;
static uint8_t sp48TapeSavePreviousDataPulse;
static uint8_t sp48TapeSaveLastPulse;
static uint8_t sp48TapeSaveBitOffset;
static uint8_t sp48TapeSaveDataByte;
static uint32_t sp48TapeSaveLastMicBitTact;
static uint32_t sp48TapeSavePilotPulseCount;
static uint32_t sp48TapeSavedBlockCount;
static uint32_t sp48TapeSavedDataLength;
static uint32_t sp48TapeSavedRevision;
static uint32_t sp48TapeSaveCurrentBlockOffset;
static uint32_t sp48TapeSaveCurrentBlockLength;
static uint32_t sp48DiagnosticFlags;

// --- The host the player expects
/* The player's "now", in 3.5 MHz T-states of real time: set before every call into it */
static uint32_t zxnextTapeNowTacts;
#define sp48Tacts zxnextTapeNowTacts
#define sp48BaseClockFrequency 3500000u
#define sp48CpuReadMemory(address) zxnextMemoryReadMapped(address)
#define sp48CpuWriteMemory(address, value) zxnextMemoryWriteMapped((address), (value))
/* The player's own EAR level is the socket; the input stage below takes it from there */
static uint8_t zxnextTapeUnusedMicBit;
static uint8_t zxnextTapeUnusedBeeperLevel;
#define sp48MicBit zxnextTapeUnusedMicBit
#define sp48BeeperLevel zxnextTapeUnusedBeeperLevel
#define recordAudioTransition(tact, ear, mic) ((void)0)
static uint32_t zxnextTapeTrapActive(void);
#define SP48_TAPE_TRAP_ACTIVE() zxnextTapeTrapActive()

#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"

// ----------------------------------------------------------------------------
// Time and the trap

static ZxNextClock28 zxnextTapeClock;

/* The 28 MHz clock now */
static inline uint64_t zxnextTapeClockNow(void) { return zxnextClock28Now(&zxnextTapeClock); }

/* The trap only where the CPU reads ROM 3 at $0000-$1FFF: no overlay, no Layer 2 mapping */
static uint32_t zxnextTapeTrapActive(void) {
  if (zxnextMemoryLowOverlayActive()) return 0u;
  if (zxnextMemoryResolveLayer2Offset(SP48_TAPE_LOAD_BYTES_ROUTINE, 0u) != ZXNEXT_NO_WRITE_OFFSET) return 0u;
  return zxnextMemoryResolveReadOffset(0u) == ZXNEXT_OFFS_NEXT_ROM + 3u * 0x4000u;
}

// ----------------------------------------------------------------------------
// The input stage

#define ZXNEXT_TAPE_DEBOUNCE_PERIOD 16u   /* CLK_28_PSG_EN: 1.75 MHz */
#define ZXNEXT_TAPE_RELAX_PERIOD 512u     /* CLK_28_MEMBRANE_EN: every 512 clocks */
#define ZXNEXT_TAPE_RELAX_COUNT 64u       /* COUNTER_SIZE 6: 64 enables, about 1.15 ms */

/* The next 1.75 MHz enable not processed yet (a 28 MHz clock where clock % 16 == 15) */
static uint64_t zxnextTapeInputNextTick;
/* The socket's level at the previous enable, the debounce's count (0-2) and its output */
static uint8_t zxnextTapeInputRawPrev;
static uint8_t zxnextTapeInputStable;
static uint8_t zxnextTapeInputDebounced;
/* The relaxation's count of membrane enables with the debounced level at 1 (0-64), and the result */
static uint8_t zxnextTapeInputRelax;
static uint8_t zxnextTapeInput;

/* The socket's level at the player's current time: the player while the ROM loads, 0 otherwise */
static inline uint8_t zxnextTapeSocketLevel(void) {
  return sp48TapeMode == SP48_TAPE_MODE_LOAD ? sp48TapeGetEarBitInternal() : 0u;
}

/* The time `t` (28 MHz) in the beeper's CPU tacts, counted back from `now` (as the Pi's receiver) */
static inline double zxnextTapeBeeperTact(uint64_t t, uint64_t now) {
  const double tactScale = cpuTactScale == 0u ? 1.0 : (double)cpuTactScale;
  return (double)zxnextBeeperTacts - (double)(now - t) / tactScale;
}

static inline uint64_t zxnextTapeFirstTickAfter(uint64_t clock) {
  return clock - (clock % ZXNEXT_TAPE_DEBOUNCE_PERIOD) + (ZXNEXT_TAPE_DEBOUNCE_PERIOD - 1u);
}

/* Steps the input stage through every 1.75 MHz enable up to `now` */
static void zxnextTapeInputSync(uint64_t now) {
  if (zxnextTapeInputNextTick > now) return;
  const uint8_t loading = sp48TapeMode == SP48_TAPE_MODE_LOAD;
  if (!loading && zxnextTapeInputRawPrev == 0u && zxnextTapeInputDebounced == 0u && zxnextTapeInput == 0u) {
    /* Settled at rest: nothing can change until a tape plays */
    zxnextTapeInputNextTick = zxnextTapeFirstTickAfter(now + 1u);
    return;
  }
  while (zxnextTapeInputNextTick <= now) {
    const uint64_t t = zxnextTapeInputNextTick;
    zxnextTapeNowTacts = (uint32_t)(t >> 3u);
    const uint8_t raw = zxnextTapeSocketLevel();
    /* debounce.vhd: a change restarts the count; two enables without one hand the level over */
    if (raw != zxnextTapeInputRawPrev) {
      zxnextTapeInputStable = 1u;
    } else if (zxnextTapeInputStable < 2u) {
      zxnextTapeInputStable++;
    }
    if (zxnextTapeInputStable >= 2u) zxnextTapeInputDebounced = raw;
    zxnextTapeInputRawPrev = raw;
    /* relaxation.vhd: the count runs on the membrane enable while the level is 1, clears at 0 */
    if (zxnextTapeInputDebounced == 0u) {
      zxnextTapeInputRelax = 0u;
    } else if ((t % ZXNEXT_TAPE_RELAX_PERIOD) == ZXNEXT_TAPE_RELAX_PERIOD - 1u &&
               zxnextTapeInputRelax < ZXNEXT_TAPE_RELAX_COUNT) {
      zxnextTapeInputRelax++;
    }
    const uint8_t input = zxnextTapeInputDebounced != 0u && zxnextTapeInputRelax < ZXNEXT_TAPE_RELAX_COUNT;
    if (input != zxnextTapeInput) {
      zxnextTapeInput = input;
      zxnextBeeperSetTapeEarAt(input, zxnextTapeBeeperTact(t, now));
    }
    zxnextTapeInputNextTick += ZXNEXT_TAPE_DEBOUNCE_PERIOD;
    if (!loading && raw == 0u && zxnextTapeInputDebounced == 0u && zxnextTapeInput == 0u) {
      zxnextTapeInputNextTick = zxnextTapeFirstTickAfter(now + 1u);
      break;
    }
  }
}

/* The conditioned tape input now (port $FE bit 6, the MIC line) */
static uint32_t zxnextTapeGetInput(void) {
  zxnextTapeInputSync(zxnextTapeClockNow());
  return zxnextTapeInput;
}

/* Before each instruction: the input stage up to now, then the player's trap and mode at now */
static void zxnextTapeBeforeInstruction(void) {
  const uint64_t now = zxnextTapeClockNow();
  zxnextTapeInputSync(now);
  zxnextTapeNowTacts = (uint32_t)(now >> 3u);
  updateTapeMode();
}

// ----------------------------------------------------------------------------
// The core's tape API

static void zxnextTapeReset(void) {
  zxnextTapeNowTacts = (uint32_t)(zxnextTapeClockNow() >> 3u);
  /* A reset rewinds the tape but keeps it in the deck */
  resetTapePlayback();
  resetTapeSaveCapture();
  zxnextTapeInputNextTick = ZXNEXT_TAPE_DEBOUNCE_PERIOD - 1u; /* the first enable: clock 15 */
  zxnextTapeInputRawPrev = 0u;
  zxnextTapeInputStable = 2u;
  zxnextTapeInputDebounced = 0u;
  zxnextTapeInputRelax = 0u;
  zxnextTapeInput = 0u;
}

static void zxnextTapeSetMode(uint32_t mode) {
  zxnextTapeNowTacts = (uint32_t)(zxnextTapeClockNow() >> 3u);
  sp48TapeSetMode(mode);
}

static uint32_t zxnextTapeGetMode(void) { return sp48TapeMode; }

/* The player's level at the socket, as the IDE reads it */
static uint32_t zxnextTapeGetEarBit(void) { return sp48TapeEarBit; }

static uint32_t zxnextTapeGetMicBit(void) { return sp48TapeSaveMicBit; }

/* Port $FE bit 3 written: the SAVE capture's MIC line */
static void zxnextTapeProcessMicBit(uint32_t value) {
  zxnextTapeNowTacts = (uint32_t)(zxnextTapeClockNow() >> 3u);
  sp48TapeProcessMicBit(value);
}
