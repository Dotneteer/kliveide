/**
 * Language intelligence for ZX BASIC (`.zxbas`) in Monaco (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md`
 * §4.6): hover, definition, references, highlights, completion, signature help, rename, outline,
 * folding and `#include` links.
 *
 * As on the assembler side (`z80-providers.ts`), the logic is in Monaco-free `compute*()` functions
 * over plain data, unit-tested in Node; `registerBasicProviders()` only adapts them to Monaco.
 *
 * Symbol features read the Klive BASIC snapshots (`BasicIntelService`); structure features (folding,
 * block keywords, the completion context) read the text, so they work while the file does not parse
 * (E7). With zxbc selected there are no snapshots: keyword help, keyword and library completion,
 * built-in signature help, folding and block highlights still work (E13).
 *
 * Positions are Monaco's: 1-based lines and columns, end columns exclusive.
 */
import type { BasicDefineInfo, BasicSymbolInfo } from "@abstractions/BasicIntel";
import {
  availableLibraryFiles,
  availableLibraryRoutines,
  DIRECTIVE_HELP,
  directiveHelp,
  HELP_ATTRIBUTION,
  KEYWORD_HELP,
  keywordHelp,
  libraryRoutineHelp,
  PRAGMA_HELP,
  pragmaHelp
} from "@common/kbasic/help";
import type { BasicHelpEntry, BasicLibraryRoutineHelp } from "@common/kbasic/help-types";
import { OPTIONS_BY_NAME, OPTION_SPECS } from "@main/kbasic/options/options";
import { EXTENSION_KEYWORDS, KEYWORDS, TYPE_KEYWORDS } from "@main/kbasic/syntax/keywords";
import { scanBasicCall, scanBasicContext, type BasicCompletionContext } from "./basic-context";
import { computeBasicBlockMatch, computeBasicFoldingRanges, type BasicFoldingRange } from "./basic-structure";
import { normalizeBasicPath, wordAt, type BasicIntelSnapshot, type BasicSymbolRef, type IBasicIntelService } from "./BasicIntelService";
import { CIK, computeNumericHover, SK, type RenameEdit } from "./z80-providers";

export { computeBasicFoldingRanges };
export type { BasicFoldingRange };

/** What every request knows: the model's path and text, the intel and the project folder. */
export type BasicRequest = {
  service: IBasicIntelService;
  path: string;
  lines: readonly string[];
  projectFolder?: string;
};

export type BasicHover = { contents: string[]; range?: { startColumn: number; endColumn: number } };

export type BasicLocationResult = { path: string; line: number; startColumn: number; endColumn: number };

export type BasicHighlight = { line: number; startColumn: number; endColumn: number; kind: number };

export type BasicCompletion = {
  label: string;
  kind: number;
  detail: string;
  documentation?: string;
  insertText: string;
  isSnippet: boolean;
  /** Text to insert elsewhere when the item is accepted (a missing `#include`, E9). */
  additionalTextEdits?: { line: number; column: number; text: string }[];
  sortText?: string;
};

export type BasicCompletionList = {
  /** The first column of the text the items replace (the typed prefix). */
  startColumn: number;
  items: BasicCompletion[];
};

export type BasicSignatureHelp = {
  label: string;
  documentation?: string;
  /** Each parameter's [start, end) offsets in `label`. */
  parameters: [number, number][];
  activeParameter: number;
};

export type BasicDocumentSymbol = {
  name: string;
  detail?: string;
  kind: number;
  line: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  children: BasicDocumentSymbol[];
};

export type BasicLink = { line: number; startColumn: number; endColumn: number; path: string };

/** Monaco SymbolKind values beyond the shared `SK` table. */
const SYMBOL_KIND = { Namespace: 2, Field: 7, Array: 17, Key: 19 } as const;
/** Monaco DocumentHighlightKind. */
const HIGHLIGHT = { Text: 0, Read: 1, Write: 2 } as const;

// =================================================================================================
// Shared helpers

