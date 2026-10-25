import type { SourceValueType } from "@abstractions/SourceDebugInfo";

/**
 * The neutral watch AST (`.plans/SHARED_Z80_BACKEND_PLAN.md` §12.3). A language plugin parses a
 * watch into it; `watch-expression.ts` evaluates it, for every language. As in the compiler's MIR,
 * no node has a hidden default meaning where languages disagree: the parser states it.
 */
export type WatchExpr =
  /** `real`: written as a real number (`2.0`), so C's `/` divides it exactly. */
  | { kind: "number"; value: number; real?: boolean }
  | { kind: "string"; value: string }
  /** A variable of the selected frame, or a global. */
  | { kind: "variable"; name: string }
  /** An array element, with the source's subscripts (lower bounds included). */
  | { kind: "element"; name: string; subscripts: WatchExpr[] }
  /** The address of a variable or an element, typed as the language types an address. */
  | { kind: "addressOf"; target: Extract<WatchExpr, { kind: "variable" | "element" }>; type: SourceValueType; typeLabel: string }
  /** The value of a representation at an address. */
  | { kind: "peek"; address: WatchExpr; type: SourceValueType; typeLabel: string }
  | { kind: "unary"; op: "neg" | "plus" | "not" | "bitnot"; operand: WatchExpr; trueValue?: number }
  | {
      kind: "binary";
      op: WatchBinaryOp;
      left: WatchExpr;
      right: WatchExpr;
      /**
       * `div`: `real` divides exactly; `trunc` truncates towards zero; `c` truncates when both
       * operands are whole numbers and divides exactly otherwise (C's `/`).
       * `mod`: `trunc` (the remainder has the dividend's sign), `floor` (the divisor's), or
       * `magnitude` (the remainder of the magnitudes, never negative: BASIC's `MOD`).
       * `shr`: `arith` keeps the sign; otherwise the shift is logical.
       */
      mode?: "real" | "trunc" | "floor" | "magnitude" | "c" | "arith";
      /** `add` of two strings concatenates them (BASIC's `+`). */
      concatStrings?: boolean;
      /** What a comparison or a logical operator gives for true (false is 0); default 1. */
      trueValue?: number;
    }
  /** A call of one of the language's built-ins. */
  | { kind: "builtin"; name: string; args: WatchExpr[] }
  /** A construct the language parses but watches cannot evaluate: the message is the error shown. */
  | { kind: "unsupported"; message: string };

export type WatchBinaryOp =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "mod"
  | "pow"
  | "eq"
  | "ne"
  | "lt"
  | "gt"
  | "le"
  | "ge"
  | "and"
  | "or"
  | "xor"
  | "band"
  | "bor"
  | "bxor"
  | "shl"
  | "shr";

/**
 * A watch's value: a number (with the representation and type it was read as; `real` when it is a
 * real number in the program's terms, whatever its value) or a string.
 */
export type WatchValue =
  | { kind: "number"; value: number; type?: SourceValueType; typeLabel?: string; real?: boolean }
  | { kind: "string"; value: string };
