import type {
  DocumentOutlineEntry,
  LanguageIntelData,
  SymbolDefinitionInfo,
  SymbolReferenceInfo
} from "@abstractions/CompilerInfo";

/** Address and bytes for a single assembled line. */
export type LineAddressInfo = { address: number; bytes: readonly number[] };
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ILanguageIntelService {
  /** Update the service's indexes from a new LanguageIntelData snapshot. */
  update(data: LanguageIntelData): void;

  /** The symbol at the given file/line/column (0-based), or null. */
  getSymbolAtPosition(fileIndex: number, line: number, column: number): SymbolDefinitionInfo | null;

  /** All symbols whose lowercase name starts with prefix (case-insensitive). */
  getCompletionCandidates(prefix: string): SymbolDefinitionInfo[];

  /** The definition of the named symbol (lookup is case-insensitive). */
  getSymbolDefinition(name: string): SymbolDefinitionInfo | null;

  /** All recorded usages of the named symbol (case-insensitive lookup). */
  getSymbolReferences(name: string): SymbolReferenceInfo[];

  /** The top-level document outline entries for the given file index. */
  getDocumentOutline(fileIndex: number): DocumentOutlineEntry[];

  /** Absolute path for the source file at the given index, or undefined. */
  getFilePath(fileIndex: number): string | undefined;

  /** File index for the given absolute path, or undefined. */
  getFileIndex(filePath: string): number | undefined;

  /**
   * Find the absolute path of a known source file whose path ends with the
   * given relative path (e.g. "lib/macros.z80asm"). Returns the first match,
   * or undefined if no known file matches.
   */
  findFileByRelativePath(relativePath: string): string | undefined;

  /**
   * Returns the assembled address and emitted bytes for the given
   * (fileIndex, 1-based lineNumber), or undefined if the line emits no code.
   */
  getLineAddress(fileIndex: number, lineNumber: number): LineAddressInfo | undefined;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class LanguageIntelService implements ILanguageIntelService {
  // Maps keyed by lower-cased symbol name
  private _symbolByName = new Map<string, SymbolDefinitionInfo>();
  private _symbolsByFile = new Map<number, SymbolDefinitionInfo[]>();
  private _referencesBySymbol = new Map<string, SymbolReferenceInfo[]>();
  private _outlineByFile = new Map<number, DocumentOutlineEntry[]>();
  private _fileIndexToPath = new Map<number, string>();
  private _filePathToIndex = new Map<string, number>();
  private _lineInfoMap = new Map<string, LineAddressInfo>();

  /**
   * Constructs the service.
   * @param store Optional Redux store. When provided, the service subscribes to
   *              `state.compilation.languageIntel` changes automatically.
   */
  constructor(store?: Store<AppState>) {
    if (store) {
      let prevIntel: LanguageIntelData | undefined;
      store.subscribe(() => {
        const intel = store.getState()?.compilation?.languageIntel;
        if (intel && intel !== prevIntel) {
          prevIntel = intel;
          this.update(intel);
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // ILanguageIntelService
  // -------------------------------------------------------------------------

  update(data: LanguageIntelData): void {
    this._symbolByName.clear();
    this._symbolsByFile.clear();
    this._referencesBySymbol.clear();
    this._outlineByFile.clear();
    this._fileIndexToPath.clear();
    this._filePathToIndex.clear();
    this._lineInfoMap.clear();

    // --- Index symbol definitions
    for (const sym of data.symbolDefinitions) {
      const key = sym.name.toLowerCase();
      this._symbolByName.set(key, sym);

      let list = this._symbolsByFile.get(sym.fileIndex);
      if (!list) {
        list = [];
        this._symbolsByFile.set(sym.fileIndex, list);
      }
      list.push(sym);
    }

    // --- Index symbol references
    for (const ref of data.symbolReferences) {
      const key = ref.symbolName.toLowerCase();
      let list = this._referencesBySymbol.get(key);
      if (!list) {
        list = [];
        this._referencesBySymbol.set(key, list);
      }
      list.push(ref);
    }

    // --- Index document outline entries by fileIndex (top-level only)
    for (const entry of data.documentOutline) {
      const fi = entry.fileIndex;
      let list = this._outlineByFile.get(fi);
      if (!list) {
        list = [];
        this._outlineByFile.set(fi, list);
      }
      list.push(entry);
    }

    // --- Index source files
    for (const sf of data.sourceFiles) {
      this._fileIndexToPath.set(sf.index, sf.filename);
      this._filePathToIndex.set(sf.filename, sf.index);
    }

    // --- Index per-line address/byte information
    for (const li of data.lineInfo ?? []) {
      this._lineInfoMap.set(`${li.fileIndex}:${li.lineNumber}`, { address: li.address, bytes: li.bytes });
    }
  }

  getSymbolAtPosition(
    fileIndex: number,
    line: number,
    column: number
  ): SymbolDefinitionInfo | null {
    const syms = this._symbolsByFile.get(fileIndex);
    if (!syms) return null;
    for (const sym of syms) {
      if (
        sym.line === line &&
        sym.startColumn <= column &&
        column <= sym.endColumn
      ) {
        return sym;
      }
    }
    return null;
  }

  getCompletionCandidates(prefix: string): SymbolDefinitionInfo[] {
    const lc = prefix.toLowerCase();
    const results: SymbolDefinitionInfo[] = [];
    for (const [key, sym] of this._symbolByName) {
      if (key.startsWith(lc)) {
        results.push(sym);
      }
    }
    return results;
  }

  getSymbolDefinition(name: string): SymbolDefinitionInfo | null {
    return this._symbolByName.get(name.toLowerCase()) ?? null;
  }

  getSymbolReferences(name: string): SymbolReferenceInfo[] {
    return this._referencesBySymbol.get(name.toLowerCase()) ?? [];
  }

  getDocumentOutline(fileIndex: number): DocumentOutlineEntry[] {
    return this._outlineByFile.get(fileIndex) ?? [];
  }

  getFilePath(fileIndex: number): string | undefined {
    return this._fileIndexToPath.get(fileIndex);
  }

  getFileIndex(filePath: string): number | undefined {
    return this._filePathToIndex.get(filePath);
  }

  getLineAddress(fileIndex: number, lineNumber: number): LineAddressInfo | undefined {
    return this._lineInfoMap.get(`${fileIndex}:${lineNumber}`);
  }

  findFileByRelativePath(relativePath: string): string | undefined {
    // Normalise to forward slashes so Windows paths work too
    const rel = relativePath.replace(/\\/g, "/");
    const suffix = rel.startsWith("/") ? rel : "/" + rel;
    for (const [absPath] of this._filePathToIndex) {
      const normalised = absPath.replace(/\\/g, "/");
      if (normalised.endsWith(suffix) || normalised === rel) {
        return absPath;
      }
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createLanguageIntelService(store?: Store<AppState>): ILanguageIntelService {
  return new LanguageIntelService(store);
}

// ---------------------------------------------------------------------------
// Module-level singleton (no store — updated manually via .update())
// ---------------------------------------------------------------------------

/**
 * Shared singleton used by `initializeMonaco()` (which has no React context)
 * and by `MonacoEditor` (which calls `.update()` whenever new intel arrives).
 */
export const languageIntelSingleton: ILanguageIntelService = new LanguageIntelService();
