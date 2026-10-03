/*
 * Breakpoint condition evaluator - the one evaluator of Klive's breakpoint condition language.
 *
 * `.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`. The language (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`
 * §3) is parsed and checked in TypeScript (`src/common/utils/breakpoint-condition/`), which emits the
 * bytecode below; this file runs it. It is `#include`d at the end of every Z80 core's translation
 * unit, after `z80.c` (it reads `cpu`), so registers are read in place - no copy crosses the WASM
 * boundary. What differs between machines - memory, paging, Next registers - is behind the `COND_*`
 * hooks, which each core defines before the include, the way `z80.c` takes its `Z80_*` hooks.
 *
 * The same file built alone with `COND_TEST_HOST` (`scripts/build-condition-wasm.cjs`) reads
 * registers and memory through WebAssembly imports, so the language is tested without a machine.
 *
 * Values are `int64_t`: exact integers, as the language requires (C4). `& | ^ ~` produce unsigned
 * 32-bit results (C6); the shifts reproduce JavaScript's (C5). `COND_NO_VALUE` stands for "nothing
 * is paged there" (`page()`), and behaves like the `NaN` it replaced: every comparison with it is
 * false except `!=`, arithmetic keeps it, bitwise operators read it as 0, and it is truthy.
 *
 * No heap, no libc: the program store is static, and the stack is a local array.
 */

#include <stdint.h>

// -----------------------------------------------------------------------------
// The bytecode - keep in step with `condition-bytecode.ts`
// -----------------------------------------------------------------------------

#define COND_FORMAT 0x434e0001u /* "CN", format 1: the first word of every program */

#define COND_OP_END 0u
#define COND_OP_CONST 1u /* lo32, hi32 */
#define COND_OP_REG 2u /* register id */
#define COND_OP_FLAG 3u /* bit */
#define COND_OP_VAL 4u
#define COND_OP_ADDR 5u
#define COND_OP_MEM 6u /* info, part value */
#define COND_OP_PAGE 7u
#define COND_OP_NR 8u
#define COND_OP_S8 9u
#define COND_OP_S16 10u
#define COND_OP_S32 11u
#define COND_OP_NOT 12u
#define COND_OP_BNOT 13u
#define COND_OP_NEG 14u
#define COND_OP_ADD 15u
#define COND_OP_SUB 16u
#define COND_OP_AND 17u
#define COND_OP_OR 18u
#define COND_OP_XOR 19u
#define COND_OP_SHL 20u
#define COND_OP_SHR 21u
#define COND_OP_USHR 22u
#define COND_OP_EQ 23u
#define COND_OP_NE 24u
#define COND_OP_LT 25u
#define COND_OP_LE 26u
#define COND_OP_GT 27u
#define COND_OP_GE 28u
#define COND_OP_ANDJ 29u /* target: if the top is 0, keep it and jump; else drop it */
#define COND_OP_ORJ 30u /* target: if the top is not 0, make it 1 and jump; else drop it */
#define COND_OP_BOOL 31u
/* `.plans/LOGPOINTS_PLAN.md` §3.4-§3.5: multiplicative operators and the machine specials */
#define COND_OP_MUL 32u
#define COND_OP_DIV 33u /* integer, truncating toward zero; a zero divisor is COND_RESULT_DIVZERO */
#define COND_OP_MOD 34u /* C's remainder; a zero divisor is COND_RESULT_DIVZERO */
#define COND_OP_TSTATES 35u /* the CPU's T-state counter */
#define COND_OP_ENV 36u /* index: a machine fact TypeScript wrote with `condSetEnv` */

/* `MEM` info word: bits 0-3 width (1, 2, 4), bit 4 big-endian, bit 5 signed, bits 8-9 part kind */
#define COND_MEM_BE 0x10u
#define COND_MEM_SIGNED 0x20u
#define COND_PART_NONE 0u
#define COND_PART_PARTITION 1u
#define COND_PART_BANK 2u