/** Whether a position is BASIC code (not a string, comment or ASM line); directive lines count. */
function isCode(lines: readonly string[], line: number, column: number): boolean {
  const text = lines[line - 1] ?? "";
  if (/^\s*#/.test(text)) return true;
  return scanBasicContext(lines, line, column).kind !== "none";
}

function fence(lines: readonly string[]): string {
  return "```zxbas\n" + lines.join("\n") + "\n```";
}

function relativePath(path: string, projectFolder?: string): string {
  const p = path.replace(/\\/g, "/");
  const folder = projectFolder?.replace(/\\/g, "/").replace(/\/$/, "");
  return folder && p.startsWith(folder + "/") ? p.slice(folder.length + 1) : p;
}

function whereText(snapshot: BasicIntelSnapshot, symbol: BasicSymbolInfo, projectFolder?: string): string {
  const path = snapshot.filePath(symbol.declaration.fileIndex) ?? "";
  if (snapshot.isLibraryFile(symbol.declaration.fileIndex)) {
    return `standard library, \`${path.slice(path.indexOf("/") + 1)}\` line ${symbol.declaration.line}`;
  }
  return `\`${relativePath(path, projectFolder)}\` line ${symbol.declaration.line}`;
}

function symbolKindText(s: BasicSymbolInfo): string {
  switch (s.kind) {
    case "variable":
      return `${s.storage === "local" ? "local" : "global"} variable`;
    case "array":
      return `${s.storage === "local" ? "local" : s.storage === "param" ? "array parameter" : "global"}${s.storage === "param" ? "" : " array"}`;
    case "const":
      return "constant";
    case "sub":
      return "SUB";
    case "function":
      return "FUNCTION";
    case "param":
      return "parameter";
    case "label":
      return "label";
    case "lineNumber":
      return "line number";
  }
}

/** Keyword case for an insertion (Q6): upper case unless the typed prefix is lower case. */
function keywordCase(text: string, prefix: string): string {
  return prefix && prefix === prefix.toLowerCase() && /[a-z]/.test(prefix) ? text.toLowerCase() : text;
}

// =================================================================================================
// Hover (G8.1)

/** The hover at a position: header option, directive, pragma, macro, symbol, keyword, library routine or number. */
export function computeBasicHover(req: BasicRequest, line: number, column: number): BasicHover | null {
  const lineText = req.lines[line - 1] ?? "";
  const word = wordAt(lineText, column);

  // --- A header option line
  const header = /^(\s*(?:'|rem\s)\s*)@([\w-]+)/i.exec(lineText);
  if (header && word) {
    const nameStart = header[1].length + 2;
    if (column >= nameStart && column <= nameStart + header[2].length) return headerOptionHover(req, header[2].toLowerCase());
  }
  if (!word || !isCode(req.lines, line, column)) return null;
  const range = { startColumn: word.startColumn, endColumn: word.endColumn };

  // --- Directives and pragmas
  const directive = /^\s*#\s*([A-Za-z_]\w*)/.exec(lineText);
  if (directive) {
    const nameStart = lineText.indexOf(directive[1]) + 1;
    if (word.startColumn === nameStart) {
      const help = directiveHelp(directive[1]);
      return help ? { contents: keywordContents(help), range } : null;
    }
    if (directive[1].toLowerCase() === "pragma") {
      const p = pragmaHelp(word.word);
      if (p) {
        const parts = [`\`#pragma ${p.name}\` (${p.type}${p.default !== "" ? `, default ${p.default}` : ""})`, p.effect, `_${HELP_ATTRIBUTION}_`];
        return { contents: parts, range };
      }
    }
  }

  // --- A macro: names in the text are the preprocessor's first
  const define = req.service.defineAt(req.path, line, column, lineText);
  if (define) return { contents: defineContents(define.define), range };

  // --- A symbol of the program
  const ref = req.service.symbolAt(req.path, line, column, lineText);
  if (ref) return { contents: symbolContents(ref, req.projectFolder), range };

  // --- A keyword or built-in function
  const sigil = lineText[word.endColumn - 1] === "$" ? "$" : "";
  const keyword = keywordHelp(word.word + sigil);
  if (keyword && !/^\d/.test(word.word)) return { contents: keywordContents(keyword), range };

  // --- A library routine the program does not include yet
  const routine = libraryRoutineHelp(word.word);
  if (routine?.available) return { contents: libraryContents(routine), range };

  // --- A number in any of ZX BASIC's notations
  return basicNumericHover(lineText, column);
}

function symbolContents(ref: BasicSymbolRef, projectFolder?: string): string[] {
  const { snapshot, symbol } = ref;
  const contents = [fence([symbol.detail])];
  const facts: string[] = [`*${symbolKindText(symbol)}*`];
  if ((symbol.kind === "variable" || symbol.kind === "param") && symbol.typeText) facts.push(symbol.typeText);
  if (symbol.byref) facts.push("BYREF");
  if (symbol.kind === "array" && symbol.arrayBounds) facts.push(`${symbol.typeText} elements, bounds ${symbol.arrayBounds}`);
  if (symbol.constValue !== undefined) facts.push(`value ${symbol.constValue}`);
  if (symbol.convention === "FASTCALL") facts.push("FASTCALL");
  if (symbol.implicit) facts.push("implicit: created by its first use (W100)");
  if (symbol.bank) facts.push(`CODEBANK ${symbol.bank}`);
  contents.push(facts.join(" · "));
  if (symbol.doc) contents.push(symbol.doc);
  const where = [`Declared in ${whereText(snapshot, symbol, projectFolder)}`];
  if (symbol.forwardDeclaration) where.push(`declared earlier at line ${symbol.forwardDeclaration.line}`);
  contents.push(where.join("; "));
  return contents;
}

function keywordContents(help: BasicHelpEntry): string[] {
  return [fence(help.display), help.summary, `_${HELP_ATTRIBUTION}_`];
}

function libraryContents(routine: BasicLibraryRoutineHelp): string[] {
  const contents = [fence(routine.syntax.length ? routine.syntax : [routine.name])];
  contents.push(routine.summary + (routine.returns ? ` Returns ${routine.returns}.` : ""));
  contents.push(`Library routine: needs \`${routine.include}\``);
  contents.push(`_${HELP_ATTRIBUTION}_`);
  return contents;
}

function defineContents(define: BasicDefineInfo): string[] {
  const head = `#define ${define.name}${define.params ? `(${define.params.join(", ")})` : ""}${define.body ? ` ${define.body}` : ""}`;
  return [fence([head]), `*macro* · defined at line ${define.declaration.line}`];
}

function headerOptionHover(req: BasicRequest, name: string): BasicHover | null {
  const spec = OPTIONS_BY_NAME.get(name);
  if (!spec) return { contents: [`\`'@${name}\`: not a Klive BASIC header option`] };
  const v = spec.value;
  const values =
    v.kind === "enum" ? v.values.join(" | ") : v.kind === "int" ? `${v.min}..${v.max}` : v.kind === "flag" ? "a flag (no value)" : v.kind === "list" ? "a list" : v.kind;
  const contents = [`\`'@${spec.name}\` — ${spec.describe}`, `Value: ${values}`];
  const snapshot = req.service.snapshotFor(req.path);
  const used = snapshot?.headerOptions().find((h) => h.name === name);
  if (used?.value !== undefined) contents.push(`In this build: \`${used.value}\``);
  return { contents };
}

/** The numeric hover of the assembler, over ZX BASIC's literal forms (spec `lexical.numeric_literals`). */
function basicNumericHover(lineText: string, column: number): BasicHover | null {
  const re = /\bBIN\s+([01]+)\b|\$[0-9A-Fa-f]+\b|\b0x[0-9A-Fa-f]+\b|\b[0-9][0-9A-Fa-f]*[hH]\b|\b[0-7]+[oO]\b|%[01]+\b|\b[01]+[bB]\b|\b\d+\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText))) {
    const start = m.index + 1;
    const end = start + m[0].length;
    if (column < start || column > end) continue;
    const text = m[0];
    // --- Into a form the assembler's hover reads
    const asmText = m[1] !== undefined ? `%${m[1]}` : /^[01]+[bB]$/.test(text) ? `%${text.slice(0, -1)}` : text;
    const hover = computeNumericHover(asmText, 1);
    if (!hover) return null;
    return { contents: hover.contents.map((c) => c.replace(`\`${asmText}\``, `\`${text}\``)), range: { startColumn: start, endColumn: end } };
  }
  return null;
}

