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
// Semantic-token change notification
// ---------------------------------------------------------------------------
let _fireSemanticChange: (() => void) | undefined;

/**
 * Fires the semantic-token onDidChange event so Monaco immediately
 * re-requests tokens (e.g. after a background compile or tab switch).
 */
export function notifySemanticTokensChanged(): void {
  _fireSemanticChange?.();
}

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
// Step 4.7 — ZX Spectrum Color Decorators
// ---------------------------------------------------------------------------

/** ZX Spectrum non-bright color palette [r, g, b] 0-255. */
const ZX_COLORS: readonly [number, number, number][] = [
  [0,   0,   0  ],  // 0 Black
  [0,   0,   204],  // 1 Blue
  [204, 0,   0  ],  // 2 Red
  [204, 0,   204],  // 3 Magenta
  [0,   204, 0  ],  // 4 Green
  [0,   204, 204],  // 5 Cyan
  [204, 204, 0  ],  // 6 Yellow
  [204, 204, 204],  // 7 White
];

/** ZX Spectrum bright color palette [r, g, b] 0-255. */
const ZX_BRIGHT_COLORS: readonly [number, number, number][] = [
  [0,   0,   0  ],  // 0 Black (unchanged)
  [0,   0,   255],  // 1 Blue
  [255, 0,   0  ],  // 2 Red
  [255, 0,   255],  // 3 Magenta
  [0,   255, 0  ],  // 4 Green
  [0,   255, 255],  // 5 Cyan
  [255, 255, 0  ],  // 6 Yellow
  [255, 255, 255],  // 7 White
];

function zxRgb(index: number, bright: number): [number, number, number] {
  const i = index >= 0 && index <= 7 ? index : 0;
  return bright ? ZX_BRIGHT_COLORS[i] : ZX_COLORS[i];
}

/** Returns the ZX Spectrum palette index (0-7) closest to the given RGB. */
export function nearestZxIndex(r: number, g: number, b: number): number {
  let minDist = Infinity;
  let bestIndex = 0;
  // Check both normal and bright palettes — index is the same in both
  for (const palette of [ZX_COLORS, ZX_BRIGHT_COLORS]) {
    for (let i = 0; i < 8; i++) {
      const [pr, pg, pb] = palette[i];
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < minDist) { minDist = d; bestIndex = i; }
    }
  }
  return bestIndex;
}

/** A single color swatch to show inline next to a ZX color argument. */
export type ColorDecoration = {
  /** 1-based line number. */
  line: number;
  /** 1-based start column (inclusive). */
  startColumn: number;
  /** 1-based end column (exclusive). */
  endColumn: number;
  /** Red component 0-255. */
  r: number;
  /** Green component 0-255. */
  g: number;
  /** Blue component 0-255. */
  b: number;
};

// Regex for attr(ink, paper[, bright[, flash]]) — no whitespace inside captures
const ATTR_RE = /\battr\s*\(\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?\s*\)/gi;
// Regex for ink(color) and paper(color)
const INK_RE   = /\bink\s*\(\s*(\d+)\s*\)/gi;
const PAPER_RE = /\bpaper\s*\(\s*(\d+)\s*\)/gi;

/**
 * Appends a ColorDecoration for `token` found inside `fullMatch` at or after
 * `searchFrom` (offset within fullMatch).  Returns the next searchFrom offset.
 */
function pushTokenColor(
  result: ColorDecoration[],
  line: number,
  matchIndex: number,
  fullMatch: string,
  token: string,
  searchFrom: number,
  rgb: [number, number, number]
): number {
  const off = fullMatch.indexOf(token, searchFrom);
  if (off < 0) return searchFrom;
  const col0 = matchIndex + off; // 0-based in the line
  result.push({ line, startColumn: col0 + 1, endColumn: col0 + token.length + 1, r: rgb[0], g: rgb[1], b: rgb[2] });
  return off + token.length;
}

/**
 * Scans assembly source lines for ZX Spectrum color expressions:
 *   attr(ink, paper[, bright[, flash]])
 *   ink(color)
 *   paper(color)
 * Returns one ColorDecoration per color argument (two for attr).
 * Part of line before the first `;` comment marker is searched.
 *
 * @param lines 0-indexed array of source strings (each string = one line).
 */
