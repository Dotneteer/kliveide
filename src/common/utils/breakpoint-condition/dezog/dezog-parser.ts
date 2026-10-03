import type { ConditionBinaryOp, ConditionUnaryOp, MachineFunction } from "../condition-types";
import { ConditionSyntaxError } from "../condition-lexer";
import type { AccessType, SyntaxNode } from "../condition-parser";

/*
 * The DeZog expression dialect (`.plans/LOGPOINTS_PLAN.md` §3.4): what a `LOGPOINT` source comment's
 * `${...}` placeholders hold, and what G1.5's ASSERTION conditions will hold.
 *
 * A second *front end*, not a second engine: this parser builds the same syntax tree as Klive's own
 * condition parser, and the shared checker turns it into the same bytecode for the same C evaluator.
 * Only the conventions are DeZog's (D3) - written from DeZog's documentation, not its code:
 *
 * - C precedence: relational binds tighter than bitwise, `&&` tighter than `||`; `==`/`!=` are a
 *   level below `<`...`>=`, and comparisons may be chained, as in C.
 * - `b@(e)` / `w@(e)` read a byte / a little-endian word; parentheses alone only group.
 * - Numbers are decimal, `0x1F` or `1Fh`. Anything else (`$1F`, `%1010`, character literals) is
 *   refused with a message naming the construct, never guessed (R3).
 * - Labels are written with their full dotted name (`sprite.counter`) and are case-insensitive, like
 *   every Klive symbol. A name that is not a DeZog register is always a label: Klive's flag names
 *   and `VAL`/`ADDR` mean nothing here.
 * - `Remote.tStates`, `Remote.cpuFrequency`, `Remote.slots` are the machine specials.
 * - `*`, `/`, `%` are integer operations; `/` truncates toward zero (Q3).
 */

type TokenKind = "num" | "ident" | "op" | "eof";

type Token = { kind: TokenKind; text: string; value?: number; start: number; end: number };

const OPERATORS = [
  "||", "&&", "==", "!=", "<=", ">=", "<<", ">>",
  "<", ">", "!", "~", "&", "|", "^", "+", "-", "*", "/", "%", "(", ")", "@"
];

/** DeZog's register names; anything else is a label. */
const REGISTERS = new Set([
  "a", "f", "b", "c", "d", "e", "h", "l", "i", "r",
  "ixh", "ixl", "iyh", "iyl",
  "af", "bc", "de", "hl", "ix", "iy", "sp", "pc",
  "af'", "bc'", "de'", "hl'"
]);

const PRIMABLE = new Set(["af", "bc", "de", "hl"]);

const SPECIALS: Record<string, MachineFunction> = {
  "remote.tstates": "tstates",
  "remote.cpufrequency": "cpufreq",
  "remote.slots": "slots"
};

const MAX_LITERAL = 0xffff_ffff;

const isDigit = (c: string | undefined) => !!c && c >= "0" && c <= "9";
const isAlpha = (c: string | undefined) =>
  !!c && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_");
const isIdentChar = (c: string | undefined) => isAlpha(c) || isDigit(c) || c === ".";

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < text.length) {
    const c = text[pos];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      pos++;
      continue;
    }
    const start = pos;

    if (isDigit(c)) {
      let end = pos;
      while (end < text.length && (isAlpha(text[end]) || isDigit(text[end]))) end++;
      const raw = text.substring(pos, end);
      let value: number;
      if (/^0x[0-9a-f]+$/i.test(raw)) value = parseInt(raw.substring(2), 16);
      else if (/^[0-9][0-9a-f]*h$/i.test(raw)) value = parseInt(raw.substring(0, raw.length - 1), 16);
      else if (/^[0-9]+$/.test(raw)) value = parseInt(raw, 10);
      else {
        throw new ConditionSyntaxError(
          `Invalid number '${raw}'; write decimal, 0x1F or 1Fh`,
          start,
          end
        );
      }
      if (value > MAX_LITERAL) {
        throw new ConditionSyntaxError(`${raw} is larger than 0xFFFFFFFF`, start, end);
      }
      tokens.push({ kind: "num", text: raw, value, start, end });
      pos = end;
      continue;
    }

    if (isAlpha(c)) {
      let end = pos;
      while (end < text.length && isIdentChar(text[end])) end++;
      let ident = text.substring(pos, end);
      if (text[end] === "'" && PRIMABLE.has(ident.toLowerCase())) {
        ident += "'";
        end++;
      }
      tokens.push({ kind: "ident", text: ident, start, end });
      pos = end;
      continue;
    }

    if (c === "$") {
      throw new ConditionSyntaxError(
        "DeZog expressions write hex as 0x1F or 1Fh, not $1F",
        start,
        start + 1
      );
    }
    if (c === "'" || c === '"') {
      throw new ConditionSyntaxError(
        "Character and string literals are not part of DeZog's expressions",
        start,
        start + 1
      );
    }

    const op = OPERATORS.find((o) => text.startsWith(o, pos));
    if (op) {
      tokens.push({ kind: "op", text: op, start, end: pos + op.length });
      pos += op.length;
      continue;
    }
    throw new ConditionSyntaxError(`Unexpected character '${c}'`, start, start + 1);
  }
  tokens.push({ kind: "eof", text: "", start: text.length, end: text.length });
  return tokens;
}

