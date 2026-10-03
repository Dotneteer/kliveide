import type { ConditionDiagnostic } from "./condition-types";

/*
 * The condition lexer (plan §3.2-§3.5).
 *
 * Two context rules are decided here rather than in the parser, because both depend on what is
 * *immediately* next to a character:
 *
 * - a `'` right after `AF`, `BC`, `DE` or `HL` is a prime (`AF'`), never a character literal;
 * - a run of letters and digits right before a `:` is a partition or bank spec (`05:`, `B5:`), since
 *   `:` has no other use and `05`/`0A` would otherwise lex as a number or not at all.
 */

export type TokenKind =
  | "num" // a number or a character literal
  | "str" // a string literal
  | "part" // a partition literal, `@B5`
  | "spec" // a partition/bank spec before a `:`
  | "ident"
  | "quoted" // a backtick label
  | "op"
  | "eof";

export type Token = {
  kind: TokenKind;
  /** The operator, the identifier, the spec or the label text. */
  text: string;
  /** A number's value. */
  value?: number;
  /** A string's character codes (already mapped to the ZX Spectrum set). */
  codes?: number[];
  start: number;
  end: number;
};

/** Thrown for the first lexical error; the compiler turns it into a diagnostic. */
export class ConditionSyntaxError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number
  ) {
    super(message);
  }

  toDiagnostic(): ConditionDiagnostic {
    return { severity: "error", message: this.message, start: this.start, end: this.end };
  }
}

const OPERATORS = [
  ">>>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "<<",
  ">>",
  "<",
  ">",
  "!",
  "~",
  "&",
  "|",
  "^",
  "+",
  "-",
  "*",
  "/",
  "(",
  ")",
  "[",
  "]",
  ":"
];

const PRIMABLE = new Set(["af", "bc", "de", "hl"]);
const MAX_LITERAL = 0xffff_ffff;

/**
 * The ZX Spectrum code of a character (Q7): the three printable characters where the Spectrum set
 * differs from ASCII are mapped, everything else is its code point and must fit a byte.
 */
export function zxCharCode(ch: string): number | undefined {
  switch (ch) {
    case "£":
      return 0x60;
    case "©":
      return 0x7f;
    case "↑":
      return 0x5e;
  }
  const code = ch.codePointAt(0)!;
  return code <= 0xff ? code : undefined;
}

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isAlnum = (c: string) => isAlpha(c) || isDigit(c);

