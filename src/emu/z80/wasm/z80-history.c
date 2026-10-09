/*
 * The execution-history recorder: a ring of the most recent instructions and CPU events, each with
 * the machine state *before* it ran (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.2, D1-D10).
 *
 * One file for every Z80 core. The core includes `z80-history.h` before `z80.c` (which turns the
 * CPU's history hooks on) and this file after everything its machine macros use, after defining:
 *
 * - `Z80_HISTORY_CAPACITY`: the ring's size in records, a power of two (D6);
 * - `Z80_HISTORY_PEEK(address)`: a side-effect-free byte read through the current map - no
 *   contention, no automap, no floating bus (trap T3); optionally `Z80_HISTORY_PEEK3(from, out3)`,
 *   the three bytes after `from` in one read;
 * - `Z80_HISTORY_CONTEXT(kind, out16)`: the 16-byte machine context of a record, which only the
 *   core and its TypeScript decoder (`src/common/history/contexts/`) interpret (§4.3);
 * - `Z80_HISTORY_FRAME()` and `Z80_HISTORY_FRAME_TACT()`: the frame counter and the position in
 *   the frame, in the machine's own unit (trap T10);
 * - optionally `Z80_HISTORY_CONTEXT_BEFORE_FETCH`: capture an instruction's context before the
 *   opcode fetch instead of after it, for a machine whose fetch-time paging happens after the byte
 *   is read (the Next's delayed DivMMC entry); by default it is captured after, for one whose
 *   paging happens at the fetch and supplies the byte (the 128K's TR-DOS ROM);
 * - optionally `Z80_HISTORY_FORCED_NOP()`: nonzero when the opcode fetch just committed did not
 *   read the byte at PC but had the hardware force a NOP onto the bus (the ZX80/81 ULA's display
 *   fetches above 32K). Such fetches coalesce into one *forced-NOP run* record per run of
 *   consecutive addresses, whose repeat count is the run's length (`.plans/
 *   EXECUTION_HISTORY_ALL_CORES_PLAN.md` D6, T2): a display line is one record, not 32.
 *
 * An instruction is recorded in two phases (trap T4): `z80HistoryBegin` writes the registers into
 * the next slot before the opcode fetch increments R, and `z80HistoryCommit` adds the executed bytes
 * and the context after the fetch - so byte 0 is what the CPU decoded, after any paging the fetch
 * itself caused (T3), and self-modifying code reads correctly in history (D5). Both run inside one
 * `z80ExecuteCpuCycle` call, so a host read between calls never sees a half-written record (T11).
 * Only an M1 with no prefix pending starts an instruction, so `DD CB d op` is one record (T2).
 *
 * Interrupt acknowledges and HALTed cycles are events (T5): the INT/NMI record holds the interrupted
 * PC and, for INT, the data-bus vector in byte 0. Consecutive HALTed cycles at one PC coalesce into
 * one record whose repeat count saturates at 65,535 (T6).
 *
 * The ring and its header are volatile statics (D7): neither a state file nor a checkpoint carries
 * them. Clearing is the host's decision (D9).
 */

#ifndef Z80_HISTORY_CAPACITY
#error "Z80_HISTORY_CAPACITY must be defined before including z80-history.c"
#endif
#if (Z80_HISTORY_CAPACITY & (Z80_HISTORY_CAPACITY - 1)) != 0
#error "Z80_HISTORY_CAPACITY must be a power of two"
#endif

#include <stddef.h>

#define Z80_HISTORY_MAGIC 0x5453484bu /* "KHST" */
#define Z80_HISTORY_VERSION 1u
#define Z80_HISTORY_MASK ((uint32_t)(Z80_HISTORY_CAPACITY) - 1u)
#define Z80_HISTORY_MAX_REPEAT 0xffffu

/* Record flags (byte 13) */
#define Z80_HISTORY_FLAG_IFF1 0x01u
#define Z80_HISTORY_FLAG_IFF2 0x02u
#define Z80_HISTORY_FLAG_IM_SHIFT 2u
#define Z80_HISTORY_FLAG_INT_PENDING 0x10u
#define Z80_HISTORY_FLAG_BYTES_TRUNCATED 0x20u

