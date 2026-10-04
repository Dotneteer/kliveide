/*
 * RZX input recording: the fetch counter, the IN tap, and the playback interrupt rule
 * (`.plans/RZX_PLAN.md` §4.2, D4, D7, D8, D9).
 *
 * Shared by the 48K, 128K and +2E/+3E cores. Each core:
 *  - declares `rzxCountFetch` and `rzxIntAck` and maps `Z80_REFRESH` / `Z80_INT_ACK` to them before it
 *    includes z80.c;
 *  - defines `RZX_CORE_PREFIX` (sp48, sp128, spp3e) and includes this file right after z80.c, so the
 *    exports get the core's prefix (`sp48RzxSetMode`, ...);
 *  - taps its CPU port-read wrapper (never the exported port read the debugger uses, D7);
 *  - in PLAY, runs its instruction step through `rzxPlayBeforeStep` and completes a picture at
 *    each boundary of a frame longer than RZX_SHORT_FRAME_FETCHES (trap 5, D19);
 *  - in RECORD, closes a frame at each ULA frame end once the CPU stands at an instruction boundary.
 *
 * The fetch counter (D4) counts every `Z80_REFRESH`: one per M1, so an unprefixed opcode adds 1, a
 * CB/ED/DD/FD instruction 2, DDCB/FDCB 2 (the displacement and last byte are plain reads), every
 * chained DD/FD prefix 1 more, and every HALTed cycle 1. The INT acknowledge also refreshes, but the
 * format excludes it, so `rzxIntAck` takes it back; the NMI acknowledge stays counted. The counter is
 * not R: `LD R,A` does not touch it.
 *
 * Machine state for a Klive state file? No: these statics are listed as volatile by each core's
 * build script, so a state restore never brings back a half-played recording.
 */

#ifndef RZX_CORE_PREFIX
#error "Define RZX_CORE_PREFIX before including zx-spectrum-rzx.c"
#endif

#define RZX_PASTE2(a, b) a##b
#define RZX_PASTE(a, b) RZX_PASTE2(a, b)
#define RZX_EXPORT(name) RZX_PASTE(RZX_CORE_PREFIX, name)

#define RZX_MODE_OFF 0u
#define RZX_MODE_PLAY 1u
#define RZX_MODE_RECORD 2u

#define RZX_STATUS_OK 0u
/* The frame's fetch count is reached: the host supplies the next frame */
#define RZX_STATUS_FRAME_DONE 1u
/* The program read more INs than the frame recorded */
#define RZX_STATUS_DESYNC_OVER 2u
/* The frame ended with recorded INs left unread */
#define RZX_STATUS_DESYNC_UNDER 3u

/* A frame of at most this many fetches is an EI or retrigger frame (D8, D19) */
#define RZX_SHORT_FRAME_FETCHES 4u

/* The most INs one frame can hold in the format */
#define RZX_PLAY_BUFFER_CAPACITY 0x10000u
/* Two ULA frames of worst-case INs (a tape loader reads about 6,000 a frame, trap 9) */
#define RZX_REC_BUFFER_CAPACITY 0x4000u
/* Closed frames the host has not drained yet: a ULA frame plus its retrigger frames */
#define RZX_REC_FRAME_CAPACITY 64u

/* What `rzxPlayBeforeStep` tells the core to do */
#define RZX_STEP_NONE 0u
#define RZX_STEP_RUN 1u
#define RZX_STEP_RUN_INT 2u
#define RZX_STEP_BOUNDARY 3u

static uint8_t rzxMode;
static uint8_t rzxStatus;
static uint32_t rzxFetchCount;

/* --- Playback */
static uint8_t rzxPlayBuffer[RZX_PLAY_BUFFER_CAPACITY];
static uint32_t rzxPlayTarget;
static uint32_t rzxPlayInCount;
static uint32_t rzxPlayReadIndex;
static uint8_t rzxPlayIntRequest;

/* --- Recording */
static uint8_t rzxRecBuffer[RZX_REC_BUFFER_CAPACITY];
static uint32_t rzxRecFrameTable[RZX_REC_FRAME_CAPACITY * 2u];
static uint32_t rzxRecFrameCount;
/* Bytes of the buffer the open frame does not own (they belong to closed frames) */
static uint32_t rzxRecClosedBytes;
static uint32_t rzxRecByteCount;
static uint8_t rzxRecOverflow;
/* A ULA frame ended; the frame closes at the next instruction boundary */
static uint8_t rzxRecClosePending;
/* No frame has closed since the block started (see `rzxIntAck`) */
static uint8_t rzxRecAtBlockStart;

