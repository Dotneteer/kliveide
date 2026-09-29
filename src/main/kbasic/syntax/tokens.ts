import type { Span } from "../diagnostics";

export type TokenKind =
  | "identifier"
  | "keyword"
  | "number"
  | "string"
  | "operator"
  | "newline"
  | "directive"
  | "asm"
  | "pragma"
  | "eof";

/** Where a token produced by a macro expansion came from, innermost expansion first. */
export type ExpansionStep = {
  macro: string;
  /** The macro use (its name, or the whole call) in the text that invoked it. */
  span: Span;
};

export type Token = {
  kind: TokenKind;
  /** The source text of the token (for a directive or asm line, the whole line). */
  text: string;
  span: Span;
  /** keyword: canonical upper-case keyword (CHR$, STR$, INKEY$ keep the `$`). */
  keyword?: string;
  /** identifier: the name without its sigil. */
  name?: string;
  /** identifier: the type sigil. */
  sigil?: "$" | "%";
  /** number: the value (exact for integers up to 2^53). */
  value?: number;
  /** number: decimal integer, decimal real, or a based (hex, octal, binary) literal. */
  numberForm?: "integer" | "real" | "based";
  /** string: the characters after escapes, as character codes 0-255. */
  stringValue?: string;
  /** directive: its name (lower case) and where the text after the name starts. */
  directive?: { name: string; argsStart: number };
  /** The first token of a logical line (only blanks before it on a line that does not continue). */
  atLineStart?: boolean;
  /** Blank or comment right before the token. */
  spaceBefore?: boolean;
  /** Set by the preprocessor for tokens a macro produced. */
  expansion?: ExpansionStep[];
};