/* Register ids - the order of `CONDITION_REGISTER_IDS` in `condition-bytecode.ts` */
#define COND_REG_A 0u
#define COND_REG_F 1u
#define COND_REG_B 2u
#define COND_REG_C 3u
#define COND_REG_D 4u
#define COND_REG_E 5u
#define COND_REG_H 6u
#define COND_REG_L 7u
#define COND_REG_I 8u
#define COND_REG_R 9u
#define COND_REG_XH 10u
#define COND_REG_XL 11u
#define COND_REG_YH 12u
#define COND_REG_YL 13u
#define COND_REG_AF 14u
#define COND_REG_BC 15u
#define COND_REG_DE 16u
#define COND_REG_HL 17u
#define COND_REG_IX 18u
#define COND_REG_IY 19u
#define COND_REG_SP 20u
#define COND_REG_PC 21u
#define COND_REG_WZ 22u
#define COND_REG_AF_ALT 23u
#define COND_REG_BC_ALT 24u
#define COND_REG_DE_ALT 25u
#define COND_REG_HL_ALT 26u

#define COND_NO_VALUE INT64_MIN

#define COND_RESULT_FALSE 0u
#define COND_RESULT_TRUE 1u
#define COND_RESULT_ERROR 2u
/* A division or remainder by zero: an error for a condition (it then fails safe, as any error), a
 * `<division by zero>` placeholder for a logpoint. */
#define COND_RESULT_DIVZERO 3u

/* `COND_OP_ENV` indexes */
#define COND_ENV_CPUFREQ 0u
#define COND_ENV_FRAME 1u
#define COND_ENV_COUNT 4u

#define COND_STACK_DEPTH 64u
#define COND_SLOT_COUNT 256u
#define COND_ARENA_WORDS 16384u
#define COND_MAX_PROGRAM_WORDS 1024u

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

#ifdef COND_TEST_HOST
/* The test build: every machine fact is a JavaScript function supplied at instantiation. */
#define COND_IMPORT(name) __attribute__((import_module("env"), import_name(name)))
COND_IMPORT("reg") uint32_t condHostReg(uint32_t id);
COND_IMPORT("peek") uint32_t condHostPeek(uint32_t address);
COND_IMPORT("peekPartition") uint32_t condHostPeekPartition(int32_t partition, uint32_t address);
COND_IMPORT("peekBank") uint32_t condHostPeekBank(uint32_t bank, uint32_t offset);
COND_IMPORT("partitionOf") double condHostPartitionOf(uint32_t address);
COND_IMPORT("nextReg") uint32_t condHostNextReg(uint32_t reg);
COND_IMPORT("tstates") uint32_t condHostTstates(void);
#define COND_REGISTER(id) condHostReg(id)
#define COND_PEEK(address) condHostPeek(address)
#define COND_PEEK_PARTITION(partition, address) condHostPeekPartition(partition, address)
#define COND_PEEK_BANK(bank, offset) condHostPeekBank(bank, offset)
#define COND_PARTITION_OF(address) condFromDouble(condHostPartitionOf(address))
#define COND_NEXTREG(reg) condHostNextReg(reg)
#define COND_TSTATES() condHostTstates()

/* NaN - JavaScript's "undefined" partition - is "no value" */
static inline int64_t condFromDouble(double value) {
  return value != value ? COND_NO_VALUE : (int64_t)value;
}
#endif