static void rzxRecordOverflow(void) {
  rzxRecOverflow = 1u;
  rzxMode = RZX_MODE_OFF;
}

/* Closes the open frame and appends it to the frame table */
static void rzxRecCloseFrame(void) {
  if (rzxRecFrameCount >= RZX_REC_FRAME_CAPACITY || rzxFetchCount > 0xffffu) {
    rzxRecordOverflow();
    return;
  }
  rzxRecFrameTable[rzxRecFrameCount * 2u] = rzxFetchCount;
  rzxRecFrameTable[rzxRecFrameCount * 2u + 1u] = rzxRecByteCount - rzxRecClosedBytes;
  rzxRecFrameCount++;
  rzxRecClosedBytes = rzxRecByteCount;
  rzxFetchCount = 0u;
  rzxRecAtBlockStart = 0u;
}

/* Z80_REFRESH: one per M1 */
static inline void rzxCountFetch(void) {
  rzxFetchCount++;
}

/*
 * Z80_INT_ACK: an interrupt is being accepted. The acknowledge's refresh follows and is not a fetch
 * the format counts, so it is taken back here.
 *
 * While recording, an acceptance closes a frame when fetches ran since the last close: a retrigger,
 * or an interrupt the EI delay postponed past the ULA frame end (D9). One accepted right at a block's
 * start closes an empty frame, so that the player raises it first: a player starts a block without
 * an interrupt.
 */
static inline void rzxIntAck(void) {
  if (rzxMode == RZX_MODE_RECORD && (rzxFetchCount > 0u || rzxRecAtBlockStart != 0u)) {
    rzxRecCloseFrame();
  }
  rzxFetchCount--;
}

/*
 * The IN tap while playing: the next recorded value. Past the frame's INs, the core reads the live
 * port (returns 0) and playback has desynced.
 */
static inline uint8_t rzxPlayNextIn(uint32_t *value) {
  if (rzxStatus != RZX_STATUS_OK) return 0u;
  if (rzxPlayReadIndex < rzxPlayInCount) {
    *value = rzxPlayBuffer[rzxPlayReadIndex++];
    return 1u;
  }
  rzxStatus = RZX_STATUS_DESYNC_OVER;
  return 0u;
}

/* The IN tap while recording: appends the value the CPU read */
static inline void rzxRecordIn(uint32_t value) {
  if (rzxRecByteCount >= RZX_REC_BUFFER_CAPACITY) {
    rzxRecordOverflow();
    return;
  }
  rzxRecBuffer[rzxRecByteCount++] = (uint8_t)value;
}

/*
 * Playback, before each step (D8): what the step should do.
 *  - A pending interrupt request (the previous frame's end) is raised for one step. It is accepted
 *    only with IFF1 set; under DI the frame just moves on. An EI delay still pending is ignored
 *    unless this frame is an EI/retrigger frame (4 fetches or fewer), which the recording made by
 *    running the instruction after EI first.
 *  - The frame ends once its fetch count is reached at an instruction boundary (trap 2: `>=`, so a
 *    prefix that overshoots still ends it at the next boundary). INs left unread are a desync.
 */
static uint32_t rzxPlayBeforeStep(void) {
  if (rzxStatus != RZX_STATUS_OK) return RZX_STEP_NONE;
  if (rzxPlayIntRequest != 0u) {
    rzxPlayIntRequest = 0u;
    if (cpu.eiBacklog > 1u && rzxPlayTarget > RZX_SHORT_FRAME_FETCHES) {
      cpu.eiBacklog = 0u;
    }
    if (cpu.iff1 != 0u && cpu.eiBacklog <= 1u && cpu.prefix == PREFIX_NONE) {
      return RZX_STEP_RUN_INT;
    }
  }
  if (rzxFetchCount >= rzxPlayTarget && cpu.prefix == PREFIX_NONE) {
    rzxStatus = rzxPlayReadIndex < rzxPlayInCount ? RZX_STATUS_DESYNC_UNDER : RZX_STATUS_FRAME_DONE;
    return RZX_STEP_BOUNDARY;
  }
  return RZX_STEP_RUN;
}

/* Recording, after each step: a ULA frame end closes a frame at the next instruction boundary */
static inline void rzxRecAfterStep(uint32_t ulaFrameEnded) {
  if (ulaFrameEnded != 0u) rzxRecClosePending = 1u;
  if (rzxRecClosePending != 0u && cpu.prefix == PREFIX_NONE) {
    rzxRecClosePending = 0u;
    rzxRecCloseFrame();
  }
}