/* One record, 64 bytes, little-endian: the struct is the wire format (`historyRecord.ts`). */
typedef struct Z80HistoryRecord {
  uint32_t sequence; /* 0: low 32 bits */
  uint32_t frame; /* 4 */
  uint32_t frameTact; /* 8 */
  uint8_t kind; /* 12 */
  uint8_t flags; /* 13 */
  uint16_t repeat; /* 14 */
  uint16_t pc; /* 16 */
  uint16_t af; /* 18 */
  uint16_t bc; /* 20 */
  uint16_t de; /* 22 */
  uint16_t hl; /* 24 */
  uint16_t afAlt; /* 26 */
  uint16_t bcAlt; /* 28 */
  uint16_t deAlt; /* 30 */
  uint16_t hlAlt; /* 32 */
  uint16_t ix; /* 34 */
  uint16_t iy; /* 36 */
  uint16_t sp; /* 38 */
  uint8_t i; /* 40 */
  uint8_t r; /* 41 */
  uint16_t wz; /* 42 */
  uint8_t bytes[4]; /* 44 */
  uint8_t context[16]; /* 48 */
} Z80HistoryRecord;

_Static_assert(sizeof(Z80HistoryRecord) == 64, "a history record is 64 bytes");
_Static_assert(sizeof(Z80HistoryHeader) == 80, "the history header is 80 bytes");

static Z80HistoryRecord z80HistoryRing[Z80_HISTORY_CAPACITY] __attribute__((aligned(64)));

static void z80HistoryEnsureHeader(void) {
  if (z80HistoryHeader.magic == Z80_HISTORY_MAGIC) return;
  z80HistoryHeader.magic = Z80_HISTORY_MAGIC;
  z80HistoryHeader.version = Z80_HISTORY_VERSION;
  z80HistoryHeader.recordSize = (uint16_t)sizeof(Z80HistoryRecord);
  z80HistoryHeader.capacity = (uint32_t)(Z80_HISTORY_CAPACITY);
  z80HistoryHeader.ringOffset = (uint32_t)(uintptr_t)z80HistoryRing;
}

/* The newest record, or 0 when the ring is empty */
static inline Z80HistoryRecord *z80HistoryNewest(void) {
  if (z80HistoryHeader.count == 0u) return 0;
  return &z80HistoryRing[(z80HistoryHeader.writeIndex - 1u) & Z80_HISTORY_MASK];
}

/*
 * The record's AF ... IY are the CPU's ten register pairs in the CPU's own order and byte order, so
 * staging copies them in one go (trap T5: the Z88's and the ZX80/81's debug loops run in C, where
 * every store of the recorder shows)
 */
_Static_assert(offsetof(Z80State, iy) - offsetof(Z80State, af) == 18u, "AF..IY are contiguous in the CPU state");
_Static_assert(offsetof(Z80HistoryRecord, iy) - offsetof(Z80HistoryRecord, af) == 18u, "AF..IY are contiguous in a record");

/*
 * Replay's self-check (`.plans/REVERSE_DEBUGGING_PLAN.md` D9): the slot about to be written may still
 * hold the record the recorded run wrote for the same sequence (a rewound ring keeps them). If it
 * does and the CPU disagrees with it, the replay has diverged - once the staged record is published
 * (`z80HistoryPublish` marks it and stops at once). A forced NOP that extends a run stages a record
 * it then drops, while the slot holds the record *after* the run: that comparison is void.
 */
static void z80HistoryVerifySlot(const Z80HistoryRecord *old) {
  const uint32_t next = z80HistoryHeader.newestSequenceLo + 1u;
  z80HistoryHeader.verifyState &= ~Z80_HISTORY_VERIFY_STAGED;
  if (z80HistoryHeader.verifyStagedLo != next) {
    /* The sequence's first staging: the slot still holds what the recorded run left there */
    z80HistoryHeader.verifyStagedLo = next;
    if (old->sequence == next) {
      z80HistoryHeader.verifyHeldLo = next;
      z80HistoryHeader.verifyPcSp = (uint32_t)old->pc | ((uint32_t)old->sp << 16);
      z80HistoryHeader.verifyAf = old->af;
    } else {
      z80HistoryHeader.verifyHeldLo = 0u;
    }
  }
  if (z80HistoryHeader.verifyHeldLo != next) return;
  if ((uint16_t)z80HistoryHeader.verifyPcSp == cpu.pc && (uint16_t)(z80HistoryHeader.verifyPcSp >> 16) == cpu.sp &&
      (uint16_t)z80HistoryHeader.verifyAf == cpu.af.word) {
    return;
  }
  z80HistoryHeader.verifyState |= Z80_HISTORY_VERIFY_STAGED;
}