/* A register of the shared Z80 (`cpu`, `z80.c`). Named fields, not `z80.c`'s single-letter macros. */
#ifndef COND_REGISTER
#define COND_REGISTER(id) condCpuRegister(id)
static uint32_t condCpuRegister(uint32_t id) {
  switch (id) {
    case COND_REG_A: return cpu.af.bytes.high;
    case COND_REG_F: return cpu.af.bytes.low;
    case COND_REG_B: return cpu.bc.bytes.high;
    case COND_REG_C: return cpu.bc.bytes.low;
    case COND_REG_D: return cpu.de.bytes.high;
    case COND_REG_E: return cpu.de.bytes.low;
    case COND_REG_H: return cpu.hl.bytes.high;
    case COND_REG_L: return cpu.hl.bytes.low;
    case COND_REG_I: return cpu.ir.bytes.high;
    case COND_REG_R: return cpu.ir.bytes.low;
    case COND_REG_XH: return cpu.ix.bytes.high;
    case COND_REG_XL: return cpu.ix.bytes.low;
    case COND_REG_YH: return cpu.iy.bytes.high;
    case COND_REG_YL: return cpu.iy.bytes.low;
    case COND_REG_AF: return cpu.af.word;
    case COND_REG_BC: return cpu.bc.word;
    case COND_REG_DE: return cpu.de.word;
    case COND_REG_HL: return cpu.hl.word;
    case COND_REG_IX: return cpu.ix.word;
    case COND_REG_IY: return cpu.iy.word;
    case COND_REG_SP: return cpu.sp;
    case COND_REG_PC: return cpu.pc;
    case COND_REG_WZ: return cpu.wz.word;
    case COND_REG_AF_ALT: return cpu.afAlt.word;
    case COND_REG_BC_ALT: return cpu.bcAlt.word;
    case COND_REG_DE_ALT: return cpu.deAlt.word;
    case COND_REG_HL_ALT: return cpu.hlAlt.word;
    default: return 0u;
  }
}
#endif

/* A byte as the CPU sees it now, without side effects (no contention, latch or bus record). */
#ifndef COND_PEEK
#define COND_PEEK(address) 0u
#endif

/* A byte of a partition, whatever is paged in: at `address` modulo the partition's own size. */
#ifndef COND_PEEK_PARTITION
#define COND_PEEK_PARTITION(partition, address) COND_PEEK((address) & 0xffffu)
#endif

/* A byte of a ZX Spectrum Next 16K bank at `offset` ($0000-$3FFF). */
#ifndef COND_PEEK_BANK
#define COND_PEEK_BANK(bank, offset) 0u
#endif

/* The partition paged in at `address`; `COND_NO_VALUE` when there is none. */
#ifndef COND_PARTITION_OF
#define COND_PARTITION_OF(address) COND_NO_VALUE
#endif

/* A Next register's current value, without side effects. */
#ifndef COND_NEXTREG
#define COND_NEXTREG(reg) 0u
#endif

/* T-states since the machine started: the shared Z80's counter. */
#ifndef COND_TSTATES
#define COND_TSTATES() cpu.tacts
#endif

// -----------------------------------------------------------------------------
// The program store
// -----------------------------------------------------------------------------

/*
 * Written by TypeScript through the exported pointers (`DebugSupport`), the way the Next's NextReg
 * watch is. A slot is [offset into the arena, length in words]; length 0 is an empty slot. The token
 * is TypeScript's: a store it did not write (a freshly instantiated core) does not carry it, which
 * is how `DebugSupport` knows to rebuild.
 */
static uint32_t condArena[COND_ARENA_WORDS];
static uint32_t condSlots[COND_SLOT_COUNT][2];
static uint32_t condToken;
static uint32_t condLastStatus;
/* Machine facts the core does not keep itself (the clock, the frame counter), written by TypeScript
 * before a program that reads them runs (`COND_OP_ENV`). */
static uint32_t condEnv[COND_ENV_COUNT];

uint32_t condArenaPtr(void) { return (uint32_t)(uintptr_t)condArena; }
uint32_t condArenaCapacity(void) { return COND_ARENA_WORDS; }
uint32_t condSlotTablePtr(void) { return (uint32_t)(uintptr_t)condSlots; }
uint32_t condSlotCapacity(void) { return COND_SLOT_COUNT; }
uint32_t condMaxProgramWords(void) { return COND_MAX_PROGRAM_WORDS; }
uint32_t condGetToken(void) { return condToken; }
void condSetToken(uint32_t token) { condToken = token; }
/* The status of the last evaluation: `COND_RESULT_*` (for `condEvaluateValue`). */
uint32_t condGetLastStatus(void) { return condLastStatus; }
/* Write one `COND_OP_ENV` fact. */
void condSetEnv(uint32_t index, uint32_t value) {
  if (index < COND_ENV_COUNT) condEnv[index] = value;
}
/* A byte as the CPU sees it now, without side effects - a logpoint's `string` format reads with it. */
uint32_t condPeek(uint32_t address) { return COND_PEEK(address & 0xffffu) & 0xffu; }

