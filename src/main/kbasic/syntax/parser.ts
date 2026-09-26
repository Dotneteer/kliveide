import type { DiagnosticBag, Span } from "../diagnostics";
import type {
  Argument,
  AttrModifier,
  AttrName,
  BinaryOp,
  DimBound,
  Expression,
  JumpTarget,
  LoopKind,
  NameRef,
  Node,
  Param,
  PrintItem,
  Program,
  RoutineHeader,
  Statement,
  TapeTarget,
  TypeRef,
  Vector
} from "./ast";
import { baseKeyword, TYPE_KEYWORDS, type TypeName } from "./keywords";
import { siteSpan, type PreprocessResult } from "./preprocessor";
import type { Token } from "./tokens";

/** Parses preprocessed tokens into a Program (spec `statements`, `operators`, `functions`). */
export function parse(input: PreprocessResult, diagnostics: DiagnosticBag): Program {
  return new Parser(input.tokens, input.comments, diagnostics).program();
}

const ATTRS: AttrName[] = ["INK", "PAPER", "FLASH", "BRIGHT", "INVERSE", "OVER", "BOLD", "ITALIC"];

/** Binary operators: binding power (higher binds tighter) and associativity, from the spec's table. */
const BINARY: Record<string, { op: BinaryOp; power: number; right?: boolean }> = {
  OR: { op: "OR", power: 10 },
  AND: { op: "AND", power: 20 },
  XOR: { op: "XOR", power: 30 },
  "=": { op: "=", power: 50 },
  "<>": { op: "<>", power: 50 },
  "<": { op: "<", power: 50 },
  ">": { op: ">", power: 50 },
  "<=": { op: "<=", power: 50 },
  ">=": { op: ">=", power: 50 },
  BOR: { op: "BOR", power: 60 },
  "|": { op: "BOR", power: 60 },
  BAND: { op: "BAND", power: 70 },
  "&": { op: "BAND", power: 70 },
  BXOR: { op: "BXOR", power: 70 },
  "~": { op: "BXOR", power: 70 },
  SHL: { op: "SHL", power: 70 },
  "<<": { op: "SHL", power: 70 },
  SHR: { op: "SHR", power: 70 },
  ">>": { op: "SHR", power: 70 },
  "+": { op: "+", power: 80 },
  "-": { op: "-", power: 80 },
  MOD: { op: "MOD", power: 90 },
  "*": { op: "*", power: 100 },
  "/": { op: "/", power: 100 },
  "^": { op: "^", power: 120, right: true }
};
const NOT_OPERAND = 50; // NOT a = b is NOT (a = b)
const BNOT_OPERAND = 81; // bNOT sits with + and -
const NEGATION_OPERAND = 110; // -2^2 is -(2^2)
const FUNCTION_OPERAND = 110; // PEEK a + 1 is PEEK(a) + 1

/** The `#pragma` options (spec `preprocessor.pragmas`, plus CODEBANK's `codebank`) and their value types. */
const PRAGMAS: Record<string, "int" | "bool" | "string" | "strategy"> = {
  array_base: "int",
  array_check: "bool",
  autorun: "bool",
  case_insensitive: "bool",
  codebank: "int",
  default_byref: "bool",
  enable_break: "bool",
  expected_warnings: "int",
  explicit: "bool",
  force_asm_brackets: "bool",
  headerless: "bool",
  heap_address: "int",
  heap_size: "int",
  hide_warning_codes: "bool",
  include_path: "string",
  memory_check: "bool",
  memory_map: "string",
  opt_strategy: "strategy",
  optimization_level: "int",
  org: "int",
  sinclair: "bool",
  strict: "bool",
  strict_bool: "bool",
  string_base: "int",
  zxnext: "bool"
};

/** Built-ins with a single argument in parentheses. */
const PAREN_FUNCTIONS = new Set(["ABS", "ACS", "ASN", "ATN", "CODE", "COS", "EXP", "INT", "LEN", "LN", "SGN", "SIN", "SQR", "STR", "TAN", "VAL"]);

class ParseError extends Error {}

