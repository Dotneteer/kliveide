import type { CompiledCondition, CondNode, ConditionBinaryOp, ConditionRegister } from "./condition-types";

/*
 * The bytecode a compiled condition runs as, and the emitter that produces it.
 *
 * `.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §4.1. The evaluator is C
 * (`src/emu/z80/wasm/z80-condition.c`), included in every Z80 core; TypeScript only emits. **Keep
 * every number here in step with the `COND_*` defines there** - the format word guards against a
 * program from a different front end, nothing guards against a renumbered op.
 */

/** The first word of every program: "CN", format 1. */
export const CONDITION_FORMAT = 0x434e0001;

export const CondOp = {
  END: 0,
  CONST: 1,
  REG: 2,
  FLAG: 3,
  VAL: 4,
  ADDR: 5,
  MEM: 6,
  PAGE: 7,
  NR: 8,
  S8: 9,
  S16: 10,
  S32: 11,
  NOT: 12,
  BNOT: 13,
  NEG: 14,
  ADD: 15,
  SUB: 16,
  AND: 17,
  OR: 18,
  XOR: 19,
  SHL: 20,
  SHR: 21,
  USHR: 22,
  EQ: 23,
  NE: 24,
  LT: 25,
  LE: 26,
  GT: 27,
  GE: 28,
  ANDJ: 29,
  ORJ: 30,
  BOOL: 31,
  MUL: 32,
  DIV: 33,
  MOD: 34,
  TSTATES: 35,
  ENV: 36
} as const;

/** `ENV` indexes: the facts TypeScript writes with `condSetEnv` (`COND_ENV_*`). */
export const CondEnv = { CPUFREQ: 0, FRAME: 1 } as const;

/** `MEM` info word: width in bits 0-3, then these flags; the part kind in bits 8-9. */
export const MEM_BE = 0x10;
export const MEM_SIGNED = 0x20;
export const PART_PARTITION = 1;
export const PART_BANK = 2;

/** Register ids, in the order of the C `COND_REG_*` defines. */
export const CONDITION_REGISTER_IDS: readonly ConditionRegister[] = [
  "A", "F", "B", "C", "D", "E", "H", "L", "I", "R",
  "XH", "XL", "YH", "YL",
  "AF", "BC", "DE", "HL", "IX", "IY", "SP", "PC", "WZ",
  "AF'", "BC'", "DE'", "HL'"
];

/** The largest program a core stores for one condition (`COND_MAX_PROGRAM_WORDS`). */
export const MAX_PROGRAM_WORDS = 1024;

/** How many values a program may hold at once (`COND_STACK_DEPTH`). */
export const MAX_STACK_DEPTH = 64;

/** The value `condEvaluateValue` returns for "nothing is paged there" (`COND_NO_VALUE`). */
export const NO_VALUE = -(2n ** 63n);

const BINARY_OPS: Record<Exclude<ConditionBinaryOp, "&&" | "||">, number> = {
  "*": CondOp.MUL,
  "/": CondOp.DIV,
  "%": CondOp.MOD,
  "+": CondOp.ADD,
  "-": CondOp.SUB,
  "&": CondOp.AND,
  "|": CondOp.OR,
  "^": CondOp.XOR,
  "<<": CondOp.SHL,
  ">>": CondOp.SHR,
  ">>>": CondOp.USHR,
  "==": CondOp.EQ,
  "!=": CondOp.NE,
  "<": CondOp.LT,
  "<=": CondOp.LE,
  ">": CondOp.GT,
  ">=": CondOp.GE
};

/**
 * The program for a compiled condition, with its labels as currently bound. Re-emit after
 * `bindCondition`: a label's value is a constant in the program (E10).
 */
export function emitCondition(compiled: Pick<CompiledCondition, "tree" | "values">): Uint32Array {
  const words: number[] = [CONDITION_FORMAT];
  emitNode(compiled.tree, compiled.values, words);
  words.push(CondOp.END);
  return Uint32Array.from(words);
}

