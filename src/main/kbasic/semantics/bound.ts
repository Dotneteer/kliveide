import type { Span } from "../diagnostics";
import type { AttrName, BinaryOp, LoopKind } from "../syntax/ast";
import type { Constant } from "./constants";
import type { ArraySymbol, LabelSymbol, ParamSymbol, RoutineSymbol, VariableSymbol } from "./symbols";
import type { KType } from "./types";

/**
 * The typed tree the binder produces and code generation consumes: names resolved to symbols, every
 * expression typed, implicit conversions made explicit (`convert` nodes) and constant expressions
 * folded (`constant` set). Statements keep the spans of the syntax they came from, which is what
 * debug information needs (plan §8.2).
 */

// =================================================================================================
// Expressions

type ExprBase = {
  span: Span;
  type: KType;
  /** The value, when the expression is a compile-time constant. */
  constant?: Constant;
};

export type BoundExpr = ExprBase &
  (
    | { kind: "constant" }
    | { kind: "variable"; symbol: VariableSymbol }
    | { kind: "element"; symbol: ArraySymbol; indices: BoundExpr[] }
    /** A whole array: an argument, or either side of a whole-array assignment. */
    | { kind: "array"; symbol: ArraySymbol }
    /** `s(from TO to)`, or `s(i)` for one character; bounds already relative to string_base 0. */
    | { kind: "slice"; target: BoundExpr; from?: BoundExpr; to?: BoundExpr; single: boolean }
    | { kind: "call"; routine: RoutineSymbol; args: BoundArgument[] }
    | { kind: "builtin"; name: string; args: BoundExpr[]; argType?: KType }
    | { kind: "unary"; op: "-" | "NOT" | "BNOT"; operand: BoundExpr }
    | { kind: "binary"; op: BinaryOp; left: BoundExpr; right: BoundExpr; operandType: KType }
    | { kind: "convert"; operand: BoundExpr }
    | { kind: "address"; target: AddressTarget }
    | { kind: "farptr"; target: VariableSymbol | ArraySymbol | RoutineSymbol | LabelSymbol }
    /** Could not be bound; its error is already reported. */
    | { kind: "error" }
  );

export type AddressTarget =
  | { kind: "variable"; symbol: VariableSymbol }
  | { kind: "element"; symbol: ArraySymbol; indices: BoundExpr[] }
  | { kind: "array"; symbol: ArraySymbol }
  | { kind: "label"; label: LabelSymbol }
  | { kind: "routine"; routine: RoutineSymbol };

/** An argument matched to its parameter: a value converted to the parameter's type, or a reference. */
export type BoundArgument = {
  param: ParamSymbol;
  /** Undefined when the parameter's default value is used. */
  value?: BoundExpr;
  /** BYREF: `value` is a variable, an element or an array whose address is passed. */
  byref: boolean;
};

// =================================================================================================
// Statements

type StatementBase = { span: Span };

export type BoundAttr = { attr: AttrName; value: BoundExpr };

export type BoundPrintItem =
  | { kind: "expr"; value: BoundExpr }
  | { kind: "at"; row: BoundExpr; column: BoundExpr }
  | { kind: "tab"; column: BoundExpr }
  | { kind: "attr"; attr: AttrName; value: BoundExpr }
  | { kind: "separator"; separator: ";" | "," };

export type BoundStatement = StatementBase &
  (
    | { kind: "label"; label: LabelSymbol }
    | { kind: "print"; items: BoundPrintItem[] }
    | { kind: "attribute"; attr: AttrName; value: BoundExpr }
    | { kind: "border"; value: BoundExpr }
    | { kind: "beep"; duration: BoundExpr; pitch: BoundExpr }
    | { kind: "cls" }
    | { kind: "plot"; attrs: BoundAttr[]; x: BoundExpr; y: BoundExpr }
    | {
        kind: "draw";
        attrs: BoundAttr[];
        x: BoundExpr;
        y: BoundExpr;
        angle?: BoundExpr;
        /** With an angle: the library routine that draws the arc (`__drawarc.bas`). */
        arc?: RoutineSymbol;
      }
    | { kind: "circle"; attrs: BoundAttr[]; x: BoundExpr; y: BoundExpr; radius: BoundExpr }
    /** `target = value`; value is converted to the target's type (whole arrays: same element type). */
    | { kind: "assign"; target: BoundExpr; value: BoundExpr }
    | { kind: "call"; routine: RoutineSymbol; args: BoundArgument[] }
    /** A DIM that runs code: a local's allocation, or an initial value that is not a constant. */
    | { kind: "dim"; symbol: VariableSymbol | ArraySymbol; value?: BoundExpr }
    /** Each branch's `header` is its own statement for the debugger: `IF c` / `ELSEIF c` (plan §8.2). */
    | { kind: "if"; branches: { header: Span; condition: BoundExpr; body: BoundStatement[] }[]; else?: BoundStatement[] }
    | {
        kind: "for";
        /** `FOR i = a TO b [STEP s]`: initialisation and first test. */
        header: Span;
        variable: BoundExpr;
        from: BoundExpr;
        to: BoundExpr;
        step?: BoundExpr;
        body: BoundStatement[];
        /** `NEXT [i]`: increment and test. */
        next: Span;
      }
    | { kind: "while"; header: Span; condition: BoundExpr; body: BoundStatement[] }
    | {
        kind: "do";
        test: "none" | "preUntil" | "preWhile" | "postUntil" | "postWhile";
        condition?: BoundExpr;
        body: BoundStatement[];
        /** `DO WHILE c` / `DO UNTIL c` for a pre-test; the `LOOP ...` line otherwise. */
        loop: Span;
        doSpan: Span;
      }
    | { kind: "exit" | "continue"; loop: LoopKind }
    | { kind: "goto" | "gosub"; label: LabelSymbol }
    | { kind: "on"; selector: BoundExpr; jump: "GOTO" | "GOSUB"; labels: LabelSymbol[] }
    | { kind: "return"; value?: BoundExpr }
    | { kind: "end" | "stop"; value?: BoundExpr }
    | { kind: "error"; value: BoundExpr }
    | { kind: "poke"; type: KType; address: BoundExpr; value: BoundExpr }
    | { kind: "out"; port: BoundExpr; value: BoundExpr }
    | { kind: "pause"; value: BoundExpr }
    | { kind: "randomize"; seed?: BoundExpr }
    | { kind: "read"; targets: BoundExpr[] }
    | { kind: "data"; items: BoundExpr[] }
    | { kind: "restore"; label?: LabelSymbol }
    | {
        kind: "tape";
        operation: "LOAD" | "SAVE" | "VERIFY";
        name: BoundExpr;
        target:
          | { kind: "code"; start?: BoundExpr; length?: BoundExpr }
          | { kind: "screen" }
          | { kind: "data"; target?: BoundExpr };
      }
    | { kind: "routine"; routine: RoutineSymbol; body: BoundStatement[]; end: Span }
    | { kind: "asm"; lines: { text: string; span: Span }[] }
    | { kind: "codebank"; bank: number; body: BoundStatement[] }
  );

export type BoundProgram = {
  statements: BoundStatement[];
  routines: RoutineSymbol[];
  labels: LabelSymbol[];
};