// =================================================================================================
// Definition, references, highlights (G8.2)

const INCLUDE_RE = /^(\s*#\s*include\s+(?:once\s+(?:\[[^\]]*\]\s*)?)?)(?:<([^>]+)>|"([^"]+)")/i;

/** The file an `#include` line names, when the position is on its file name. */
export function computeBasicIncludeTarget(req: BasicRequest, line: number, column: number): string | null {
  const lineText = req.lines[line - 1] ?? "";
  const m = INCLUDE_RE.exec(lineText);
  if (!m) return null;
  const name = (m[2] ?? m[3]).trim();
  const start = m[1].length + 2;
  if (column < start - 1 || column > start + name.length) return null;
  return resolveInclude(req, name, m[2] !== undefined);
}

/** Where an `#include` goes, as the compiler finds it: `"file"` beside the source first, then the library. */
function resolveInclude(req: BasicRequest, name: string, system: boolean): string | null {
  const snapshot = req.service.snapshotFor(req.path);
  const files = snapshot?.data.files ?? [];
  const dir = req.path.replace(/\\/g, "/").replace(/\/[^/]*$/, "");
  const joined = joinPath(dir, name);
  const exact = system ? undefined : files.find((f) => normalizeBasicPath(f.path) === normalizeBasicPath(joined));
  if (exact) return exact.path;
  const library = availableLibraryFiles().find((l) => l.name.toLowerCase() === name.toLowerCase());
  const bundled = files.find((f) => f.library && f.path.toLowerCase().endsWith("/" + name.toLowerCase()));
  if (bundled) return bundled.path;
  if (library) return `<kbasic-stdlib>/${library.name}`;
  const suffix = files.find((f) => !f.virtual && normalizeBasicPath(f.path).endsWith("/" + normalizeBasicPath(name)));
  if (suffix) return suffix.path;
  return system ? null : joined;
}

function joinPath(dir: string, name: string): string {
  if (/^([A-Za-z]:)?[\\/]/.test(name)) return name;
  const out: string[] = [];
  for (const p of `${dir}/${name}`.replace(/\\/g, "/").split("/")) {
    if (p === "." || (p === "" && out.length > 0)) continue;
    if (p === ".." && out.length > 0 && out[out.length - 1] !== "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

/** Go to Definition: an `#include`d file, a macro's `#define`, or a symbol's declaration (and DECLARE). */
export function computeBasicDefinition(req: BasicRequest, line: number, column: number): BasicLocationResult[] {
  const include = computeBasicIncludeTarget(req, line, column);
  if (include) return [{ path: include, line: 1, startColumn: 1, endColumn: 1 }];
  if (!isCode(req.lines, line, column)) return [];
  const lineText = req.lines[line - 1] ?? "";
  const define = req.service.defineAt(req.path, line, column, lineText);
  if (define) {
    const loc = define.snapshot.resolve(define.define.declaration);
    return loc ? [loc] : [];
  }
  const ref = req.service.symbolAt(req.path, line, column, lineText);
  return ref ? req.service.definition(ref) : [];
}

/** Find All References: scope-correct, from the binder's resolved uses. */
export function computeBasicReferences(req: BasicRequest, line: number, column: number, includeDeclaration: boolean): BasicLocationResult[] {
  if (!isCode(req.lines, line, column)) return [];
  const lineText = req.lines[line - 1] ?? "";
  const define = req.service.defineAt(req.path, line, column, lineText);
  if (define) {
    const { snapshot, define: d } = define;
    const all = [...(includeDeclaration ? [d.declaration] : []), ...d.uses];
    return all.map((l) => snapshot.resolve(l)).filter((l): l is BasicLocationResult => !!l);
  }
  const ref = req.service.symbolAt(req.path, line, column, lineText);
  return ref ? req.service.references(ref, includeDeclaration) : [];
}

/** Highlights: the keywords of the block under the cursor, or the symbol's occurrences in this file. */
export function computeBasicHighlights(req: BasicRequest, line: number, column: number): BasicHighlight[] {
  const block = computeBasicBlockMatch(req.lines, line, column);
  if (block) return block.map((k) => ({ ...k, kind: HIGHLIGHT.Read }));
  if (!isCode(req.lines, line, column)) return [];
  const ref = req.service.symbolAt(req.path, line, column, req.lines[line - 1] ?? "");
  if (!ref) return [];
  const here = normalizeBasicPath(req.path);
  return req.service
    .references(ref, true)
    .filter((r) => normalizeBasicPath(r.path) === here)
    .map((r) => ({ line: r.line, startColumn: r.startColumn, endColumn: r.endColumn, kind: HIGHLIGHT.Text }));
}

// =================================================================================================
// Outline and links (G8.5)

const OUTLINE_KINDS: Record<string, number> = {
  sub: SK.Function,
  function: SK.Function,
  param: SK.Variable,
  variable: SK.Variable,
  array: SYMBOL_KIND.Array,
  const: SK.Constant,
  label: SYMBOL_KIND.Key,
  codebank: SYMBOL_KIND.Namespace
};

/** The outline of the file (its own symbols, also for an `#include`d file). */
export function computeBasicDocumentSymbols(req: BasicRequest): BasicDocumentSymbol[] {
  const convert = (e: import("@abstractions/BasicIntel").BasicOutlineEntry): BasicDocumentSymbol => ({
    name: e.name,
    ...(e.detail ? { detail: e.detail } : {}),
    kind: OUTLINE_KINDS[e.kind] ?? SK.Variable,
    line: e.line,
    endLine: Math.max(e.endLine, e.line),
    startColumn: e.startColumn + 1,
    endColumn: e.endColumn + 1,
    children: (e.children ?? []).map(convert)
  });
  return req.service.outline(req.path).map(convert);
}

/** `#include` file names as links. */
export function computeBasicIncludeLinks(req: BasicRequest): BasicLink[] {
  const links: BasicLink[] = [];
  req.lines.forEach((text, i) => {
    const m = INCLUDE_RE.exec(text);
    if (!m) return;
    const name = (m[2] ?? m[3]).trim();
    const path = resolveInclude(req, name, m[2] !== undefined);
    if (!path) return;
    const start = m[1].length + 2;
    links.push({ line: i + 1, startColumn: start, endColumn: start + name.length, path });
  });
  return links;
}

// =================================================================================================
// Completion (G8.3)

const STATEMENT_KINDS = new Set(["statement", "declaration"]);
const EXPRESSION_KINDS = new Set(["function", "operator"]);

/** Snippets offered at the start of a statement (§4.7). `KW` is replaced by the keyword case. */
const SNIPPETS: { label: string; detail: string; body: string }[] = [
  { label: "SUB", detail: "SUB … END SUB", body: "SUB ${1:name}(${2})\n\t$0\nEND SUB" },
  { label: "FUNCTION", detail: "FUNCTION … END FUNCTION", body: "FUNCTION ${1:name}(${2}) AS ${3:UByte}\n\t$0\nEND FUNCTION" },
  { label: "FOR", detail: "FOR … NEXT", body: "FOR ${1:i} = ${2:1} TO ${3:10}\n\t$0\nNEXT ${1:i}" },
  { label: "IF", detail: "IF … END IF", body: "IF ${1:condition} THEN\n\t$0\nEND IF" },
  { label: "DO", detail: "DO … LOOP", body: "DO\n\t$0\nLOOP" },
  { label: "WHILE", detail: "WHILE … WEND", body: "WHILE ${1:condition}\n\t$0\nWEND" }
];

/** Completion items at a position. */
export function computeBasicCompletions(req: BasicRequest, line: number, column: number): BasicCompletionList {
  const context = scanBasicContext(req.lines, line, column);
  const prefix = "prefix" in context ? context.prefix : "";
  const startColumn = column - prefix.length;
  return { startColumn, items: completionItems(req, context, line) };
}

function completionItems(req: BasicRequest, context: BasicCompletionContext, line: number): BasicCompletion[] {
  const kw = (name: string, detail: string, prefix: string, kind: number = CIK.Keyword, documentation?: string): BasicCompletion => ({
    label: keywordCase(name, prefix),
    kind,
    detail,
    ...(documentation ? { documentation } : {}),
    insertText: keywordCase(name, prefix),
    isSnippet: false
  });
  switch (context.kind) {
    case "none":
      return [];
    case "header-option":
      if (context.part === "name") {
        return OPTION_SPECS.map((o) => ({ label: o.name, kind: CIK.Variable, detail: o.describe, insertText: o.name, isSnippet: false }));
      } else {
        const spec = OPTIONS_BY_NAME.get(context.option ?? "");
        if (spec?.value.kind !== "enum") return [];
        return spec.value.values.map((v) => ({ label: v, kind: CIK.Constant, detail: spec.describe, insertText: v, isSnippet: false }));
      }
    case "directive":
      return DIRECTIVE_HELP.map((d) => ({
        label: d.name.slice(1),
        kind: CIK.Keyword,
        detail: d.display[0],
        documentation: d.summary,
        insertText: d.name.slice(1),
        isSnippet: false
      }));
    case "pragma":
      if (context.part === "name") {
        return [
          ...PRAGMA_HELP.map((p) => ({ label: p.name, kind: CIK.Variable, detail: `${p.type}: ${p.effect}`, insertText: p.name, isSnippet: false })),
          ...["push", "pop", "once"].map((w) => ({ label: w, kind: CIK.Keyword, detail: `#pragma ${w}`, insertText: w, isSnippet: false }))
        ];
      } else {
        const p = pragmaHelp(context.option ?? "");
        if (p?.type !== "bool") return [];
        return ["true", "false"].map((v) => ({ label: v, kind: CIK.Constant, detail: p.effect, insertText: v, isSnippet: false }));
      }
    case "include-path":
      return includeItems(context.system);
    case "type":
      return TYPE_KEYWORDS.map((t) => kw(t, keywordHelp(t)?.summary ?? "", context.prefix, CIK.Struct));
    case "label": {
      const snapshot = req.service.snapshotFor(req.path);
      return (snapshot?.labels() ?? []).map((l) => ({
        label: l.name,
        kind: l.kind === "lineNumber" ? CIK.Constant : CIK.Module,
        detail: l.detail,
        insertText: l.name,
        isSnippet: false
      }));
    }
    case "statement-start":
    case "expression": {
      const atStart = context.kind === "statement-start";
      const items: BasicCompletion[] = [];
      for (const e of KEYWORD_HELP) {
        const fits = atStart ? STATEMENT_KINDS.has(e.kind) : EXPRESSION_KINDS.has(e.kind);
        if (fits) items.push(kw(e.name, e.display[0], context.prefix, e.kind === "function" ? CIK.Function : CIK.Keyword, e.summary));
      }
      if (atStart) {
        for (const s of SNIPPETS) {
          items.push({
            label: `${keywordCase(s.label, context.prefix)} …`,
            kind: CIK.Snippet,
            detail: s.detail,
            insertText: snippetCase(s.body, context.prefix),
            isSnippet: true,
            sortText: `~${s.label}`
          });
        }
      }
      items.push(...symbolItems(req, line, atStart));
      items.push(...libraryItems(req, atStart));
      return items;
    }
  }
}

function snippetCase(body: string, prefix: string): string {
  if (!(prefix && prefix === prefix.toLowerCase() && /[a-z]/.test(prefix))) return body;
  return body.replace(/\b(SUB|FUNCTION|END|FOR|TO|NEXT|IF|THEN|DO|LOOP|WHILE|WEND|AS|UByte)\b/g, (w) => w.toLowerCase());
}

const SYMBOL_COMPLETION_KIND: Record<string, number> = {
  variable: CIK.Variable,
  param: CIK.Variable,
  array: CIK.Variable,
  const: CIK.Constant,
  sub: CIK.Function,
  function: CIK.Function
};

/** The program's symbols in scope: SUBs and variables at a statement start, values elsewhere. */
function symbolItems(req: BasicRequest, line: number, atStart: boolean): BasicCompletion[] {
  return req.service
    .visibleSymbols(req.path, line)
    .filter((s) => (atStart ? s.kind !== "function" && s.kind !== "const" : s.kind !== "sub"))
    .map((s) => ({
      label: s.name,
      kind: SYMBOL_COMPLETION_KIND[s.kind] ?? CIK.Variable,
      detail: s.detail,
      ...(s.doc ? { documentation: s.doc } : {}),
      insertText: s.name,
      isSnippet: false,
      sortText: `0${s.name}`
    }));
}

/**
 * Library routines (E9): one the program already includes comes from its bound symbol (above); one
 * it does not is offered from the catalogue, and accepting it adds its `#include` line.
 */
function libraryItems(req: BasicRequest, atStart: boolean): BasicCompletion[] {
  const snapshot = req.service.snapshotFor(req.path);
  const known = new Set((snapshot?.routines() ?? []).map((r) => r.name.toLowerCase()));
  const text = req.lines.join("\n");
  const items: BasicCompletion[] = [];
  for (const r of availableLibraryRoutines()) {
    if ((r.kind === "sub") !== atStart) continue;
    if (known.has(r.name.replace(/\$$/, "").toLowerCase())) continue;
    const included = new RegExp(`#\\s*include\\s+(?:once\\s+)?<\\s*${r.library.replace(/[.]/g, "\\.")}\\s*>`, "i").test(text);
    items.push({
      label: r.name,
      kind: CIK.Function,
      detail: r.syntax[0] ?? r.name,
      documentation: `${r.summary}${included ? "" : `\n\nAdds \`${r.include}\``}`,
      insertText: r.name,
      isSnippet: false,
      ...(included ? {} : { additionalTextEdits: [{ ...includeInsertPosition(req.lines), text: `${r.include}\n` }] })
    });
  }
  return items;
}

/** Where a new `#include` line goes: after the last one, or after the header comments. */
export function includeInsertPosition(lines: readonly string[]): { line: number; column: number } {
  let lastInclude = -1;
  let firstCode = -1;
  lines.forEach((l, i) => {
    if (/^\s*#\s*include\b/i.test(l)) lastInclude = i;
    if (firstCode < 0 && l.trim() !== "" && !/^\s*('|rem(\s|$))/i.test(l)) firstCode = i;
  });
  if (lastInclude >= 0) return { line: lastInclude + 2, column: 1 };
  return { line: (firstCode < 0 ? lines.length : firstCode) + 1, column: 1 };
}

function includeItems(system: boolean): BasicCompletion[] {
  if (system) {
    return availableLibraryFiles().map((l) => ({ label: l.name, kind: CIK.Module, detail: l.summary, insertText: l.name, isSnippet: false }));
  }
  return [];
}

/** Project `.bas`/`.zxbas` files, relative to the including file's folder, for `#include "..."`. */
export function computeBasicIncludeFileItems(path: string, projectFiles: readonly string[]): BasicCompletion[] {
  const dir = path.replace(/\\/g, "/").replace(/\/[^/]*$/, "");
  return projectFiles
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => /\.(zxbas|bas)$/i.test(f) && normalizeBasicPath(f) !== normalizeBasicPath(path))
    .map((f) => {
      const rel = f.startsWith(dir + "/") ? f.slice(dir.length + 1) : f;
      return { label: rel, kind: CIK.Module, detail: f, insertText: rel, isSnippet: false };
    });
}

// =================================================================================================
// Signature help (G8.5)

/** Statement keywords whose operands signature help shows (`BEEP duration, pitch`). */
function statementSignature(name: string): BasicHelpEntry | undefined {
  const help = keywordHelp(name);
  if (!help || help.kind !== "statement") return undefined;
  return help.display.some((d) => d.includes(",")) ? help : undefined;
}

/** Parameter hints for the call around the cursor: a user routine, a built-in, or a library routine. */
export function computeBasicSignatureHelp(req: BasicRequest, line: number, column: number): BasicSignatureHelp | null {
  const isStatementCall = (name: string) =>
    req.service.routineByName(name, req.path)?.symbol.kind === "sub" ||
    libraryRoutineHelp(name)?.kind === "sub" ||
    !!statementSignature(name);
  const call = scanBasicCall(req.lines, line, column, isStatementCall);
  if (!call) return null;

  const routine = req.service.routineByName(call.name, req.path);
  if (routine) {
    const params = (routine.symbol.params ?? []).map(
      (p) => `${p.isArray ? "" : p.byref ? "BYREF " : "BYVAL "}${p.name}${p.isArray ? "()" : ""} AS ${p.typeText}${p.defaultText !== undefined ? ` = ${p.defaultText}` : ""}`
    );
    const tail = routine.symbol.kind === "function" && routine.symbol.returnType ? ` AS ${routine.symbol.returnType}` : "";
    return signature(routine.symbol.name, params, tail, call.argIndex, routine.symbol.doc);
  }
  const keyword = keywordHelp(call.name);
  if (keyword?.kind === "function" && keyword.params?.length) {
    return signature(call.name.toUpperCase(), [...keyword.params], "", call.argIndex, keyword.summary);
  }
  const statement = !call.parens ? statementSignature(call.name) : undefined;
  if (statement) {
    const display = statement.display.find((d) => d.includes(",")) ?? statement.display[0];
    const operands = display.slice(display.indexOf(" ") + 1).split(/\s*,\s*/);
    return signature(display.slice(0, display.indexOf(" ")), operands, "", call.argIndex, statement.summary, " ");
  }
  const library = libraryRoutineHelp(call.name);
  if (library) {
    const params = library.params.map((p) => (p.type ? `${p.name} AS ${p.type}` : p.name));
    return signature(library.name, params, library.returns ? ` AS ${library.returns}` : "", call.argIndex, library.summary);
  }
  return null;
}

function signature(name: string, params: string[], tail: string, argIndex: number, documentation?: string, open = "("): BasicSignatureHelp {
  let label = name + open;
  const offsets: [number, number][] = [];
  params.forEach((p, i) => {
    if (i > 0) label += ", ";
    offsets.push([label.length, label.length + p.length]);
    label += p;
  });
  label += (open === "(" ? ")" : "") + tail;
  // --- A repeated last parameter (`expr, …`) takes every further argument
  const active = params[params.length - 1] === "…" && argIndex >= params.length - 1 ? params.length - 1 : argIndex;
  return { label, ...(documentation ? { documentation } : {}), parameters: offsets, activeParameter: Math.min(active, Math.max(params.length - 1, 0)) };
}

// =================================================================================================
// Rename (G8.4)

const RENAMABLE = new Set(["variable", "array", "const", "sub", "function", "param", "label"]);

export type BasicRenameTarget = { ref: BasicSymbolRef; startColumn: number; endColumn: number; text: string };

/** Whether the symbol at a position can be renamed (§4.8, step 1); the reason when it cannot. */
export function computeBasicRenameValidation(req: BasicRequest, line: number, column: number): BasicRenameTarget | { rejectReason: string } {
  const lineText = req.lines[line - 1] ?? "";
  const word = wordAt(lineText, column);
  if (!word || !isCode(req.lines, line, column)) return { rejectReason: "No symbol at the cursor" };
  if (req.service.defineAt(req.path, line, column, lineText)) return { rejectReason: "Macros (#define) cannot be renamed" };
  const ref = req.service.symbolAt(req.path, line, column, lineText);
  if (!ref) {
    return { rejectReason: keywordHelp(word.word) ? `'${word.word}' is a keyword` : `'${word.word}' is not a symbol Klive BASIC knows here (yet)` };
  }
  const { snapshot, symbol } = ref;
  if (!RENAMABLE.has(symbol.kind)) return { rejectReason: "Line numbers cannot be renamed" };
  if (snapshot.isLibraryFile(symbol.declaration.fileIndex)) return { rejectReason: `'${symbol.name}' is in the standard library, which is read-only` };
  const macro = snapshot.occurrencesOf(symbol.id).find((o) => !o.editable);
  if (macro) {
    const path = snapshot.filePath(macro.fileIndex) ?? "";
    return { rejectReason: `'${symbol.name}' is used through a macro at ${relativePath(path, req.projectFolder)} line ${macro.line}; rename it by hand` };
  }
  return { ref, startColumn: word.startColumn, endColumn: word.endColumn, text: word.word };
}

/** The edits that rename the symbol at a position (§4.8, steps 2-3), or why the new name is refused. */
export function computeBasicRenameEdits(req: BasicRequest, line: number, column: number, newName: string): { edits: RenameEdit[] } | { error: string } {
  const target = computeBasicRenameValidation(req, line, column);
  if ("rejectReason" in target) return { error: target.rejectReason };
  const { snapshot, symbol } = target.ref;

  // --- The new name: an identifier, not a keyword; a sigil that fits the type is not part of it
  let name = newName.trim();
  const sigil = /[$%]$/.exec(name)?.[0];
  if (sigil) {
    const fits = (sigil === "$" && symbol.typeText === "String") || (sigil === "%" && symbol.typeText === "Integer");
    if (!fits) return { error: `'${sigil}' does not fit ${symbol.name}'s type` };
    name = name.slice(0, -1);
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return { error: `'${newName}' is not a valid name` };
  const upper = name.toUpperCase();
  if (upper in KEYWORDS || upper in EXTENSION_KEYWORDS) return { error: `'${name}' is a keyword` };
  if (name === symbol.name) return { edits: [] };

  // --- Collisions, as the program compares names (E12)
  const same = (other: BasicSymbolInfo) => other.id !== symbol.id && snapshot.sameName(other.name, name, other);
  if (symbol.kind === "label") {
    const clash = snapshot.labels().find((l) => l.kind === "label" && same(l));
    if (clash) return { error: `A label '${clash.name}' already exists` };
  } else {
    const scopes = new Set<number>([symbol.scopeId, 0]);
    for (const o of snapshot.occurrencesOf(symbol.id)) {
      const scope = snapshot.routineScopeAt(o.fileIndex, o.line);
      if (scope) scopes.add(scope.id);
    }
    for (const id of scopes) {
      const scope = snapshot.data.scopes[id];
      const clash = scope?.symbolIds.map((s) => snapshot.symbol(s)!).find((s) => s.kind !== "label" && s.kind !== "lineNumber" && same(s));
      if (clash) return { error: `'${name}' is already ${symbolKindText(clash)} ${clash.name} where '${symbol.name}' is visible` };
    }
    const library = libraryRoutineHelp(name);
    if (library?.available || snapshot.data.symbols.some((s) => snapshot.isLibraryFile(s.declaration.fileIndex) && s.name.toLowerCase() === name.toLowerCase())) {
      return { error: `'${name}' is a standard library routine` };
    }
  }

  // --- A snapshot older than the text would edit the wrong places: every occurrence in this file
  // --- must still read as the name (E5)
  const here = snapshot.fileIndex(req.path);
  const stale = snapshot
    .occurrencesOf(symbol.id)
    .some((o) => o.fileIndex === here && !snapshot.sameName((req.lines[o.line - 1] ?? "").slice(o.startColumn, o.endColumn), symbol.name, symbol));
  if (stale) return { error: "The file changed since its last check; try again in a moment" };

  const edits: RenameEdit[] = snapshot.occurrencesOf(symbol.id).map((o) => ({
    filePath: snapshot.filePath(o.fileIndex)!,
    line: o.line,
    startColumn: o.startColumn + 1,
    endColumn: o.endColumn + 1,
    newText: name
  }));
  return { edits };
}

// =================================================================================================
// Monaco adapter

export type BasicProviderHost = {
  getService: () => IBasicIntelService;
  getProjectFolder?: () => string | undefined;
  getProjectFiles?: () => string[];
  navigateToFile?: (filePath: string, line: number) => void;
  applyExternalEdits?: (edits: RenameEdit[]) => void;
};

const OPEN_INCLUDE_CMD = "klive.openIncludeFile";

/** Registers the `.zxbas` providers; called once from `initializeMonaco()`. */
export function registerBasicProviders(monaco: any, host: BasicProviderHost): void {
  const LANG = "zxbas";
  const request = (model: any): BasicRequest => {
    const lines: string[] = [];
    const count = model.getLineCount();
    for (let i = 1; i <= count; i++) lines.push(model.getLineContent(i));
    return { service: host.getService(), path: modelPath(model), lines, projectFolder: host.getProjectFolder?.() };
  };
  const uriOf = (model: any, path: string) =>
    normalizeBasicPath(path) === normalizeBasicPath(modelPath(model)) ? model.uri : monaco.Uri.file(path);
  const range = (line: number, startColumn: number, endLine: number, endColumn: number) => ({
    startLineNumber: line,
    startColumn,
    endLineNumber: endLine,
    endColumn
  });

  try {
    monaco.editor.registerCommand(OPEN_INCLUDE_CMD, (_accessor: any, absolutePath: string) => host.navigateToFile?.(absolutePath, 1));
  } catch {
    // --- The assembler's providers registered it already
  }

  monaco.languages.registerHoverProvider(LANG, {
    provideHover(model: any, position: any) {
      const hover = computeBasicHover(request(model), position.lineNumber, position.column);
      if (!hover) return null;
      return {
        contents: hover.contents.map((value) => ({ value })),
        ...(hover.range ? { range: range(position.lineNumber, hover.range.startColumn, position.lineNumber, hover.range.endColumn) } : {})
      };
    }
  });

  monaco.languages.registerDefinitionProvider(LANG, {
    provideDefinition(model: any, position: any) {
      return computeBasicDefinition(request(model), position.lineNumber, position.column).map((d) => ({
        uri: uriOf(model, d.path),
        range: range(d.line, d.startColumn, d.line, d.endColumn)
      }));
    }
  });

  monaco.languages.registerReferenceProvider(LANG, {
    provideReferences(model: any, position: any, ctx: any) {
      return computeBasicReferences(request(model), position.lineNumber, position.column, ctx?.includeDeclaration ?? true).map((r) => ({
        uri: uriOf(model, r.path),
        range: range(r.line, r.startColumn, r.line, r.endColumn)
      }));
    }
  });

  monaco.languages.registerDocumentHighlightProvider(LANG, {
    provideDocumentHighlights(model: any, position: any) {
      return computeBasicHighlights(request(model), position.lineNumber, position.column).map((h) => ({
        range: range(h.line, h.startColumn, h.line, h.endColumn),
        kind: h.kind
      }));
    }
  });

  monaco.languages.registerDocumentSymbolProvider(LANG, {
    provideDocumentSymbols(model: any) {
      const toMonaco = (s: BasicDocumentSymbol): any => ({
        name: s.name,
        detail: s.detail ?? "",
        kind: s.kind,
        tags: [],
        range: range(s.line, 1, s.endLine, model.getLineMaxColumn(Math.min(s.endLine, model.getLineCount()))),
        selectionRange: range(s.line, s.startColumn, s.line, s.endColumn),
        children: s.children.map(toMonaco)
      });
      return computeBasicDocumentSymbols(request(model)).map(toMonaco);
    }
  });

  monaco.languages.registerFoldingRangeProvider(LANG, {
    provideFoldingRanges(model: any) {
      return computeBasicFoldingRanges(request(model).lines).map((r) => ({
        start: r.line,
        end: r.endLine,
        ...(r.kind === "comment" ? { kind: monaco.languages.FoldingRangeKind.Comment } : r.kind === "region" ? { kind: monaco.languages.FoldingRangeKind.Region } : {})
      }));
    }
  });

  monaco.languages.registerLinkProvider(LANG, {
    provideLinks(model: any) {
      const links = computeBasicIncludeLinks(request(model)).map((l) => ({
        range: range(l.line, l.startColumn, l.line, l.endColumn),
        url: `command:${OPEN_INCLUDE_CMD}?${encodeURIComponent(JSON.stringify(l.path))}`,
        tooltip: "Open the included file"
      }));
      return { links };
    }
  });

  monaco.languages.registerCompletionItemProvider(LANG, {
    triggerCharacters: ["#", "<", '"', "@", " "],
    provideCompletionItems(model: any, position: any, context: any) {
      const req = request(model);
      // --- A blank typed after a word only matters where a list starts: after GOTO, AS, #pragma ...
      const result = computeBasicCompletions(req, position.lineNumber, position.column);
      const ctx = scanBasicContext(req.lines, position.lineNumber, position.column);
      if (context?.triggerCharacter === " " && !["label", "type", "pragma", "header-option"].includes(ctx.kind)) return { suggestions: [] };
      let items = result.items;
      if (ctx.kind === "include-path" && !ctx.system) items = computeBasicIncludeFileItems(req.path, host.getProjectFiles?.() ?? []);
      const replace = range(position.lineNumber, result.startColumn, position.lineNumber, position.column);
      return {
        suggestions: items.map((item) => ({
          label: item.label,
          kind: item.kind,
          detail: item.detail,
          ...(item.documentation ? { documentation: { value: item.documentation } } : {}),
          insertText: item.insertText,
          insertTextRules: item.isSnippet ? 4 : 0,
          ...(item.sortText ? { sortText: item.sortText } : {}),
          range: replace,
          ...(item.additionalTextEdits
            ? { additionalTextEdits: item.additionalTextEdits.map((e) => ({ range: range(e.line, e.column, e.line, e.column), text: e.text })) }
            : {})
        }))
      };
    }
  });

  monaco.languages.registerSignatureHelpProvider(LANG, {
    signatureHelpTriggerCharacters: ["(", ",", " "],
    signatureHelpRetriggerCharacters: [","],
    provideSignatureHelp(model: any, position: any) {
      const help = computeBasicSignatureHelp(request(model), position.lineNumber, position.column);
      if (!help) return null;
      return {
        value: {
          signatures: [
            {
              label: help.label,
              ...(help.documentation ? { documentation: { value: help.documentation } } : {}),
              parameters: help.parameters.map((p) => ({ label: p }))
            }
          ],
          activeSignature: 0,
          activeParameter: help.activeParameter
        },
        dispose() {}
      };
    }
  });

  monaco.languages.registerRenameProvider(LANG, {
    provideRenameEdits(model: any, position: any, newName: string) {
      const result = computeBasicRenameEdits(request(model), position.lineNumber, position.column, newName);
      if ("error" in result) return { edits: [], rejectReason: result.error };
      const here = normalizeBasicPath(modelPath(model));
      const own = result.edits.filter((e) => normalizeBasicPath(e.filePath) === here);
      const others = result.edits.filter((e) => normalizeBasicPath(e.filePath) !== here);
      // --- Other files are edited on disk and their open documents reloaded, as the assembler does
      if (others.length) host.applyExternalEdits?.(others);
      return {
        edits: own.map((e) => ({
          resource: model.uri,
          textEdit: { range: range(e.line, e.startColumn, e.line, e.endColumn), text: e.newText },
          versionId: undefined
        }))
      };
    },
    resolveRenameLocation(model: any, position: any) {
      const result = computeBasicRenameValidation(request(model), position.lineNumber, position.column);
      if ("rejectReason" in result) return { rejectReason: result.rejectReason };
      return { range: range(position.lineNumber, result.startColumn, position.lineNumber, result.endColumn), text: result.text };
    }
  });
}

/** A model's file path: its document id (`<kbasic-stdlib>/x.bas` for a library tab). */
function modelPath(model: any): string {
  const uri = model.uri;
  return normalizeBasicPath(uri?.fsPath ?? uri?.path ?? String(uri ?? ""));
}
