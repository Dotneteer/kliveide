import type {
  ConditionBinaryOp,
  ConditionFunction,
  ConditionSpan,
  ConditionUnaryOp
} from "./condition-types";
import { ConditionSyntaxError, type Token, tokenizeCondition } from "./condition-lexer";

/*
 * The condition parser (plan §3.2): text to a syntax tree that still carries names, strings and
 * spans. Resolving names, folding strings and constants, and the static checks of §3.7 are the
 * checker's job (`condition-checker.ts`), so this module knows nothing about machines.
 *
 * Precedence, lowest first: `||`, `&&`, the comparisons (non-associative), `|`, `^`, `&`, the shifts,
 * `+`/`-`, the unary operators. Bitwise and shift bind tighter than comparison (C3).
 */

/** A memory access prefix: `b`, `w`, `l`, their big-endian and signed forms. */
export type AccessType = {
  width: 1 | 2 | 4;
  be: boolean;
  signed: boolean;
  /** The prefix as written, for messages. */
  name: string;
};

/** The syntax tree, before the checker resolves it. */
export type SyntaxNode = ConditionSpan &
  (
    | { k: "num"; v: number }
    | { k: "str"; codes: number[]; text: string }
    | { k: "part"; label: string }
    | { k: "name"; name: string; quoted: boolean }
    | { k: "bankLabel"; bank: string; bankSpan: ConditionSpan; name: string }
    | {
        k: "mem";
        access: AccessType;
        part?: { kind: "partition" | "bank"; text: string; span: ConditionSpan };
        addr: SyntaxNode;
      }
    | { k: "call"; fn: ConditionFunction; arg: SyntaxNode }
    | { k: "un"; op: ConditionUnaryOp; e: SyntaxNode }
    | { k: "bin"; op: ConditionBinaryOp; l: SyntaxNode; r: SyntaxNode }
  );

const ACCESS_TYPES: Record<string, Omit<AccessType, "name">> = {
  b: { width: 1, be: false, signed: false },
  w: { width: 2, be: false, signed: false },
  wle: { width: 2, be: false, signed: false },
  wbe: { width: 2, be: true, signed: false },
  l: { width: 4, be: false, signed: false },
  lle: { width: 4, be: false, signed: false },
  lbe: { width: 4, be: true, signed: false },
  sb: { width: 1, be: false, signed: true },
  sw: { width: 2, be: false, signed: true },
  swle: { width: 2, be: false, signed: true },
  swbe: { width: 2, be: true, signed: true },
  sl: { width: 4, be: false, signed: true },
  slle: { width: 4, be: false, signed: true },
  slbe: { width: 4, be: true, signed: true }
};

const FUNCTIONS = new Set<string>(["page", "nr", "s8", "s16", "s32"]);
const RELATIONAL = new Set(["==", "!=", "<", "<=", ">", ">="]);

/**
 * Names the checker resolves to something other than a label. Exported so the parser can tell a
 * bank-local label (`05:Flags`) from a partition-qualified address (`05:HL`).
 */
export const RESERVED_NAMES = new Set<string>([
  "a", "f", "b", "c", "d", "e", "h", "l", "i", "r",
  "ixh", "ixl", "iyh", "iyl", "xh", "xl", "yh", "yl",
  "af", "bc", "de", "hl", "ix", "iy", "sp", "pc", "wz",
  "af'", "bc'", "de'", "hl'",
  "sf", "zf", "f5f", "yf", "hf", "f3f", "xf", "pvf", "pf", "vf", "nf", "cf",
  "val", "addr"
]);

/** Parse a condition. Throws `ConditionSyntaxError`. */
export function parseCondition(text: string): SyntaxNode {
  const tokens = tokenizeCondition(text);
  if (tokens.length === 1) {
    throw new ConditionSyntaxError("The condition is empty", 0, text.length);
  }
  const parser = new Parser(tokens);
  const tree = parser.condition();
  const rest = parser.peek();
  if (rest.kind !== "eof") {
    throw new ConditionSyntaxError(
      rest.kind === "op" && rest.text === ")"
        ? "Unbalanced ')'"
        : rest.kind === "op" && rest.text === "]"
          ? "Unbalanced ']'"
          : `Unexpected '${describe(rest)}'`,
      rest.start,
      rest.end
    );
  }
  return tree;
}