static void rzxClearRecording(void) {
  rzxRecFrameCount = 0u;
  rzxRecClosedBytes = 0u;
  rzxRecByteCount = 0u;
  rzxRecOverflow = 0u;
  rzxRecClosePending = 0u;
  rzxRecAtBlockStart = 1u;
}

// ----------------------------------------------------------------------------
// Exports

/*
 * Enters a mode. PLAY waits for the first frame (`RzxSetPlayFrame`); RECORD starts a block at the
 * current instruction. Every mode change starts the fetch counter afresh.
 */
void RZX_EXPORT(RzxSetMode)(uint32_t mode) {
  rzxMode = mode == RZX_MODE_PLAY || mode == RZX_MODE_RECORD ? (uint8_t)mode : RZX_MODE_OFF;
  rzxFetchCount = 0u;
  rzxStatus = mode == RZX_MODE_PLAY ? RZX_STATUS_FRAME_DONE : RZX_STATUS_OK;
  rzxPlayTarget = 0u;
  rzxPlayInCount = 0u;
  rzxPlayReadIndex = 0u;
  rzxPlayIntRequest = 0u;
  rzxClearRecording();
}

uint32_t RZX_EXPORT(RzxGetMode)(void) {
  return rzxMode;
}

uint8_t *RZX_EXPORT(RzxPlayBufferPtr)(void) {
  return rzxPlayBuffer;
}

uint32_t RZX_EXPORT(RzxPlayBufferCapacity)(void) {
  return RZX_PLAY_BUFFER_CAPACITY;
}

/*
 * Starts the next playback frame, whose INs the host has written into the play buffer.
 * @param raiseInt 1 when the previous frame ended here: the interrupt is raised first (0 for a
 * block's first frame, which a player starts without one)
 */
void RZX_EXPORT(RzxSetPlayFrame)(uint32_t fetchCount, uint32_t inCount, uint32_t raiseInt) {
  rzxPlayTarget = fetchCount;
  rzxPlayInCount = inCount > RZX_PLAY_BUFFER_CAPACITY ? RZX_PLAY_BUFFER_CAPACITY : inCount;
  rzxPlayReadIndex = 0u;
  rzxPlayIntRequest = raiseInt != 0u ? 1u : 0u;
  rzxFetchCount = 0u;
  rzxStatus = RZX_STATUS_OK;
}

uint32_t RZX_EXPORT(RzxGetStatus)(void) {
  return rzxStatus;
}

uint32_t RZX_EXPORT(RzxGetFetchCount)(void) {
  return rzxFetchCount;
}

uint32_t RZX_EXPORT(RzxGetReadIndex)(void) {
  return rzxPlayReadIndex;
}

uint8_t *RZX_EXPORT(RzxRecBufferPtr)(void) {
  return rzxRecBuffer;
}

uint32_t RZX_EXPORT(RzxRecBufferCapacity)(void) {
  return RZX_REC_BUFFER_CAPACITY;
}

/* Closed frames as (fetch count, IN count) pairs of 32-bit words */
uint32_t *RZX_EXPORT(RzxRecFrameTablePtr)(void) {
  return rzxRecFrameTable;
}

uint32_t RZX_EXPORT(RzxGetRecFrameCount)(void) {
  return rzxRecFrameCount;
}

/* The bytes of the closed frames, from the buffer's start */
uint32_t RZX_EXPORT(RzxGetRecByteCount)(void) {
  return rzxRecClosedBytes;
}

uint32_t RZX_EXPORT(RzxGetOverflow)(void) {
  return rzxRecOverflow;
}

/* Drops the closed frames the host has read; the open frame's INs move to the buffer's start */
void RZX_EXPORT(RzxClearRec)(void) {
  const uint32_t open = rzxRecByteCount - rzxRecClosedBytes;
  for (uint32_t i = 0u; i < open; i++) rzxRecBuffer[i] = rzxRecBuffer[rzxRecClosedBytes + i];
  rzxRecByteCount = open;
  rzxRecClosedBytes = 0u;
  rzxRecFrameCount = 0u;
}

/*
 * A new input block starts here (after an autosave or a rollback): the open frame is empty, and an
 * interrupt accepted before any fetch closes an empty frame (see `rzxIntAck`).
 */
void RZX_EXPORT(RzxRecMarkBlockStart)(void) {
  rzxFetchCount = 0u;
  rzxRecByteCount = rzxRecClosedBytes;
  rzxRecClosePending = 0u;
  rzxRecAtBlockStart = 1u;
}

/* 1 when the open frame is waiting for an instruction boundary to close */
uint32_t RZX_EXPORT(RzxGetRecClosePending)(void) {
  return rzxRecClosePending;
}
