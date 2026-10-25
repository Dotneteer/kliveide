import { t as translate } from "@common/i18n/i18n";

import type { DebugLanguageSupport } from "../source/language-support";
import type { WatchBinaryOp, WatchExpr } from "../source/watch-ast";

/**
 * The source-level debugger's C (`language: "c"`: z88dk, `.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §12.4). A small C-expression parser, written for Klive: identifiers, decimal, hex, octal and
 * character literals, strings, `[]` subscripts, `&` (address of), unary `- + ! ~`, and the binary
 * operators by C's precedence. Its meanings are C's: `/` truncates two whole numbers, `%` truncates,
 * `>>` keeps the sign, comparisons and `&& || !` give 1 or 0. Watches compute with JavaScript
 * numbers, so they do not wrap at the width of `int`.
 */

type Token = { kind: "number"; value: number; real?: boolean } | { kind: "string"; value: string } | { kind: "name"; value: string } | { kind: "op"; value: string } | { kind: "end" };

const OPERATORS = ["<<", ">>", "<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "&", "|", "^", "!", "~", "(", ")", "[", "]", ","];
const ESCAPES: Record<string, number> = { n: 10, r: 13, t: 9, "0": 0, "\\": 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11 };

class ParseError extends Error {}
const invalid = (): never => {
  throw new ParseError(translate("panels.side.watchExpr.invalidExpression"));
};

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const escape = (): number => {
    const c = text[i++];
    if (c === "x") {
      const m = /^[0-9a-f]{1,2}/i.exec(text.slice(i)) ?? invalid();
      i += m![0].length;
      return parseInt(m![0], 16);
    }
    return ESCAPES[c] ?? invalid();
  };
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const number = /^(0x[0-9a-f]+|0[0-7]*|[1-9][0-9]*(?:\.[0-9]*)?(?:e[+-]?[0-9]+)?|\.[0-9]+)[uUlL]*/i.exec(text.slice(i));
    if (number) {
      const t = number[1];
      const real = /[.e]/i.test(t) && !/^0x/i.test(t);
      out.push({ kind: "number", value: /^0x/i.test(t) ? parseInt(t, 16) : /^0[0-7]+$/.test(t) ? parseInt(t, 8) : Number(t), ...(real ? { real } : {}) });
      i += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_]\w*/.exec(text.slice(i));
    if (name) {
      out.push({ kind: "name", value: name[0] });
      i += name[0].length;
      continue;
    }
    if (c === "'") {
      i++;
      const value = text[i] === "\\" ? (i++, escape()) : text.charCodeAt(i++);
      if (text[i++] !== "'") invalid();
      out.push({ kind: "number", value });
      continue;
    }
    if (c === '"') {
      i++;
      let value = "";
      while (i < text.length && text[i] !== '"') value += text[i] === "\\" ? (i++, String.fromCharCode(escape())) : text[i++];
      if (text[i++] !== '"') invalid();
      out.push({ kind: "string", value });
      continue;
    }
    const op = OPERATORS.find((o) => text.startsWith(o, i)) ?? invalid();
    out.push({ kind: "op", value: op! });
    i += op!.length;
  }
  out.push({ kind: "end" });
  return out;
}

/** Binary operators by C's precedence (higher binds tighter) and their meaning. */
const BINARY: Record<string, { prec: number; op: WatchBinaryOp; mode?: "c" | "trunc" | "arith" }> = {
  "||": { prec: 1, op: "or" },
  "&&": { prec: 2, op: "and" },
  "|": { prec: 3, op: "bor" },
  "^": { prec: 4, op: "bxor" },
  "&": { prec: 5, op: "band" },
  "==": { prec: 6, op: "eq" },
  "!=": { prec: 6, op: "ne" },
  "<": { prec: 7, op: "lt" },
  ">": { prec: 7, op: "gt" },
  "<=": { prec: 7, op: "le" },
  ">=": { prec: 7, op: "ge" },
  "<<": { prec: 8, op: "shl" },
  ">>": { prec: 8, op: "shr", mode: "arith" },
  "+": { prec: 9, op: "add" },
  "-": { prec: 9, op: "sub" },
  "*": { prec: 10, op: "mul" },
  "/": { prec: 10, op: "div", mode: "c" },
  "%": { prec: 10, op: "mod", mode: "trunc" }
};

/** Parses a C expression into the neutral watch AST. */
export function parseCExpression(text: string): WatchExpr {
  const tokens = tokenize(text);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => peek().kind === "op" && (peek() as { value: string }).value === value;
  const expect = (value: string) => (isOp(value) ? pos++ : invalid());

  const postfix = (name: string): WatchExpr => {
    const subscripts: WatchExpr[] = [];
    while (isOp("[")) {
      pos++;
      subscripts.push(binary(0));
      expect("]");
    }
    return subscripts.length ? { kind: "element", name, subscripts } : { kind: "variable", name };
  };

  const unary = (): WatchExpr => {
    const t = peek();
    if (t.kind === "op") {
      if (t.value === "(") {
        pos++;
        const inner = binary(0);
        expect(")");
        return inner;
      }
      if (t.value === "&") {
        pos++;
        const target = peek();
        if (target.kind !== "name") return invalid();
        pos++;
        const operand = postfix(target.value);
        if (operand.kind !== "variable" && operand.kind !== "element") return invalid();
        return { kind: "addressOf", target: operand, type: "ptr16", typeLabel: "pointer" };
      }
      const op = ({ "-": "neg", "+": "plus", "!": "not", "~": "bitnot" } as const)[t.value as "-"];
      if (!op) return invalid();
      pos++;
      return { kind: "unary", op, operand: unary() };
    }
    pos++;
    if (t.kind === "number") return { kind: "number", value: t.value, ...(t.real ? { real: true } : {}) };
    if (t.kind === "string") return { kind: "string", value: t.value };
    if (t.kind === "name") {
      if (isOp("(")) {
        pos++;
        const args: WatchExpr[] = [];
        if (!isOp(")")) {
          args.push(binary(0));
          while (isOp(",")) {
            pos++;
            args.push(binary(0));
          }
        }
        expect(")");
        return { kind: "builtin", name: t.value, args };
      }
      return postfix(t.value);
    }
    return invalid();
  };

  const binary = (minPrec: number): WatchExpr => {
    let left = unary();
    for (;;) {
      const t = peek();
      const info = t.kind === "op" ? BINARY[t.value] : undefined;
      if (!info || info.prec < minPrec) break;
      pos++;
      const right = binary(info.prec + 1);
      left = { kind: "binary", op: info.op, left, right, ...(info.mode ? { mode: info.mode } : {}) };
    }
    return left;
  };

  const expression = binary(0);
  if (peek().kind !== "end") invalid();
  return expression;
}

export const C_LANGUAGE: DebugLanguageSupport = {
  id: "c",
  parseWatch(text) {
    try {
      return { expression: parseCExpression(text) };
    } catch (e) {
      if (e instanceof ParseError) return { error: e.message };
      throw e;
    }
  },
  builtins: {
    abs: (args, fail) =>
      args[0]?.kind === "number" ? { kind: "number", value: Math.abs(args[0].value) } : fail(translate("panels.side.watchExpr.numberExpected"))
  },
  arrayTypeLabel: (elementLabel, dimensions) => `${elementLabel}${dimensions.map((d) => `[${d.count ?? ""}]`).join("")}`
};
