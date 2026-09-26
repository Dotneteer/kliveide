import { DiagnosticBag, type Span } from "../diagnostics";
import { lex, lexFragment } from "./lexer";
import type { SourceFile, SourceSet } from "./source";
import type { ExpansionStep, Token } from "./tokens";

/** How the preprocessor reads files: injected, so it works in the main process, the worker and tests. */
export interface FileReader {
  /** The file's text, or undefined when there is no such file. */
  read(path: string): string | undefined;
}

export type PreprocessorOptions = {
  /** Macros defined before the first line (-D, the header's `define`, option macros): name -> value. */
  defines?: Record<string, string>;
  /** Folders searched for `#include <file>`, and for `"file"` after the including file's folder. */
  includePaths?: string[];
};

export type PreprocessResult = {
  /** The tokens after directives and macro expansion; `#pragma` lines are `pragma` tokens. */
  tokens: Token[];
  comments: Span[];
  /** `#require "file.asm"` requests, in order. */
  requires: { name: string; span: Span }[];
  /** `#init name` registrations, in order. */
  inits: { name: string; span: Span }[];
};

type Macro = {
  name: string;
  params?: string[];
  body: Token[];
  /** The body's text, for #if and #include, which do not read it as BASIC. */
  text: string;
  /** What lexing the body as BASIC found; reported when the macro is expanded in code. */
  bodyProblems?: DiagnosticBag;
  span: Span;
  builtin?: boolean;
};

type Condition = {
  /** Whether the enclosing section is active. */
  outer: boolean;
  /** Whether this branch is active. */
  active: boolean;
  /** Whether a branch of this #if has been taken. */
  taken: boolean;
  elseSeen: boolean;
  span: Span;
};

const BUILTIN_NAMES = ["__FILE__", "__LINE__", "__BASE_FILE__", "__ABS_FILE__"];

/**
 * Runs the ZX BASIC preprocessor (spec `preprocessor`) on the build root: directives, conditional
 * sections, includes and macro expansion, on tokens rather than text, so every token keeps its
 * original span and macro output records where the macro was used.
 */
export function preprocess(
  sources: SourceSet,
  root: SourceFile,
  reader: FileReader,
  diagnostics: DiagnosticBag,
  options: PreprocessorOptions = {}
): PreprocessResult {
  return new Preprocessor(sources, root, reader, diagnostics, options).run();
}

class Preprocessor {
  private readonly macros = new Map<string, Macro>();
  private readonly out: Token[] = [];
  private readonly comments: Span[] = [];
  private readonly requires: PreprocessResult["requires"] = [];
  private readonly inits: PreprocessResult["inits"] = [];
  private readonly includeStack: string[] = [];
  private readonly includedOnce = new Set<string>();
  private readonly includedAlready = new Set<string>();
  private conditions: Condition[] = [];

  constructor(
    private readonly sources: SourceSet,
    private readonly root: SourceFile,
    private readonly reader: FileReader,
    private readonly diagnostics: DiagnosticBag,
    private readonly options: PreprocessorOptions
  ) {
    for (const name of BUILTIN_NAMES) {
      this.macros.set(name, { name, body: [], text: "", span: { file: root.index, start: 0, end: 0 }, builtin: true });
    }
    for (const [name, value] of Object.entries(options.defines ?? {})) {
      const file = sources.add(`<define ${name}>`, value);
      const problems = new DiagnosticBag();
      const body = lexFragment(file, 0, value.length, problems);
      this.macros.set(name, { name, body, text: value, bodyProblems: problems, span: { file: file.index, start: 0, end: 0 } });
    }
  }

  run(): PreprocessResult {
    this.processFile(this.root);
    this.out.push({ kind: "eof", text: "", span: { file: this.root.index, start: this.root.text.length, end: this.root.text.length } });
    return { tokens: this.out, comments: this.comments, requires: this.requires, inits: this.inits };
  }

  // ----------------------------------------------------------------------------------------------
  // Files and directives

