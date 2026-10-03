import type {
  BasicDefineInfo,
  BasicHeaderOptionInfo,
  BasicIntelData,
  BasicIntelFile,
  BasicLocation,
  BasicOccurrence,
  BasicOutlineEntry,
  BasicParamInfo,
  BasicScopeInfo,
  BasicSymbolInfo
} from "@abstractions/BasicIntel";
import type { Span } from "../diagnostics";
import type { KBasicFrontEndResult } from "../KBasicCompiler";
import { defaultOptions, OPTION_SPECS, type KBasicOptions, type OptionValue } from "../options/options";
import { constantText } from "../semantics/constants";
import type { ArraySymbol, LabelSymbol, ParamSymbol, RoutineSymbol, Symbol, VariableSymbol } from "../semantics/symbols";
import { typeText } from "../semantics/types";
import type { Statement } from "../syntax/ast";
import type { SourceSet } from "../syntax/source";
import { isLibraryPath } from "../stdlib";

/**
 * Builds the editor's BASIC intelligence snapshot from a front-end run
 * (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` §3, §4.1). Pure: it reads the result and nothing else.
 *
 * Undefined when the program was not bound (it has lexer, preprocessor or parser errors).
 */
export function extractBasicIntel(result: KBasicFrontEndResult): BasicIntelData | undefined {
  if (!result.bound) return undefined;
  return new Extractor(result).run();
}

/** A symbol before ids are given: what it is, and the spans of its declaration and uses. */
type Candidate = {
  /** The binder's object(s) this stands for (a parameter is its ParamSymbol and its body variable). */
  keys: object[];
  info: Omit<BasicSymbolInfo, "id" | "scopeId" | "declaration" | "forwardDeclaration">;
  scope: number;
  declaration: Span;
  forwardDeclaration?: Span;
  uses: Span[];
  library: boolean;
};

class Extractor {
  private readonly sources: SourceSet;
  private readonly caseInsensitive: boolean;
  /** Whole-line comments by file and 1-based line: their text without the comment marker. */
  private readonly commentLines = new Map<number, Map<number, string>>();
  /** Spans that are macro uses (`file:start`): a symbol use there is not its name (E11). */
  private readonly macroSites = new Set<string>();
  /** Routine definitions' END lines, by the header span's `file:start`. */
  private readonly routineEnds = new Map<string, number>();
  private readonly codebanks: { fileIndex: number; line: number; endLine: number; bank: string; nameStart: number; nameEnd: number }[] = [];

  constructor(private readonly result: KBasicFrontEndResult) {
    this.sources = result.sources;
    this.caseInsensitive = result.options.caseInsensitive;
  }