class Parser {
  private pos = 0;
  /** Set when a block's closer was missing: the statement that follows needs no separator. */
  private afterMissingCloser = false;
  private routineDepth = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly comments: Span[],
    private readonly diagnostics: DiagnosticBag
  ) {}

  program(): Program {
    const statements = this.block(() => this.at("eof"));
    const first = this.tokens[0];
    const last = this.tokens[this.tokens.length - 1];
    return {
      kind: "program",
      statements,
      comments: this.comments,
      span: { file: first.span.file, start: 0, end: last.span.end }
    };
  }

  // ==============================================================================================
  // Tokens

  private peek(k = 0): Token {
    return this.tokens[Math.min(this.pos + k, this.tokens.length - 1)];
  }
  private next(): Token {
    const t = this.peek();
    if (t.kind !== "eof") this.pos++;
    return t;
  }
  private at(kind: Token["kind"], k = 0): boolean {
    return this.peek(k).kind === kind;
  }
  private atKeyword(keyword: string, k = 0): boolean {
    const t = this.peek(k);
    return t.kind === "keyword" && t.keyword === keyword;
  }
  private atOp(text: string, k = 0): boolean {
    const t = this.peek(k);
    return t.kind === "operator" && t.text === text;
  }
  /** The end of a statement: ':', end of line or file, or ELSE (in a single-line IF). */
  private atStatementEnd(): boolean {
    return this.at("newline") || this.at("eof") || this.atOp(":") || this.atKeyword("ELSE");
  }
  private eatKeyword(keyword: string): Token | undefined {
    return this.atKeyword(keyword) ? this.next() : undefined;
  }
  private eatOp(text: string): Token | undefined {
    return this.atOp(text) ? this.next() : undefined;
  }
  private expectKeyword(keyword: string, what = keyword): Token {
    if (this.atKeyword(keyword)) return this.next();
    return this.fail("E302", `Expected ${what}`);
  }
  private expectOp(text: string): Token {
    if (this.atOp(text)) return this.next();
    return this.fail("E302", `Expected '${text}'`);
  }
  private fail(code: string, message: string, token = this.peek()): never {
    this.diagnostics.error(code, `${message}${describe(token)}`, siteSpan(token));
    throw new ParseError(message);
  }

  /** A span from the token at `start` to the last token consumed. */
  private spanFrom(start: number): Span {
    const a = siteSpan(this.tokens[start]);
    const b = siteSpan(this.tokens[Math.max(this.pos - 1, start)]);
    return { file: a.file, start: a.start, end: b.file === a.file ? Math.max(b.end, a.start) : a.end };
  }
  private node<T extends object>(start: number, fields: T): T & Node {
    return { ...fields, span: this.spanFrom(start) };
  }

  /** Skips to the end of the statement after an error. */
  private synchronize(): void {
    while (!this.at("newline") && !this.at("eof") && !this.atOp(":")) this.next();
  }

  // ==============================================================================================
  // Blocks and lines

  /**
   * Statements (and labels) up to a token `isEnd` accepts at the start of a statement; the caller
   * consumes the terminator. Stops at end of file too, leaving the report to the caller.
   */
  private block(isEnd: () => boolean): Statement[] {
    const out: Statement[] = [];
    for (;;) {
      while (this.at("newline") || this.atOp(":")) this.next();
      if (this.at("eof") || isEnd()) return out;
      const t = this.peek();
      if (t.atLineStart && t.kind === "number") {
        const start = this.pos;
        this.next();
        if (t.numberForm !== "integer") this.diagnostics.error("E304", "A line number must be a whole number", siteSpan(t));
        out.push(this.node(start, { kind: "label", name: t.text, lineNumber: t.value }));
        continue;
      }
      if (t.atLineStart && t.kind === "identifier" && this.atOp(":", 1)) {
        const start = this.pos;
        this.next();
        out.push(this.node(start, { kind: "label", name: t.name! + (t.sigil ?? "") }));
        this.next();
        continue;
      }
      if (isEnd()) return out;
      this.afterMissingCloser = false;
      this.statementInto(out);
      if (!this.atStatementEnd() && !this.afterMissingCloser) {
        this.diagnostics.error("E301", `Expected the end of the statement${describe(this.peek())}`, siteSpan(this.peek()));
        this.synchronize();
      }
    }
  }

  private statementInto(out: Statement[]): void {
    try {
      const s = this.statement();
      if (s) out.push(s);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.synchronize();
    }
  }

  /** The statements of a single-line IF branch: up to the end of the line, or ELSE. */
  private inlineStatements(): Statement[] {
    const out: Statement[] = [];
    for (;;) {
      if (this.at("newline") || this.at("eof") || this.atKeyword("ELSE")) return out;
      if (this.atOp(":")) {
        this.next();
        continue;
      }
      if (this.isEndIf()) return out;
      this.statementInto(out);
      if (!this.atStatementEnd()) {
        this.diagnostics.error("E301", `Expected the end of the statement${describe(this.peek())}`, siteSpan(this.peek()));
        this.synchronize();
      }
    }
  }

  private isEndIf(): boolean {
    return this.atKeyword("ENDIF") || (this.atKeyword("END") && this.atKeyword("IF", 1));
  }

  private isEnd(keyword: string): boolean {
    return this.atKeyword("END") && this.atKeyword(keyword, 1);
  }

  /**
   * Consumes END <keyword> (or its one-word form), or reports the construct `opener` as unclosed and
   * returns an empty node where the closer should be, so parsing goes on from there.
   */
  private closeBlock(keyword: string, opener: Token, oneWord?: string): Node {
    const start = this.pos;
    if (oneWord && this.eatKeyword(oneWord)) return this.node(start, {});
    if (this.isEnd(keyword)) {
      this.next();
      this.next();
      return this.node(start, {});
    }
    return this.missingCloser(`${opener.text.toUpperCase()} has no END ${keyword}`, opener);
  }

  private missingCloser(message: string, opener: Token): Node {
    this.diagnostics.error("E303", message, siteSpan(opener));
    this.afterMissingCloser = true;
    const at = siteSpan(this.peek());
    return { span: { file: at.file, start: at.start, end: at.start } };
  }

  // ==============================================================================================
  // Statements

  private statement(): Statement | undefined {
    const t = this.peek();
    const start = this.pos;
    if (t.kind === "pragma") {
      this.next();
      return this.node(start, { kind: "pragma", text: t.text, ...this.pragma(t) });
    }
    if (t.kind === "identifier") return this.assignmentOrCall(false);
    if (t.kind !== "keyword") this.fail("E301", "Expected a statement");

    const kw = t.keyword!;
    if ((ATTRS as string[]).includes(kw)) {
      this.next();
      return this.node(start, { kind: "attribute", attr: kw as AttrName, value: this.expression() });
    }
    switch (kw) {
      case "PRINT":
        this.next();
        return this.node(start, { kind: "print", items: this.printItems() });
      case "BORDER":
        this.next();
        return this.node(start, { kind: "border", value: this.expression() });
      case "BEEP": {
        this.next();
        const duration = this.expression();
        this.expectOp(",");
        return this.node(start, { kind: "beep", duration, pitch: this.expression() });
      }
      case "CLS":
        this.next();
        return this.node(start, { kind: "cls" });
      case "PLOT": {
        this.next();
        const attrs = this.attrList();
        const x = this.expression();
        this.expectOp(",");
        return this.node(start, { kind: "plot", attrs, x, y: this.expression() });
      }
      case "DRAW": {
        this.next();
        const attrs = this.attrList();
        const x = this.expression();
        this.expectOp(",");
        const y = this.expression();
        const angle = this.eatOp(",") ? this.expression() : undefined;
        return this.node(start, { kind: "draw", attrs, x, y, ...(angle ? { angle } : {}) });
      }
      case "CIRCLE": {
        this.next();
        const attrs = this.attrList();
        const x = this.expression();
        this.expectOp(",");
        const y = this.expression();
        this.expectOp(",");
        return this.node(start, { kind: "circle", attrs, x, y, radius: this.expression() });
      }
      case "LET":
        this.next();
        return this.assignmentOrCall(true, start);
      case "DIM":
        return this.dim();
      case "CONST": {
        this.next();
        const name = this.name();
        const type = this.asType();
        this.expectOp("=");
        return this.node(start, { kind: "const", name, ...(type ? { type } : {}), value: this.expression() });
      }
      case "IF":
        return this.ifStatement();
      case "FOR":
        return this.forStatement();
      case "WHILE":
        return this.whileStatement();
      case "DO":
        return this.doStatement();
      case "EXIT":
      case "CONTINUE": {
        this.next();
        const loop = this.loopKind();
        return this.node(start, { kind: kw === "EXIT" ? "exit" : "continue", loop });
      }
      case "GOTO":
      case "GOSUB":
        this.next();
        return this.node(start, { kind: kw === "GOTO" ? "goto" : "gosub", target: this.jumpTarget() });
      case "GO": {
        this.next();
        const which = this.eatKeyword("TO") ? "goto" : this.eatKeyword("SUB") ? "gosub" : this.fail("E302", "Expected TO or SUB after GO");
        return this.node(start, { kind: which, target: this.jumpTarget() });
      }
      case "ON":
        return this.onJump();
      case "RETURN":
      case "END":
      case "STOP": {
        if (kw === "END" && this.endsBlock()) {
          this.fail("E305", `END ${this.peek(1).text.toUpperCase()} without its opening statement`);
        }
        this.next();
        const value = this.atStatementEnd() ? undefined : this.expression();
        const kind = kw === "RETURN" ? "return" : kw === "END" ? "end" : "stop";
        return this.node(start, { kind, ...(value ? { value } : {}) });
      }
      case "ERROR":
        this.next();
        return this.node(start, { kind: "error", value: this.expression() });
      case "POKE":
        return this.poke();
      case "OUT": {
        this.next();
        const port = this.expression();
        this.expectOp(",");
        return this.node(start, { kind: "out", port, value: this.expression() });
      }
      case "PAUSE":
        this.next();
        return this.node(start, { kind: "pause", value: this.expression() });
      case "RANDOMIZE": {
        this.next();
        const seed = this.atStatementEnd() ? undefined : this.expression();
        return this.node(start, { kind: "randomize", ...(seed ? { seed } : {}) });
      }
      case "READ": {
        this.next();
        const targets = [this.designator()];
        while (this.eatOp(",")) targets.push(this.designator());
        return this.node(start, { kind: "read", targets });
      }
      case "DATA": {
        this.next();
        const items = [this.expression()];
        while (this.eatOp(",")) items.push(this.expression());
        return this.node(start, { kind: "data", items });
      }
      case "RESTORE": {
        this.next();
        const target = this.atStatementEnd() ? undefined : this.jumpTarget();
        return this.node(start, { kind: "restore", ...(target ? { target } : {}) });
      }
      case "LOAD":
      case "SAVE":
      case "VERIFY":
        return this.tape(kw);
      case "SUB":
      case "FUNCTION":
        return this.routine();
      case "DECLARE": {
        this.next();
        const header = this.routineHeader();
        return this.node(start, { kind: "declare", header });
      }
      case "ASM":
        return this.asm();
      case "CODEBANK":
        return this.codebank();
      case "NEXT":
        this.fail("E306", "NEXT without FOR");
        break;
      case "LOOP":
        this.fail("E306", "LOOP without DO");
        break;
      case "WEND":
        this.fail("E306", "WEND without WHILE");
        break;
      case "ELSEIF":
      case "ENDIF":
        this.fail("E306", `${kw} without IF`);
    }
    return this.fail("E301", "Expected a statement");
  }

  /** `option = value`, `option value`, `push(option)`, `pop(option)` (spec `preprocessor` #pragma). */
  private pragma(t: Token): { name?: string; action: "set" | "push" | "pop"; value?: string } {
    const span = siteSpan(t);
    const stack = /^(push|pop)\s*\(\s*([A-Za-z_]\w*)\s*\)$/i.exec(t.text);
    if (stack) {
      const name = stack[2].toLowerCase();
      if (!(name in PRAGMAS)) this.diagnostics.warning("W300", `Unknown #pragma option '${stack[2]}' ignored`, span);
      return { name, action: stack[1].toLowerCase() as "push" | "pop" };
    }
    const m = /^([A-Za-z_]\w*)\s*(?:=\s*)?(.*)$/.exec(t.text);
    if (!m) {
      this.diagnostics.error("E314", "Expected a #pragma option", span);
      return { action: "set" };
    }
    const name = m[1].toLowerCase();
    const raw = m[2].trim();
    const value = /^".*"$/.test(raw) ? raw.slice(1, -1) : raw;
    const type = PRAGMAS[name];
    if (!type) {
      this.diagnostics.warning("W300", `Unknown #pragma option '${m[1]}' ignored`, span);
      return { name, action: "set", value };
    }
    const valid =
      type === "int"
        ? /^(-?\d+|\$[0-9A-Fa-f]+|0x[0-9A-Fa-f]+|[0-9][0-9A-Fa-f]*h)$/i.test(value)
        : type === "bool"
          ? /^(true|false|on|off|yes|no|\+|-|0|1)?$/i.test(value)
          : type === "strategy"
            ? /^(size|speed|auto)$/i.test(value)
            : true;
    if (!valid || (type !== "bool" && value === "")) {
      this.diagnostics.error("E314", `Invalid value '${value}' for #pragma ${name}`, span);
    }
    return { name, action: "set", value };
  }

  /** A block header ends at ':' or the end of the line (spec SEP); `lineOnly` wants the end of the line. */
  private expectSeparator(lineOnly = false): void {
    if (this.at("newline") || this.at("eof") || (!lineOnly && this.atOp(":"))) return;
    this.fail("E302", lineOnly ? "Expected the end of the line" : "Expected ':' or the end of the line");
  }

  private endsBlock(): boolean {
    return ["IF", "SUB", "FUNCTION", "WHILE", "ASM", "CODEBANK"].some((k) => this.atKeyword(k, 1));
  }

  /** `[LET] target = value`, or a SUB/FUNCTION call statement. */
  private assignmentOrCall(hasLet: boolean, start = this.pos): Statement {
    const nameToken = this.peek();
    if (nameToken.kind !== "identifier") this.fail("E302", "Expected a variable name");
    const afterName = this.pos + 1;
    const target = this.postfix(this.primaryName());
    if (this.eatOp("=")) return this.node(start, { kind: "let", target, value: this.expression(), hasLet });
    if (hasLet) this.fail("E302", "Expected '='");
    const callee = nameRef(nameToken);
    if (this.atStatementEnd()) {
      if (target.kind === "name") return this.node(start, { kind: "callStatement", callee, args: [], parens: false });
      if (target.kind === "call" && target.callee.kind === "name") {
        return this.node(start, { kind: "callStatement", callee, args: target.args, parens: true });
      }
    }
    // --- `name a, b` (the first argument may itself start with '(')
    this.pos = afterName;
    const args = this.argumentList();
    return this.node(start, { kind: "callStatement", callee, args, parens: false });
  }

  private designator(): Expression {
    if (!this.at("identifier")) this.fail("E302", "Expected a variable");
    return this.postfix(this.primaryName());
  }

  private printItems(): PrintItem[] {
    const items: PrintItem[] = [];
    while (!this.atStatementEnd()) {
      const start = this.pos;
      if (this.atOp(";") || this.atOp(",")) {
        const separator = this.next().text as ";" | ",";
        items.push(this.node(start, { kind: "separator", separator }));
        continue;
      }
      if (this.eatKeyword("AT")) {
        const row = this.expression();
        this.expectOp(",");
        items.push(this.node(start, { kind: "at", row, column: this.expression() }));
      } else if (this.eatKeyword("TAB")) {
        items.push(this.node(start, { kind: "tab", column: this.expression() }));
      } else if (this.atAttr()) {
        items.push(this.attrModifier());
      } else {
        items.push(this.node(start, { kind: "expr", value: this.expression() }));
      }
      if (!this.atStatementEnd() && !this.atOp(";") && !this.atOp(",")) this.fail("E302", "Expected ';' or ','");
    }
    return items;
  }

  private atAttr(): boolean {
    const t = this.peek();
    return t.kind === "keyword" && (ATTRS as string[]).includes(t.keyword!);
  }

  private attrModifier(): AttrModifier {
    const start = this.pos;
    const attr = this.next().keyword as AttrName;
    return this.node(start, { kind: "attrModifier", attr, value: this.expression() });
  }

  /** PLOT, DRAW and CIRCLE: `attr value ;` modifiers before the coordinates. */
  private attrList(): AttrModifier[] {
    const attrs: AttrModifier[] = [];
    while (this.atAttr()) {
      attrs.push(this.attrModifier());
      this.expectOp(";");
    }
    return attrs;
  }

  private dim(): Statement {
    const start = this.pos;
    this.next();
    const names = [this.name()];
    if (this.atOp("(")) {
      this.next();
      const bounds = [this.bound()];
      while (this.eatOp(",")) bounds.push(this.bound());
      this.expectOp(")");
      const type = this.asType();
      let at: Expression | undefined;
      let vector: Vector | undefined;
      if (this.eatKeyword("AT")) at = this.expression();
      else if (this.eatOp("=>")) vector = this.vector();
      return this.node(start, { kind: "dim", names, bounds, ...(type ? { type } : {}), ...(at ? { at } : {}), ...(vector ? { vector } : {}) });
    }
    while (this.eatOp(",")) names.push(this.name());
    const type = this.asType();
    if (names.length === 1 && this.eatOp("=")) {
      return this.node(start, { kind: "dim", names, ...(type ? { type } : {}), initialValue: this.expression() });
    }
    if (names.length === 1 && this.eatKeyword("AT")) {
      return this.node(start, { kind: "dim", names, ...(type ? { type } : {}), at: this.expression() });
    }
    return this.node(start, { kind: "dim", names, ...(type ? { type } : {}) });
  }

  private bound(): DimBound {
    const start = this.pos;
    const first = this.expression();
    if (this.eatKeyword("TO")) return this.node(start, { kind: "bound", lower: first, upper: this.expression() });
    return this.node(start, { kind: "bound", upper: first });
  }

  private vector(): Vector {
    const start = this.pos;
    this.expectOp("{");
    const items: (Expression | Vector)[] = [];
    const skipLines = () => {
      while (this.at("newline")) this.next();
    };
    skipLines();
    if (!this.atOp("}")) {
      do {
        skipLines();
        items.push(this.atOp("{") ? this.vector() : this.expression());
        skipLines();
      } while (this.eatOp(","));
    }
    this.expectOp("}");
    return this.node(start, { kind: "vector", items });
  }

  private ifStatement(): Statement {
    const start = this.pos;
    const opener = this.next();
    const condition = this.expression();
    this.eatKeyword("THEN");
    if (!this.at("newline") && !this.at("eof")) {
      // --- single-line IF: [ELSE ...] [: END IF] on the same line
      const then = this.inlineStatements();
      const otherwise = this.eatKeyword("ELSE") ? this.inlineStatements() : undefined;
      if (this.isEndIf() && this.next().keyword === "END") this.next();
      return this.node(start, { kind: "if", condition, then, elseIfs: [], ...(otherwise ? { else: otherwise } : {}), singleLine: true });
    }
    const branchEnd = () => this.atKeyword("ELSEIF") || this.atKeyword("ELSE") || this.isEndIf();
    const then = this.block(branchEnd);
    const elseIfs: (Node & { condition: Expression; body: Statement[] })[] = [];
    while (this.atKeyword("ELSEIF")) {
      const elseIfStart = this.pos;
      this.next();
      const c = this.expression();
      this.eatKeyword("THEN");
      elseIfs.push(this.node(elseIfStart, { condition: c, body: this.block(branchEnd) }));
    }
    let otherwise: Statement[] | undefined;
    if (this.eatKeyword("ELSE")) otherwise = this.block(() => this.isEndIf() || this.atKeyword("ELSEIF") || this.atKeyword("ELSE"));
    if (this.atKeyword("ELSEIF") || this.atKeyword("ELSE")) this.fail("E306", "ELSE or ELSEIF after ELSE");
    this.closeBlock("IF", opener, "ENDIF");
    return this.node(start, { kind: "if", condition, then, elseIfs, ...(otherwise ? { else: otherwise } : {}), singleLine: false });
  }

  private forStatement(): Statement {
    const start = this.pos;
    const opener = this.next();
    const variable = this.name();
    this.expectOp("=");
    const from = this.expression();
    this.expectKeyword("TO");
    const to = this.expression();
    const step = this.eatKeyword("STEP") ? this.expression() : undefined;
    this.expectSeparator();
    const body = this.block(() => this.atKeyword("NEXT"));
    const nextStart = this.pos;
    let next: Node & { variable?: NameRef };
    if (this.eatKeyword("NEXT")) {
      const nextVariable = this.at("identifier") ? this.name() : undefined;
      next = this.node(nextStart, nextVariable ? { variable: nextVariable } : {});
    } else next = this.missingCloser("FOR has no NEXT", opener);
    return this.node(start, { kind: "for", variable, from, to, ...(step ? { step } : {}), body, next });
  }

  private whileStatement(): Statement {
    const start = this.pos;
    const opener = this.next();
    const condition = this.expression();
    this.expectSeparator();
    const body = this.block(() => this.atKeyword("WEND") || this.isEnd("WHILE"));
    const end = this.closeBlock("WHILE", opener, "WEND");
    return this.node(start, { kind: "while", condition, body, end });
  }

  private doStatement(): Statement {
    const start = this.pos;
    const opener = this.next();
    let test: "none" | "preUntil" | "preWhile" | "postUntil" | "postWhile" = "none";
    let condition: Expression | undefined;
    if (this.eatKeyword("UNTIL")) {
      test = "preUntil";
      condition = this.expression();
    } else if (this.eatKeyword("WHILE")) {
      test = "preWhile";
      condition = this.expression();
    }
    this.expectSeparator();
    const body = this.block(() => this.atKeyword("LOOP"));
    const loopStart = this.pos;
    if (!this.eatKeyword("LOOP")) {
      const loop = this.missingCloser("DO has no LOOP", opener);
      return this.node(start, { kind: "do", test, ...(condition ? { condition } : {}), body, loop });
    }
    const post = this.atKeyword("UNTIL") ? "postUntil" : this.atKeyword("WHILE") ? "postWhile" : undefined;
    if (post) {
      if (condition) this.fail("E307", "A DO loop cannot test both at the top and at the bottom");
      this.next();
      test = post;
      condition = this.expression();
    }
    const loop = this.node(loopStart, {});
    return this.node(start, { kind: "do", test, ...(condition ? { condition } : {}), body, loop });
  }

  private loopKind(): LoopKind {
    for (const k of ["DO", "FOR", "WHILE"] as LoopKind[]) if (this.eatKeyword(k)) return k;
    return this.fail("E302", "Expected DO, FOR or WHILE");
  }

  private jumpTarget(): JumpTarget {
    const t = this.peek();
    const start = this.pos;
    if (t.kind === "number") {
      this.next();
      if (t.numberForm !== "integer") this.diagnostics.error("E304", "A line number must be a whole number", siteSpan(t));
      return this.node(start, { kind: "lineTarget", line: t.value! });
    }
    if (t.kind === "identifier" && !t.sigil) {
      this.next();
      return this.node(start, { kind: "labelTarget", name: t.name! });
    }
    return this.fail("E302", "Expected a label or line number");
  }

  private onJump(): Statement {
    const start = this.pos;
    this.next();
    const selector = this.expression();
    let jump: "GOTO" | "GOSUB";
    if (this.eatKeyword("GOTO")) jump = "GOTO";
    else if (this.eatKeyword("GOSUB")) jump = "GOSUB";
    else if (this.atKeyword("GO")) {
      this.next();
      jump = this.eatKeyword("TO") ? "GOTO" : this.eatKeyword("SUB") ? "GOSUB" : this.fail("E302", "Expected TO or SUB after GO");
    } else return this.fail("E302", "Expected GOTO or GOSUB");
    const targets = [this.jumpTarget()];
    while (this.eatOp(",")) targets.push(this.jumpTarget());
    return this.node(start, { kind: "on", selector, jump, targets });
  }

  /** POKE [type] addr, value — optionally in parentheses, optionally with a comma after the type. */
  private poke(): Statement {
    const start = this.pos;
    this.next();
    const saved = this.pos;
    const savedDiagnostics = this.diagnostics.items.length;
    if (this.atOp("(")) {
      try {
        this.next();
        const body = this.pokeBody();
        this.expectOp(")");
        if (this.atStatementEnd()) return this.node(start, { kind: "poke", ...body, parens: true });
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
      }
      this.pos = saved;
      this.diagnostics.items.length = savedDiagnostics;
    }
    return this.node(start, { kind: "poke", ...this.pokeBody(), parens: false });
  }

  private pokeBody(): { type?: TypeRef; address: Expression; value: Expression } {
    const type = this.atType() ? this.typeRef() : undefined;
    if (type) this.eatOp(",");
    const address = this.expression();
    this.expectOp(",");
    return { ...(type ? { type } : {}), address, value: this.expression() };
  }

  private tape(operation: "LOAD" | "SAVE" | "VERIFY"): Statement {
    const start = this.pos;
    this.next();
    const name = this.expression();
    const targetStart = this.pos;
    let target: TapeTarget;
    if (this.eatKeyword("CODE")) {
      if (operation === "SAVE") {
        const s = this.expression();
        this.expectOp(",");
        target = this.node(targetStart, { kind: "code", start: s, length: this.expression() });
      } else {
        const s = this.atStatementEnd() ? undefined : this.expression();
        const length = s && this.eatOp(",") ? this.expression() : undefined;
        target = this.node(targetStart, { kind: "code", ...(s ? { start: s } : {}), ...(length ? { length } : {}) });
      }
    } else if (this.at("identifier") && this.peek().name!.toUpperCase() === "SCREEN" && this.peek().sigil !== "%") {
      this.next();
      target = this.node(targetStart, { kind: "screen" });
    } else if (this.eatKeyword("DATA")) {
      const variable = this.at("identifier") ? this.name() : undefined;
      const isArray = !!variable && !!this.eatOp("(") && !!this.expectOp(")");
      target = this.node(targetStart, { kind: "data", ...(variable ? { variable } : {}), isArray });
    } else {
      return this.fail("E302", `Expected CODE, SCREEN$ or DATA after ${operation}'s name`);
    }
    return this.node(start, { kind: "tape", operation, name, target });
  }

  private routine(): Statement {
    const start = this.pos;
    const opener = this.peek();
    const header = this.routineHeader();
    const keyword = header.routine;
    this.expectSeparator(true);
    this.routineDepth++;
    // --- A routine ends at its END; END of the other kind or a new routine header leaves it unclosed
    const body = this.block(
      () => this.isEnd("SUB") || this.isEnd("FUNCTION") || this.atKeyword("SUB") || this.atKeyword("FUNCTION")
    );
    this.routineDepth--;
    const end = this.closeBlock(keyword, opener);
    return this.node(start, { kind: "routine", header, body, end });
  }

  private routineHeader(): RoutineHeader {
    const start = this.pos;
    const routine = this.eatKeyword("SUB") ? "SUB" : this.eatKeyword("FUNCTION") ? "FUNCTION" : this.fail("E302", "Expected SUB or FUNCTION");
    const convention = this.eatKeyword("FASTCALL") ? "FASTCALL" : this.eatKeyword("STDCALL") ? "STDCALL" : undefined;
    const name = this.name();
    const params: Param[] = [];
    if (this.eatOp("(")) {
      if (!this.atOp(")")) {
        do params.push(this.param());
        while (this.eatOp(","));
      }
      this.expectOp(")");
    }
    const returnType = this.asType();
    if (returnType && routine === "SUB") {
      this.diagnostics.error("E308", "A SUB cannot have a return type", returnType.span);
    }
    return this.node(start, {
      kind: "routineHeader",
      routine,
      ...(convention ? { convention } : {}),
      name,
      params,
      ...(returnType ? { returnType } : {})
    });
  }

  private param(): Param {
    const start = this.pos;
    const passing = this.eatKeyword("BYVAL") ? "BYVAL" : this.eatKeyword("BYREF") ? "BYREF" : undefined;
    const name = this.name();
    if (this.eatOp("(")) {
      this.expectOp(")");
      const type = this.asType() ?? this.fail("E302", "Expected AS and a type for the array parameter");
      return this.node(start, { kind: "param", name, ...(passing ? { passing } : {}), type, isArray: true });
    }
    const type = this.asType();
    const defaultValue = this.eatOp("=") ? this.expression() : undefined;
    return this.node(start, {
      kind: "param",
      name,
      ...(passing ? { passing } : {}),
      ...(type ? { type } : {}),
      ...(defaultValue ? { defaultValue } : {}),
      isArray: false
    });
  }

  private asm(): Statement {
    const start = this.pos;
    const opener = this.next();
    const lines: (Node & { text: string })[] = [];
    while (!this.at("eof") && !this.isEnd("ASM")) {
      const t = this.next();
      if (t.kind !== "asm") continue;
      lines.push({ text: t.text, span: t.span });
      if (/^\s*codebank\s*(;.*)?$/i.test(t.text)) {
        this.diagnostics.error("E313", "CODEBANK in an ASM block needs a bank number", t.span);
      }
    }
    const end = this.closeBlock("ASM", opener);
    return this.node(start, { kind: "asm", lines, end });
  }

  private codebank(): Statement {
    const start = this.pos;
    const opener = this.next();
    if (this.routineDepth > 0) this.diagnostics.error("E312", "A CODEBANK block cannot be inside a SUB or FUNCTION", siteSpan(opener));
    const bank = this.expression();
    this.expectSeparator(true);
    const body = this.block(() => this.isEnd("CODEBANK") || this.atKeyword("CODEBANK"));
    for (const s of body) {
      if (!["routine", "declare", "dim", "const", "asm", "label", "pragma"].includes(s.kind)) {
        this.diagnostics.error("E311", "A CODEBANK block holds only SUBs, FUNCTIONs, DIMs, ASM blocks and labels", s.span);
      }
    }
    const end = this.closeBlock("CODEBANK", opener);
    return this.node(start, { kind: "codebank", bank, body, end });
  }

  // ==============================================================================================
  // Names and types

  private name(): NameRef {
    const t = this.peek();
    if (t.kind !== "identifier") return this.fail("E302", "Expected a name");
    this.next();
    return nameRef(t);
  }

  private atType(): boolean {
    const t = this.peek();
    return t.kind === "keyword" && (TYPE_KEYWORDS as readonly string[]).includes(t.keyword!);
  }

  private typeRef(): TypeRef {
    const t = this.peek();
    if (!this.atType()) return this.fail("E302", "Expected a type");
    this.next();
    return { kind: "type", name: t.keyword as TypeName, span: siteSpan(t) };
  }

  private asType(): TypeRef | undefined {
    return this.eatKeyword("AS") ? this.typeRef() : undefined;
  }

  // ==============================================================================================
  // Expressions

  expression(minPower = 0): Expression {
    const start = this.pos;
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      const key = t.kind === "keyword" ? t.keyword! : t.kind === "operator" ? t.text : "";
      const info = BINARY[key];
      if (!info || info.power < minPower) return left;
      this.next();
      const right = this.expression(info.right ? info.power : info.power + 1);
      left = this.node(start, { kind: "binary", op: info.op, left, right });
    }
  }

  private prefix(): Expression {
    const start = this.pos;
    const t = this.peek();
    if (t.kind === "operator") {
      if (t.text === "-" || t.text === "+") {
        this.next();
        return this.node(start, { kind: "unary", op: t.text as "-" | "+", operand: this.expression(NEGATION_OPERAND) });
      }
      if (t.text === "!") {
        this.next();
        return this.node(start, { kind: "unary", op: "BNOT", operand: this.expression(BNOT_OPERAND) });
      }
      if (t.text === "(") {
        this.next();
        const expression = this.expression();
        this.expectOp(")");
        return this.postfix(this.node(start, { kind: "paren", expression }));
      }
      if (t.text === "@") {
        this.next();
        if (!this.at("identifier")) this.fail("E302", "Expected a name after '@'");
        const target = this.postfix(this.primaryName());
        if (target.kind !== "name" && target.kind !== "call") this.fail("E302", "Expected a name after '@'");
        return this.node(start, { kind: "addressOf", target: target as never });
      }
    }
    if (t.kind === "number") {
      this.next();
      return this.node(start, { kind: "number", value: t.value!, text: t.text, form: t.numberForm! });
    }
    if (t.kind === "string") {
      this.next();
      return this.postfix(this.node(start, { kind: "string", value: t.stringValue ?? "" }));
    }
    if (t.kind === "identifier") {
      const callee = this.postfix(this.primaryName());
      // --- `f x`: a single-argument call without parentheses
      if (callee.kind === "name" && this.startsBareArgument()) {
        const argStart = this.pos;
        const value = this.expression(FUNCTION_OPERAND);
        const arg = this.node(argStart, { kind: "arg" as const, value });
        return this.node(start, { kind: "call", callee, args: [arg], parens: false });
      }
      return callee;
    }
    if (t.kind === "keyword") return this.keywordPrimary();
    return this.fail("E309", "Expected an expression");
  }

  private startsBareArgument(): boolean {
    const t = this.peek();
    return t.kind === "number" || t.kind === "string" || t.kind === "identifier" || (t.kind === "operator" && t.text === "@");
  }

  private primaryName(): NameRef {
    return this.name();
  }

  /** Parenthesised argument lists after a primary: calls, array elements, string slices. */
  private postfix(primary: Expression): Expression {
    let e = primary;
    while (this.atOp("(")) {
      this.next();
      const args = this.atOp(")") ? [] : this.argumentList(true);
      this.expectOp(")");
      e = { kind: "call", callee: e, args, parens: true, span: { ...e.span, end: siteSpan(this.tokens[this.pos - 1]).end } };
    }
    return e;
  }

  /** Arguments separated by ',': expressions, `name := value`, and (in parentheses) `[a] TO [b]`. */
  private argumentList(inParens = false): Argument[] {
    const args: Argument[] = [];
    do {
      const start = this.pos;
      if (this.at("identifier") && this.atOp(":=", 1)) {
        const name = this.name();
        this.next();
        args.push(this.node(start, { kind: "named", name, value: this.expression() }));
        continue;
      }
      if (inParens && this.atKeyword("TO")) {
        this.next();
        const to = this.atOp(")") || this.atOp(",") ? undefined : this.expression();
        args.push(this.node(start, { kind: "range", ...(to ? { to } : {}) }));
        continue;
      }
      const value = this.expression();
      if (inParens && this.eatKeyword("TO")) {
        const to = this.atOp(")") || this.atOp(",") ? undefined : this.expression();
        args.push(this.node(start, { kind: "range", from: value, ...(to ? { to } : {}) }));
        continue;
      }
      args.push(this.node(start, { kind: "arg", value }));
    } while (this.eatOp(","));
    return args;
  }

  private keywordPrimary(): Expression {
    const start = this.pos;
    const t = this.next();
    const kw = baseKeyword(t.keyword!);
    const builtin = (args: Expression[], parens: boolean, type?: TypeRef): Expression =>
      this.node(start, { kind: "builtin", name: kw, args, parens, ...(type ? { type } : {}) });

    switch (kw) {
      case "NOT":
        return this.node(start, { kind: "unary", op: "NOT", operand: this.expression(NOT_OPERAND) });
      case "BNOT":
        return this.node(start, { kind: "unary", op: "BNOT", operand: this.expression(BNOT_OPERAND) });
      case "PI":
        return builtin([], false);
      case "INKEY":
        return this.postfix(builtin([], false));
      case "RND":
        if (this.atOp("(") && this.atOp(")", 1)) {
          this.next();
          this.next();
          return builtin([], true);
        }
        return builtin([], false);
      case "FARPTR": {
        const target = this.name();
        return this.node(start, { kind: "farptr", target });
      }
      case "PEEK":
      case "IN":
      case "USR": {
        if (!this.atOp("(")) return builtin([this.expression(FUNCTION_OPERAND)], false);
        this.next();
        const type = kw === "PEEK" && this.atType() ? this.typeRef() : undefined;
        if (type) this.expectOp(",");
        const arg = this.expression();
        this.expectOp(")");
        return this.postfix(builtin([arg], true, type));
      }
      case "CAST": {
        this.expectOp("(");
        const type = this.typeRef();
        this.expectOp(",");
        const arg = this.expression();
        this.expectOp(")");
        return builtin([arg], true, type);
      }
      case "SIZEOF": {
        this.expectOp("(");
        if (this.atType()) {
          const type = this.typeRef();
          this.expectOp(")");
          return builtin([], true, type);
        }
        const arg = this.name();
        this.expectOp(")");
        return builtin([arg], true);
      }
      case "LBOUND":
      case "UBOUND": {
        this.expectOp("(");
        const args: Expression[] = [this.name()];
        if (this.eatOp(",")) args.push(this.expression());
        this.expectOp(")");
        return builtin(args, true);
      }
      case "CHR": {
        this.expectOp("(");
        const args = [this.expression()];
        while (this.eatOp(",")) args.push(this.expression());
        this.expectOp(")");
        return this.postfix(builtin(args, true));
      }
    }
    if (PAREN_FUNCTIONS.has(kw)) {
      if (!this.atOp("(")) this.fail("E310", `${t.text.toUpperCase()} needs its argument in parentheses`);
      this.next();
      const arg = this.expression();
      this.expectOp(")");
      return this.postfix(builtin([arg], true));
    }
    this.pos = start;
    return this.fail("E309", "Expected an expression");
  }
}

function nameRef(t: Token): NameRef {
  return { kind: "name", name: t.name!, ...(t.sigil ? { sigil: t.sigil } : {}), span: siteSpan(t) };
}

function describe(t: Token): string {
  if (t.kind === "eof") return ", found the end of the file";
  if (t.kind === "newline") return ", found the end of the line";
  return `, found '${t.text.length > 20 ? t.text.slice(0, 20) + "..." : t.text}'`;
}