// -----------------------------------------------------------------------------
// Evaluation
// -----------------------------------------------------------------------------

/* JavaScript's ToInt32, with "no value" read as 0 (what `NaN | 0` gives) */
static inline int32_t condInt32(int64_t value) {
  return value == COND_NO_VALUE ? 0 : (int32_t)(uint32_t)(uint64_t)value;
}

static inline int64_t condSigned(int64_t value, uint32_t bits) {
  if (bits == 32u) return condInt32(value);
  const int32_t mask = bits == 8u ? 0xff : 0xffff;
  const int32_t sign = bits == 8u ? 0x80 : 0x8000;
  return ((condInt32(value) & mask) ^ sign) - sign;
}

/* A 1, 2 or 4 byte read, wrapping inside its address space (64K, the partition, the bank). */
static int64_t condRead(uint32_t info, int32_t part, int64_t addressValue) {
  const uint32_t width = info & 0x0fu;
  const uint32_t kind = (info >> 8) & 0x03u;
  const int32_t address = condInt32(addressValue);
  int64_t value = 0;
  for (uint32_t i = 0; i < width; i++) {
    uint32_t byte;
    const uint32_t at = (uint32_t)(address + (int32_t)i);
    if (kind == COND_PART_BANK) {
      byte = COND_PEEK_BANK((uint32_t)part, at & 0x3fffu) & 0xffu;
    } else if (kind == COND_PART_PARTITION) {
      byte = COND_PEEK_PARTITION(part, at) & 0xffu;
    } else {
      byte = COND_PEEK(at & 0xffffu) & 0xffu;
    }
    const uint32_t position = (info & COND_MEM_BE) ? width - 1u - i : i;
    value |= (int64_t)byte << (8u * position);
  }
  return (info & COND_MEM_SIGNED) ? condSigned(value, width * 8u) : value;
}

/*
 * Run a program. Returns `COND_RESULT_*`; the value of the expression in `*result`.
 *
 * Every malformed program - an unknown op, a bad jump, the stack over- or under-flowing, a program
 * running off its end - is an error, which `DebugSupport` treats as "true" (fail-safe, C15).
 */