/* Writes the CPU state into the next slot without publishing it */
Z80_ALWAYS_INLINE Z80HistoryRecord *z80HistoryStage(uint32_t kind) {
  Z80HistoryRecord *r = &z80HistoryRing[z80HistoryHeader.writeIndex];
  if (z80HistoryHeader.verifyState != 0u) z80HistoryVerifySlot(r);
  r->sequence = z80HistoryHeader.newestSequenceLo + 1u;
  r->frame = (uint32_t)(Z80_HISTORY_FRAME());
  r->frameTact = (uint32_t)(Z80_HISTORY_FRAME_TACT());
  r->kind = (uint8_t)kind;
  r->flags = (uint8_t)((cpu.iff1 & 1u) | ((cpu.iff2 & 1u) << 1u) | ((uint32_t)(cpu.interruptMode & 0x03u) << Z80_HISTORY_FLAG_IM_SHIFT) |
                       ((cpu.sigInt & 1u) << 4u));
  r->repeat = 1u;
  r->pc = cpu.pc;
  __builtin_memcpy(&r->af, &cpu.af, 20u);
  r->sp = cpu.sp;
  r->i = cpu.ir.bytes.high;
  r->r = cpu.ir.bytes.low;
  r->wz = WZ;
  return r;
}

/* Publishes the staged record: the newest sequence, the write index and the count move on */
Z80_ALWAYS_INLINE void z80HistoryPublish(void) {
  if ((z80HistoryHeader.verifyState & Z80_HISTORY_VERIFY_STAGED) != 0u) {
    z80HistoryHeader.verifyState = (z80HistoryHeader.verifyState & ~Z80_HISTORY_VERIFY_STAGED) | Z80_HISTORY_VERIFY_MISMATCH;
    z80HistoryHeader.stopState = Z80_HISTORY_STOP_ARMED | Z80_HISTORY_STOP_REACHED;
  }
  z80HistoryHeader.newestSequenceLo++;
  if (z80HistoryHeader.newestSequenceLo == 0u) z80HistoryHeader.newestSequenceHi++;
  z80HistoryHeader.writeIndex = (z80HistoryHeader.writeIndex + 1u) & Z80_HISTORY_MASK;
  if (z80HistoryHeader.count < (uint32_t)(Z80_HISTORY_CAPACITY)) z80HistoryHeader.count++;
}

/*
 * The three bytes after the opcode. A core may define `Z80_HISTORY_PEEK3(from, out3)` to read them in
 * one go (the Next resolves its mapping once per instruction instead of three times, trap T14); the
 * default peeks byte by byte.
 */
Z80_ALWAYS_INLINE void z80HistoryPeekBytes(Z80HistoryRecord *r, uint32_t from) {
#ifdef Z80_HISTORY_PEEK3
  Z80_HISTORY_PEEK3((uint16_t)from, &r->bytes[1]);
#else
  r->bytes[1] = (uint8_t)(Z80_HISTORY_PEEK((uint16_t)(from + 1u)));
  r->bytes[2] = (uint8_t)(Z80_HISTORY_PEEK((uint16_t)(from + 2u)));
  r->bytes[3] = (uint8_t)(Z80_HISTORY_PEEK((uint16_t)(from + 3u)));
#endif
}

/*
 * Appends an event record with the current CPU state: for a core's own events (the Next's DMA
 * hold) as well as the CPU's. Bytes and context are zero; the caller fills what its kind needs.
 */
static Z80HistoryRecord *z80HistoryAppend(uint32_t kind) {
  Z80HistoryRecord *r = z80HistoryStage(kind);
  for (uint32_t i = 0; i < 4u; i++) r->bytes[i] = 0u;
  for (uint32_t i = 0; i < 16u; i++) r->context[i] = 0u;
  z80HistoryPublish();
  return r;
}

