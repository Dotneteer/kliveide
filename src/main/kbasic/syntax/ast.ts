import type { Span } from "../diagnostics";
import type { TypeName } from "./keywords";

/**
 * The syntax tree of a ZX BASIC program. Every node has the span of its source text; a statement's
 * span covers the statement only (not the ':' around it, not a trailing comment), which is what the
 * debugger highlights (plan §8.2). The parser builds it from the spec's grammar; what a name means
 * (variable, array, function, label) is the binder's business (Phase 2).
 */
export type Node = { span: Span };

// =================================================================================================
// Expressions

export type NumberLiteral = Node & {
  kind: "number";
  value: number;
  /** The literal as written (a decimal real keeps its digits for exact Float conversion). */
  text: string;
  form: "integer" | "real" | "based";
};

export type StringLiteral = Node & { kind: "string"; value: string };

export type NameRef = Node & { kind: "name"; name: string; sigil?: "$" | "%" };

/** `callee(args)`: a function call, an array element or a string slice, depending on the callee. */
export type CallExpr = Node & { kind: "call"; callee: Expression; args: Argument[]; parens: boolean };

export type UnaryExpr = Node & { kind: "unary"; op: "-" | "+" | "NOT" | "BNOT"; operand: Expression };

export type BinaryOp =
  | "+" | "-" | "*" | "/" | "^" | "MOD"
  | "=" | "<>" | "<" | ">" | "<=" | ">="
  | "AND" | "OR" | "XOR"
  | "BAND" | "BOR" | "BXOR" | "SHL" | "SHR";

export type BinaryExpr = Node & { kind: "binary"; op: BinaryOp; left: Expression; right: Expression };

export type ParenExpr = Node & { kind: "paren"; expression: Expression };

/** `@x`, `@a(1, 2)`, `@label`. */
export type AddressOfExpr = Node & { kind: "addressOf"; target: NameRef | CallExpr };

/** A built-in function (spec `functions`), by its keyword without `$` (CHR$ is CHR). */
export type BuiltinExpr = Node & {
  kind: "builtin";
  name: string;
  args: Expression[];
  /** CAST, PEEK and SIZEOF can take a type. */
  type?: TypeRef;
  parens: boolean;
};

/** `FARPTR x` (CODEBANK extension). */
export type FarPtrExpr = Node & { kind: "farptr"; target: NameRef };

/** An expression the parser could not read; its error is already reported. */
export type ErrorExpr = Node & { kind: "error" };

export type Expression =
  | NumberLiteral
  | StringLiteral
  | NameRef
  | CallExpr
  | UnaryExpr
  | BinaryExpr
  | ParenExpr
  | AddressOfExpr
  | BuiltinExpr
  | FarPtrExpr
  | ErrorExpr;

/** An argument: an expression, a slice range `[a] TO [b]`, or a named argument `name := value`. */
export type Argument =
  | (Node & { kind: "arg"; value: Expression })
  | (Node & { kind: "range"; from?: Expression; to?: Expression })
  | (Node & { kind: "named"; name: NameRef; value: Expression });

export type TypeRef = Node & { kind: "type"; name: TypeName };

// =================================================================================================
// Statements

export type LabelDecl = Node & { kind: "label"; name: string; lineNumber?: number };

export type AttrName = "INK" | "PAPER" | "FLASH" | "BRIGHT" | "INVERSE" | "OVER" | "BOLD" | "ITALIC";
export type AttrModifier = Node & { kind: "attrModifier"; attr: AttrName; value: Expression };

export type PrintItem =
  | (Node & { kind: "expr"; value: Expression })
  | (Node & { kind: "at"; row: Expression; column: Expression })
  | (Node & { kind: "tab"; column: Expression })
  | AttrModifier
  | (Node & { kind: "separator"; separator: ";" | "," });

export type JumpTarget = Node & ({ kind: "lineTarget"; line: number } | { kind: "labelTarget"; name: string });

export type LoopKind = "DO" | "FOR" | "WHILE";

export type Param = Node & {
  kind: "param";
  name: NameRef;
  passing?: "BYVAL" | "BYREF";
  type?: TypeRef;
  defaultValue?: Expression;
  isArray: boolean;
};

export type RoutineHeader = Node & {
  kind: "routineHeader";
  routine: "SUB" | "FUNCTION";
  convention?: "FASTCALL" | "STDCALL";
  name: NameRef;
  params: Param[];
  returnType?: TypeRef;
};