export function computeColorDecorations(lines: string[]): ColorDecoration[] {
  const result: ColorDecoration[] = [];

  for (let li = 0; li < lines.length; li++) {
    const lineNum = li + 1;
    // Strip comment tail (rough — doesn't handle ';' inside strings)
    const raw = lines[li];
    const semi = raw.indexOf(";");
    const lineText = semi >= 0 ? raw.slice(0, semi) : raw;

    // attr(ink, paper[, bright[, flash]])
    ATTR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ATTR_RE.exec(lineText)) !== null) {
      const inkVal   = parseInt(m[1]);
      const paperVal = parseInt(m[2]);
      const bright   = m[3] !== undefined ? Math.min(1, parseInt(m[3])) : 0;
      if (inkVal < 0 || inkVal > 7 || paperVal < 0 || paperVal > 7) continue;

      let pos = 0;
      pos = pushTokenColor(result, lineNum, m.index, m[0], m[1], pos, zxRgb(inkVal, bright));
      pushTokenColor(result, lineNum, m.index, m[0], m[2], pos, zxRgb(paperVal, bright));
    }

    // ink(color)
    INK_RE.lastIndex = 0;
    while ((m = INK_RE.exec(lineText)) !== null) {
      const val = parseInt(m[1]);
      if (val < 0 || val > 7) continue;
      pushTokenColor(result, lineNum, m.index, m[0], m[1], 0, zxRgb(val, 0));
    }

    // paper(color)
    PAPER_RE.lastIndex = 0;
    while ((m = PAPER_RE.exec(lineText)) !== null) {
      const val = parseInt(m[1]);
      if (val < 0 || val > 7) continue;
      pushTokenColor(result, lineNum, m.index, m[0], m[1], 0, zxRgb(val, 0));
    }
  }

  return result;
}

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
// Step 4.3a — Go-to-Definition for #include directives
// ---------------------------------------------------------------------------

/** Regex matching `#include "path"` or `#include 'path'` (case-insensitive). */
const INCLUDE_RE = /#include\s+["']([^"']+)["']/i;

/**
 * If `lineContent` is an `#include` directive and `column` (1-based Monaco
 * column) falls within the quoted filename, return the absolute path of the
 * included file as known by the language service. Returns null otherwise.
 */