/** Binary levels, lowest precedence first (C's order). */
const LEVELS: string[][] = [
  ["||"],
  ["&&"],
  ["|"],
  ["^"],
  ["&"],
  ["==", "!="],
  ["<", "<=", ">", ">="],
  ["<<", ">>"],
  ["+", "-"],
  ["*", "/", "%"]
];

const BYTE: AccessType = { width: 1, be: false, signed: false, name: "b@" };
const WORD: AccessType = { width: 2, be: false, signed: false, name: "w@" };

/** Parse a DeZog expression into the shared syntax tree. Throws `ConditionSyntaxError`. */
export function parseDezogExpression(text: string): SyntaxNode {
  const tokens = tokenize(text);
  if (tokens.length === 1) {
    throw new ConditionSyntaxError("The expression is empty", 0, text.length);
  }
  let index = 0;
  const peek = (offset = 0) => tokens[Math.min(index + offset, tokens.length - 1)];
  const next = () => {
    const token = peek();
    if (token.kind !== "eof") index++;
    return token;
  };
  const isOp = (op: string, offset = 0) => {
    const token = peek(offset);
    return token.kind === "op" && token.text === op;
  };
  const describe = (token: Token) => (token.kind === "eof" ? "end of expression" : token.text);
  const expectClose = (open: Token) => {
    const token = peek();
    if (token.kind === "op" && token.text === ")") return next();
    throw new ConditionSyntaxError(
      `Missing ')' to close the '(' at column ${open.start + 1}`,
      token.start,
      token.end
    );
  };

  const level = (n: number): SyntaxNode => {
    if (n >= LEVELS.length) return unary();
    let left = level(n + 1);
    while (true) {
      const token = peek();
      if (token.kind !== "op" || !LEVELS[n].includes(token.text)) return left;
      next();
      const right = level(n + 1);
      left = {
        k: "bin",
        op: token.text as ConditionBinaryOp,
        l: left,
        r: right,
        start: left.start,
        end: right.end
      };
    }
  };

  const unary = (): SyntaxNode => {
    const token = peek();
    if (token.kind === "op" && (token.text === "!" || token.text === "~" || token.text === "-")) {
      next();
      const e = unary();
      return { k: "un", op: token.text as ConditionUnaryOp, e, start: token.start, end: e.end };
    }
    if (token.kind === "op" && token.text === "+") {
      next();
      const e = unary();
      return { ...e, start: token.start };
    }
    return primary();
  };

  const primary = (): SyntaxNode => {
    const token = peek();
    switch (token.kind) {
      case "num":
        next();
        return { k: "num", v: token.value!, start: token.start, end: token.end };
      case "ident": {
        const lower = token.text.toLowerCase();
        // --- `b@(...)` / `w@(...)`: a memory read
        if ((lower === "b" || lower === "w") && isOp("@", 1)) {
          next();
          next();
          const open = peek();
          if (!(open.kind === "op" && open.text === "(")) {
            throw new ConditionSyntaxError(
              `${lower}@ must be followed by an address in parentheses: ${lower}@(HL)`,
              open.start,
              open.end
            );
          }
          next();
          const addr = level(0);
          const close = expectClose(open);
          return {
            k: "mem",
            access: lower === "b" ? BYTE : WORD,
            addr,
            start: token.start,
            end: close.end
          };
        }
        next();
        const special = SPECIALS[lower];
        if (special) return { k: "machine", fn: special, start: token.start, end: token.end };
        if (lower.startsWith("remote.")) {
          throw new ConditionSyntaxError(
            `Unknown special '${token.text}'; use Remote.tStates, Remote.cpuFrequency or Remote.slots`,
            token.start,
            token.end
          );
        }
        // --- A register stays a name the checker resolves; anything else is forced to a label
        return {
          k: "name",
          name: token.text,
          quoted: !REGISTERS.has(lower),
          start: token.start,
          end: token.end
        };
      }
      case "op":
        if (token.text === "(") {
          next();
          const inner = level(0);
          const close = expectClose(token);
          return { ...inner, start: token.start, end: close.end };
        }
        if (token.text === "@") {
          throw new ConditionSyntaxError(
            "A memory read is written b@(address) or w@(address)",
            token.start,
            token.end
          );
        }
        throw new ConditionSyntaxError(
          `Unexpected '${token.text}'; expected a value`,
          token.start,
          token.end
        );
      default:
        throw new ConditionSyntaxError(
          "The expression ends where a value is expected",
          token.start,
          token.end
        );
    }
  };

  const tree = level(0);
  const rest = peek();
  if (rest.kind !== "eof") {
    throw new ConditionSyntaxError(
      rest.kind === "op" && rest.text === ")" ? "Unbalanced ')'" : `Unexpected '${describe(rest)}'`,
      rest.start,
      rest.end
    );
  }
  return tree;
}
