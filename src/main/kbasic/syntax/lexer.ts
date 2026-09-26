import type { DiagnosticBag, Span } from "../diagnostics";
import { keywordOf, KEYWORDS } from "./keywords";
import type { SourceFile } from "./source";
import type { Token } from "./tokens";

/** The tokens of a file (or of a fragment of it) and the spans of its comments. */
export type LexResult = {
  tokens: Token[];
  comments: Span[];
};

/**
 * Splits a ZX BASIC source file into tokens (spec `lexical`). Comments are kept aside as spans. A
 * `_` or `\` ending a line joins the next one. A `#` line is one `directive` token, and the lines of
 * an `ASM` block are `asm` tokens holding the raw text; both are the preprocessor's and the parser's
 * to interpret. Every logical line ends with a `newline` token; the last token is `eof`.
 */
export function lex(file: SourceFile, diagnostics: DiagnosticBag): LexResult {
  return new Lexer(file, 0, file.text.length, false, diagnostics).run();
}

/**
 * Tokens of part of a line (a directive's arguments or a macro body): no directives, no ASM blocks,
 * no newline or eof tokens; `#` and `##` are operators (stringize and paste).
 */
export function lexFragment(file: SourceFile, start: number, end: number, diagnostics: DiagnosticBag): Token[] {
  return new Lexer(file, start, end, true, diagnostics).run().tokens;
}

const TWO_CHAR_OPERATORS = new Set(["<=", ">=", "<>", "<<", ">>", ":=", "=>"]);
const ONE_CHAR_OPERATORS = new Set([..."+-*/^()=<>~&|!@{},;:"]);
const BLOCK_GRAPHIC_P: Record<string, number> = { " ": 0, "'": 2, ".": 8, ":": 10 };
const BLOCK_GRAPHIC_N: Record<string, number> = { " ": 0, "'": 1, ".": 4, ":": 5 };

class Lexer {
  private readonly tokens: Token[] = [];
  private readonly comments: Span[] = [];
  private readonly text: string;
  private pos: number;
  /** Only blanks since the start of a line that does not continue the previous one. */
  private lineStart = true;
  /** At the first character of a physical line. */
  private physicalLineStart = true;
  private spaceBefore = false;
  private asmMode = false;
  private asmPending = false;
  /** The last token of the current logical line. */
  private lastOnLine?: Token;

  constructor(
    private readonly file: SourceFile,
    start: number,
    private readonly end: number,
    private readonly fragment: boolean,
    private readonly diagnostics: DiagnosticBag
  ) {
    this.text = file.text;
    this.pos = start;
    if (fragment) this.lineStart = this.physicalLineStart = false;
  }

  run(): LexResult {
    while (this.pos < this.end) {
      if (this.asmMode && this.physicalLineStart && this.asmLine()) continue;
      this.physicalLineStart = false;
      const c = this.text[this.pos];
      const next = this.text[this.pos + 1];
      if (c === " " || c === "\t" || c === "\r") {
        this.pos++;
        this.spaceBefore = true;
      } else if (c === "\n") {
        this.newline();
      } else if (c === "#" && this.lineStart && !this.fragment) {
        this.directive();
      } else if (c === "'") {
        this.lineComment(this.pos);
      } else if (c === "/" && next === "'") {
        this.blockComment();
      } else if ((c === "_" || c === "\\") && this.continuation()) {
        // --- joined with the next line
      } else if (c === '"') {
        this.string();
      } else if (isDigit(c) || (c === "." && isDigit(next))) {
        this.number();
      } else if (c === "$" && isHexDigit(next)) {
        this.prefixedNumber(/^\$([0-9A-Fa-f]+)/, 16);
      } else if (c === "%" && (next === "0" || next === "1")) {
        this.prefixedNumber(/^%([01]+)/, 2);
      } else if (isIdentifierStart(c)) {
        this.word();
      } else if (this.fragment && c === "#") {
        const op = next === "#" ? "##" : "#";
        this.emit("operator", this.pos, this.pos + op.length);
      } else if (TWO_CHAR_OPERATORS.has(c + (next ?? ""))) {
        this.emit("operator", this.pos, this.pos + 2);
      } else if (ONE_CHAR_OPERATORS.has(c)) {
        this.emit("operator", this.pos, this.pos + 1);
      } else {
        this.error("E101", `Unexpected character '${c}'`, this.pos, this.pos + 1);
        this.pos++;
      }
    }
    if (!this.fragment) {
      if (this.asmMode) this.error("E102", "The ASM block has no END ASM", this.end, this.end);
      if (this.tokens.length && this.tokens[this.tokens.length - 1].kind !== "newline") {
        this.tokens.push({ kind: "newline", text: "", span: this.span(this.end, this.end) });
      }
      this.tokens.push({ kind: "eof", text: "", span: this.span(this.end, this.end) });
    }
    return { tokens: this.tokens, comments: this.comments };
  }

