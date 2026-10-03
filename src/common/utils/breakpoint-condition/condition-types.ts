/*
 * The breakpoint condition language: the types every part of the engine shares.
 *
 * One engine, imported by the IDE (to validate what the user types) and by the emulator (to arm and
 * evaluate it); see `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3 for the language and C1/C2 for why it
 * is parsed on both sides. No imports: the main process and both renderers can load it.
 */

/** A source range, `[start, end)`, 0-based offsets into the condition text. */
export type ConditionSpan = { start: number; end: number };

/** An error that rejects a condition, or a warning that accepts it with a note. */
export type ConditionDiagnostic = ConditionSpan & {
  severity: "error" | "warning";
  message: string;
};

/** The registers a condition can read. Primed names are the shadow set. */
export type ConditionRegister =
  | "A" | "F" | "B" | "C" | "D" | "E" | "H" | "L" | "I" | "R"
  | "XH" | "XL" | "YH" | "YL"
  | "AF" | "BC" | "DE" | "HL" | "IX" | "IY" | "SP" | "PC" | "WZ"
  | "AF'" | "BC'" | "DE'" | "HL'";

/** The operators of a binary node. `&&` and `||` short-circuit. */
export type ConditionBinaryOp =
  | "||" | "&&"
  | "==" | "!=" | "<" | "<=" | ">" | ">="
  | "|" | "^" | "&"
  | "<<" | ">>" | ">>>"
  | "+" | "-";

/** The operators of a unary node. */
export type ConditionUnaryOp = "!" | "~" | "-";

/** The functions a condition can call. */
export type ConditionFunction = "page" | "nr" | "s8" | "s16" | "s32";

/**
 * The evaluation tree (plan §3.8): what the checker produces, with every name resolved, strings and
 * constants folded, and labels bound by slot.
 */
export type CondNode =
  | { k: "num"; v: number }
  | { k: "reg"; r: ConditionRegister }
  | { k: "flag"; bit: number }
  | { k: "special"; s: "val" | "addr" }
  | { k: "label"; slot: number }
  | {
      k: "mem";
      width: 1 | 2 | 4;
      be: boolean;
      signed: boolean;
      part?: { kind: "partition"; index: number } | { kind: "bank"; bank: number };
      addr: CondNode;
    }
  | { k: "call"; fn: ConditionFunction; arg: CondNode }
  | { k: "un"; op: ConditionUnaryOp; e: CondNode }
  | { k: "bin"; op: ConditionBinaryOp; l: CondNode; r: CondNode };

/** Which kind of breakpoint the condition belongs to; decides whether `VAL`/`ADDR` mean anything. */
export type ConditionAccessKind = "exec" | "memory" | "io" | "nextReg";

/**
 * The machine facts the checker needs (plan §3.7 rules 3-5). The IDE builds it from the machine
 * the condition is typed against; the emulator from the machine it runs on.
 */
export type ConditionEnvironment = {
  /** The breakpoint's kind. */
  accessKind: ConditionAccessKind;
  /** Conditions are a Z80 profile (C18); anything else is rejected. Default true. */
  isZ80?: boolean;
  /** Whether the machine has memory partitions (ROM pages, RAM banks). */
  hasPartitions?: boolean;
  /** The ZX Spectrum Next: 16K bank specs and `nr()`. */
  isNext?: boolean;
  /** The machine's partition label parser — the one `bp-set` uses. */
  parsePartitionLabel?: (label: string) => number | undefined;
  /** The partition indexes `page()` can return, for the out-of-range check. */
  partitionRange?: { min: number; max: number };
  /**
   * The current symbol table, when known. Unknown labels become warnings (§3.6), and a reserved name
   * that is also a symbol gets a warning naming the backtick form (R5). Absent: no label warnings.
   */
  symbols?: ConditionSymbols;
};

/**
 * Integer symbols a condition's labels resolve against, keyed lower-case. A bank-local label of a
 * NEX sidecar is keyed with `bankLocalSymbolKey`.
 */
export type ConditionSymbols = Record<string, number>;

/** The symbol-table key of a ZX Spectrum Next bank-local label (`05:Flags`). */
export function bankLocalSymbolKey(bank: number, name: string): string {
  return `${bank}:${name.toLowerCase()}`;
}

/**
 * The machine facts a condition reads - the contract of the C evaluator's `COND_*` hooks
 * (`src/emu/z80/wasm/z80-condition.c`), which each core implements in C. In TypeScript this shape
 * only describes a fake machine for the evaluator's standalone test build
 * (`test/wasm/condition/condition-host.ts`). Every read must be free of side effects: no
 * contention, no floating-bus latch, no access-breakpoint trigger (R3).
 */
export interface ConditionContext {
  reg(id: ConditionRegister): number;
  /** A byte as the CPU sees it now; `address` is 16-bit. */
  readMemory(address: number): number;
  /**
   * A byte of a partition, whatever is paged in. `address` is any CPU address: the context reads
   * the byte at `address` modulo the partition's own size, so consecutive bytes wrap inside the
   * partition and an 8K page and a 16K ROM are both read right.
   */
  readPartition(partition: number, address: number): number;
  /** A byte at `offset` (`$0000-$3FFF`) of a ZX Spectrum Next 16K bank. */
  readBank(bank: number, offset: number): number;
  /** The partition paged in at `address`. */
  partitionOf(address: number): number | undefined;
  /** A Next register's current value. ZX Spectrum Next only. */
  nextReg?(reg: number): number;
  /** `VAL`: the byte read or written, the port value, the NextReg value. */
  accessValue?: number;
  /** `ADDR`: the memory address or the 16-bit port. */
  accessAddress?: number;
}

/**
 * A condition ready to evaluate. Built by `compileCondition`, re-bound by `bindCondition` whenever
 * the symbol table changes. Never persisted, never sent over IPC (C1).
 */
export type CompiledCondition = {
  /** The text it was compiled from. */
  source: string;
  tree: CondNode;
  /** The symbol-table key of each label slot. */
  labels: string[];
  /** The label displayed in messages, per slot. */
  labelNames: string[];
  /** The bound value of each slot. */
  values: number[];
  /** Set while a label is missing from the symbol table (C14): the condition must not stop. */
  inactiveReason?: string;
};