  private processFile(file: SourceFile): void {
    const { tokens, comments } = lex(file, this.diagnostics);
    this.comments.push(...comments);
    this.includeStack.push(file.name);
    this.includedAlready.add(file.name);
    const outerConditions = this.conditions;
    this.conditions = [];

    const pending: Token[] = [];
    const flush = () => {
      if (pending.length) this.out.push(...this.expand(pending.splice(0), file));
    };
    for (const token of tokens) {
      if (token.kind === "eof") break;
      if (token.kind === "directive") {
        flush();
        this.directive(token, file);
        continue;
      }
      if (!this.active) continue;
      pending.push(token);
      if (token.kind === "newline") flush();
    }
    flush();

    for (const c of this.conditions) this.error("E201", "This #if has no #endif", c.span);
    this.conditions = outerConditions;
    this.includeStack.pop();
  }

  private get active(): boolean {
    return this.conditions.length === 0 || this.conditions[this.conditions.length - 1].active;
  }

  private directive(token: Token, file: SourceFile): void {
    const { name, argsStart } = token.directive!;
    const argsEnd = token.span.end;
    const args = () => lexFragment(file, argsStart, argsEnd, this.diagnostics);
    const fullText = file.text.slice(argsStart, argsEnd).trim();
    const rawArgs = fullText.replace(/\s*'[^"]*$/, "").trim();
    const span = token.span;

    // --- Conditionals run even in inactive sections
    switch (name) {
      case "if":
      case "ifdef":
      case "ifndef": {
        const outer = this.active;
        const value = outer && this.condition(name, rawArgs, args, span);
        this.conditions.push({ outer, active: outer && value, taken: value, elseSeen: false, span });
        return;
      }
      case "elif": {
        const c = this.top("#elif", span);
        if (!c) return;
        if (c.elseSeen) this.error("E202", "#elif after #else", span);
        const value = c.outer && !c.taken && this.condition("if", rawArgs, args, span);
        c.active = value;
        c.taken ||= value;
        return;
      }
      case "else": {
        const c = this.top("#else", span);
        if (!c) return;
        if (c.elseSeen) this.error("E202", "A second #else for the same #if", span);
        c.elseSeen = true;
        c.active = c.outer && !c.taken;
        c.taken = true;
        return;
      }
      case "endif":
        if (this.top("#endif", span)) this.conditions.pop();
        return;
    }
    if (!this.active) return;

    switch (name) {
      case "define": {
        const problems = new DiagnosticBag();
        this.define(lexFragment(file, argsStart, argsEnd, problems), span, file, argsEnd, problems);
        return;
      }
      case "undef": {
        const t = args()[0];
        if (!t || t.kind !== "identifier") this.error("E203", "#undef needs a macro name", span);
        else this.macros.delete(t.text);
        return;
      }
      case "include":
        this.include(rawArgs, file, span);
        return;
      case "line": {
        const m = /^(\d+)\s*(?:"([^"]*)")?$/.exec(rawArgs);
        if (!m) this.error("E204", '#line needs a line number and an optional "file"', span);
        else file.addLineDirective(file.position(span.start).line, Number(m[1]), m[2]);
        return;
      }
      case "error":
        this.error("E205", fullText || "#error", span);
        return;
      case "warning":
        this.diagnostics.warning("K205", fullText || "#warning", span);
        return;
      case "pragma":
        if (/^once$/i.test(rawArgs)) this.includedOnce.add(file.name);
        else this.out.push({ kind: "pragma", text: rawArgs, span });
        return;
      case "require": {
        const m = /^"([^"]+)"$/.exec(rawArgs);
        if (!m) this.error("E206", '#require needs a "file"', span);
        else this.requires.push({ name: m[1], span });
        return;
      }
      case "init": {
        const m = /^(?:"([^"]+)"|([A-Za-z_][\w.]*))$/.exec(rawArgs);
        if (!m) this.error("E207", "#init needs a routine name", span);
        else this.inits.push({ name: m[1] ?? m[2], span });
        return;
      }
      default:
        this.error("E208", `Unknown directive #${name}`, span);
    }
  }

  private top(what: string, span: Span): Condition | undefined {
    const c = this.conditions[this.conditions.length - 1];
    if (!c) this.error("E209", `${what} without #if`, span);
    return c;
  }

  // ----------------------------------------------------------------------------------------------
  // #define

  private define(tokens: Token[], span: Span, file: SourceFile, end: number, problems: DiagnosticBag): void {
    // --- The preprocessor works below the language: a macro may be named like a keyword (upstream too)
    const nameToken = tokens[0];
    if (!nameToken || (nameToken.kind !== "identifier" && nameToken.kind !== "keyword") || nameToken.sigil) {
      this.error("E203", "#define needs a macro name", span);
      return;
    }
    const name = nameToken.text;
    let i = 1;
    let params: string[] | undefined;
    if (tokens[1]?.text === "(" && !tokens[1].spaceBefore) {
      params = [];
      i = 2;
      while (i < tokens.length && tokens[i].text !== ")") {
        const p = tokens[i];
        if (p.kind !== "identifier") {
          this.error("E210", "A macro parameter must be a name", p.span);
          return;
        }
        if (params.includes(p.text)) this.error("E211", `Duplicate macro parameter '${p.text}'`, p.span);
        params.push(p.text);
        i++;
        if (tokens[i]?.text === ",") i++;
        else if (tokens[i]?.text !== ")") {
          this.error("E210", "Expected ',' or ')' in the macro's parameters", tokens[i]?.span ?? span);
          return;
        }
      }
      if (tokens[i]?.text !== ")") {
        this.error("E210", "The macro's parameter list has no ')'", span);
        return;
      }
      i++;
    } else if (tokens[1] && !tokens[1].spaceBefore) {
      this.diagnostics.warning("W520", `No blank after the macro name '${name}'`, tokens[1].span);
    }

    const body = tokens.slice(i);
    const text = body.length
      ? file.text.slice(body[0].span.start, end).replace(/[_\\][ \t]*\n/g, " ").replace(/\s*'[^"]*$/, "").trim()
      : "";
    const existing = this.macros.get(name);
    if (existing?.builtin) this.diagnostics.warning("W500", `The built-in macro ${name} is redefined`, nameToken.span);
    else if (existing && !sameBody(existing, body, params)) {
      this.diagnostics.warning("W510", `The macro ${name} is redefined`, nameToken.span);
    }
    const bodyProblems = problems.items.length ? problems : undefined;
    this.macros.set(name, { name, params, body, text, bodyProblems, span: nameToken.span });
  }

  // ----------------------------------------------------------------------------------------------
  // #if

  private condition(kind: string, rawArgs: string, args: () => Token[], span: Span): boolean {
    if (kind === "ifdef" || kind === "ifndef") {
      const t = args()[0];
      if (!t || (t.kind !== "identifier" && t.kind !== "keyword")) {
        this.error("E212", `#${kind} needs a macro name`, span);
        return false;
      }
      return this.macros.has(t.text) === (kind === "ifdef");
    }
    try {
      return new ConditionEvaluator(rawArgs, (name) => this.macroText(name, 0)).evaluate();
    } catch (e) {
      this.error("E213", `Invalid #if expression: ${(e as Error).message}`, span);
      return false;
    }
  }

  /** The text an object-like macro expands to (nested ones too), or undefined when not defined. */
  private macroText(name: string, depth: number): string | undefined {
    const m = this.macros.get(name);
    if (!m || m.params || m.builtin || depth > 32) return m ? "" : undefined;
    const nested = this.macros.get(m.text);
    return nested && nested !== m ? (this.macroText(m.text, depth + 1) ?? m.text) : m.text;
  }

  // ----------------------------------------------------------------------------------------------
  // #include

  private include(rawArgs: string, file: SourceFile, span: Span): void {
    let text = rawArgs;
    let once = false;
    const onceMatch = /^once\b\s*(\[\s*(\w+)\s*:\s*\w+\s*\])?\s*/i.exec(text);
    if (onceMatch) {
      once = true;
      if (onceMatch[2] && onceMatch[2].toLowerCase() !== "arch") {
        this.error("E214", `Unknown #include modifier '${onceMatch[2]}'`, span);
        return;
      }
      text = text.slice(onceMatch[0].length);
    }
    if (/^[A-Za-z_]\w*$/.test(text) && this.macros.has(text)) text = this.macroText(text, 0) ?? text;
    const m = /^(?:<([^>]+)>|"([^"]+)")$/.exec(text);
    if (!m) {
      this.error("E215", '#include needs <file> or "file"', span);
      return;
    }
    const system = m[1] !== undefined;
    const name = (m[1] ?? m[2]).trim();
    const resolved = this.resolveInclude(name, file.name, system);
    if (!resolved) {
      const message = system
        ? `<${name}> is not in Klive BASIC's library (yet), nor in the include path`
        : `Cannot find the included file "${name}"`;
      this.error("E216", message, span);
      return;
    }
    if (this.includedOnce.has(resolved.path)) return;
    if (this.includeStack.includes(resolved.path)) {
      this.diagnostics.warning("K216", `"${name}" includes itself (through other files); ignored`, span);
      return;
    }
    if (once) {
      if (this.includedAlready.has(resolved.path)) return;
      this.includedOnce.add(resolved.path);
    }
    const child = this.sources.add(resolved.path, resolved.text);
    this.processFile(child);
  }

  private resolveInclude(name: string, from: string, system: boolean): { path: string; text: string } | undefined {
    const candidates: string[] = [];
    if (isAbsolute(name)) candidates.push(name);
    else {
      if (!system) candidates.push(joinPath(dirName(from), name));
      for (const dir of this.options.includePaths ?? []) candidates.push(joinPath(dir, name));
    }
    for (const path of candidates) {
      const text = this.reader.read(path);
      if (text !== undefined) return { path, text };
    }
    return undefined;
  }

  // ----------------------------------------------------------------------------------------------
  // Macro expansion

  /** Expands macros in a run of tokens (one logical line). */
  private expand(tokens: Token[], file: SourceFile): Token[] {
    const result: Token[] = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      const macro = (t.kind === "identifier" && !t.sigil) || t.kind === "keyword" ? this.macros.get(t.text) : undefined;
      if (!macro || t.expansion?.some((e) => e.macro === macro.name)) {
        result.push(t);
        i++;
        continue;
      }
      if (macro.builtin) {
        result.push(this.builtin(macro.name, t, file));
        i++;
        continue;
      }
      if (macro.bodyProblems) {
        for (const d of macro.bodyProblems.items) this.diagnostics.items.push({ ...d, message: `${d.message} (in macro ${macro.name})` });
        macro.bodyProblems = undefined;
      }
      if (!macro.params) {
        const step: ExpansionStep = { macro: macro.name, span: siteSpan(t) };
        result.push(...this.expand(this.substitute(macro, [], t, step), file));
        i++;
        continue;
      }
      if (tokens[i + 1]?.text !== "(") {
        result.push(t);
        i++;
        continue;
      }
      const call = collectArguments(tokens, i + 1);
      if (!call) {
        this.error("E217", `The call of macro ${macro.name} has no ')'`, t.span);
        result.push(t);
        i++;
        continue;
      }
      const callSpan = { file: siteSpan(t).file, start: siteSpan(t).start, end: siteSpan(tokens[call.end]).end };
      const args = call.args.length === 1 && call.args[0].length === 0 && macro.params.length === 0 ? [] : call.args;
      if (args.length !== macro.params.length) {
        this.error("E218", `Macro ${macro.name} takes ${macro.params.length} argument(s), not ${args.length}`, callSpan);
        i = call.end + 1;
        continue;
      }
      const step: ExpansionStep = { macro: macro.name, span: callSpan };
      result.push(...this.expand(this.substitute(macro, args, t, step, file), file));
      i = call.end + 1;
    }
    return result;
  }

  /** The body of a macro with its parameters replaced, # and ## applied, tagged with the expansion. */
  private substitute(macro: Macro, args: Token[][], use: Token, step: ExpansionStep, file?: SourceFile): Token[] {
    const params = macro.params ?? [];
    const chain = [step, ...(use.expansion ?? [])];
    const tag = (t: Token): Token => ({ ...t, expansion: [...chain, ...(t.expansion ?? [])] });
    const expandedArgs = args.map((a) => (file ? this.expand(a, file) : a));
    const body = macro.body;
    const out: Token[] = [];
    for (let k = 0; k < body.length; k++) {
      const b = body[k];
      if (b.text === "#" && body[k + 1] && params.includes(body[k + 1].text)) {
        const arg = args[params.indexOf(body[k + 1].text)];
        out.push(tag(this.stringToken(arg, b.span)));
        k++;
        continue;
      }
      if (b.text === "##") continue;
      const index = b.kind === "identifier" ? params.indexOf(b.text) : -1;
      const pasteNext = body[k + 1]?.text === "##";
      const pastePrev = body[k - 1]?.text === "##";
      const piece = index >= 0 ? (pasteNext || pastePrev ? args[index] : expandedArgs[index]) : [b];
      if (pastePrev && out.length && piece.length) {
        const left = out.pop()!;
        out.push(...this.paste(left, piece[0], chain), ...piece.slice(1).map(tag));
      } else out.push(...piece.map(tag));
    }
    return out;
  }

  private stringToken(arg: Token[], span: Span): Token {
    const text = arg.map((t, n) => (n > 0 && t.spaceBefore ? " " : "") + t.text).join("");
    return { kind: "string", text: `"${text.replace(/"/g, '""')}"`, stringValue: text, span };
  }

  /** `a ## b`: the tokens of the two texts joined. */
  private paste(left: Token, right: Token, chain: ExpansionStep[]): Token[] {
    const text = left.text + right.text;
    const file = this.sources.add(`<paste ${text}>`, text);
    return lexFragment(file, 0, text.length, this.diagnostics).map((t) => ({ ...t, span: left.span, expansion: chain }));
  }

  private builtin(name: string, use: Token, file: SourceFile): Token {
    const base = { span: use.span, expansion: [{ macro: name, span: siteSpan(use) }, ...(use.expansion ?? [])] };
    const at = siteSpan(use);
    const where = this.sources.get(at.file);
    switch (name) {
      case "__LINE__": {
        const line = where.location(at.start).line;
        return { ...base, kind: "number", text: String(line), value: line, numberForm: "integer" };
      }
      case "__BASE_FILE__":
        return { ...base, kind: "string", text: `"${this.root.name}"`, stringValue: this.root.name };
      default: {
        const name = where.location(at.start).fileName ?? file.name;
        return { ...base, kind: "string", text: `"${name}"`, stringValue: name };
      }
    }
  }

  private error(code: string, message: string, span: Span): void {
    this.diagnostics.error(code, message, span);
  }
}