function describe(token: Token): string {
  return token.kind === "eof" ? "end of condition" : token.text;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== "eof") this.index++;
    return token;
  }

  private isOp(text: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === "op" && token.text === text;
  }

  private expectOp(text: string, opening?: Token): Token {
    const token = this.peek();
    if (token.kind === "op" && token.text === text) return this.next();
    if (opening) {
      throw new ConditionSyntaxError(
        `Missing '${text}' to close the '${opening.text}' at column ${opening.start + 1}`,
        token.start,
        token.end
      );
    }
    throw new ConditionSyntaxError(
      `Expected '${text}' but found '${describe(token)}'`,
      token.start,
      token.end
    );
  }

  condition(): SyntaxNode {
    return this.leftAssoc(() => this.logicalAnd(), ["||"]);
  }

  private logicalAnd(): SyntaxNode {
    return this.leftAssoc(() => this.relation(), ["&&"]);
  }

  private relation(): SyntaxNode {
    const left = this.bitOr();
    const token = this.peek();
    if (token.kind !== "op" || !RELATIONAL.has(token.text)) return left;
    this.next();
    const right = this.bitOr();
    const after = this.peek();
    if (after.kind === "op" && RELATIONAL.has(after.text)) {
      throw new ConditionSyntaxError(
        "Comparisons cannot be chained; join them with && (a < b && b < c)",
        after.start,
        after.end
      );
    }
    return bin(token.text as ConditionBinaryOp, left, right);
  }

  /** The bitwise and arithmetic levels, highest last. */
  bitOr(): SyntaxNode {
    return this.leftAssoc(() => this.bitXor(), ["|"]);
  }

  private bitXor(): SyntaxNode {
    return this.leftAssoc(() => this.bitAnd(), ["^"]);
  }

  private bitAnd(): SyntaxNode {
    return this.leftAssoc(() => this.shift(), ["&"]);
  }

  private shift(): SyntaxNode {
    return this.leftAssoc(() => this.additive(), ["<<", ">>", ">>>"]);
  }

  private additive(): SyntaxNode {
    return this.leftAssoc(() => this.unary(), ["+", "-"]);
  }

  private leftAssoc(operand: () => SyntaxNode, ops: string[]): SyntaxNode {
    let left = operand();
    while (true) {
      const token = this.peek();
      if (token.kind !== "op" || !ops.includes(token.text)) return left;
      this.next();
      left = bin(token.text as ConditionBinaryOp, left, operand());
    }
  }

  private unary(): SyntaxNode {
    const token = this.peek();
    if (token.kind === "op" && (token.text === "!" || token.text === "~" || token.text === "-")) {
      this.next();
      const e = this.unary();
      return { k: "un", op: token.text as ConditionUnaryOp, e, start: token.start, end: e.end };
    }
    return this.primary();
  }

  private primary(): SyntaxNode {
    const token = this.peek();
    switch (token.kind) {
      case "num":
        this.next();
        return { k: "num", v: token.value!, start: token.start, end: token.end };
      case "str":
        this.next();
        return { k: "str", codes: token.codes!, text: token.text, start: token.start, end: token.end };
      case "part":
        this.next();
        return { k: "part", label: token.text, start: token.start, end: token.end };
      case "quoted":
        this.next();
        return { k: "name", name: token.text, quoted: true, start: token.start, end: token.end };
      case "spec":
        return this.bankLabel();
      case "ident": {
        const lower = token.text.toLowerCase();
        // --- An access prefix only directly before `[`, a function only directly before `(`:
        // --- elsewhere these are ordinary labels.
        if (ACCESS_TYPES[lower] && this.isOp("[", 1)) {
          this.next();
          return this.memAccess({ ...ACCESS_TYPES[lower], name: lower }, token.start);
        }
        if (FUNCTIONS.has(lower) && this.isOp("(", 1)) {
          this.next();
          const open = this.next();
          const arg = this.condition();
          const close = this.expectOp(")", open);
          return {
            k: "call",
            fn: lower as ConditionFunction,
            arg,
            start: token.start,
            end: close.end
          };
        }
        this.next();
        return { k: "name", name: token.text, quoted: false, start: token.start, end: token.end };
      }
      case "op":
        if (token.text === "(") {
          this.next();
          const inner = this.condition();
          const close = this.expectOp(")", token);
          return { ...inner, start: token.start, end: close.end };
        }
        if (token.text === "[") {
          return this.memAccess({ ...ACCESS_TYPES.b, name: "b" }, token.start);
        }
        throw new ConditionSyntaxError(
          `Unexpected '${token.text}'; expected a value`,
          token.start,
          token.end
        );
      default:
        throw new ConditionSyntaxError(
          "The condition ends where a value is expected",
          token.start,
          token.end
        );
    }
  }

  /** `<bank>:<label>` outside brackets, or as the start of a bank-local address inside them. */
  private bankLabel(): SyntaxNode {
    const spec = this.next();
    this.expectOp(":");
    const name = this.peek();
    if (name.kind !== "ident" && name.kind !== "quoted") {
      throw new ConditionSyntaxError(
        `'${spec.text}:' must be followed by a label here; a partition or bank address is only valid inside [ ]`,
        spec.start,
        name.end
      );
    }
    this.next();
    return {
      k: "bankLabel",
      bank: spec.text,
      bankSpan: { start: spec.start, end: spec.end },
      name: name.text,
      start: spec.start,
      end: name.end
    };
  }

  private memAccess(access: AccessType, start: number): SyntaxNode {
    const open = this.expectOp("[");
    let part: { kind: "partition" | "bank"; text: string; span: ConditionSpan } | undefined;
    let addr: SyntaxNode;

    const spec = this.peek();
    if (spec.kind === "spec") {
      const afterColon = this.peek(2);
      const span = { start: spec.start, end: spec.end };
      if (afterColon.kind === "op" && afterColon.text === "+") {
        // --- `<bank>:+<offset>`: a ZX Spectrum Next 16K bank
        this.next();
        this.next();
        this.next();
        part = { kind: "bank", text: spec.text, span };
        addr = this.condition();
      } else if (
        afterColon.kind === "quoted" ||
        (afterColon.kind === "ident" && !RESERVED_NAMES.has(afterColon.text.toLowerCase()))
      ) {
        // --- `<bank>:<label>`: the label's offset inside the bank; the address expression starts
        // --- with the bank label itself, so `[05:Table+2]` works.
        part = { kind: "bank", text: spec.text, span };
        addr = this.condition();
      } else {
        // --- `<partition>:<address>`
        this.next();
        this.next();
        part = { kind: "partition", text: spec.text, span };
        addr = this.condition();
      }
    } else {
      addr = this.condition();
    }
    const close = this.expectOp("]", open);
    return { k: "mem", access, part, addr, start, end: close.end };
  }
}

function bin(op: ConditionBinaryOp, l: SyntaxNode, r: SyntaxNode): SyntaxNode {
  return { k: "bin", op, l, r, start: l.start, end: r.end };
}