  run(): BasicIntelData {
    const bound = this.result.bound!;
    this.readComments();
    for (const d of this.result.preprocessed.defines ?? []) for (const u of d.uses) this.macroSites.add(key(u));
    this.walk(this.result.program.statements);

    const files: BasicIntelFile[] = this.sources.files.map((f) => ({
      index: f.index,
      path: f.name,
      library: isLibraryPath(f.name),
      virtual: f.name.startsWith("<")
    }));

    // --- Candidates: globals, then each routine's parameters and locals, then labels
    const candidates: Candidate[] = [];
    const scopeOf: { routine?: RoutineSymbol; candidates: Candidate[] }[] = [{ candidates: [] }];
    const paramUses = new Map<ParamSymbol, Span[]>();
    for (const u of bound.paramUses ?? []) paramUses.set(u.param, [...(paramUses.get(u.param) ?? []), u.span]);

    for (const symbol of bound.globals.symbols) {
      const c = this.candidateOf(symbol, 0);
      candidates.push(c);
      scopeOf[0].candidates.push(c);
    }
    for (const routine of bound.program.routines) {
      if (!routine.scope || !routine.definedAt || this.isLibrary(routine.definedAt)) continue;
      const scope = scopeOf.length;
      const entry = { routine, candidates: [] as Candidate[] };
      scopeOf.push(entry);
      const paramVariables = new Set<object>();
      for (const p of routine.params) {
        const c = this.paramCandidate(p, scope, paramUses.get(p) ?? []);
        if (p.symbol) paramVariables.add(p.symbol);
        candidates.push(c);
        entry.candidates.push(c);
      }
      for (const symbol of routine.scope.symbols) {
        if (paramVariables.has(symbol)) continue;
        const c = this.candidateOf(symbol, scope);
        candidates.push(c);
        entry.candidates.push(c);
      }
    }
    const labels = bound.program.labels.map((l) => this.labelCandidate(l));
    candidates.push(...labels);
    scopeOf[0].candidates.push(...labels);

    // --- Library symbols the user's files never name are left out, and so are library internals
    const kept = candidates.filter((c) => !c.library || (!c.info.name.startsWith("__") && c.uses.some((u) => !this.isLibrary(u))));
    const ids = new Map<Candidate, number>();
    kept.forEach((c, i) => ids.set(c, i));
    const scopeIds = new Map<number, number>();
    const scopes: BasicScopeInfo[] = [];
    scopeOf.forEach((s, index) => {
      const symbolIds = s.candidates.filter((c) => ids.has(c)).map((c) => ids.get(c)!);
      if (index > 0 && !s.routine) return;
      const id = scopes.length;
      scopeIds.set(index, id);
      if (!s.routine) {
        const root = this.sources.get(0);
        scopes.push({ id, fileIndex: 0, startLine: 1, endLine: root.position(root.text.length).line, symbolIds });
        return;
      }
      const header = s.routine.definedAt!;
      const start = this.location(s.routine.span);
      scopes.push({
        id,
        routineId: ids.get(candidates.find((c) => c.keys.includes(s.routine!))!) ?? -1,
        fileIndex: start.fileIndex,
        startLine: this.sources.get(header.file).position(header.start).line,
        endLine: this.routineEnds.get(key(header)) ?? start.line,
        symbolIds
      });
    });

    const symbols: BasicSymbolInfo[] = kept.map((c, id) => ({
      id,
      scopeId: scopeIds.get(c.scope) ?? 0,
      ...c.info,
      declaration: this.location(c.declaration),
      ...(c.forwardDeclaration ? { forwardDeclaration: this.location(c.forwardDeclaration) } : {})
    }));

    // --- Occurrences, sorted and without duplicates
    const occurrences: BasicOccurrence[] = [];
    const seen = new Set<string>();
    const add = (c: Candidate, span: Span, role: "declaration" | "use") => {
      const occurrence = this.occurrence(ids.get(c)!, c.info.name, span, role, c.library);
      const k = `${occurrence.symbolId}:${occurrence.fileIndex}:${occurrence.line}:${occurrence.startColumn}`;
      if (seen.has(k)) return;
      seen.add(k);
      occurrences.push(occurrence);
    };
    for (const c of kept) {
      add(c, c.declaration, "declaration");
      if (c.forwardDeclaration) add(c, c.forwardDeclaration, "declaration");
      for (const u of c.uses) add(c, u, "use");
    }
    occurrences.sort((a, b) => a.fileIndex - b.fileIndex || a.line - b.line || a.startColumn - b.startColumn);

    return {
      rootFile: this.sources.get(0).name,
      caseInsensitive: this.caseInsensitive,
      files,
      symbols,
      occurrences,
      scopes,
      outline: this.outline(symbols, scopes, kept, ids),
      defines: this.defines(),
      headerOptions: this.headerOptions()
    };
  }

  // ===============================================================================================
  // Candidates