static uint32_t condRun(
  const uint32_t *code,
  uint32_t length,
  int64_t accessValue,
  int64_t accessAddress,
  int64_t *result
) {
  int64_t stack[COND_STACK_DEPTH];
  uint32_t depth = 0;
  if (length < 2u || code[0] != COND_FORMAT) return COND_RESULT_ERROR;

#define COND_NEED(n) \
  if (depth < (n)) return COND_RESULT_ERROR
#define COND_PUSH(v) \
  do { \
    if (depth >= COND_STACK_DEPTH) return COND_RESULT_ERROR; \
    stack[depth++] = (v); \
  } while (0)
#define COND_OPERAND(at) \
  if ((at) >= length) return COND_RESULT_ERROR

  uint32_t pc = 1u;
  while (pc < length) {
    const uint32_t op = code[pc++];
    switch (op) {
      case COND_OP_END:
        COND_NEED(1u);
        *result = stack[depth - 1u];
        return stack[depth - 1u] != 0 ? COND_RESULT_TRUE : COND_RESULT_FALSE;

      case COND_OP_CONST: {
        COND_OPERAND(pc + 1u);
        const uint64_t bits = (uint64_t)code[pc] | ((uint64_t)code[pc + 1u] << 32);
        pc += 2u;
        COND_PUSH((int64_t)bits);
        break;
      }
      case COND_OP_REG:
        COND_OPERAND(pc);
        COND_PUSH((int64_t)COND_REGISTER(code[pc]));
        pc++;
        break;
      case COND_OP_FLAG:
        COND_OPERAND(pc);
        COND_PUSH((int64_t)((COND_REGISTER(COND_REG_F) >> (code[pc] & 7u)) & 1u));
        pc++;
        break;
      case COND_OP_VAL:
        COND_PUSH(accessValue);
        break;
      case COND_OP_ADDR:
        COND_PUSH(accessAddress);
        break;

      case COND_OP_MEM: {
        COND_OPERAND(pc + 1u);
        COND_NEED(1u);
        const uint32_t info = code[pc];
        const int32_t part = (int32_t)code[pc + 1u];
        pc += 2u;
        const uint32_t width = info & 0x0fu;
        if (width != 1u && width != 2u && width != 4u) return COND_RESULT_ERROR;
        stack[depth - 1u] = condRead(info, part, stack[depth - 1u]);
        break;
      }
      case COND_OP_PAGE:
        COND_NEED(1u);
        stack[depth - 1u] = COND_PARTITION_OF((uint32_t)condInt32(stack[depth - 1u]) & 0xffffu);
        break;
      case COND_OP_NR:
        COND_NEED(1u);
        stack[depth - 1u] = (int64_t)(COND_NEXTREG((uint32_t)condInt32(stack[depth - 1u]) & 0xffu) & 0xffu);
        break;
      case COND_OP_S8:
      case COND_OP_S16:
      case COND_OP_S32:
        COND_NEED(1u);
        stack[depth - 1u] = condSigned(stack[depth - 1u], op == COND_OP_S8 ? 8u : op == COND_OP_S16 ? 16u : 32u);
        break;

      case COND_OP_NOT:
        COND_NEED(1u);
        stack[depth - 1u] = stack[depth - 1u] == 0 ? 1 : 0;
        break;
      case COND_OP_BNOT:
        COND_NEED(1u);
        stack[depth - 1u] = (int64_t)(uint32_t)~(uint32_t)condInt32(stack[depth - 1u]);
        break;
      case COND_OP_NEG:
        COND_NEED(1u);
        if (stack[depth - 1u] != COND_NO_VALUE) stack[depth - 1u] = -stack[depth - 1u];
        break;
      case COND_OP_BOOL:
        COND_NEED(1u);
        stack[depth - 1u] = stack[depth - 1u] != 0 ? 1 : 0;
        break;
      case COND_OP_TSTATES:
        COND_PUSH((int64_t)(uint32_t)COND_TSTATES());
        break;
      case COND_OP_ENV:
        COND_OPERAND(pc);
        if (code[pc] >= COND_ENV_COUNT) return COND_RESULT_ERROR;
        COND_PUSH((int64_t)condEnv[code[pc]]);
        pc++;
        break;

      case COND_OP_MUL:
      case COND_OP_DIV:
      case COND_OP_MOD: {
        COND_NEED(2u);
        const int64_t r = stack[--depth];
        const int64_t l = stack[depth - 1u];
        if (l == COND_NO_VALUE || r == COND_NO_VALUE) {
          stack[depth - 1u] = COND_NO_VALUE;
          break;
        }
        if (op == COND_OP_MUL) {
          /* Wrapping, not undefined, on the (unrealistic) 64-bit overflow */
          stack[depth - 1u] = (int64_t)((uint64_t)l * (uint64_t)r);
          break;
        }
        if (r == 0) return COND_RESULT_DIVZERO;
        if (r == -1) {
          /* `INT64_MIN / -1` overflows; `l` is never INT64_MIN here (that is "no value") */
          stack[depth - 1u] = op == COND_OP_DIV ? -l : 0;
          break;
        }
        /* C99 division truncates toward zero, and `%` takes the sign of the dividend */
        stack[depth - 1u] = op == COND_OP_DIV ? l / r : l % r;
        break;
      }

      case COND_OP_ANDJ:
      case COND_OP_ORJ: {
        COND_OPERAND(pc);
        COND_NEED(1u);
        const uint32_t target = code[pc++];
        if (target >= length || target <= pc - 2u) return COND_RESULT_ERROR;
        const int64_t top = stack[depth - 1u];
        if (op == COND_OP_ANDJ ? top == 0 : top != 0) {
          stack[depth - 1u] = op == COND_OP_ANDJ ? 0 : 1;
          pc = target;
        } else {
          depth--;
        }
        break;
      }

      default: {
        if (op < COND_OP_ADD || op > COND_OP_GE) return COND_RESULT_ERROR;
        COND_NEED(2u);
        const int64_t r = stack[--depth];
        const int64_t l = stack[depth - 1u];
        const int noValue = l == COND_NO_VALUE || r == COND_NO_VALUE;
        int64_t v;
        switch (op) {
          case COND_OP_ADD: v = noValue ? COND_NO_VALUE : l + r; break;
          case COND_OP_SUB: v = noValue ? COND_NO_VALUE : l - r; break;
          case COND_OP_AND: v = (int64_t)(uint32_t)(condInt32(l) & condInt32(r)); break;
          case COND_OP_OR: v = (int64_t)(uint32_t)(condInt32(l) | condInt32(r)); break;
          case COND_OP_XOR: v = (int64_t)(uint32_t)(condInt32(l) ^ condInt32(r)); break;
          case COND_OP_SHL:
            v = (int32_t)((uint32_t)condInt32(l) << ((uint32_t)condInt32(r) & 31u));
            break;
          case COND_OP_SHR: v = condInt32(l) >> ((uint32_t)condInt32(r) & 31u); break;
          case COND_OP_USHR: v = (int64_t)((uint32_t)condInt32(l) >> ((uint32_t)condInt32(r) & 31u)); break;
          case COND_OP_EQ: v = !noValue && l == r; break;
          case COND_OP_NE: v = noValue || l != r; break;
          case COND_OP_LT: v = !noValue && l < r; break;
          case COND_OP_LE: v = !noValue && l <= r; break;
          case COND_OP_GT: v = !noValue && l > r; break;
          default: v = !noValue && l >= r; break; /* COND_OP_GE */
        }
        stack[depth - 1u] = v;
        break;
      }
    }
  }
  return COND_RESULT_ERROR; /* ran off the end without END */

#undef COND_NEED
#undef COND_PUSH
#undef COND_OPERAND
}