static void z80HistoryEvent(uint32_t kind) {
  if (kind == Z80_HISTORY_KIND_HALT) {
    Z80HistoryRecord *newest = z80HistoryNewest();
    if (newest && newest->kind == Z80_HISTORY_KIND_HALT && newest->pc == cpu.pc &&
        newest->repeat < Z80_HISTORY_MAX_REPEAT) {
      newest->repeat++;
      return;
    }
  }
  Z80HistoryRecord *r = z80HistoryAppend(kind);
  if (kind == Z80_HISTORY_KIND_INT) {
    r->bytes[0] = cpu.interruptVector;
  } else if (kind == Z80_HISTORY_KIND_HALT) {
    r->bytes[0] = (uint8_t)(Z80_HISTORY_PEEK(cpu.pc));
  }
  Z80_HISTORY_CONTEXT(kind, r->context);
}

static void z80HistoryBegin(void) {
  Z80HistoryRecord *r = z80HistoryStage(Z80_HISTORY_KIND_INSTRUCTION);
#ifdef Z80_HISTORY_CONTEXT_BEFORE_FETCH
  Z80_HISTORY_CONTEXT(Z80_HISTORY_KIND_INSTRUCTION, r->context);
#else
  (void)r;
#endif
}

#ifdef Z80_HISTORY_FORCED_NOP
/*
 * A forced NOP (see the top of this file). The staged record holds the registers before the fetch:
 * it either starts a new run, or - when the newest record is a run that ends right before this
 * address - is dropped and the run grows by one. The registers of a run are those before its first
 * NOP; a NOP changes nothing else a record holds but R, PC and the frame position.
 */
static void z80HistoryForcedNop(Z80HistoryRecord *r) {
  Z80HistoryRecord *newest = z80HistoryNewest();
  if (newest && newest->kind == Z80_HISTORY_KIND_FORCED_NOP && newest->repeat < Z80_HISTORY_MAX_REPEAT &&
      (uint16_t)(newest->pc + newest->repeat) == cpu.pc) {
    newest->repeat++;
    /* The staged record is dropped, and its self-check with it (see `z80HistoryVerifySlot`); the
       slot must not pass for the next sequence's record either, should the run stop here and a
       replay later come through it */
    z80HistoryHeader.verifyState &= ~Z80_HISTORY_VERIFY_STAGED;
    r->sequence = 0u;
    /* Staging wrote into the slot after the newest one: with a full ring, that was the oldest record */
    if (z80HistoryHeader.count == (uint32_t)(Z80_HISTORY_CAPACITY)) z80HistoryHeader.count--;
    return;
  }
  r->kind = (uint8_t)Z80_HISTORY_KIND_FORCED_NOP;
  for (uint32_t i = 0; i < 4u; i++) r->bytes[i] = 0u;
  Z80_HISTORY_CONTEXT(Z80_HISTORY_KIND_FORCED_NOP, r->context);
  z80HistoryPublish();
}
#endif

static void z80HistoryCommit(void) {
  Z80HistoryRecord *r = &z80HistoryRing[z80HistoryHeader.writeIndex];
#ifdef Z80_HISTORY_FORCED_NOP
  if (Z80_HISTORY_FORCED_NOP()) {
    z80HistoryForcedNop(r);
    return;
  }
#endif
  r->bytes[0] = cpu.opCode;
  z80HistoryPeekBytes(r, cpu.pc);
#ifndef Z80_HISTORY_CONTEXT_BEFORE_FETCH
  Z80_HISTORY_CONTEXT(Z80_HISTORY_KIND_INSTRUCTION, r->context);
#endif
  z80HistoryPublish();
}

// -----------------------------------------------------------------------------
// Exports (`scripts/z80-history-exports.cjs`): the same names in every core
// -----------------------------------------------------------------------------

/* Where the header is; the header says where the ring is (`WasmHistoryReader.ts`) */
uint32_t z80HistoryGetHeaderOffset(void) {
  z80HistoryEnsureHeader();
  return (uint32_t)(uintptr_t)&z80HistoryHeader;
}

void z80HistorySetEnabled(uint32_t enabled) {
  z80HistoryEnsureHeader();
  z80HistoryHeader.enabled = enabled ? 1u : 0u;
}

/* Empties the ring. Sequence numbers keep counting, so a sequence never names two records. */
void z80HistoryClear(void) {
  z80HistoryEnsureHeader();
  z80HistoryHeader.count = 0u;
  z80HistoryHeader.writeIndex = 0u;
  z80HistoryHeader.generation++;
}