  private candidateOf(symbol: Symbol, scope: number): Candidate {
    const library = this.isLibrary(symbol.span);
    const base = { keys: [symbol] as object[], scope, uses: symbol.uses, library };
    const doc = this.docAbove(symbol.kind === "sub" || symbol.kind === "function" ? (symbol.definedAt ?? symbol.span) : symbol.span);
    const bank = symbol.bank ? { bank: symbol.bank } : {};
    switch (symbol.kind) {
      case "variable": {
        const implicit = !symbol.declared;
        return {
          ...base,
          declaration: symbol.span,
          info: {
            name: symbol.name,
            kind: "variable",
            typeText: typeText(symbol.type),
            detail: variableDetail(symbol),
            storage: symbol.storage,
            ...(symbol.byref ? { byref: true } : {}),
            ...(implicit ? { implicit: true } : {}),
            ...(doc ? { doc } : {}),
            ...bank
          }
        };
      }
      case "array": {
        const bounds = boundsText(symbol);
        return {
          ...base,
          declaration: symbol.span,
          info: {
            name: symbol.name,
            kind: "array",
            typeText: typeText(symbol.elementType),
            detail: `DIM ${symbol.name}${bounds} AS ${typeText(symbol.elementType)}`,
            storage: symbol.storage,
            arrayBounds: bounds,
            ...(doc ? { doc } : {}),
            ...bank
          }
        };
      }
      case "const": {
        const value = constantText(symbol.value);
        return {
          ...base,
          declaration: symbol.span,
          info: {
            name: symbol.name,
            kind: "const",
            typeText: typeText(symbol.type),
            detail: `CONST ${symbol.name} AS ${typeText(symbol.type)} = ${value}`,
            constValue: value,
            ...(doc ? { doc } : {}),
            ...bank
          }
        };
      }
      case "sub":
      case "function": {
        const params: BasicParamInfo[] = symbol.params.map((p) => ({
          name: p.name,
          typeText: typeText(p.type),
          byref: p.byref,
          isArray: p.isArray,
          ...(p.defaultValue ? { defaultText: constantText(p.defaultValue) } : {})
        }));
        const forward = symbol.declaredAt && symbol.definedAt ? this.headerName(symbol.declaredAt, symbol.name) : undefined;
        return {
          ...base,
          declaration: symbol.span,
          ...(forward ? { forwardDeclaration: forward } : {}),
          info: {
            name: symbol.name,
            kind: symbol.kind,
            detail: routineDetail(symbol),
            params,
            ...(symbol.returnType ? { returnType: typeText(symbol.returnType), typeText: typeText(symbol.returnType) } : {}),
            convention: symbol.convention,
            ...(doc ? { doc } : {}),
            ...bank
          }
        };
      }
    }
  }

  private paramCandidate(p: ParamSymbol, scope: number, namedUses: Span[]): Candidate {
    const variable = p.symbol;
    const type = typeText(p.type);
    return {
      keys: variable ? [p, variable] : [p],
      scope,
      declaration: p.span,
      uses: [...(variable?.uses ?? []), ...namedUses],
      library: this.isLibrary(p.span),
      info: {
        name: p.name,
        kind: "param",
        typeText: type,
        detail: paramText(p),
        storage: "param",
        ...(p.byref ? { byref: true } : {})
      }
    };
  }

  private labelCandidate(label: LabelSymbol): Candidate {
    const isLine = label.lineNumber !== undefined;
    const name = isLine ? String(label.lineNumber) : label.name.replace(/[$%]$/, "");
    const doc = isLine ? undefined : this.docAbove(label.span);
    return {
      keys: [label],
      scope: 0,
      declaration: label.span,
      uses: label.uses,
      library: this.isLibrary(label.span),
      info: {
        name,
        kind: isLine ? "lineNumber" : "label",
        detail: isLine ? `line ${name}` : `${name}:`,
        ...(doc ? { doc } : {}),
        ...(label.bank ? { bank: label.bank } : {})
      }
    };
  }

  // ===============================================================================================
  // Positions

  private isLibrary(span: Span): boolean {
    return isLibraryPath(this.sources.get(span.file).name);
  }

  private location(span: Span): BasicLocation {
    const file = this.sources.get(span.file);
    const start = file.position(span.start);
    const end = file.position(Math.max(span.start, span.end));
    const lineEnd = file.text.indexOf("\n", span.start);
    const endColumn = end.line === start.line ? end.column : (lineEnd < 0 ? file.text.length : lineEnd) - file.lineStart(start.line);
    return { fileIndex: span.file, line: start.line, startColumn: start.column, endColumn };
  }

