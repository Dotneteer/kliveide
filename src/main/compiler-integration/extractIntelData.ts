import {
  DocumentOutlineEntry,
  KliveCompilerOutput,
  LanguageIntelData,
  LineIntelInfo,
  SymbolDefinitionInfo,
  SymbolReferenceInfo
} from "@abstractions/CompilerInfo";
import { ExpressionValueType } from "@abstractions/CompilerInfo";

/**
 * Extracts serialisable language-intelligence data from a compiler output.
 * The result is safe to pass through IPC (plain objects, no class instances).
 */
export function extractLanguageIntelData(output: KliveCompilerOutput): LanguageIntelData {
  const symbolDefinitions: SymbolDefinitionInfo[] = [];
  const outline: DocumentOutlineEntry[] = [];

  // --- sourceFileList is on DebuggableOutput / CompilerOutput
  const sourceFileList: ReadonlyArray<{ index: number; filename: string }> =
    "sourceFileList" in output && Array.isArray((output as any).sourceFileList)
      ? (output as any).sourceFileList.map(
          (f: { filename: string }, i: number) => ({ index: i, filename: f.filename })
        )
      : [];

  // --- symbolReferences are on CompilerOutput (our new field)
  const symbolReferences: SymbolReferenceInfo[] =
    "symbolReferences" in output && Array.isArray((output as any).symbolReferences)
      ? (output as any).symbolReferences
      : [];

  // --- Walk module tree for symbols and outline entries
  if ("symbols" in output) {
    visitModule(output as any, "", symbolDefinitions, outline);
  }

  // --- Build per-line address and byte information from listFileItems + segments
  const lineInfo: LineIntelInfo[] = [];
  const listFileItems: any[] =
    "listFileItems" in output && Array.isArray((output as any).listFileItems)
      ? (output as any).listFileItems
      : [];
  const segments: any[] =
    "segments" in output && Array.isArray((output as any).segments)
      ? (output as any).segments
      : [];
  for (const item of listFileItems) {
    if (!item.codeLength) continue;
    const segment = segments[item.segmentIndex];
    if (!segment?.emittedCode) continue;
    const bytes: number[] = (segment.emittedCode as number[]).slice(
      item.codeStartIndex,
      item.codeStartIndex + item.codeLength
    );
    lineInfo.push({
      fileIndex: item.fileIndex,
      lineNumber: item.lineNumber,
      address: item.address,
      bytes
    });
  }

  return {
    symbolDefinitions,
    symbolReferences,
    documentOutline: outline,
    sourceFiles: sourceFileList,
    lineInfo
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyModule = {
  symbols: Record<string, any>;
  macros: Record<string, any>;
  structs: Record<string, any>;
  nestedModules: Record<string, AnyModule>;
};

/**
 * Recursively visits a compiled module, collecting symbol definitions
 * and building the document outline.
 */
function visitModule(
  module: AnyModule,
  modulePath: string,
  definitions: SymbolDefinitionInfo[],
  outline: DocumentOutlineEntry[]
): void {
  // --- Plain symbols (labels and vars in this module's scope)
  for (const [rawName, sym] of Object.entries(module.symbols)) {
    if (!sym || typeof sym !== "object") continue;
    // --- Skip symbols whose name is also a macro — handled below with richer info
    if (rawName in module.macros) continue;
    const fullName = modulePath ? `${modulePath}.${rawName}` : rawName;
    const kind = symKind(sym);
    const def = buildDefinitionInfo(fullName, sym, kind);
    definitions.push(def);

    // Flat labels / vars go into the outline for the file that defines them
    if (typeof sym.definitionLine === "number") {
      outline.push({
        name: fullName,
        kind,
        fileIndex: sym.definitionFileIndex ?? 0,
        line: sym.definitionLine,
        endLine: sym.definitionLine,
        children: []
      });
    }
  }

  // --- Macros
  for (const [macroName, macro] of Object.entries(module.macros)) {
    if (!macro || typeof macro !== "object") continue;
    // Use macro.macroName (original case from source) instead of the dict key (which may be lowercased)
    const displayName = (typeof macro.macroName === "string" && macro.macroName) ? macro.macroName : macroName;
    const fullName = modulePath ? `${modulePath}.${displayName}` : displayName;

    // --- Use the source location stored on the macro definition
    const fileIndex: number = macro.fileIndex ?? 0;
    const line: number = macro.sourceLine ?? ((macro.section?.firstLine ?? 0) + 1);
    const startColumn: number = macro.startColumn ?? 0;
    const endColumn: number = macro.endColumn ?? 0;

    // --- Build a description showing the parameter list
    const argNames: string[] = Array.isArray(macro.argNames)
      ? macro.argNames.map((a: any) => (typeof a === "object" ? a.name : String(a)))
      : [];
    const description = `(${argNames.join(", ")})`;

    const bodyLines: readonly string[] | undefined = Array.isArray(macro.bodyLines)
      ? macro.bodyLines
      : undefined;
    const def: SymbolDefinitionInfo = {
      name: fullName,
      kind: "macro",
      fileIndex,
      line,
      startColumn,
      endColumn,
      description,
      bodyLines
    };
    definitions.push(def);
    outline.push({
      name: fullName,
      kind: "macro",
      fileIndex,
      line,
      endLine: (macro.section?.lastLine ?? 0) + 1,
      children: []
    });
  }

  // --- Structs
  for (const [structName, struct] of Object.entries(module.structs)) {
    if (!struct || typeof struct !== "object") continue;
    const fullName = modulePath ? `${modulePath}.${structName}` : structName;
    const section = struct.section ?? { firstLine: 0, lastLine: 0 };
    const def: SymbolDefinitionInfo = {
      name: fullName,
      kind: "struct",
      fileIndex: 0,
      line: section.firstLine + 1,
      startColumn: 0,
      endColumn: 0
    };
    definitions.push(def);
    outline.push({
      name: fullName,
      kind: "struct",
      fileIndex: 0,
      line: section.firstLine + 1,
      endLine: section.lastLine + 1,
      children: []
    });
  }

  // --- Nested modules (recurse)
  for (const [modName, subModule] of Object.entries(module.nestedModules)) {
    if (!subModule || typeof subModule !== "object") continue;
    const fullPath = modulePath ? `${modulePath}.${modName}` : modName;
    const childDefs: SymbolDefinitionInfo[] = [];
    const childOutline: DocumentOutlineEntry[] = [];
    visitModule(subModule, fullPath, childDefs, childOutline);
    definitions.push(...childDefs);
    // Module itself as an outline entry wrapping its children
    outline.push({
      name: fullPath,
      kind: "module",
      fileIndex: 0,
      line: 0,
      endLine: 0,
      children: childOutline
    });
  }
}

function symKind(sym: any): SymbolDefinitionInfo["kind"] {
  // SymbolType: 0=None, 1=Label, 2=Var, 3=Equ
  if (sym.type === 3) return "equ";
  if (sym.type === 2) return "var";
  return "label";
}

function buildDefinitionInfo(
  name: string,
  sym: any,
  kind: SymbolDefinitionInfo["kind"]
): SymbolDefinitionInfo {
  const numericValue: number | undefined =
    sym.value &&
    sym.value.type !== ExpressionValueType.Error &&
    sym.value.type !== ExpressionValueType.NonEvaluated &&
    sym.value.type !== ExpressionValueType.String
      ? (sym.value.value as number)
      : undefined;

  const description =
    numericValue !== undefined
      ? `= $${numericValue.toString(16).toUpperCase()}`
      : undefined;

  return {
    name,
    kind,
    fileIndex: sym.definitionFileIndex ?? 0,
    line: sym.definitionLine ?? 0,
    startColumn: sym.definitionStartColumn ?? 0,
    endColumn: sym.definitionEndColumn ?? 0,
    value: numericValue,
    description
  };
}
