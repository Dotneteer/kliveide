import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeReferences } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData, SymbolDefinitionInfo, SymbolReferenceInfo } from "@abstractions/CompilerInfo";

function makeSym(partial: Partial<SymbolDefinitionInfo> & { name: string }): SymbolDefinitionInfo {
  return { kind: "label", fileIndex: 0, line: 5, startColumn: 0, endColumn: partial.name.length, ...partial };
}

function makeRef(partial: Partial<SymbolReferenceInfo> & { symbolName: string }): SymbolReferenceInfo {
  return { fileIndex: 0, line: 10, startColumn: 5, endColumn: 5 + partial.symbolName.length, ...partial };
}

function makeData(
  syms: SymbolDefinitionInfo[] = [],
  refs: SymbolReferenceInfo[] = []
): LanguageIntelData {
  return {
    symbolDefinitions: syms,
    symbolReferences: refs,
    documentOutline: [],
    sourceFiles: [
      { index: 0, filename: "/project/main.asm" },
      { index: 1, filename: "/project/lib.asm" }
    ]
  };
}

describe("computeReferences", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
    svc.update(makeData(
      [
        makeSym({ name: "MyLabel", line: 5,  fileIndex: 0 }),
        makeSym({ name: "Other",   line: 50, fileIndex: 0 })
      ],
      [
        makeRef({ symbolName: "MyLabel", line: 10, fileIndex: 0 }),
        makeRef({ symbolName: "MyLabel", line: 20, fileIndex: 0 }),
        makeRef({ symbolName: "Other",   line: 30, fileIndex: 0 })
      ]
    ));
  });

  // --- includeDeclaration: true
  it("includes definition when includeDeclaration is true", () => {
    const results = computeReferences("MyLabel", true, svc);
    const lines = results.map((r) => r.line);
    expect(lines).toContain(5);   // definition line
    expect(lines).toContain(10);  // first reference
    expect(lines).toContain(20);  // second reference
    expect(results.length).toBe(3);
  });

  it("definition is the first entry when includeDeclaration is true", () => {
    const results = computeReferences("MyLabel", true, svc);
    expect(results[0].line).toBe(5);
  });

  // --- includeDeclaration: false
  it("excludes definition when includeDeclaration is false", () => {
    const results = computeReferences("MyLabel", false, svc);
    const lines = results.map((r) => r.line);
    expect(lines).not.toContain(5);
    expect(lines).toContain(10);
    expect(lines).toContain(20);
    expect(results.length).toBe(2);
  });

  // --- File paths
  it("result contains the resolved file path", () => {
    const results = computeReferences("MyLabel", false, svc);
    for (const r of results) {
      expect(r.filePath).toBe("/project/main.asm");
    }
  });

  it("resolves cross-file references correctly", () => {
    svc.update(makeData(
      [makeSym({ name: "LibFn", line: 3, fileIndex: 1 })],
      [
        makeRef({ symbolName: "LibFn", line: 8,  fileIndex: 0 }),
        makeRef({ symbolName: "LibFn", line: 22, fileIndex: 1 })
      ]
    ));
    const results = computeReferences("LibFn", true, svc);
    const paths = results.map((r) => r.filePath);
    expect(paths).toContain("/project/lib.asm");   // definition
    expect(paths).toContain("/project/main.asm");  // ref in main
    expect(paths).toContain("/project/lib.asm");   // ref in lib
  });

  // --- Case-insensitive lookup
  it("lookup is case-insensitive", () => {
    expect(computeReferences("mylabel", false, svc).length).toBe(2);
    expect(computeReferences("MYLABEL", false, svc).length).toBe(2);
  });

  // --- No references
  it("returns only definition for a symbol with no references", () => {
    svc.update(makeData([makeSym({ name: "Lone", line: 99 })], []));
    const withDecl = computeReferences("Lone", true, svc);
    expect(withDecl.length).toBe(1);
    expect(withDecl[0].line).toBe(99);
    const withoutDecl = computeReferences("Lone", false, svc);
    expect(withoutDecl.length).toBe(0);
  });

  // --- Unknown symbol
  it("returns empty array for unknown symbol", () => {
    expect(computeReferences("Unknown", false, svc)).toEqual([]);
    expect(computeReferences("Unknown", true, svc)).toEqual([]);
  });

  // --- Empty word
  it("returns empty array for empty word", () => {
    expect(computeReferences("", false, svc)).toEqual([]);
    expect(computeReferences("", true, svc)).toEqual([]);
  });

  // --- Does not mix references of different symbols
  it("does not include references for other symbols", () => {
    const results = computeReferences("MyLabel", false, svc);
    for (const r of results) {
      expect(r.line).not.toBe(30); // that's for "Other"
    }
  });
});