/** Where a token is reported: the outermost macro use for macro output, else its own span. */
export function siteSpan(token: Token): Span {
  const chain = token.expansion;
  return chain && chain.length ? chain[chain.length - 1].span : token.span;
}

/** The arguments of a macro call starting at the '(' at `open`; undefined when it has no ')'. */
function collectArguments(tokens: Token[], open: number): { args: Token[][]; end: number } | undefined {
  const args: Token[][] = [[]];
  let depth = 0;
  for (let i = open + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "newline") return undefined;
    if (t.text === "(") depth++;
    else if (t.text === ")") {
      if (depth === 0) return { args, end: i };
      depth--;
    } else if (t.text === "," && depth === 0) {
      args.push([]);
      continue;
    }
    args[args.length - 1].push(t);
  }
  return undefined;
}

function sameBody(m: Macro, body: Token[], params?: string[]): boolean {
  return (
    JSON.stringify(m.params ?? null) === JSON.stringify(params ?? null) &&
    m.body.map((t) => t.text).join(" ") === body.map((t) => t.text).join(" ")
  );
}

function isAbsolute(path: string): boolean {
  return /^([A-Za-z]:)?[\\/]/.test(path);
}

function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? "" : path.slice(0, i);
}

function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  const parts = `${dir}/${name}`.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "." || (p === "" && out.length > 0)) continue;
    if (p === ".." && out.length > 0 && out[out.length - 1] !== "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

/**
 * `#if` expressions (spec `preprocessor.directives` #if): names, integers, strings, parentheses,
 * == != <> < <= > >=, && || and !. Equality compares the expanded text; ordering compares integer
 * values (non-numeric text counts as 0); a bare name is true when it expands to a non-zero integer,
 * or, failing that, when it is defined.
 */
class ConditionEvaluator {
  private readonly tokens: string[];
  private i = 0;

  constructor(
    text: string,
    private readonly lookup: (name: string) => string | undefined
  ) {
    const re = /\s*(==|!=|<>|<=|>=|&&|\|\||[()<>!=]|"[^"]*"|\$[0-9A-Fa-f]+|\d+|[A-Za-z_]\w*)/y;
    this.tokens = [];
    let at = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      this.tokens.push(m[1]);
      at = re.lastIndex;
    }
    if (text.slice(at).trim() !== "") throw new Error(`unexpected '${text.slice(at).trim()}'`);
  }

  evaluate(): boolean {
    const v = this.or();
    if (this.i < this.tokens.length) throw new Error(`unexpected '${this.tokens[this.i]}'`);
    return truth(v);
  }

  private or(): Value {
    let v = this.and();
    while (this.tokens[this.i] === "||") {
      this.i++;
      const r = this.and();
      v = bool(truth(v) || truth(r));
    }
    return v;
  }

  private and(): Value {
    let v = this.comparison();
    while (this.tokens[this.i] === "&&") {
      this.i++;
      const r = this.comparison();
      v = bool(truth(v) && truth(r));
    }
    return v;
  }

  private comparison(): Value {
    let v = this.unary();
    for (;;) {
      const op = this.tokens[this.i];
      if (!["==", "=", "!=", "<>", "<", "<=", ">", ">="].includes(op)) return v;
      this.i++;
      const r = this.unary();
      if (op === "==" || op === "=") v = bool(v.text === r.text);
      else if (op === "!=" || op === "<>") v = bool(v.text !== r.text);
      else {
        const a = toInt(v.text);
        const b = toInt(r.text);
        v = bool(op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b);
      }
    }
  }

  private unary(): Value {
    const t = this.tokens[this.i++];
    if (t === undefined) throw new Error("the expression ends too early");
    if (t === "!") return bool(!truth(this.unary()));
    if (t === "(") {
      const v = this.or();
      if (this.tokens[this.i++] !== ")") throw new Error("missing ')'");
      return v;
    }
    if (t.startsWith('"')) return { text: t.slice(1, -1), defined: true };
    if (/^\d/.test(t) || t.startsWith("$")) return { text: String(toInt(t)), defined: true };
    const expanded = this.lookup(t);
    return expanded === undefined ? { text: "", defined: false } : { text: expanded, defined: true };
  }
}

type Value = { text: string; defined: boolean };

function bool(b: boolean): Value {
  return { text: b ? "1" : "0", defined: true };
}

function toInt(text: string): number {
  if (/^\$[0-9A-Fa-f]+$/.test(text)) return parseInt(text.slice(1), 16);
  return /^-?\d+$/.test(text) ? Number(text) : 0;
}

function truth(v: Value): boolean {
  if (/^-?\d+$/.test(v.text) || /^\$[0-9A-Fa-f]+$/.test(v.text)) return toInt(v.text) !== 0;
  return v.defined;
}
