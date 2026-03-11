/**
 * Z80 Assembly language-intelligence providers for Monaco editor.
 *
 * Architecture
 * ────────────
 * Provider *logic* is in plain `compute*()` functions that work on pure data
 * and can be unit-tested in Node/Vitest without the Monaco runtime.
 *
 * The `registerZ80Providers()` function is a thin Monaco adapter that wraps
 * the logic into real Monaco provider objects.  It is only called from the
 * browser-side `initializeMonaco()`.
 */

import type { ILanguageIntelService } from "./LanguageIntelService";
import {
  Z80_COMPLETION_ITEMS,
  Z80_INSTRUCTION_ITEMS,
  Z80_REGISTER_ITEMS,
  type StaticCompletionItem
} from "./z80-completion-data";
import type { DocumentOutlineEntry, SymbolDefinitionInfo } from "@abstractions/CompilerInfo";

// ---------------------------------------------------------------------------
// Numeric constants that mirror Monaco enum values (no runtime Monaco dep)
// ---------------------------------------------------------------------------

/** Monaco CompletionItemKind values we use */
export const CIK = {
  Keyword:  17,
  Snippet:  27,
  Variable:  4,
  Function:  1,
  Struct:    6,
  Module:    8,
  Constant: 14
} as const;

/** Monaco SymbolKind values we use */
export const SK = {
  Module:    1,
  Function: 11,
  Variable: 12,
  Constant: 13,
  Struct:   22
} as const;

// ---------------------------------------------------------------------------
// Plain result types   (independent of Monaco runtime types)
// ---------------------------------------------------------------------------

export type CompletionResult = {
  label: string;
  /** CompletionItemKind numeric value */
  kind: number;
  detail: string;
  insertText: string;
  isSnippet: boolean;
};

export type HoverResult = {
  /** Markdown-formatted content lines */
  contents: string[];
};

export type DefinitionResult = {
  filePath: string;
  line: number;
  startColumn: number;
  endColumn: number;
};

export type ReferenceResult = {
  filePath: string;
  line: number;
  startColumn: number;
  endColumn: number;
};

export type DocumentSymbolResult = {
  name: string;
  /** SymbolKind numeric value */
  kind: number;
  line: number;
  endLine: number;
  children: DocumentSymbolResult[];
};

export type RenameEdit = {
  filePath: string;
  line: number;
  startColumn: number;
  endColumn: number;
  newText: string;
};

