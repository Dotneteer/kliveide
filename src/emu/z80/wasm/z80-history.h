/*
 * The execution-history recorder's hooks (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.1-§4.2).
 *
 * A core that records history includes this file BEFORE `z80.c`, and `z80-history.c` after
 * everything its `Z80_HISTORY_*` machine macros use (see the top of `z80-history.c`). This file
 * turns the three no-op hooks of `z80.c` into one predictable branch each (trap T14): while
 * recording is off, a cycle pays a load and a compare.
 */

#ifndef Z80_HISTORY_H
#define Z80_HISTORY_H

#include <stdint.h>

/*
 * The 64-byte header the reader (`WasmHistoryReader.ts`) parses. Little-endian, natural alignment:
 * every field sits at the offset in the comment, so the struct is the wire format.
 */
typedef struct Z80HistoryHeader {
  uint32_t magic; /* 0: "KHST" */
  uint16_t version; /* 4 */
  uint16_t recordSize; /* 6 */
  uint32_t capacity; /* 8: records, a power of two */
  uint32_t enabled; /* 12 */
  uint32_t count; /* 16: records held, saturates at the capacity */
  uint32_t writeIndex; /* 20: the slot the next record goes to */
  uint32_t newestSequenceLo; /* 24: the newest record's sequence (0: none was ever written) */
  uint32_t newestSequenceHi; /* 28 */
  uint32_t generation; /* 32: bumped by every clear, so a reader drops its caches */
  uint32_t ringOffset; /* 36: where the records start in linear memory */
  /* The stop target of a replay (`.plans/REVERSE_DEBUGGING_PLAN.md` D3, D4): a position is the
     newest record's sequence and the units it holds (its repeat count), `z80HistorySetTarget` */
  uint32_t targetSequenceLo; /* 40 */
  uint32_t targetSequenceHi; /* 44 */
  uint32_t targetSub; /* 48 */
  uint32_t stopState; /* 52: Z80_HISTORY_STOP_ARMED, Z80_HISTORY_STOP_REACHED */
  uint32_t targetPhase; /* 56: 0 an instruction boundary, 1/2 inside a prefixed instruction */
  uint32_t verifyState; /* 60: Z80_HISTORY_VERIFY_ON, Z80_HISTORY_VERIFY_MISMATCH (D9) */
} Z80HistoryHeader;

static Z80HistoryHeader z80HistoryHeader;

#define Z80_HISTORY_STOP_ARMED 0x01u
#define Z80_HISTORY_STOP_REACHED 0x02u
#define Z80_HISTORY_VERIFY_ON 0x01u
#define Z80_HISTORY_VERIFY_MISMATCH 0x02u

/*
 * Nonzero when a frame loop must return now: the recorder reached its stop target and the CPU is at
 * an instruction boundary (no prefix pending). One call per instruction in every frame loop and
 * `...ExecuteUntilStop`; with no target armed it is a load and a compare. Defined in `z80-history.c`.
 */
static uint32_t z80HistoryStopNow(void);

static void z80HistoryEvent(uint32_t kind);
static void z80HistoryBegin(void);
static void z80HistoryCommit(void);

#define Z80_HISTORY_EVENT(kind) \
  do { \
    if (z80HistoryHeader.enabled) z80HistoryEvent(kind); \
  } while (0)
#define Z80_HISTORY_BEGIN() \
  do { \
    if (z80HistoryHeader.enabled) z80HistoryBegin(); \
  } while (0)
#define Z80_HISTORY_COMMIT() \
  do { \
    if (z80HistoryHeader.enabled) z80HistoryCommit(); \
  } while (0)

#endif
