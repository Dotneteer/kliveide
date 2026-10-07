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
 *   the frame, in the machine's own unit (trap T10).
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
_Static_assert(sizeof(Z80HistoryHeader) == 64, "the history header is 64 bytes");

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

/* Writes the CPU state into the next slot without publishing it */
Z80_ALWAYS_INLINE Z80HistoryRecord *z80HistoryStage(uint32_t kind) {
  Z80HistoryRecord *r = &z80HistoryRing[z80HistoryHeader.writeIndex];
  r->sequence = z80HistoryHeader.newestSequenceLo + 1u;
  r->frame = (uint32_t)(Z80_HISTORY_FRAME());
  r->frameTact = (uint32_t)(Z80_HISTORY_FRAME_TACT());
  r->kind = (uint8_t)kind;
  r->flags = (uint8_t)((cpu.iff1 ? Z80_HISTORY_FLAG_IFF1 : 0u) | (cpu.iff2 ? Z80_HISTORY_FLAG_IFF2 : 0u) |
                       ((uint32_t)(cpu.interruptMode & 0x03u) << Z80_HISTORY_FLAG_IM_SHIFT) |
                       (cpu.sigInt ? Z80_HISTORY_FLAG_INT_PENDING : 0u));
  r->repeat = 1u;
  r->pc = cpu.pc;
  r->af = AF;
  r->bc = BC;
  r->de = DE;
  r->hl = HL;
  r->afAlt = AF_ALT;
  r->bcAlt = BC_ALT;
  r->deAlt = DE_ALT;
  r->hlAlt = HL_ALT;
  r->ix = IX;
  r->iy = IY;
  r->sp = cpu.sp;
  r->i = cpu.ir.bytes.high;
  r->r = cpu.ir.bytes.low;
  r->wz = WZ;
  return r;
}

/* Publishes the staged record: the newest sequence, the write index and the count move on */
Z80_ALWAYS_INLINE void z80HistoryPublish(void) {
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

static void z80HistoryBegin(void) { (void)z80HistoryStage(Z80_HISTORY_KIND_INSTRUCTION); }

static void z80HistoryCommit(void) {
  Z80HistoryRecord *r = &z80HistoryRing[z80HistoryHeader.writeIndex];
  r->bytes[0] = cpu.opCode;
  z80HistoryPeekBytes(r, cpu.pc);
  Z80_HISTORY_CONTEXT(Z80_HISTORY_KIND_INSTRUCTION, r->context);
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