/** How many values evaluating the tree holds at once - the checker refuses a deeper condition. */
export function stackDepthOf(node: CondNode): number {
  switch (node.k) {
    case "mem":
      return stackDepthOf(node.addr);
    case "call":
      return stackDepthOf(node.arg);
    case "un":
      return stackDepthOf(node.e);
    case "bin":
      // --- `&&`/`||` drop the left value before the right one is computed
      return node.op === "&&" || node.op === "||"
        ? Math.max(stackDepthOf(node.l), stackDepthOf(node.r))
        : Math.max(stackDepthOf(node.l), stackDepthOf(node.r) + 1);
    default:
      return 1;
  }
}

function emitConst(value: number, words: number[]): void {
  const bits = BigInt.asUintN(64, BigInt(value));
  words.push(CondOp.CONST, Number(bits & 0xffffffffn), Number(bits >> 32n));
}

function emitNode(node: CondNode, values: number[], words: number[]): void {
  switch (node.k) {
    case "num":
      emitConst(node.v, words);
      return;
    case "label":
      emitConst(values[node.slot] ?? 0, words);
      return;
    case "reg":
      words.push(CondOp.REG, CONDITION_REGISTER_IDS.indexOf(node.r));
      return;
    case "flag":
      words.push(CondOp.FLAG, node.bit);
      return;
    case "special":
      words.push(node.s === "val" ? CondOp.VAL : CondOp.ADDR);
      return;
    case "machine":
      if (node.fn === "tstates") words.push(CondOp.TSTATES);
      else words.push(CondOp.ENV, node.fn === "cpufreq" ? CondEnv.CPUFREQ : CondEnv.FRAME);
      return;
    case "mem": {
      emitNode(node.addr, values, words);
      const kind = node.part?.kind === "bank" ? PART_BANK : node.part ? PART_PARTITION : 0;
      const info =
        node.width | (node.be ? MEM_BE : 0) | (node.signed ? MEM_SIGNED : 0) | (kind << 8);
      const part = node.part?.kind === "bank" ? node.part.bank : node.part ? node.part.index : 0;
      words.push(CondOp.MEM, info >>> 0, part >>> 0);
      return;
    }
    case "call": {
      emitNode(node.arg, values, words);
      const op =
        node.fn === "page"
          ? CondOp.PAGE
          : node.fn === "nr"
            ? CondOp.NR
            : node.fn === "s8"
              ? CondOp.S8
              : node.fn === "s16"
                ? CondOp.S16
                : CondOp.S32;
      words.push(op);
      return;
    }
    case "un":
      emitNode(node.e, values, words);
      words.push(node.op === "!" ? CondOp.NOT : node.op === "~" ? CondOp.BNOT : CondOp.NEG);
      return;
    case "bin": {
      emitNode(node.l, values, words);
      if (node.op === "&&" || node.op === "||") {
        // --- Short-circuit: the right side is not evaluated when the left decides
        words.push(node.op === "&&" ? CondOp.ANDJ : CondOp.ORJ, 0);
        const patch = words.length - 1;
        emitNode(node.r, values, words);
        words.push(CondOp.BOOL);
        words[patch] = words.length;
        return;
      }
      emitNode(node.r, values, words);
      words.push(BINARY_OPS[node.op]);
      return;
    }
  }
}

/** Does the tree read a fact TypeScript must write first (`ENV`: the clock, the frame counter)? */
export function usesConditionEnv(node: CondNode): boolean {
  switch (node.k) {
    case "machine":
      return node.fn !== "tstates";
    case "mem":
      return usesConditionEnv(node.addr);
    case "call":
      return usesConditionEnv(node.arg);
    case "un":
      return usesConditionEnv(node.e);
    case "bin":
      return usesConditionEnv(node.l) || usesConditionEnv(node.r);
    default:
      return false;
  }
}