/** Split a condition into tokens. Throws `ConditionSyntaxError`. */
export function tokenizeCondition(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < text.length) {
    const c = text[pos];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      pos++;
      continue;
    }
    const start = pos;

    // --- A partition/bank spec: an alphanumeric run immediately followed by `:`
    if (isAlnum(c)) {
      let end = pos;
      while (end < text.length && isAlnum(text[end])) end++;
      if (text[end] === ":") {
        tokens.push({ kind: "spec", text: text.substring(pos, end), start, end });
        pos = end;
        continue;
      }
    }

    if (isDigit(c)) {
      pos = readNumber(text, pos, tokens);
      continue;
    }
    if (c === "$" || c === "%") {
      pos = readNumber(text, pos, tokens);
      continue;
    }

    if (isAlpha(c)) {
      let end = pos;
      while (end < text.length && isAlnum(text[end])) end++;
      let ident = text.substring(pos, end);
      if (text[end] === "'" && PRIMABLE.has(ident.toLowerCase())) {
        ident += "'";
        end++;
      }
      tokens.push({ kind: "ident", text: ident, start, end });
      pos = end;
      continue;
    }

    if (c === "`") {
      const close = text.indexOf("`", pos + 1);
      if (close < 0) throw new ConditionSyntaxError("Unterminated backtick label", start, text.length);
      const name = text.substring(pos + 1, close);
      if (!name.trim()) throw new ConditionSyntaxError("Empty backtick label", start, close + 1);
      tokens.push({ kind: "quoted", text: name, start, end: close + 1 });
      pos = close + 1;
      continue;
    }

    if (c === "@") {
      let end = pos + 1;
      while (end < text.length && isAlnum(text[end])) end++;
      if (end === pos + 1) {
        throw new ConditionSyntaxError("A partition literal needs a label after @", start, end);
      }
      tokens.push({ kind: "part", text: text.substring(pos + 1, end), start, end });
      pos = end;
      continue;
    }

    if (c === "'" || c === '"') {
      const { codes, end } = readQuoted(text, pos);
      if (c === "'") {
        if (codes.length !== 1) {
          throw new ConditionSyntaxError(
            codes.length === 0
              ? "Empty character literal; a character literal holds exactly one character"
              : `A character literal holds exactly one character; use "${text.substring(pos + 1, end - 1)}" for a string`,
            start,
            end
          );
        }
        tokens.push({ kind: "num", text: text.substring(start, end), value: codes[0], start, end });
      } else {
        tokens.push({ kind: "str", text: text.substring(start, end), codes, start, end });
      }
      pos = end;
      continue;
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

/** A decimal, `$hex`, `0x` hex, `%bin` or `0b` binary number, `_` separated. */
function readNumber(text: string, pos: number, tokens: Token[]): number {
  const start = pos;
  let radix = 10;
  let digitsStart = pos;
  if (text[pos] === "$") {
    radix = 16;
    digitsStart = pos + 1;
  } else if (text[pos] === "%") {
    radix = 2;
    digitsStart = pos + 1;
  } else if (text[pos] === "0" && (text[pos + 1] === "x" || text[pos + 1] === "X")) {
    radix = 16;
    digitsStart = pos + 2;
  } else if (
    text[pos] === "0" &&
    (text[pos + 1] === "b" || text[pos + 1] === "B") &&
    (text[pos + 2] === "0" || text[pos + 2] === "1")
  ) {
    radix = 2;
    digitsStart = pos + 2;
  }

  let end = digitsStart;
  while (end < text.length && (isAlnum(text[end]))) end++;
  const raw = text.substring(digitsStart, end);
  const digits = raw.replace(/_/g, "");
  const valid =
    radix === 16 ? /^[0-9a-f]+$/i : radix === 2 ? /^[01]+$/ : /^[0-9]+$/;
  if (!digits || !valid.test(digits) || raw.startsWith("_") || raw.endsWith("_")) {
    throw new ConditionSyntaxError(`Invalid number '${text.substring(start, end)}'`, start, end);
  }
  const value = parseInt(digits, radix);
  if (value > MAX_LITERAL) {
    throw new ConditionSyntaxError(
      `${text.substring(start, end)} is larger than $FFFFFFFF`,
      start,
      end
    );
  }
  tokens.push({ kind: "num", text: text.substring(start, end), value, start, end });
  return end;
}

/** A `'...'` or `"..."` literal, its escapes decoded and its characters mapped to ZX codes. */
function readQuoted(text: string, pos: number): { codes: number[]; end: number } {
  const quote = text[pos];
  const codes: number[] = [];
  let i = pos + 1;
  while (true) {
    if (i >= text.length) {
      throw new ConditionSyntaxError(
        quote === "'" ? "Unterminated character literal" : "Unterminated string",
        pos,
        text.length
      );
    }
    const ch = text[i];
    if (ch === quote) return { codes, end: i + 1 };
    if (ch === "\\") {
      const esc = text[i + 1];
      const simple: Record<string, number> = {
        "\\": 0x5c,
        "'": 0x27,
        '"': 0x22,
        n: 0x0a,
        r: 0x0d,
        t: 0x09,
        "0": 0x00
      };
      if (esc !== undefined && simple[esc] !== undefined) {
        codes.push(simple[esc]);
        i += 2;
        continue;
      }
      if (esc === "x" && /^[0-9a-f]{2}$/i.test(text.substring(i + 2, i + 4))) {
        codes.push(parseInt(text.substring(i + 2, i + 4), 16));
        i += 4;
        continue;
      }
      throw new ConditionSyntaxError(
        "Invalid escape; use \\\\, \\', \\\", \\n, \\r, \\t, \\0 or \\xHH",
        i,
        Math.min(text.length, i + 2)
      );
    }
    const cp = text.codePointAt(i)!;
    const chr = String.fromCodePoint(cp);
    const code = zxCharCode(chr);
    if (code === undefined) {
      throw new ConditionSyntaxError(
        `'${chr}' has no ZX Spectrum character code; write it as \\xHH`,
        i,
        i + chr.length
      );
    }
    codes.push(code);
    i += chr.length;
  }
}