export type DimBound = Node & { kind: "bound"; lower?: Expression; upper: Expression };

/** `{ ... }` of an array initialiser: expressions or nested vectors. */
export type Vector = Node & { kind: "vector"; items: (Expression | Vector)[] };

export type TapeTarget =
  | (Node & { kind: "code"; start?: Expression; length?: Expression })
  | (Node & { kind: "screen" })
  | (Node & { kind: "data"; variable?: NameRef; isArray: boolean });

export type Statement =
  | LabelDecl
  | (Node & { kind: "print"; items: PrintItem[] })
  | (Node & { kind: "attribute"; attr: AttrName; value: Expression })
  | (Node & { kind: "border"; value: Expression })
  | (Node & { kind: "beep"; duration: Expression; pitch: Expression })
  | (Node & { kind: "cls" })
  | (Node & { kind: "plot"; attrs: AttrModifier[]; x: Expression; y: Expression })
  | (Node & { kind: "draw"; attrs: AttrModifier[]; x: Expression; y: Expression; angle?: Expression })
  | (Node & { kind: "circle"; attrs: AttrModifier[]; x: Expression; y: Expression; radius: Expression })
  | (Node & { kind: "let"; target: Expression; value: Expression; hasLet: boolean })
  | (Node & { kind: "callStatement"; callee: NameRef; args: Argument[]; parens: boolean })
  | (Node & {
      kind: "dim";
      names: NameRef[];
      type?: TypeRef;
      bounds?: DimBound[];
      initialValue?: Expression;
      at?: Expression;
      vector?: Vector;
    })
  | (Node & { kind: "const"; name: NameRef; type?: TypeRef; value: Expression })
  | (Node & {
      kind: "if";
      condition: Expression;
      then: Statement[];
      elseIfs: (Node & { condition: Expression; body: Statement[] })[];
      else?: Statement[];
      singleLine: boolean;
    })
  | (Node & {
      kind: "for";
      variable: NameRef;
      from: Expression;
      to: Expression;
      step?: Expression;
      body: Statement[];
      next: Node & { variable?: NameRef };
    })
  | (Node & { kind: "while"; condition: Expression; body: Statement[]; end: Node })
  | (Node & {
      kind: "do";
      test: "none" | "preUntil" | "preWhile" | "postUntil" | "postWhile";
      condition?: Expression;
      body: Statement[];
      loop: Node;
    })
  | (Node & { kind: "exit"; loop: LoopKind })
  | (Node & { kind: "continue"; loop: LoopKind })
  | (Node & { kind: "goto"; target: JumpTarget })
  | (Node & { kind: "gosub"; target: JumpTarget })
  | (Node & { kind: "on"; selector: Expression; jump: "GOTO" | "GOSUB"; targets: JumpTarget[] })
  | (Node & { kind: "return"; value?: Expression })
  | (Node & { kind: "end"; value?: Expression })
  | (Node & { kind: "stop"; value?: Expression })
  | (Node & { kind: "error"; value: Expression })
  | (Node & {
      kind: "poke";
      type?: TypeRef;
      address: Expression;
      value: Expression;
      parens: boolean;
    })
  | (Node & { kind: "out"; port: Expression; value: Expression })
  | (Node & { kind: "pause"; value: Expression })
  | (Node & { kind: "randomize"; seed?: Expression })
  | (Node & { kind: "read"; targets: Expression[] })
  | (Node & { kind: "data"; items: Expression[] })
  | (Node & { kind: "restore"; target?: JumpTarget })
  | (Node & { kind: "tape"; operation: "LOAD" | "SAVE" | "VERIFY"; name: Expression; target: TapeTarget })
  | (Node & { kind: "routine"; header: RoutineHeader; body: Statement[]; end: Node })
  | (Node & { kind: "declare"; header: RoutineHeader })
  | (Node & { kind: "asm"; lines: (Node & { text: string })[]; end: Node })
  | (Node & { kind: "codebank"; bank: Expression; body: Statement[]; end: Node })
  | (Node & {
      kind: "pragma";
      text: string;
      /** The option (lower case); absent when the line could not be read. */
      name?: string;
      action: "set" | "push" | "pop";
      /** The value as written (strings without their quotes). */
      value?: string;
    });

export type StatementKind = Statement["kind"];

export type Program = Node & {
  kind: "program";
  statements: Statement[];
  /** The comments, which the tree does not otherwise hold (for outline, folding and hover). */
  comments: Span[];
};