  /**
   * An occurrence: narrowed to the name when the span covers more (`@x`, `a(1)`), and editable only
   * when that text is the symbol's name (E11) - a use a macro produced has the macro's span.
   */
  private occurrence(symbolId: number, name: string, span: Span, role: "declaration" | "use", anyCase: boolean): BasicOccurrence {
    const file = this.sources.get(span.file);
    const text = file.text.slice(span.start, span.end);
    const m = /^@?\s*([A-Za-z_][A-Za-z0-9_]*|\d+)/.exec(text);
    const macro = this.macroSites.has(key(span));
    const matches = !!m && this.sameName(m[1], name, anyCase);
    const narrowed = matches ? { file: span.file, start: span.start + m!.index + m![0].length - m![1].length, end: span.start + m![0].length } : span;
    return {
      ...this.location(narrowed),
      symbolId,
      role,
      editable: matches && !macro && !file.name.startsWith("<")
    };
  }

  /** Names match exactly, or in any case in a case-insensitive program or for a library symbol (E12). */
  private sameName(a: string, b: string, anyCase: boolean): boolean {
    return a === b || ((this.caseInsensitive || anyCase) && a.toLowerCase() === b.toLowerCase());
  }

  /** The routine name's span in a DECLARE (or definition) header. */
  private headerName(header: Span, name: string): Span | undefined {
    const text = this.sources.text(header);
    const m = /\b(?:SUB|FUNCTION)\s+(?:(?:FASTCALL|STDCALL)\s+)?([A-Za-z_]\w*)/i.exec(text);
    if (!m || m[1].toLowerCase() !== name.toLowerCase()) return undefined;
    const start = header.start + m.index + m[0].length - m[1].length;
    return { file: header.file, start, end: start + m[1].length };
  }

  // ===============================================================================================
  // Comments, routine ends, CODEBANK blocks