// -----------------------------------------------------------------------------
// Positions and the stop target (`.plans/REVERSE_DEBUGGING_PLAN.md` D3, D4, T6)
//
// A position is `(sequence, sub, phase)`: the newest record's sequence, the units it holds - its
// repeat count, which grows while HALTed cycles, forced NOPs or DMA-hold T-states coalesce into it -
// and how far into a prefixed instruction the CPU is. A prefixed instruction is one record but
// several CPU cycles, and the host can touch the machine between them: a frame can end after the `ED`
// of the ROM's `IN A,(C)`, and a debugger step runs one cycle. The phase is 0 at an instruction
// boundary, 1 after a CB/ED/DD/FD prefix and 2 after DD CB / FD CB; inside one record the phases
// come in the order 1, 2, 0. (A run of DD/FD prefixes stays in phase 1, so its cycles share a
// position.) The recorder counts only while it is enabled, so a replay records.
// -----------------------------------------------------------------------------

/* The units the newest record holds: 0 right after a clear or a reseed without a record */
static inline uint32_t z80HistoryCurrentSub(void) {
  Z80HistoryRecord *newest = z80HistoryNewest();
  return newest ? (uint32_t)newest->repeat : 0u;
}

/* How far into a prefixed instruction the CPU is (see above) */
static inline uint32_t z80HistoryCurrentPhase(void) {
  switch (cpu.prefix) {
    case PREFIX_NONE: return 0u;
    case PREFIX_DDCB:
    case PREFIX_FDCB: return 2u;
    default: return 1u;
  }
}

/*
 * Marks the target reached once the position is at it - or past it, at the next instruction boundary.
 * The host reads the mark from the header after a frame call, so a frame that completes on the very
 * cycle that reaches the target still reports it.
 */
static uint32_t z80HistoryStopNow(void) {
#ifdef Z80_BENCH_STRIP_DEBUG
  /* Benchmark-only (z80.c): no stop target can be armed */
  return 0u;
#endif
  const uint32_t state = z80HistoryHeader.stopState;
  if (state == 0u) return 0u;
  if ((state & Z80_HISTORY_STOP_REACHED) != 0u) return 1u;
  const uint32_t hi = z80HistoryHeader.newestSequenceHi;
  const uint32_t lo = z80HistoryHeader.newestSequenceLo;
  const uint32_t thi = z80HistoryHeader.targetSequenceHi;
  const uint32_t tlo = z80HistoryHeader.targetSequenceLo;
  if (hi < thi || (hi == thi && lo < tlo)) return 0u;
  const uint32_t phase = z80HistoryCurrentPhase();
  if (hi == thi && lo == tlo) {
    const uint32_t sub = z80HistoryCurrentSub();
    const uint32_t tsub = z80HistoryHeader.targetSub;
    if (sub < tsub) return 0u;
    const uint32_t tphase = z80HistoryHeader.targetPhase;
    /* At the target's record and units: a mid-instruction target stops at its phase; anything else
       waits for the instruction boundary */
    if (sub == tsub && tphase != 0u && phase == tphase) {
      z80HistoryHeader.stopState = state | Z80_HISTORY_STOP_REACHED;
      return 1u;
    }
  }
  if (phase != 0u) return 0u;
  z80HistoryHeader.stopState = state | Z80_HISTORY_STOP_REACHED;
  return 1u;
}

/* Arms the stop target; a frame loop returns once the position reaches it (D4) */
void z80HistorySetTarget(uint32_t sequenceLo, uint32_t sequenceHi, uint32_t sub, uint32_t phase) {
  z80HistoryEnsureHeader();
  z80HistoryHeader.targetSequenceLo = sequenceLo;
  z80HistoryHeader.targetSequenceHi = sequenceHi;
  z80HistoryHeader.targetSub = sub;
  z80HistoryHeader.targetPhase = phase;
  z80HistoryHeader.stopState = Z80_HISTORY_STOP_ARMED;
}

void z80HistoryClearTarget(void) {
  z80HistoryEnsureHeader();
  z80HistoryHeader.stopState = 0u;
}

