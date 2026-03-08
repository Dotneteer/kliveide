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
  service: ILanguageIntelService
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
    const filePath = service.getFilePath(sym.fileIndex) ?? `file ${sym.fileIndex}`;
    const lines: string[] = [
      `**${sym.name}** *(${sym.kind})*`
    ];
    if (sym.description) lines.push(sym.description);
    lines.push(`Defined in \`${filePath}\` line ${sym.line}`);
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
 */
export function registerZ80Providers(
  monaco: any,
  getService: () => ILanguageIntelService,
  getFileIndex: (modelUri: string) => number = () => 0
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
      const result = computeHover(word.word, getService());
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
}
