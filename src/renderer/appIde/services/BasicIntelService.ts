import type {
  BasicDefineInfo,
  BasicHeaderOptionInfo,
  BasicIntelData,
  BasicLocation,
  BasicOccurrence,
  BasicOutlineEntry,
  BasicScopeInfo,
  BasicSymbolInfo
} from "@abstractions/BasicIntel";

/**
 * The renderer's view of Klive BASIC intel snapshots (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md`
 * §4.3): indexes over each `BasicIntelData`, and the queries the `.zxbas` providers ask.
 *
 * Positions in and out are Monaco's: 1-based lines and 1-based columns (end columns exclusive).
 *
 * A snapshot is up to a debounce and a check behind the editor, or older while the file has errors.
 * A position query therefore trusts the snapshot's occurrence there only when the live text at that
 * place is still the symbol's name; otherwise it falls back to looking the word up by name in the
 * scope around the cursor (E5). A wrong answer is worse than none.
 */

/** A file location resolved to a path, in Monaco coordinates. */
export type BasicPathLocation = {
  path: string;
  line: number;
  startColumn: number;
  endColumn: number;
};

/** A symbol of a snapshot. */
export type BasicSymbolRef = { snapshot: BasicIntelSnapshot; symbol: BasicSymbolInfo };

/** The word at a column of a line: a name (no sigil) or a run of digits. */
export function wordAt(lineText: string, column: number): { word: string; startColumn: number; endColumn: number } | undefined {
  const re = /[A-Za-z_][A-Za-z0-9_]*|\d+/g;
  let m: RegExpExecArray | null;
  const col0 = column - 1;
  while ((m = re.exec(lineText))) {
    if (col0 >= m.index && col0 <= m.index + m[0].length) {
      return { word: m[0], startColumn: m.index + 1, endColumn: m.index + m[0].length + 1 };
    }
    if (m.index > col0) break;
  }
  return undefined;
}