export type FoldingRangeResult = {
  line: number;
  endLine: number;
  kind?: "region" | "comment" | "imports" | "folds";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function staticItemToCompletion(item: StaticCompletionItem): CompletionResult {
  let kind: number;
  switch (item.kind) {
    case "instruction": kind = CIK.Keyword; break;
    case "register":    kind = CIK.Variable; break;
    case "pragma":      kind = CIK.Keyword; break;
    case "keyword":     kind = CIK.Keyword; break;
    case "directive":   kind = CIK.Snippet; break;
  }
  const insertText = item.insertText ?? item.label;
  const isSnippet = insertText !== item.label;
  return { label: item.label, kind, detail: item.detail, insertText, isSnippet };
}

function symToCompletion(sym: SymbolDefinitionInfo): CompletionResult {
  let kind: number;
  switch (sym.kind) {
    case "var":    kind = CIK.Variable;  break;
    case "macro":  kind = CIK.Function;  break;
    case "struct": kind = CIK.Struct;    break;
    case "module": kind = CIK.Module;    break;
    case "equ":    kind = CIK.Constant;  break;
    default:       kind = CIK.Function;  break;  // label, proc
  }
  const detail = sym.description ?? sym.kind;
  return {
    label: sym.name,
    kind,
    detail,
    insertText: sym.name,
    isSnippet: false
  };
}

function outlineEntryToSymbol(entry: DocumentOutlineEntry): DocumentSymbolResult {
  let kind: number;
  switch (entry.kind) {
    case "module": kind = SK.Module;    break;
    case "struct": kind = SK.Struct;    break;
    case "var":    kind = SK.Variable;  break;
    case "equ":    kind = SK.Constant;  break;
    default:       kind = SK.Function;  break;  // label, macro, proc
  }
  return {
    name: entry.name,
    kind,
    line: entry.line,
    endLine: entry.endLine,
    children: (entry.children ?? []).map(outlineEntryToSymbol)
  };
}

// ---------------------------------------------------------------------------
// Step 4.1 — Completion
// ---------------------------------------------------------------------------

const INSTRUCTION_LABELS = new Set(Z80_INSTRUCTION_ITEMS.map((i) => i.label));
const REGISTER_LABELS     = new Set(Z80_REGISTER_ITEMS.map((r) => r.label));

/**
 * Compute completion items for the given word prefix and optional trigger character.
 *
 * @param word         The word (prefix) at the cursor.  Empty string for all.
 * @param triggerChar  The character that triggered the completion ('.' '#' or undefined).
 * @param service      Language intelligence service instance.
 */
export function computeCompletionItems(
  word: string,
  triggerChar: string | undefined,
  service: ILanguageIntelService
): CompletionResult[] {
  const lc = word.toLowerCase();
  const results: CompletionResult[] = [];

  // --- Static items (filtered by trigger character and prefix)
  let staticPool: readonly StaticCompletionItem[];
  if (triggerChar === ".") {
    staticPool = Z80_COMPLETION_ITEMS.filter(
      (i) => i.kind === "pragma" || i.kind === "keyword"
    );
  } else if (triggerChar === "#") {
    staticPool = Z80_COMPLETION_ITEMS.filter((i) => i.kind === "directive");
  } else {
    staticPool = Z80_COMPLETION_ITEMS;
  }

  for (const item of staticPool) {
    if (item.label.toLowerCase().startsWith(lc)) {
      results.push(staticItemToCompletion(item));
    }
  }

  // --- Dynamic symbols from compiled output
  for (const sym of service.getCompletionCandidates(word)) {
    results.push(symToCompletion(sym));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step 4.2 — Hover
// ---------------------------------------------------------------------------

/**
 * Compute hover information for the word at the cursor.
 *
 * Returns null when no useful information is available (e.g. whitespace).
 */
export function computeHover(
  word: string,
  service: ILanguageIntelService,
  /** 1-based editor line number of the cursor. When provided, macro body is only
   * shown when the cursor is NOT on the definition line (i.e. it's an invocation). */
  lineNumber?: number,
  /** Optional project folder path to display relative paths in the hover panel. */
  projectFolder?: string
): HoverResult | null {
  if (!word) return null;
  const lc = word.toLowerCase();

  // --- Known instruction mnemonic?
  if (INSTRUCTION_LABELS.has(lc)) {
    const item = Z80_INSTRUCTION_ITEMS.find((i) => i.label === lc)!;
    return {
      contents: [
        `**${lc}** *(Z80 instruction${item.next ? " — ZX Spectrum Next" : ""})*`,
        item.detail
      ]
    };
  }

  // --- Known register?
  if (REGISTER_LABELS.has(lc)) {
    const item = Z80_REGISTER_ITEMS.find((r) => r.label === lc)!;
    return {
      contents: [`**${lc}** *(register)*`, item.detail]
    };
  }

  // --- Compiled symbol?
  const sym = service.getSymbolDefinition(word);
  if (sym) {
    const absPath = service.getFilePath(sym.fileIndex) ?? `file ${sym.fileIndex}`;
    let displayPath = absPath;
    if (projectFolder) {
      const sep = projectFolder.endsWith("/") ? "" : "/";
      const prefix = projectFolder + sep;
      if (absPath.startsWith(prefix)) {
        displayPath = absPath.slice(prefix.length);
      }
    }
    const lines: string[] = [
      `**${sym.name}** *(${sym.kind})*`
    ];
    if (sym.description) lines.push(sym.description);
    if (sym.kind === "macro" && sym.bodyLines && sym.bodyLines.length > 0) {
      const isDefinitionLine = lineNumber !== undefined && lineNumber === sym.line;
      if (!isDefinitionLine) {
        const bodyText = sym.bodyLines
          .map(l => l.trimEnd())
          .filter(l => l.trim().length > 0)
          .join("\n");
        if (bodyText) {
          lines.push("```\n" + bodyText + "\n```");
        }
      }
    }
    lines.push(`Defined in \`${displayPath}\` line ${sym.line}`);
    return { contents: lines };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step 4.3 — Definition (Go-to-Definition)
// ---------------------------------------------------------------------------

/**
 * Compute the definition location for the word at the cursor.
 * Returns null for unknowns, registers and instruction mnemonics.
 */
export function computeDefinition(
  word: string,
  service: ILanguageIntelService
): DefinitionResult | null {
  if (!word) return null;
  // Registers and instructions have no source definition
  const lc = word.toLowerCase();
  if (INSTRUCTION_LABELS.has(lc) || REGISTER_LABELS.has(lc)) return null;

  const sym = service.getSymbolDefinition(word);
  if (!sym) return null;

  const filePath = service.getFilePath(sym.fileIndex);
  if (!filePath) return null;

  return {
    filePath,
    line: sym.line,
    startColumn: sym.startColumn,
    endColumn: sym.endColumn
  };
}

// ---------------------------------------------------------------------------
// Step 4.4 — References (Find All References)
// ---------------------------------------------------------------------------

/**
 * Compute all reference locations for the word at the cursor.
 *
 * @param word               The symbol name (case-insensitive).
 * @param includeDeclaration Include the definition site as the first result.
 * @param service            Language intelligence service instance.
 */
export function computeReferences(
  word: string,
  includeDeclaration: boolean,
  service: ILanguageIntelService
): ReferenceResult[] {
  if (!word) return [];

  const results: ReferenceResult[] = [];

  if (includeDeclaration) {
    const sym = service.getSymbolDefinition(word);
    if (sym) {
      const filePath = service.getFilePath(sym.fileIndex);
      if (filePath) {
        results.push({
          filePath,
          line: sym.line,
          startColumn: sym.startColumn,
          endColumn: sym.endColumn
        });
      }
    }
  }

  for (const ref of service.getSymbolReferences(word)) {
    const filePath = service.getFilePath(ref.fileIndex);
    if (filePath) {
      results.push({
        filePath,
        line: ref.line,
        startColumn: ref.startColumn,
        endColumn: ref.endColumn
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step 4.5 — Document Symbols (Outline / Breadcrumbs)
// ---------------------------------------------------------------------------

/**
 * Compute the document symbol hierarchy for the given file.
 */
export function computeDocumentSymbols(
  fileIndex: number,
  service: ILanguageIntelService
): DocumentSymbolResult[] {
  return service.getDocumentOutline(fileIndex).map(outlineEntryToSymbol);
}

// ---------------------------------------------------------------------------
// Step 4.5a — Code Folding for Blocks
// ---------------------------------------------------------------------------

const BLOCK_OPENERS = new Set([
  ".macro", ".loop", ".repeat", ".while", ".for",
  ".proc", ".struct", ".if", ".module",
  "#if", "#ifdef", "#ifndef"
]);

const CLOSER_TO_OPENERS = new Map<string, string[]>([
  [".endm",      [".macro"]],
  [".endl",      [".loop"]],
  [".until",     [".repeat"]],
  [".endw",      [".while"]],
  [".next",      [".for"]],
  [".endp",      [".proc"]],
  [".ends",      [".struct"]],
  [".endif",     [".if"]],
  [".endmodule", [".module"]],
  [".endmod",    [".module"]],
  ["#endif",     ["#if", "#ifdef", "#ifndef"]]
]);

/** Extract the block-relevant keyword from a source line, or null if none. */
function extractBlockKeyword(line: string): string | null {
  const trimmed = line.trimStart();
  if (!trimmed || trimmed.startsWith(";")) return null;
  // Match optional label (with or without trailing colon), then .keyword or #keyword
  const m = trimmed.match(/^(?:[A-Za-z_$@][A-Za-z0-9_$@]*:?\s+)?(\.[A-Za-z]+|#[A-Za-z]+)\b/);
  if (!m) return null;
  return m[1].toLowerCase();
}

/**
 * Compute folding ranges via text-based block matching.
 * Handles all 10 block construct pairs by scanning source lines directly —
 * works immediately on file open with no compilation required.
 *
 * @param lines Array of source lines (lines[0] = line 1 in the editor).
 */
export function computeFoldingRanges(lines: string[]): FoldingRangeResult[] {
  const ranges: FoldingRangeResult[] = [];
  const stack: Array<{ opener: string; lineNumber: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1; // Monaco lines are 1-indexed
    const kw = extractBlockKeyword(lines[i]);
    if (!kw) continue;

    if (BLOCK_OPENERS.has(kw)) {
      stack.push({ opener: kw, lineNumber });
    } else if (CLOSER_TO_OPENERS.has(kw)) {
      const validOpeners = CLOSER_TO_OPENERS.get(kw)!;
      // Find the most recent matching opener (handle proper nesting)
      for (let j = stack.length - 1; j >= 0; j--) {
        if (validOpeners.includes(stack[j].opener)) {
          const { lineNumber: startLine } = stack[j];
          stack.splice(j, 1);
          if (lineNumber > startLine) {
            ranges.push({ line: startLine, endLine: lineNumber });
          }
          break;
        }
      }
    }
  }

  return ranges;
}

// ---------------------------------------------------------------------------
// Step 4.6 — Rename Symbol
// ---------------------------------------------------------------------------

/**
 * Validate whether the word at the cursor can be renamed.
 * Returns the symbol name and range if renamable, or null if not.
 */
export function computeRenameValidation(
  word: string,
  service: ILanguageIntelService
): { text: string; startColumn: number; endColumn: number } | null {
  if (!word) return null;
  const lc = word.toLowerCase();
  if (INSTRUCTION_LABELS.has(lc) || REGISTER_LABELS.has(lc)) return null;

  const sym = service.getSymbolDefinition(word);
  if (!sym) return null;

  return {
    text: sym.name,
    startColumn: sym.startColumn,
    endColumn: sym.endColumn
  };
}

/**
 * Compute all text edits needed to rename a symbol.
 * Includes the definition site and all reference sites.
 */
export function computeRenameEdits(
  oldName: string,
  newName: string,
  service: ILanguageIntelService
): RenameEdit[] {
  if (!oldName || !newName) return [];
  const lc = oldName.toLowerCase();
  if (INSTRUCTION_LABELS.has(lc) || REGISTER_LABELS.has(lc)) return [];

  const edits: RenameEdit[] = [];

  // --- Definition site
  const sym = service.getSymbolDefinition(oldName);
  if (sym) {
    const filePath = service.getFilePath(sym.fileIndex);
    if (filePath) {
      edits.push({
        filePath,
        line: sym.line,
        startColumn: sym.startColumn,
        endColumn: sym.endColumn,
        newText: newName
      });
    }
  }

  // --- All reference sites
  for (const ref of service.getSymbolReferences(oldName)) {
    const filePath = service.getFilePath(ref.fileIndex);
    if (filePath) {
      edits.push({
        filePath,
        line: ref.line,
        startColumn: ref.startColumn,
        endColumn: ref.endColumn,
        newText: newName
      });
    }
  }

  return edits;
}

// ---------------------------------------------------------------------------
// Monaco registration  (only call from a browser context with Monaco loaded)
// ---------------------------------------------------------------------------

/**
 * Registers all Z80 language-intelligence providers with Monaco.
 *
 * @param monaco          The Monaco API object (from `loader.init()` or `window.monaco`).
 * @param getService      Returns the current `ILanguageIntelService` instance.
 * @param getFileIndex    Given a Monaco model URI string, returns the source file index
 *                        (0 for the current single file, or derived from the URI when
 *                        multi-file support is implemented).
 * @param applyExternalEdits  Optional callback to apply rename edits to files other than
 *                            the currently active model. Receives an array of RenameEdit
 *                            objects for cross-file changes.
 * @param getProjectFolder    Optional callback returning the current project root folder
 *                            path, used to display workspace-relative paths in hover panels.
 */
export function registerZ80Providers(
  monaco: any,
  getService: () => ILanguageIntelService,
  getFileIndex: (modelUri: string) => number = () => 0,
  applyExternalEdits?: (edits: RenameEdit[]) => void,
  getProjectFolder?: () => string | undefined
): void {
  const LANG = "kz80-asm";

  // --- Completion
  monaco.languages.registerCompletionItemProvider(LANG, {
    triggerCharacters: [".", "#"],
    provideCompletionItems(model: any, position: any, context: any) {
      const word = model.getWordAtPosition(position);
      const prefix = word ? word.word : "";
      const items = computeCompletionItems(prefix, context.triggerCharacter, getService());
      return {
        suggestions: items.map((item) => ({
          label: item.label,
          kind: item.kind,
          detail: item.detail,
          insertText: item.insertText,
          insertTextRules: item.isSnippet ? 4 /* InsertAsSnippet */ : 0,
          range: word
            ? {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
              }
            : undefined
        }))
      };
    }
  });

  // --- Hover
  monaco.languages.registerHoverProvider(LANG, {
    provideHover(model: any, position: any) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const result = computeHover(word.word, getService(), position.lineNumber, getProjectFolder?.());
      if (!result) return null;
      return {
        contents: result.contents.map((value) => ({ value }))
      };
    }
  });

  // --- Definition
  monaco.languages.registerDefinitionProvider(LANG, {
    provideDefinition(model: any, position: any) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const result = computeDefinition(word.word, getService());
      if (!result) return null;
      return {
        uri: monaco.Uri.file(result.filePath),
        range: {
          startLineNumber: result.line,
          endLineNumber: result.line,
          startColumn: result.startColumn + 1,
          endColumn: result.endColumn + 1
        }
      };
    }
  });

  // --- References
  monaco.languages.registerReferenceProvider(LANG, {
    provideReferences(model: any, position: any, ctx: any) {
      const word = model.getWordAtPosition(position);
      if (!word) return [];
      const results = computeReferences(
        word.word,
        ctx.includeDeclaration ?? false,
        getService()
      );
      return results.map((r) => ({
        uri: monaco.Uri.file(r.filePath),
        range: {
          startLineNumber: r.line,
          endLineNumber: r.line,
          startColumn: r.startColumn + 1,
          endColumn: r.endColumn + 1
        }
      }));
    }
  });

  // --- Rename
  monaco.languages.registerRenameProvider(LANG, {
    provideRenameEdits(model: any, position: any, newName: string) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const svc = getService();
      const allEdits = computeRenameEdits(word.word, newName, svc);
      if (allEdits.length === 0) return null;

      // Determine the current file's path so we can use model.uri for it
      const currentFileIndex = getFileIndex(model.uri.toString());
      const currentFilePath = svc.getFilePath(currentFileIndex);

      // Split edits: current file → Monaco workspace edits; other files → external callback
      const monacoEdits: any[] = [];
      const externalEdits: RenameEdit[] = [];

      for (const e of allEdits) {
        if (e.filePath === currentFilePath) {
          monacoEdits.push({
            resource: model.uri,
            textEdit: {
              range: {
                startLineNumber: e.line,
                endLineNumber: e.line,
                startColumn: e.startColumn + 1,
                endColumn: e.endColumn + 1
              },
              text: e.newText
            },
            versionId: undefined
          });
        } else {
          externalEdits.push(e);
        }
      }

      // Apply cross-file edits via the external callback
      if (externalEdits.length > 0 && applyExternalEdits) {
        applyExternalEdits(externalEdits);
      }

      return { edits: monacoEdits };
    },

    resolveRenameLocation(model: any, position: any) {
      const word = model.getWordAtPosition(position);
      if (!word) return { rejectReason: "No symbol found at cursor" };
      const result = computeRenameValidation(word.word, getService());
      if (!result) {
        return { rejectReason: `'${word.word}' cannot be renamed` };
      }
      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        },
        text: word.word
      };
    }
  });

  // --- Document Symbols
  monaco.languages.registerDocumentSymbolProvider(LANG, {
    provideDocumentSymbols(model: any) {
      const fi = getFileIndex(model.uri.toString());
      const symbols = computeDocumentSymbols(fi, getService());

      function toMonaco(sym: DocumentSymbolResult): any {
        return {
          name: sym.name,
          kind: sym.kind,
          range: {
            startLineNumber: sym.line,
            endLineNumber: sym.endLine,
            startColumn: 1,
            endColumn: 1
          },
          selectionRange: {
            startLineNumber: sym.line,
            endLineNumber: sym.line,
            startColumn: 1,
            endColumn: 1
          },
          children: sym.children.map(toMonaco)
        };
      }

      return symbols.map(toMonaco);
    }
  });

  // --- Code Folding
  monaco.languages.registerFoldingRangeProvider(LANG, {
    provideFoldingRanges(model: any) {
      const lineCount = model.getLineCount();
      const lines: string[] = [];
      for (let i = 1; i <= lineCount; i++) {
        lines.push(model.getLineContent(i));
      }
      return computeFoldingRanges(lines).map((range) => ({
        start: range.line,
        end: range.endLine
      }));
    }
  });
}
