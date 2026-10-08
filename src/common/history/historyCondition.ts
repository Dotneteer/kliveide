import type { CompiledCondition, CondNode, ConditionRegister } from "@common/utils/breakpoint-condition/condition-types";
import type { HistoryRegisters } from "./historyRecord";

/*
 * Breakpoint conditions evaluated against a history record (`.plans/LITE_STEP_BACK_PLAN.md` D11,
 * T5). The one evaluator of the language is C (`src/emu/z80/wasm/z80-condition.c`), and it reads the
 * live CPU and memory. Reverse Continue needs the *recorded* registers, and a record holds nothing
 * else - so this evaluates only conditions built from registers, flags, constants, labels and the
 * `s8`/`s16`/`s32` conversions. Anything that reads memory, a port value, a partition, a Next
 * register or a machine counter cannot be answered in the past: the condition is then "not
 * evaluable", and Reverse Continue counts the breakpoint as hit (Q5: over-stopping is the safe failure).
 *
 * The arithmetic is the C evaluator's, operator for operator: values are 64-bit integers, `& | ^ ~`
 * give unsigned 32-bit results, the shifts are JavaScript's, `/` truncates and `%` takes the sign of
 * the dividend, and a zero divisor fails safe - it stops, as a live `DIVZERO` does. A differential test
 * (`test/wasm/condition/history-condition-differential.test.ts`) holds the two to the same answers.
 */

export type HistoryConditionResult =
  /** The condition was evaluated against the record's registers */
  | { evaluable: true; value: boolean }
  /** The condition reads something a record does not hold */
  | { evaluable: false; reason: string };

/** Why a node cannot be evaluated in the past, or undefined when it can */
export function historyConditionObstacle(node: CondNode): string | undefined {
  switch (node.k) {
    case "num":
    case "label":
    case "reg":
    case "flag":
      return undefined;
    case "mem":
      return "it reads memory";
    case "special":
      return "it reads the accessed value or address";
    case "machine":
      return node.fn === "frame" ? "it reads the frame counter" : "it reads a machine counter";
    case "call":
      if (node.fn === "page") return "it reads the memory paging";
      if (node.fn === "nr") return "it reads a Next register";
      return historyConditionObstacle(node.arg);
    case "un":
      return historyConditionObstacle(node.e);
    case "bin":
      return historyConditionObstacle(node.l) ?? historyConditionObstacle(node.r);
  }
}

/** A register's value from a record */
export function historyRegister(regs: HistoryRegisters, register: ConditionRegister): number {
  const hi = (w: number) => (w >> 8) & 0xff;
  const lo = (w: number) => w & 0xff;
  switch (register) {
    case "A": return hi(regs.af);
    case "F": return lo(regs.af);
    case "B": return hi(regs.bc);
    case "C": return lo(regs.bc);
    case "D": return hi(regs.de);
    case "E": return lo(regs.de);
    case "H": return hi(regs.hl);
    case "L": return lo(regs.hl);
    case "I": return hi(regs.ir);
    case "R": return lo(regs.ir);
    case "XH": return hi(regs.ix);
    case "XL": return lo(regs.ix);
    case "YH": return hi(regs.iy);
    case "YL": return lo(regs.iy);
    case "AF": return regs.af;
    case "BC": return regs.bc;
    case "DE": return regs.de;
    case "HL": return regs.hl;
    case "IX": return regs.ix;
    case "IY": return regs.iy;
    case "SP": return regs.sp;
    case "PC": return regs.pc;
    case "WZ": return regs.wz;
    case "AF'": return regs.af_;
    case "BC'": return regs.bc_;
    case "DE'": return regs.de_;
    case "HL'": return regs.hl_;
  }
}

/** A zero divisor: the C evaluator's `COND_RESULT_DIVZERO`, which stops (`ConditionResult`) */
class DivideByZero extends Error {}

const i64 = (v: bigint) => BigInt.asIntN(64, v);
/** JavaScript's ToInt32 (`condInt32`) */
const i32 = (v: bigint) => BigInt.asIntN(32, v);
const u32 = (v: bigint) => BigInt.asUintN(32, v);
const bool = (b: boolean) => (b ? 1n : 0n);