/** A path as the snapshots and the editor models compare it. */
export function normalizeBasicPath(path: string): string {
  let p = path.replace(/\\/g, "/");
  // --- A library model's URI path gets a leading slash
  if (/^\/<kbasic-stdlib>\//.test(p)) p = p.slice(1);
  // --- Windows paths compare in any case
  if (/^\/?[A-Za-z]:\//.test(p)) p = p.replace(/^\//, "").toLowerCase();
  return p;
}

/** One snapshot with its indexes. */
export class BasicIntelSnapshot {
  private readonly occurrencesByFile = new Map<number, BasicOccurrence[]>();
  private readonly occurrencesBySymbol = new Map<number, BasicOccurrence[]>();
  private readonly fileByPath = new Map<string, number>();
  private readonly scopesByFile = new Map<number, BasicScopeInfo[]>();

  constructor(readonly data: BasicIntelData) {
    for (const f of data.files) this.fileByPath.set(normalizeBasicPath(f.path), f.index);
    for (const o of data.occurrences) {
      push(this.occurrencesByFile, o.fileIndex, o);
      push(this.occurrencesBySymbol, o.symbolId, o);
    }
    for (const s of data.scopes) if (s.routineId !== undefined) push(this.scopesByFile, s.fileIndex, s);
  }

  get rootFile(): string {
    return this.data.rootFile;
  }

  get caseInsensitive(): boolean {
    return this.data.caseInsensitive;
  }

  fileIndex(path: string): number | undefined {
    return this.fileByPath.get(normalizeBasicPath(path));
  }

  filePath(index: number): string | undefined {
    return this.data.files[index]?.path;
  }

  isLibraryFile(index: number): boolean {
    return !!this.data.files[index]?.library;
  }

  symbol(id: number): BasicSymbolInfo | undefined {
    return this.data.symbols[id];
  }

  /** Whether two names are the same identifier in this program (E12). */
  sameName(a: string, b: string, symbol?: BasicSymbolInfo): boolean {
    if (a === b) return true;
    const anyCase = this.caseInsensitive || (symbol ? this.isLibraryFile(symbol.declaration.fileIndex) : false);
    return anyCase && a.toLowerCase() === b.toLowerCase();
  }

  /** The occurrence covering a 0-based column of a line, by binary search. */
  occurrenceAt(fileIndex: number, line: number, column0: number): BasicOccurrence | undefined {
    const list = this.occurrencesByFile.get(fileIndex);
    if (!list) return undefined;
    let lo = 0;
    let hi = list.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const o = list[mid];
      if (o.line < line || (o.line === line && o.endColumn < column0)) lo = mid + 1;
      else if (o.line > line || o.startColumn > column0) hi = mid - 1;
      else return o;
    }
    return undefined;
  }

  occurrencesOf(symbolId: number): BasicOccurrence[] {
    return this.occurrencesBySymbol.get(symbolId) ?? [];
  }

  /** The routine scope of a file whose line range holds `line`. */
  routineScopeAt(fileIndex: number, line: number): BasicScopeInfo | undefined {
    return this.scopesByFile.get(fileIndex)?.find((s) => line >= s.startLine && line <= s.endLine);
  }

  /** The symbols visible on a line: the routine's own first, then the globals they do not hide. */
  visibleSymbols(fileIndex: number | undefined, line: number): BasicSymbolInfo[] {
    const local = fileIndex === undefined ? undefined : this.routineScopeAt(fileIndex, line);
    const own = (local?.symbolIds ?? []).map((id) => this.data.symbols[id]);
    const globals = this.data.scopes[0]?.symbolIds.map((id) => this.data.symbols[id]) ?? [];
    const hidden = (g: BasicSymbolInfo) => own.some((s) => this.sameName(s.name, g.name, g));
    return [...own, ...globals.filter((g) => g.kind !== "label" && g.kind !== "lineNumber" && !hidden(g))];
  }

  /** A name looked up as the binder would at a line: the routine's scope, then the globals. */
  lookup(name: string, fileIndex: number | undefined, line: number): BasicSymbolInfo | undefined {
    const visible = this.visibleSymbols(fileIndex, line);
    return visible.find((s) => s.name === name) ?? visible.find((s) => this.sameName(s.name, name, s));
  }

  labels(): BasicSymbolInfo[] {
    return this.data.symbols.filter((s) => s.kind === "label" || s.kind === "lineNumber");
  }

  routines(): BasicSymbolInfo[] {
    return this.data.symbols.filter((s) => s.kind === "sub" || s.kind === "function");
  }

  routineByName(name: string): BasicSymbolInfo | undefined {
    const routines = this.routines();
    return routines.find((s) => s.name === name) ?? routines.find((s) => this.sameName(s.name, name, s));
  }

  outline(fileIndex: number): BasicOutlineEntry[] {
    return this.data.outline.filter((e) => e.fileIndex === fileIndex);
  }

  defines(): BasicDefineInfo[] {
    return this.data.defines;
  }

  headerOptions(): BasicHeaderOptionInfo[] {
    return this.data.headerOptions;
  }

  /** A location in Monaco coordinates with its path. */
  resolve(location: BasicLocation): BasicPathLocation | undefined {
    const path = this.filePath(location.fileIndex);
    if (path === undefined) return undefined;
    return { path, line: location.line, startColumn: location.startColumn + 1, endColumn: location.endColumn + 1 };
  }
}

export interface IBasicIntelService {
  /** New snapshots (by root file), and the build root (its snapshot is preferred for a file both have). */
  update(snapshots: Record<string, BasicIntelData> | undefined, buildRoot?: string): void;
  /** Whether any snapshot exists. */
  readonly hasData: boolean;
  /** The snapshot to answer for a file: one that contains it, the build root's first. */
  snapshotFor(path: string): BasicIntelSnapshot | undefined;
  /** The symbol at a position, applying the stale-text guard (E5). */
  symbolAt(path: string, line: number, column: number, lineText: string): BasicSymbolRef | undefined;
  /** The `#define` whose name is at a position. */
  defineAt(path: string, line: number, column: number, lineText: string): { snapshot: BasicIntelSnapshot; define: BasicDefineInfo } | undefined;
  /** A symbol's declaration, and its DECLARE line when it has one. */
  definition(ref: BasicSymbolRef): BasicPathLocation[];
  /** A symbol's occurrences. */
  references(ref: BasicSymbolRef, includeDeclaration: boolean): BasicPathLocation[];
  /** The symbols visible at a line of a file. */
  visibleSymbols(path: string, line: number): BasicSymbolInfo[];
  /** A routine by name, in the snapshot of a file. */
  routineByName(name: string, path: string): BasicSymbolRef | undefined;
  /** The outline of a file. */
  outline(path: string): BasicOutlineEntry[];
}

export class BasicIntelService implements IBasicIntelService {
  private snapshots: BasicIntelSnapshot[] = [];
  private buildRoot?: string;
  private source?: Record<string, BasicIntelData>;

  update(snapshots: Record<string, BasicIntelData> | undefined, buildRoot?: string): void {
    const root = buildRoot ? normalizeBasicPath(buildRoot) : undefined;
    if (snapshots === this.source && root === this.buildRoot) return;
    this.source = snapshots;
    this.buildRoot = root;
    const previous = new Map(this.snapshots.map((s) => [s.data, s]));
    this.snapshots = Object.values(snapshots ?? {}).map((d) => previous.get(d) ?? new BasicIntelSnapshot(d));
  }

  get hasData(): boolean {
    return this.snapshots.length > 0;
  }

  snapshotFor(path: string): BasicIntelSnapshot | undefined {
    const candidates = this.snapshots.filter((s) => s.fileIndex(path) !== undefined);
    return candidates.find((s) => normalizeBasicPath(s.rootFile) === this.buildRoot) ?? candidates[0];
  }

  symbolAt(path: string, line: number, column: number, lineText: string): BasicSymbolRef | undefined {
    const snapshot = this.snapshotFor(path);
    const word = wordAt(lineText, column);
    if (!snapshot || !word) return undefined;
    const fileIndex = snapshot.fileIndex(path)!;
    // --- The occurrence there counts only when the live text is still the symbol's name
    const occurrence = snapshot.occurrenceAt(fileIndex, line, column - 1);
    if (occurrence) {
      const symbol = snapshot.symbol(occurrence.symbolId)!;
      const live = lineText.slice(occurrence.startColumn, occurrence.endColumn);
      if (
        occurrence.editable &&
        occurrence.startColumn + 1 === word.startColumn &&
        occurrence.endColumn + 1 === word.endColumn &&
        snapshot.sameName(live, symbol.name, symbol)
      ) {
        return { snapshot, symbol };
      }
    }
    // --- Otherwise, the name in the scope around the cursor
    if (/^\d/.test(word.word)) {
      // --- A line number: as a label at the start of a line, or after GOTO / GOSUB / RESTORE
      const symbol = snapshot.labels().find((l) => l.kind === "lineNumber" && l.name === String(Number(word.word)));
      const target = /^\s*$/.test(lineText.slice(0, word.startColumn - 1)) || /\b(?:GO\s*TO|GO\s*SUB|RESTORE|THEN|ELSE)\s*$/i.test(lineText.slice(0, word.startColumn - 1)) || /,\s*$/.test(lineText.slice(0, word.startColumn - 1));
      return symbol && target ? { snapshot, symbol } : undefined;
    }
    const before = lineText.slice(0, word.startColumn - 1);
    const after = lineText.slice(word.endColumn - 1);
    const isLabelPlace = /\b(?:GO\s*TO|GO\s*SUB|RESTORE)\s*$/i.test(before) || /^\s*$/.test(before) && /^\s*:/.test(after) || /@\s*$/.test(before);
    if (isLabelPlace) {
      const label = snapshot.labels().find((l) => l.kind === "label" && snapshot.sameName(l.name, word.word, l));
      if (label) return { snapshot, symbol: label };
    }
    const symbol = snapshot.lookup(word.word, fileIndex, line);
    return symbol ? { snapshot, symbol } : undefined;
  }

  defineAt(path: string, _line: number, column: number, lineText: string): { snapshot: BasicIntelSnapshot; define: BasicDefineInfo } | undefined {
    const snapshot = this.snapshotFor(path);
    const word = wordAt(lineText, column);
    if (!snapshot || !word) return undefined;
    // --- Macro names match exactly (the preprocessor works below the language)
    const define = [...snapshot.defines()].reverse().find((d) => d.name === word.word);
    return define ? { snapshot, define } : undefined;
  }

  definition(ref: BasicSymbolRef): BasicPathLocation[] {
    const { snapshot, symbol } = ref;
    const locations = [snapshot.resolve(symbol.declaration)];
    if (symbol.forwardDeclaration) locations.push(snapshot.resolve(symbol.forwardDeclaration));
    return locations.filter((l): l is BasicPathLocation => !!l);
  }

  references(ref: BasicSymbolRef, includeDeclaration: boolean): BasicPathLocation[] {
    return ref.snapshot
      .occurrencesOf(ref.symbol.id)
      .filter((o) => includeDeclaration || o.role === "use")
      .map((o) => ref.snapshot.resolve(o))
      .filter((l): l is BasicPathLocation => !!l);
  }

  visibleSymbols(path: string, line: number): BasicSymbolInfo[] {
    const snapshot = this.snapshotFor(path);
    return snapshot ? snapshot.visibleSymbols(snapshot.fileIndex(path), line) : [];
  }

  routineByName(name: string, path: string): BasicSymbolRef | undefined {
    const snapshot = this.snapshotFor(path);
    const symbol = snapshot?.routineByName(name);
    return snapshot && symbol ? { snapshot, symbol } : undefined;
  }

  outline(path: string): BasicOutlineEntry[] {
    const snapshot = this.snapshotFor(path);
    const index = snapshot?.fileIndex(path);
    return snapshot && index !== undefined ? snapshot.outline(index) : [];
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Shared singleton the Monaco providers read (they are registered once, outside React);
 * `MonacoEditor` feeds it from `state.compilation.basicIntel`.
 */
export const basicIntelSingleton = new BasicIntelService();