export function computeIncludeDefinition(
  lineContent: string,
  column: number,
  service: ILanguageIntelService
): string | null {
  const m = INCLUDE_RE.exec(lineContent);
  if (!m) return null;

  const filename = m[1];
  // m.index = start of the full match; the filename starts after '#include "'
  const filenameStart = m.index + m[0].indexOf(filename) + 1; // 1-based
  const filenameEnd = filenameStart + filename.length;         // 1-based, inclusive

  if (column < filenameStart || column > filenameEnd) return null;

  return service.findFileByRelativePath(filename) ?? null;
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
// ---------------------------------------------------------------------------
// Step 4.8 — Block Bracket Matching
// ---------------------------------------------------------------------------

/** A pair of 1-based line numbers where a block opens and closes. */
export type BlockMatchResult = {
  /** 1-based line number of the opening keyword. */
  openLine: number;
  /** Column within that line where the keyword starts (1-based, inclusive). */
  openStartColumn: number;
  /** Column where the opening keyword ends (1-based, exclusive). */
  openEndColumn: number;
  /** 1-based line number of the closing keyword. */
  closeLine: number;
  /** Column within that line where the closing keyword starts (1-based). */
  closeStartColumn: number;
  /** Column where the closing keyword ends (1-based, exclusive). */
  closeEndColumn: number;
};

/**
 * Returns the column range (1-based, inclusive start, exclusive end) of the
 * block keyword on `line`, or null if the line has no block keyword.
 * Strips any leading label so the range covers only the keyword token.
 */
function keywordRange(line: string): { kw: string; start: number; end: number } | null {
  const kw = extractBlockKeyword(line);
  if (!kw) return null;
  const trimmed = line.trimStart();
  const leadingSpaces = line.length - trimmed.length;
  // Case-insensitive search so ".MACRO" matches the lowercased kw ".macro"
  const kwOffInTrimmed = trimmed.toLowerCase().indexOf(kw);
  if (kwOffInTrimmed < 0) return null;
  const start = leadingSpaces + kwOffInTrimmed + 1; // 1-based inclusive
  return { kw, start, end: start + kw.length };    // end: 1-based exclusive
}

/**
 * Given the 1-based `lineNumber` that the cursor is on, finds the matching
 * block opener/closer pair.  Returns null if the cursor is not on a block
 * keyword or if no matching partner is found.
 *
 * @param lines    Array of source lines (lines[0] = line 1 in the editor).
 * @param lineNumber 1-based line number where the cursor sits.
 */
export function computeBlockMatch(lines: string[], lineNumber: number): BlockMatchResult | null {
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) return null;

  const info = keywordRange(lines[idx]);
  if (!info) return null;
  const { kw } = info;

  if (BLOCK_OPENERS.has(kw)) {
    // --- Search forward for the matching closer
    let depth = 0;
    for (let i = idx; i < lines.length; i++) {
      const k2 = extractBlockKeyword(lines[i]);
      if (!k2) continue;
      if (k2 === kw) {
        depth++;
      } else if (CLOSER_TO_OPENERS.has(k2) && CLOSER_TO_OPENERS.get(k2)!.includes(kw)) {
        depth--;
        if (depth === 0) {
          const closeInfo = keywordRange(lines[i])!;
          return {
            openLine: lineNumber, openStartColumn: info.start, openEndColumn: info.end,
            closeLine: i + 1,  closeStartColumn: closeInfo.start, closeEndColumn: closeInfo.end
          };
        }
      }
    }
    return null;
  }

  if (CLOSER_TO_OPENERS.has(kw)) {
    const validOpeners = CLOSER_TO_OPENERS.get(kw)!;
    // --- Search backward for the matching opener
    let depth = 0;
    for (let i = idx; i >= 0; i--) {
      const k2 = extractBlockKeyword(lines[i]);
      if (!k2) continue;
      if (k2 === kw || (CLOSER_TO_OPENERS.has(k2) && CLOSER_TO_OPENERS.get(k2)!.some(o => validOpeners.includes(o)))) {
        depth++;
      } else if (validOpeners.includes(k2)) {
        depth--;
        if (depth === 0) {
          const openInfo = keywordRange(lines[i])!;
          return {
            openLine: i + 1, openStartColumn: openInfo.start, openEndColumn: openInfo.end,
            closeLine: lineNumber, closeStartColumn: info.start, closeEndColumn: info.end
          };
        }
      }
    }
    return null;
  }

  return null;
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
// Step 4.9 — Semantic Syntax Highlighting
// ---------------------------------------------------------------------------

/**
 * Monaco semantic token type names used in the SemanticTokensLegend.
 * Each index maps to a theme rule with the same bare token name.
 */
export const SEMANTIC_LEGEND_TYPES: readonly string[] = [
  "variable",    // 0 — labels and .var symbols
  "namespace",   // 1 — .module names
  "struct",      // 2 — .struct type names
  "equ",          // 3 — .equ constants
  "macro"        // 4 — .macro and .proc definitions
];

/** Maps a kz80-asm symbol kind to a SEMANTIC_LEGEND_TYPES index. */
const KIND_TO_SEMANTIC_TYPE: Partial<Record<string, number>> = {
  label:  0,
  var:    0,
  module: 1,
  struct: 2,
  equ:    3,
  macro:  4,
  proc:   4
};

/** Matches kz80-asm identifiers (may start with ./$/@ for local labels). */
const SEMANTIC_IDENT_RE = /[A-Za-z_$@.][A-Za-z0-9_$@.!?]*/g;

/**
 * Builds Monaco semantic token data for the given source lines.
 *
 * Returns a flat array of 5-integer tuples:
 *   [deltaLine, deltaStartChar, length, tokenTypeIndex, tokenModifierBitmask]
 * ready to be wrapped in a `Uint32Array` and returned from
 * `provideDocumentSemanticTokens`.
 *
 * Pure function — no Monaco dependency; suitable for unit-testing.
 *
 * @param lines   0-indexed source lines (one string per line).
 * @param service Compiled-symbol lookup service.
 */
export function computeSemanticTokenData(
  lines: string[],
  service: ILanguageIntelService
): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevCol  = 0;

  for (let li = 0; li < lines.length; li++) {
    const raw  = lines[li];
    // Strip comment tail (rough — doesn't handle ';' inside strings, but
    // symbol lookups for comment contents always return null anyway).
    const semi = raw.indexOf(";");
    const lineText = semi >= 0 ? raw.slice(0, semi) : raw;

    SEMANTIC_IDENT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SEMANTIC_IDENT_RE.exec(lineText)) !== null) {
      const word = m[0];
      const sym = service.getSymbolDefinition(word);
      if (!sym) continue;
      const typeIndex = KIND_TO_SEMANTIC_TYPE[sym.kind];
      if (typeIndex === undefined) continue;

      const deltaLine = li - prevLine;
      const deltaCol  = deltaLine === 0 ? m.index - prevCol : m.index;
      data.push(deltaLine, deltaCol, word.length, typeIndex, 0);
      prevLine = li;
      prevCol  = m.index;
    }
  }
  return data;
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
 * @param navigateToFile      Optional callback to open a file at a given 1-based line number.
 *                            Used by the include-file link provider for single-click navigation.
 */