function signed(value: bigint, bits: 8 | 16 | 32): bigint {
  if (bits === 32) return i32(value);
  const mask = bits === 8 ? 0xffn : 0xffffn;
  const sign = bits === 8 ? 0x80n : 0x8000n;
  return ((i32(value) & mask) ^ sign) - sign;
}

function evaluate(node: CondNode, regs: HistoryRegisters, values: readonly number[]): bigint {
  switch (node.k) {
    case "num":
      return i64(BigInt(Math.trunc(node.v)));
    case "label":
      return i64(BigInt(Math.trunc(values[node.slot] ?? 0)));
    case "reg":
      return BigInt(historyRegister(regs, node.r));
    case "flag":
      return BigInt(((regs.af & 0xff) >> (node.bit & 7)) & 1);
    case "call": {
      const arg = evaluate(node.arg, regs, values);
      if (node.fn === "s8") return signed(arg, 8);
      if (node.fn === "s16") return signed(arg, 16);
      if (node.fn === "s32") return signed(arg, 32);
      throw new Error(`'${node.fn}' is not evaluable in history`);
    }
    case "un": {
      const v = evaluate(node.e, regs, values);
      if (node.op === "!") return bool(v === 0n);
      if (node.op === "~") return u32(~i32(v));
      return i64(-v);
    }
    case "bin": {
      const l = evaluate(node.l, regs, values);
      // --- Short-circuit, as the C program's ANDJ/ORJ: the right side runs only when it decides
      if (node.op === "&&") return l === 0n ? 0n : bool(evaluate(node.r, regs, values) !== 0n);
      if (node.op === "||") return l !== 0n ? 1n : bool(evaluate(node.r, regs, values) !== 0n);
      const r = evaluate(node.r, regs, values);
      switch (node.op) {
        case "*":
          return i64(l * r);
        case "/":
        case "%":
          if (r === 0n) throw new DivideByZero();
          if (r === -1n) return node.op === "/" ? i64(-l) : 0n;
          // --- BigInt division truncates toward zero and `%` takes the dividend's sign, as C99's
          return node.op === "/" ? l / r : l % r;
        case "+":
          return i64(l + r);
        case "-":
          return i64(l - r);
        case "&":
          return u32(i32(l) & i32(r));
        case "|":
          return u32(i32(l) | i32(r));
        case "^":
          return u32(i32(l) ^ i32(r));
        case "<<":
          return i32(u32(i32(l)) << (u32(i32(r)) & 31n));
        case ">>":
          return i32(l) >> (u32(i32(r)) & 31n);
        case ">>>":
          return u32(i32(l)) >> (u32(i32(r)) & 31n);
        case "==":
          return bool(l === r);
        case "!=":
          return bool(l !== r);
        case "<":
          return bool(l < r);
        case "<=":
          return bool(l <= r);
        case ">":
          return bool(l > r);
        case ">=":
          return bool(l >= r);
      }
      throw new Error(`Unknown operator '${node.op}'`);
    }
    default:
      throw new Error(`'${node.k}' is not evaluable in history`);
  }
}

/**
 * Evaluates a compiled condition against a record's registers
 * @param compiled The breakpoint's condition, compiled and bound (`DebugSupport`)
 * @param regs The record's registers (the state before the instruction, as at a live stop)
 */
export function evaluateHistoryCondition(
  compiled: Pick<CompiledCondition, "tree" | "values">,
  regs: HistoryRegisters
): HistoryConditionResult {
  const obstacle = historyConditionObstacle(compiled.tree);
  if (obstacle) return { evaluable: false, reason: obstacle };
  try {
    return { evaluable: true, value: evaluate(compiled.tree, regs, compiled.values) !== 0n };
  } catch (err) {
    if (err instanceof DivideByZero) return { evaluable: true, value: true };
    throw err;
  }
}

/** The value of a register-only expression (the differential test compares it with C's) */
export function evaluateHistoryValue(
  compiled: Pick<CompiledCondition, "tree" | "values">,
  regs: HistoryRegisters
): number | "divzero" {
  try {
    return Number(evaluate(compiled.tree, regs, compiled.values));
  } catch (err) {
    if (err instanceof DivideByZero) return "divzero";
    throw err;
  }
}