  private readComments(): void {
    for (const span of this.result.program.comments) {
      const file = this.sources.get(span.file);
      const { line, column } = file.position(span.start);
      const before = file.text.slice(file.lineStart(line), span.start);
      if (before.trim() !== "") continue;
      const text = file.text
        .slice(span.start, span.end)
        .replace(/^(?:'|rem\b|\/')/i, "")
        .replace(/'\/$/, "")
        .replace(/^ /, "");
      let lines = this.commentLines.get(span.file);
      if (!lines) this.commentLines.set(span.file, (lines = new Map()));
      // --- A block comment over several lines covers each of them
      text.split("\n").forEach((t, i) => lines!.set(line + i, t.replace(/\s+$/, "")));
      void column;
    }
  }

  /** The whole-line comments directly above a declaration, without a blank line between (§4.1). */
  private docAbove(span: Span): string | undefined {
    const lines = this.commentLines.get(span.file);
    if (!lines) return undefined;
    let line = this.sources.get(span.file).position(span.start).line - 1;
    const doc: string[] = [];
    while (lines.has(line)) doc.unshift(lines.get(line)!), line--;
    // --- A header option block or a Klive library file's banner is not a doc comment
    const text = doc.filter((l) => !/^@/.test(l.trim())).join("\n").trim();
    return text || undefined;
  }

  private walk(statements: Statement[]): void {
    for (const s of statements) {
      switch (s.kind) {
        case "routine":
          this.routineEnds.set(key(s.header.span), this.sources.get(s.end.span.file).position(s.end.span.start).line);
          this.walk(s.body);
          break;
        case "codebank": {
          const file = this.sources.get(s.span.file);
          const bankText = this.sources.text(s.bank.span).trim();
          this.codebanks.push({
            fileIndex: s.span.file,
            line: file.position(s.span.start).line,
            endLine: file.position(s.end.span.start).line,
            bank: bankText,
            nameStart: file.position(s.span.start).column,
            nameEnd: file.position(s.bank.span.end).column
          });
          this.walk(s.body);
          break;
        }
        case "if":
          this.walk(s.then);
          for (const e of s.elseIfs) this.walk(e.body);
          if (s.else) this.walk(s.else);
          break;
        case "for":
        case "while":
        case "do":
          this.walk(s.body);
          break;
      }
    }
  }

  // ===============================================================================================
  // Outline, #define, header options

  private outline(symbols: BasicSymbolInfo[], scopes: BasicScopeInfo[], kept: Candidate[], ids: Map<Candidate, number>): BasicOutlineEntry[] {
    const entry = (s: BasicSymbolInfo, endLine = s.declaration.line, children?: BasicOutlineEntry[]): BasicOutlineEntry => ({
      name: s.name,
      kind: s.kind === "lineNumber" ? "label" : s.kind,
      fileIndex: s.declaration.fileIndex,
      line: s.declaration.line,
      endLine,
      startColumn: s.declaration.startColumn,
      endColumn: s.declaration.endColumn,
      detail: s.detail,
      ...(children && children.length ? { children } : {})
    });
    const top: BasicOutlineEntry[] = [];
    const routineEntries = new Map<number, BasicOutlineEntry>();
    for (const scope of scopes) {
      if (scope.routineId === undefined || scope.routineId < 0) continue;
      const routine = symbols[scope.routineId];
      const children = scope.symbolIds.map((id) => symbols[id]).filter((s) => s.kind === "param" || !s.implicit).map((s) => entry(s));
      const e = entry(routine, scope.endLine, children);
      routineEntries.set(routine.id, e);
      top.push(e);
    }
    const labelParents = new Map<number, number>();
    for (const c of kept) {
      const label = c.keys[0] as LabelSymbol;
      if (label.kind === "label" && label.routine) {
        const routine = kept.find((k) => k.keys.includes(label.routine!));
        if (routine && ids.has(routine)) labelParents.set(ids.get(c)!, ids.get(routine)!);
      }
    }
    for (const s of symbols) {
      if (s.scopeId !== 0 || this.isLibraryFile(s.declaration.fileIndex)) continue;
      if (s.kind === "sub" || s.kind === "function") {
        if (!routineEntries.has(s.id)) top.push(entry(s));
      } else if (s.kind === "label") {
        const parent = labelParents.get(s.id);
        const routine = parent !== undefined ? routineEntries.get(parent) : undefined;
        if (routine) (routine as { children?: BasicOutlineEntry[] }).children = [...(routine.children ?? []), entry(s)];
        else top.push(entry(s));
      } else if (s.kind === "const" || s.kind === "array" || (s.kind === "variable" && !s.implicit)) top.push(entry(s));
    }
    // --- Every routine of a library file (its tab's outline), not only the ones the program uses
    for (const routine of this.result.bound!.program.routines) {
      if (!routine.definedAt || !this.isLibrary(routine.definedAt) || routine.name.startsWith("__")) continue;
      const loc = this.location(routine.span);
      if (top.some((e) => e.fileIndex === loc.fileIndex && e.line === loc.line)) continue;
      top.push({
        name: routine.name,
        kind: routine.kind,
        fileIndex: loc.fileIndex,
        line: loc.line,
        endLine: this.routineEnds.get(key(routine.definedAt)) ?? loc.line,
        startColumn: loc.startColumn,
        endColumn: loc.endColumn,
        detail: routineDetail(routine)
      });
    }
    // --- CODEBANK blocks hold what is declared inside them
    const result: BasicOutlineEntry[] = [];
    const banks = this.codebanks.map((b) => ({
      entry: {
        name: `CODEBANK ${b.bank}`,
        kind: "codebank" as const,
        fileIndex: b.fileIndex,
        line: b.line,
        endLine: b.endLine,
        startColumn: b.nameStart,
        endColumn: b.nameEnd,
        children: [] as BasicOutlineEntry[]
      }
    }));
    for (const e of top) {
      const bank = banks.find((b) => b.entry.fileIndex === e.fileIndex && e.line > b.entry.line && e.line < b.entry.endLine);
      if (bank) bank.entry.children.push(e);
      else result.push(e);
    }
    result.push(...banks.map((b) => b.entry));
    const order = (list: BasicOutlineEntry[]) => list.sort((a, b) => a.fileIndex - b.fileIndex || a.line - b.line);
    for (const b of banks) order(b.entry.children);
    return order(result);
  }

  private isLibraryFile(index: number): boolean {
    return isLibraryPath(this.sources.get(index).name);
  }

  private defines(): BasicDefineInfo[] {
    return (this.result.preprocessed.defines ?? [])
      .filter((d) => !this.isLibrary(d.span) || d.uses.some((u) => !this.isLibrary(u)))
      .map((d) => ({
        name: d.name,
        declaration: this.location(d.span),
        uses: d.uses.map((u) => this.location(u)),
        body: d.body,
        ...(d.params ? { params: d.params } : {})
      }));
  }

  private headerOptions(): BasicHeaderOptionInfo[] {
    const root = this.sources.get(0);
    return this.result.header.map((h) => {
      const line = root.text.slice(h.span.start, h.span.end);
      const at = line.search(/[@!][A-Za-z]/);
      const nameLength = /^[@!]([A-Za-z][A-Za-z0-9-]*)/.exec(line.slice(Math.max(at, 0)))?.[0].length ?? 0;
      const start = at >= 0 ? h.span.start + at : h.span.start;
      const value = effectiveValue(h.name, this.result.options);
      return {
        name: h.name,
        location: this.location({ file: h.span.file, start, end: start + nameLength }),
        ...(value !== undefined ? { value } : h.value !== undefined ? { value: h.value } : {})
      };
    });
  }
}

function key(span: Span): string {
  return `${span.file}:${span.start}`;
}

function variableDetail(v: VariableSymbol): string {
  const type = typeText(v.type);
  if (v.storage === "param") return `${v.byref ? "BYREF" : "BYVAL"} ${v.name} AS ${type}`;
  return `${v.declared ? "DIM " : ""}${v.name} AS ${type}${v.declared ? "" : " (implicit)"}`;
}

function boundsText(a: ArraySymbol): string {
  if (!a.bounds.length) return "()";
  return `(${a.bounds.map((b) => `${b.lower} TO ${b.upper}`).join(", ")})`;
}

function paramText(p: ParamSymbol): string {
  const passing = p.isArray ? "" : p.byref ? "BYREF " : "BYVAL ";
  const def = p.defaultValue ? ` = ${constantText(p.defaultValue)}` : p.hasDefault ? " = …" : "";
  return `${passing}${p.name}${p.isArray ? "()" : ""} AS ${typeText(p.type)}${def}`;
}

/** `FUNCTION FASTCALL ATTR(BYVAL row AS UByte, BYVAL col AS UByte) AS UByte` */
export function routineDetail(r: RoutineSymbol): string {
  const convention = r.convention === "FASTCALL" ? "FASTCALL " : "";
  const params = r.params.map(paramText).join(", ");
  const result = r.kind === "function" && r.returnType ? ` AS ${typeText(r.returnType)}` : "";
  return `${r.kind === "sub" ? "SUB" : "FUNCTION"} ${convention}${r.name}(${params})${result}`;
}

/**
 * The value an option has in the build, formatted: the options field it sets is found by applying
 * it to a copy of the defaults. Undefined for an option that sets several fields or a list.
 */
function effectiveValue(name: string, options: KBasicOptions): string | undefined {
  const spec = OPTION_SPECS.find((o) => o.name === name);
  if (!spec) return undefined;
  if (spec.value.kind === "list") return undefined;
  const samples: OptionValue[] = spec.value.kind === "flag" ? [true, false] : spec.value.kind === "int" ? [0xabcd] : ["\u0001"];
  const defaults = defaultOptions() as unknown as Record<string, unknown>;
  let field: string | undefined;
  for (const sample of samples) {
    const probe = defaultOptions();
    try {
      spec.apply(probe, sample);
    } catch {
      return undefined;
    }
    const changed = Object.keys(probe).filter((k) => JSON.stringify((probe as unknown as Record<string, unknown>)[k]) !== JSON.stringify(defaults[k]));
    if (changed.length === 1) field = changed[0];
    if (changed.length) break;
  }
  if (!field) return undefined;
  const value = (options as unknown as Record<string, unknown>)[field];
  if (value === undefined || Array.isArray(value) || typeof value === "object") return undefined;
  return String(value);
}