export function registerZ80Providers(
  monaco: any,
  getService: () => ILanguageIntelService,
  getFileIndex: (modelUri: string) => number = () => 0,
  applyExternalEdits?: (edits: RenameEdit[]) => void,
  getProjectFolder?: () => string | undefined,
  navigateToFile?: (filePath: string, line: number) => void
): void {
  const LANG = "kz80-asm";
  const OPEN_INCLUDE_CMD = "klive.openIncludeFile";

  // Register a Monaco command so that the link provider can trigger navigation
  // via a command: URI (single-click, no modifier key required).
  try {
    monaco.editor.registerCommand(OPEN_INCLUDE_CMD, (_accessor: any, absolutePath: string) => {
      navigateToFile?.(absolutePath, 1);
    });
  } catch {
    // Already registered on a previous initializeMonaco call
  }

  // --- #include file links (single-click, full path highlighted)
  monaco.languages.registerLinkProvider(LANG, {
    provideLinks(model: any) {
      const lineCount = model.getLineCount();
      const links: any[] = [];
      for (let i = 1; i <= lineCount; i++) {
        const lineText = model.getLineContent(i);
        const m = INCLUDE_RE.exec(lineText);
        if (!m) continue;
        const filename = m[1];
        const absPath = getService().findFileByRelativePath(filename);
        if (!absPath) continue;
        const startCol = m.index + m[0].indexOf(filename) + 1; // 1-based, inclusive
        const endCol = startCol + filename.length;             // 1-based, exclusive
        links.push({
          range: { startLineNumber: i, endLineNumber: i, startColumn: startCol, endColumn: endCol },
          url: `command:${OPEN_INCLUDE_CMD}?${encodeURIComponent(JSON.stringify(absPath))}`,
          tooltip: "Go to included file"
        });
      }
      return { links };
    }
  });

  // --- ZX Spectrum color decorators (inline swatches for attr/ink/paper calls)
  monaco.languages.registerColorProvider(LANG, {
    provideDocumentColors(model: any) {
      const lineCount = model.getLineCount();
      const lines: string[] = [];
      for (let i = 1; i <= lineCount; i++) lines.push(model.getLineContent(i));
      return computeColorDecorations(lines).map((d) => ({
        color: { red: d.r / 255, green: d.g / 255, blue: d.b / 255, alpha: 1 },
        range: { startLineNumber: d.line, endLineNumber: d.line, startColumn: d.startColumn, endColumn: d.endColumn }
      }));
    },
    provideColorPresentations(_model: any, colorInfo: any) {
      // Map the picked color back to the nearest ZX Spectrum palette index.
      const c = colorInfo.color;
      const idx = nearestZxIndex(
        Math.round(c.red * 255),
        Math.round(c.green * 255),
        Math.round(c.blue * 255)
      );
      return [{ label: String(idx) }];
    }
  });

  monaco.languages.registerCompletionItemProvider(LANG, {
    triggerCharacters: [".", "#"],
    provideCompletionItems(model: any, position: any, context: any) {
      const word = model.getWordAtPosition(position);
      const prefix = word ? word.word : "";
      const items = computeCompletionItems(prefix, context.triggerCharacter, getService());
      // Always supply an explicit range so Monaco knows what text to replace.
      // When a word was found (wordPattern includes '.', '#') use its span;
      // when the trigger character was just typed and no word was matched yet,
      // the range covers just that one trigger character.
      const range = word
        ? {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          }
        : {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - (context.triggerCharacter ? 1 : 0),
            endColumn: position.column
          };
      return {
        suggestions: items.map((item) => ({
          label: item.label,
          kind: item.kind,
          detail: item.detail,
          insertText: item.insertText,
          insertTextRules: item.isSnippet ? 4 /* InsertAsSnippet */ : 0,
          range
        }))
      };
    }
  });

  // --- Hover
  monaco.languages.registerHoverProvider(LANG, {
    provideHover(model: any, position: any) {
      const word = model.getWordAtPosition(position);
      const svc = getService();

      // --- Symbol / instruction hover
      const result = word
        ? computeHover(word.word, svc, position.lineNumber, getProjectFolder?.())
        : null;

      // --- Numeric literal hover (hex/decimal/binary/octal conversions)
      const lineContent: string = model.getLineContent(position.lineNumber) ?? "";
      const numResult = result ? null : computeNumericHover(lineContent, position.column);

      // --- Address + byte info for the current line
      const modelPath: string = model.uri?.fsPath ?? model.uri?.path ?? "";
      const fileIndex = svc.getFileIndex(modelPath);
      const lineAddr =
        fileIndex !== undefined
          ? svc.getLineAddress(fileIndex, position.lineNumber)
          : undefined;

      if (!result && !numResult && !lineAddr) return null;

      const activeResult = result ?? numResult;
      const contents: { value: string }[] = activeResult
        ? activeResult.contents.map((value) => ({ value }))
        : [];

      if (lineAddr) {
        const addrHex = lineAddr.address.toString(16).toUpperCase().padStart(4, "0");
        const bytesHex = lineAddr.bytes
          .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
          .join(" ");
        contents.push({ value: `**$${addrHex}**  \`${bytesHex}\`` });
      }

      return { contents };
    }
  });

  // --- Definition
  monaco.languages.registerDefinitionProvider(LANG, {
    provideDefinition(model: any, position: any) {
      // --- Check for #include directive first
      const lineContent = model.getLineContent(position.lineNumber);
      const includePath = computeIncludeDefinition(lineContent, position.column, getService());
      if (includePath) {
        return {
          uri: monaco.Uri.file(includePath),
          range: { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1 }
        };
      }

      // --- Symbol definition
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

  // --- Block bracket matching (highlight opener ↔ closer)
  monaco.languages.registerDocumentHighlightProvider(LANG, {
    provideDocumentHighlights(model: any, position: any) {
      const lineCount = model.getLineCount();
      const lines: string[] = [];
      for (let i = 1; i <= lineCount; i++) lines.push(model.getLineContent(i));
      const match = computeBlockMatch(lines, position.lineNumber);
      if (!match) return [];
      // Monaco DocumentHighlightKind: 2 = Read (shown in a distinct colour)
      return [
        { range: { startLineNumber: match.openLine,  endLineNumber: match.openLine,  startColumn: match.openStartColumn,  endColumn: match.openEndColumn  }, kind: 2 },
        { range: { startLineNumber: match.closeLine, endLineNumber: match.closeLine, startColumn: match.closeStartColumn, endColumn: match.closeEndColumn }, kind: 2 }
      ];
    }
  });

  // --- Semantic syntax highlighting (compiler-resolved symbol kinds → colours)
  const semanticEmitter = new monaco.Emitter();
  _fireSemanticChange = () => semanticEmitter.fire(undefined);

  monaco.languages.registerDocumentSemanticTokensProvider(LANG, {
    onDidChange: semanticEmitter.event,
    getLegend() {
      return { tokenTypes: SEMANTIC_LEGEND_TYPES.slice(), tokenModifiers: [] };
    },
    provideDocumentSemanticTokens(model: any) {
      const lineCount = model.getLineCount();
      const lines: string[] = [];
      for (let i = 1; i <= lineCount; i++) lines.push(model.getLineContent(i));
      const data = computeSemanticTokenData(lines, getService());
      return { data: new Uint32Array(data), resultId: undefined };
    },
    releaseDocumentSemanticTokens(_resultId: string | undefined) {}
  });

}


// ---------------------------------------------------------------------------
// Step 4.10 — Numeric Literal Hover (Hex/Decimal/Binary Conversions)
// ---------------------------------------------------------------------------

/**
 * Combined regex that matches kz80-asm numeric literals in order of
 * specificity.  Capture groups:
 *   1  $hex        $FF / $4000
 *   2  0xhex       0xFF / 0x4000
 *   3  #hex        #FF / #4000   (max 4 digits)
 *   4  hexH        0FFh / 4000H
 *   5  %binary     %01010101 / %1111_0000
 *   6  octal       377o / 377q
 *   7  decimal     255 / 65535
 */
const NUM_RE =
  /\$([0-9A-Fa-f]+)|0[xX]([0-9A-Fa-f]+)|#([0-9A-Fa-f]{1,4})\b|([0-9][0-9A-Fa-f]*)[hH]\b|%([01_]+)|([0-7]+)[oOqQ]\b|([0-9]+)/g;

/** Format a value ≤ 255 as a padded binary string, e.g. `%11111111`. */
function toBin8(v: number): string {
  return "%" + v.toString(2).padStart(8, "0");
}

/** Format a value as `$XXXX` (uppercase hex). */
function toHex(v: number): string {
  return "$" + v.toString(16).toUpperCase();
}

/**
 * If the cursor at `column` (1-based Monaco column) is positioned within a
 * numeric literal on `lineText`, returns a hover showing the value in all
 * useful alternate bases.  Returns `null` if the cursor is not on a number
 * or the conversion is trivial (value ≤ 9).
 *
 * Numbers that appear after the first `;` (comment) on the line are ignored.
 *
 * Pure function — no Monaco dependency.
 */
export function computeNumericHover(
  lineText: string,
  column: number
): HoverResult | null {
  // Strip comment tail
  const semi = lineText.indexOf(";");
  const code = semi >= 0 ? lineText.slice(0, semi) : lineText;

  // 1-based column → 0-based index
  const col0 = column - 1;
  if (col0 > code.length) return null;

  NUM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = NUM_RE.exec(code)) !== null) {
    const start = m.index;
    const end   = m.index + m[0].length;
    if (col0 < start || col0 >= end) continue;

    // --- Cursor is within this token — determine value and source format
    let value: number;
    let sourceFormat: "hex" | "binary" | "octal" | "decimal";

    if (m[1] !== undefined) {
      value = parseInt(m[1], 16);          sourceFormat = "hex";
    } else if (m[2] !== undefined) {
      value = parseInt(m[2], 16);          sourceFormat = "hex";
    } else if (m[3] !== undefined) {
      value = parseInt(m[3], 16);          sourceFormat = "hex";
    } else if (m[4] !== undefined) {
      const digits = m[4];
      if (!/^[0-9A-Fa-f]+$/.test(digits)) continue;
      value = parseInt(digits, 16);        sourceFormat = "hex";
    } else if (m[5] !== undefined) {
      const bits = m[5].replace(/_/g, "");
      if (!bits) continue;
      value = parseInt(bits, 2);           sourceFormat = "binary";
    } else if (m[6] !== undefined) {
      value = parseInt(m[6], 8);           sourceFormat = "octal";
    } else if (m[7] !== undefined) {
      value = parseInt(m[7], 10);          sourceFormat = "decimal";
    } else {
      continue;
    }

    if (isNaN(value) || value === 0) continue;

    // --- Build the list of alternate representations to show
    const parts: string[] = [];

    if (sourceFormat !== "decimal") parts.push(`${value} decimal`);
    if (sourceFormat !== "hex")     parts.push(`${toHex(value)} hex`);
    // Binary: for non-binary 8-bit values also show binary representation.
    // For binary inputs ≤ 65535, show nibble-grouped form (useful for 16-bit).
    if (sourceFormat !== "binary" && value <= 0xFF) {
      parts.push(`${toBin8(value)} binary`);
    } else if (sourceFormat === "binary" && value > 0xFF && value <= 0xFFFF) {
      const binRaw = value.toString(2).padStart(16, "0");
      const nibbled = binRaw.replace(/(.{4})(?=.)/g, "$1_");
      parts.push(`%${nibbled} (grouped)`);
    }

    return { contents: [`**\`${m[0]}\`** = ${parts.join(" · ")}`] };
  }

  return null;
}