  // ----------------------------------------------------------------------------------------------
  // Helpers

  private span(start: number, end: number): Span {
    return { file: this.file.index, start, end };
  }

  private error(code: string, message: string, start: number, end: number): void {
    this.diagnostics.error(code, message, this.span(start, end));
  }

  private emit(kind: Token["kind"], start: number, end: number, extra: Partial<Token> = {}): Token {
    const token: Token = { kind, text: this.text.slice(start, end), span: this.span(start, end), ...extra };
    if (this.lineStart) token.atLineStart = true;
    if (this.spaceBefore) token.spaceBefore = true;
    this.tokens.push(token);
    this.lineStart = false;
    this.spaceBefore = false;
    this.lastOnLine = token;
    this.pos = end;
    return token;
  }

  private restOfLine(from: number): number {
    const nl = this.text.indexOf("\n", from);
    return nl < 0 || nl > this.end ? this.end : nl;
  }

  private newline(): void {
    this.emit("newline", this.pos, this.pos + 1);
    this.lineStart = true;
    this.physicalLineStart = true;
    this.lastOnLine = undefined;
    if (this.asmPending) {
      this.asmPending = false;
      this.asmMode = true;
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Comments, continuation, directives, ASM

  private lineComment(start: number): void {
    const end = this.restOfLine(start);
    this.comments.push(this.span(start, end));
    this.pos = end;
    this.spaceBefore = true;
  }

  private blockComment(): void {
    const start = this.pos;
    let depth = 0;
    while (this.pos < this.end) {
      const two = this.text.substr(this.pos, 2);
      if (two === "/'") {
        depth++;
        this.pos += 2;
      } else if (two === "'/") {
        depth--;
        this.pos += 2;
        if (depth === 0) break;
      } else this.pos++;
    }
    if (depth > 0) this.error("E103", "The block comment has no closing '/", start, start + 2);
    this.comments.push(this.span(start, this.pos));
    this.spaceBefore = true;
  }

  /** A `_` or `\` with only blanks or a comment after it on the line joins the next line. */
  private continuation(): boolean {
    const c = this.text[this.pos];
    if (c === "_" && isIdentifierPart(this.text[this.pos + 1] ?? "")) return false;
    let p = this.pos + 1;
    while (p < this.end && (this.text[p] === " " || this.text[p] === "\t" || this.text[p] === "\r")) p++;
    const rest = this.text.slice(p, this.restOfLine(p));
    const isComment = rest.startsWith("'") || /^rem(\s|$)/i.test(rest);
    if (rest !== "" && !isComment) return false;
    if (isComment) this.comments.push(this.span(p, this.restOfLine(p)));
    this.pos = Math.min(this.restOfLine(p) + 1, this.end);
    this.spaceBefore = true;
    this.physicalLineStart = true;
    return true;
  }

  /** A `#` line (with the lines a trailing `\` or `_` joins to a #define). */
  private directive(): void {
    const start = this.pos;
    let p = start + 1;
    while (this.text[p] === " " || this.text[p] === "\t") p++;
    const nameStart = p;
    while (p < this.end && /[A-Za-z]/.test(this.text[p])) p++;
    const name = this.text.slice(nameStart, p).toLowerCase();
    let end = this.restOfLine(start);
    if (name === "define") {
      while (end < this.end && /[\\_]\s*$/.test(this.text.slice(start, end).replace(/\s*'.*$/, ""))) {
        end = this.restOfLine(end + 1);
      }
    }
    this.emit("directive", start, end, { directive: { name, argsStart: p } });
  }

  /** In an ASM block: END ASM ends it; a # line is a directive; anything else is an asm line. */
  private asmLine(): boolean {
    const lineEnd = this.restOfLine(this.pos);
    const line = this.text.slice(this.pos, lineEnd);
    if (/^\s*END\s+ASM\b/i.test(line)) {
      this.asmMode = false;
      return false;
    }
    this.physicalLineStart = false;
    if (/^\s*#/.test(line)) {
      while (this.text[this.pos] === " " || this.text[this.pos] === "\t") this.pos++;
      this.lineStart = true;
      this.directive();
      return true;
    }
    this.emit("asm", this.pos, lineEnd);
    return true;
  }

  // ----------------------------------------------------------------------------------------------
  // Literals

  private string(): void {
    const start = this.pos;
    let p = start + 1;
    let value = "";
    for (;;) {
      if (p >= this.end || this.text[p] === "\n") {
        this.error("E104", "The string has no closing quote", start, p);
        break;
      }
      const c = this.text[p];
      if (c === '"') {
        if (this.text[p + 1] === '"') {
          value += '"';
          p += 2;
          continue;
        }
        p++;
        break;
      }
      if (c === "\\") {
        const escape = stringEscape(this.text, p);
        value += escape.value;
        p += escape.length;
        continue;
      }
      const code = spectrumCode(c);
      if (code === undefined) {
        this.error("E105", `'${c}' is not in the ZX Spectrum character set`, p, p + 1);
      } else value += String.fromCharCode(code);
      p++;
    }
    this.emit("string", start, p, { stringValue: value });
  }

  private number(): void {
    const rest = this.text.slice(this.pos, this.end);
    const based = (re: RegExp, radix: number) => {
      const m = re.exec(rest);
      if (!m) return false;
      this.emit("number", this.pos, this.pos + m[0].length, { value: parseInt(m[1], radix), numberForm: "based" });
      return true;
    };
    if (based(/^([0-9][0-9A-Fa-f]*)[hH](?![0-9A-Za-z_$%])/, 16)) return;
    if (based(/^0[xX]([0-9A-Fa-f]+)(?![0-9A-Za-z_$%])/, 16)) return;
    if (based(/^([0-7]+)[oO](?![0-9A-Za-z_$%])/, 8)) return;
    if (based(/^([01]+)[bB](?![0-9A-Za-z_$%])/, 2)) return;
    const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest)!;
    const text = m[0];
    const real = /[.eE]/.test(text);
    this.emit("number", this.pos, this.pos + text.length, { value: Number(text), numberForm: real ? "real" : "integer" });
  }

  private prefixedNumber(re: RegExp, radix: number): void {
    const m = re.exec(this.text.slice(this.pos, this.end))!;
    this.emit("number", this.pos, this.pos + m[0].length, { value: parseInt(m[1], radix), numberForm: "based" });
  }

  // ----------------------------------------------------------------------------------------------
  // Words

  private word(): void {
    const start = this.pos;
    let p = start + 1;
    while (p < this.end && isIdentifierPart(this.text[p])) p++;
    const name = this.text.slice(start, p);
    const sigilChar = this.text[p];
    const sigil = sigilChar === "$" || sigilChar === "%" ? (sigilChar as "$" | "%") : undefined;
    const upper = name.toUpperCase();

    if (!sigil && upper === "REM" && (p >= this.end || /[\s]/.test(this.text[p]))) {
      this.remComment(start);
      return;
    }
    if (!sigil && upper === "BIN") {
      this.binLiteral(start, p);
      return;
    }

    const end = sigil ? p + 1 : p;
    if (sigil && (upper + sigil) in KEYWORDS) {
      this.emit("keyword", start, end, { keyword: upper + sigil });
      return;
    }
    const keyword = keywordOf(upper);
    if (keyword) {
      if (sigil) this.error("E106", `'${name}' is a reserved word and cannot take a '${sigil}'`, start, end);
      const previous = this.lastOnLine;
      this.emit("keyword", start, end, { keyword });
      if (keyword === "ASM" && previous?.keyword !== "END" && this.onlyCommentFollows(end)) this.asmPending = true;
      return;
    }
    this.emit("identifier", start, end, { name, ...(sigil ? { sigil } : {}) });
  }

  /** REM is a comment; as a statement it must follow ':' (or start the line, or follow THEN/ELSE). */
  private remComment(start: number): void {
    const last = this.lastOnLine;
    const allowed =
      !last ||
      (last.kind === "operator" && last.text === ":") ||
      (last.kind === "number" && last.atLineStart) ||
      (last.kind === "keyword" && (last.keyword === "THEN" || last.keyword === "ELSE"));
    if (!allowed) this.error("E107", "REM needs a ':' before it when it follows a statement", start, start + 3);
    this.lineComment(start);
  }

  /** BIN reads the binary digits after it; with none, it is 0. */
  private binLiteral(start: number, afterBin: number): void {
    let p = afterBin;
    while (this.text[p] === " " || this.text[p] === "\t") p++;
    const m = /^[01]+/.exec(this.text.slice(p, this.end));
    if (m && !isIdentifierPart(this.text[p + m[0].length] ?? "")) {
      this.emit("number", start, p + m[0].length, { value: parseInt(m[0], 2), numberForm: "based" });
    } else {
      this.emit("number", start, afterBin, { value: 0, numberForm: "based" });
    }
  }

  private onlyCommentFollows(from: number): boolean {
    const rest = this.text.slice(from, this.restOfLine(from)).trim();
    return rest === "" || rest.startsWith("'") || /^rem(\s|$)/i.test(rest);
  }
}

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= "0" && c <= "9";
}

function isHexDigit(c: string | undefined): boolean {
  return c !== undefined && /[0-9A-Fa-f]/.test(c);
}

function isIdentifierStart(c: string): boolean {
  return /[A-Za-z_]/.test(c);
}

function isIdentifierPart(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

/** The Spectrum character code of a source character, or undefined when it has none. */
function spectrumCode(c: string): number | undefined {
  if (c === "£") return 0x60;
  if (c === "©") return 0x7f;
  const code = c.charCodeAt(0);
  return code < 256 ? code : undefined;
}

/**
 * A string escape at text[p] (a backslash): its characters and length (spec `string_literals`).
 * An unknown escape is taken literally: the backslash stays, the next character is read normally.
 */
function stringEscape(text: string, p: number): { value: string; length: number } {
  const a = text[p + 1] ?? "";
  const b = text[p + 2] ?? "";
  const chr = (...codes: number[]) => String.fromCharCode(...codes);
  if (a === "\\") return { value: "\\", length: 2 };
  if (a === "*") return { value: chr(127), length: 2 };
  if (a in BLOCK_GRAPHIC_P && b in BLOCK_GRAPHIC_N) {
    return { value: chr(128 + BLOCK_GRAPHIC_P[a] + BLOCK_GRAPHIC_N[b]), length: 3 };
  }
  if (/^[A-Ua-u]$/.test(a)) return { value: chr(144 + a.toUpperCase().charCodeAt(0) - 65), length: 2 };
  if (a === "#") {
    const m = /^\d{3}/.exec(text.slice(p + 2, p + 5));
    if (m && Number(m[0]) < 256) return { value: chr(Number(m[0])), length: 5 };
  }
  if (a === "{") {
    const m = /^\{([ipfbvIB])([0-9ni])\}/.exec(text.slice(p + 1, p + 5));
    if (m) {
      const code = { i: 16, p: 17, f: 18, b: 19, v: 20, I: 15, B: 14 }[m[1]]!;
      const n = m[2] === "n" ? 0 : m[2] === "i" ? 1 : Number(m[2]);
      if (m[2] === "n" || m[2] === "i" ? m[1] === "v" : true) return { value: chr(code, n), length: 5 };
    }
  }
  return { value: "\\", length: 1 };
}