static uint32_t condRunSlot(uint32_t slot, int64_t accessValue, int64_t accessAddress, int64_t *result) {
  if (slot >= COND_SLOT_COUNT) return COND_RESULT_ERROR;
  const uint32_t offset = condSlots[slot][0];
  const uint32_t length = condSlots[slot][1];
  if (length == 0u || length > COND_MAX_PROGRAM_WORDS || offset > COND_ARENA_WORDS - length) {
    return COND_RESULT_ERROR;
  }
  return condRun(&condArena[offset], length, accessValue, accessAddress, result);
}

/*
 * Is the condition in `slot` true? `COND_RESULT_TRUE`, `_FALSE`, `_ERROR` for a malformed or
 * missing program, or `_DIVZERO` when it divided by zero (an error, for the caller). `accessValue` / `accessAddress` are `VAL` / `ADDR` (0 where there is no access).
 */
uint32_t condEvaluate(uint32_t slot, uint32_t accessValue, uint32_t accessAddress) {
  int64_t result = 0;
  condLastStatus = condRunSlot(slot, accessValue, accessAddress, &result);
  return condLastStatus;
}

/*
 * The expression's value rather than its truth - what the language tests check. "No value" comes
 * back as `INT64_MIN`; the status of the run is in `condGetLastStatus()`.
 */
int64_t condEvaluateValue(uint32_t slot, uint32_t accessValue, uint32_t accessAddress) {
  int64_t result = 0;
  condLastStatus = condRunSlot(slot, accessValue, accessAddress, &result);
  return condLastStatus == COND_RESULT_ERROR ? 0 : result;
}