/* The newest record's units: with the header's newest sequence, the current position */
uint32_t z80HistoryGetSub(void) {
  return z80HistoryCurrentSub();
}

/* The current position's phase (0 at an instruction boundary) */
uint32_t z80HistoryGetPhase(void) {
  return z80HistoryCurrentPhase();
}

/*
 * Rewinds the ring to an earlier sequence it still holds (D9, D17): the newest sequence, the write
 * index and the count move back, and the later records stay in their slots, where a verifying replay
 * compares with them before it overwrites them. Returns 0 when the ring does not hold the sequence;
 * the host then reseeds instead. The host puts the keyframe's newest record into the newest slot
 * afterwards (its repeat count may have grown since).
 */
uint32_t z80HistoryRewind(uint32_t sequenceLo, uint32_t sequenceHi) {
  z80HistoryEnsureHeader();
  const uint64_t newest = ((uint64_t)z80HistoryHeader.newestSequenceHi << 32) | z80HistoryHeader.newestSequenceLo;
  const uint64_t target = ((uint64_t)sequenceHi << 32) | sequenceLo;
  if (target > newest) return 0u;
  const uint64_t delta = newest - target;
  if (delta >= (uint64_t)z80HistoryHeader.count) return 0u;
  z80HistoryHeader.writeIndex = (z80HistoryHeader.writeIndex - (uint32_t)delta) & Z80_HISTORY_MASK;
  z80HistoryHeader.count -= (uint32_t)delta;
  z80HistoryHeader.newestSequenceLo = sequenceLo;
  z80HistoryHeader.newestSequenceHi = sequenceHi;
  z80HistoryHeader.generation++;
  z80HistoryHeader.verifyStagedLo = 0u;
  z80HistoryHeader.verifyHeldLo = 0u;
  return 1u;
}

/* Turns replay verification on or off, and clears a reported mismatch (D9) */
void z80HistorySetVerify(uint32_t on) {
  z80HistoryEnsureHeader();
  z80HistoryHeader.verifyState = on ? Z80_HISTORY_VERIFY_ON : 0u;
  z80HistoryHeader.verifyStagedLo = 0u;
  z80HistoryHeader.verifyHeldLo = 0u;
}

/*
 * Restarts the ring at a keyframe's position (T6). The ring is volatile, so after a keyframe restore
 * it holds the future; the host writes the keyframe's newest record into slot 0 first (the header
 * says where the ring is) when `hasRecord` is set, so a HALT or a forced-NOP run in progress at the
 * keyframe keeps coalescing into it exactly as it did in the original run.
 */
void z80HistorySetPosition(uint32_t sequenceLo, uint32_t sequenceHi, uint32_t hasRecord) {
  z80HistoryEnsureHeader();
  z80HistoryHeader.newestSequenceLo = sequenceLo;
  z80HistoryHeader.newestSequenceHi = sequenceHi;
  z80HistoryHeader.count = hasRecord ? 1u : 0u;
  z80HistoryHeader.writeIndex = hasRecord ? 1u : 0u;
  z80HistoryHeader.generation++;
  z80HistoryHeader.verifyStagedLo = 0u;
  z80HistoryHeader.verifyHeldLo = 0u;
}

/*
 * The CPU's bus-event fields - the last port address, value and direction, and the event flag. The
 * CPU writes them only while its core captures bus events: in the per-instruction debug loop, never
 * in a fast frame. They are what the debugger observed, not machine state, so a fast-path replay
 * leaves them as they were and a comparison with a debug-loop run masks them
 * (`.plans/REVERSE_DEBUGGING_PLAN.md` T15).
 */
uint32_t z80HistoryBusEventFieldsPtr(void) {
  return (uint32_t)(uintptr_t)&cpu.lastPortAddress;
}

uint32_t z80HistoryBusEventFieldsSize(void) {
  return (uint32_t)(offsetof(Z80State, hasPortEvent) + 1u - offsetof(Z80State, lastPortAddress));
}

/*
 * The host's per-instruction loops (the TypeScript debug loop) ask this after every instruction while
 * a replay run toward the present is armed (`.plans/REVERSE_DEBUGGING_PLAN.md` D11): nonzero once the
 * stop target is reached, at an instruction boundary - the same check the frame loops make.
 */
uint32_t z80HistoryCheckStop(void) {
  return z80HistoryStopNow();
}
