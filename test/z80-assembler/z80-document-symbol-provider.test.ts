import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeDocumentSymbols, SK } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData, DocumentOutlineEntry } from "@abstractions/CompilerInfo";

function makeEntry(partial: Partial<DocumentOutlineEntry> & { name: string }): DocumentOutlineEntry {
  return {
    kind: "label",
    fileIndex: 0,
    line: 1,
    endLine: 1,
    children: [],
    ...partial
  };
}

function makeData(outline: DocumentOutlineEntry[] = []): LanguageIntelData {
  return {
    symbolDefinitions: [],
    symbolReferences: [],
    documentOutline: outline,
    sourceFiles: [{ index: 0, filename: "/project/main.asm" }]
  };
}

describe("computeDocumentSymbols", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
  });

  // --- Empty outline
  it("returns empty array when there are no outline entries", () => {
    svc.update(makeData([]));
    expect(computeDocumentSymbols(0, svc)).toEqual([]);
  });

  it("returns empty array for an unknown fileIndex", () => {
    svc.update(makeData([makeEntry({ name: "Main", fileIndex: 0 })]));
    expect(computeDocumentSymbols(99, svc)).toEqual([]);
  });

  // --- Basic shapes
  it("returns one symbol per top-level outline entry", () => {
    svc.update(makeData([
      makeEntry({ name: "Init",  fileIndex: 0, line: 5 }),
      makeEntry({ name: "Clear", fileIndex: 0, line: 10 })
    ]));
    expect(computeDocumentSymbols(0, svc).length).toBe(2);
  });

  it("preserves the name of outline entries", () => {
    svc.update(makeData([makeEntry({ name: "Main", fileIndex: 0 })]));
    const syms = computeDocumentSymbols(0, svc);
    expect(syms[0].name).toBe("Main");
  });

  it("preserves line and endLine numbers", () => {
    svc.update(makeData([makeEntry({ name: "Main", fileIndex: 0, line: 7, endLine: 20 })]));
    const sym = computeDocumentSymbols(0, svc)[0];
    expect(sym.line).toBe(7);
    expect(sym.endLine).toBe(20);
  });

  // --- Kind mapping
  it("label entries map to Function kind", () => {
    svc.update(makeData([makeEntry({ name: "Lbl", kind: "label", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Function);
  });

  it("var entries map to Variable kind", () => {
    svc.update(makeData([makeEntry({ name: "V", kind: "var", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Variable);
  });

  it("equ entries map to Constant kind", () => {
    svc.update(makeData([makeEntry({ name: "C", kind: "equ", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Constant);
  });

  it("macro entries map to Function kind", () => {
    svc.update(makeData([makeEntry({ name: "M", kind: "macro", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Function);
  });

  it("struct entries map to Struct kind", () => {
    svc.update(makeData([makeEntry({ name: "S", kind: "struct", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Struct);
  });

  it("module entries map to Module kind", () => {
    svc.update(makeData([makeEntry({ name: "Mod", kind: "module", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Module);
  });

  it("proc entries map to Function kind", () => {
    svc.update(makeData([makeEntry({ name: "P", kind: "proc", fileIndex: 0 })]));
    expect(computeDocumentSymbols(0, svc)[0].kind).toBe(SK.Function);
  });

  // --- Hierarchical children
  it("nested children are preserved in the result", () => {
    svc.update(makeData([
      makeEntry({
        name: "Utils",
        kind: "module",
        fileIndex: 0,
        line: 1,
        endLine: 30,
        children: [
          makeEntry({ name: "Init",  fileIndex: 0, line: 3 }),
          makeEntry({ name: "Clear", fileIndex: 0, line: 8 })
        ]
      })
    ]));
    const syms = computeDocumentSymbols(0, svc);
    expect(syms.length).toBe(1);
    expect(syms[0].name).toBe("Utils");
    expect(syms[0].children.length).toBe(2);
  });

  it("children have correct names and kinds", () => {
    svc.update(makeData([
      makeEntry({
        name: "Utils",
        kind: "module",
        fileIndex: 0,
        children: [
          makeEntry({ name: "Init",  kind: "label",  fileIndex: 0 }),
          makeEntry({ name: "Point", kind: "struct", fileIndex: 0 })
        ]
      })
    ]));
    const children = computeDocumentSymbols(0, svc)[0].children;
    expect(children[0].name).toBe("Init");
    expect(children[0].kind).toBe(SK.Function);
    expect(children[1].name).toBe("Point");
    expect(children[1].kind).toBe(SK.Struct);
  });

  it("deeply nested children are handled recursively", () => {
    svc.update(makeData([
      makeEntry({
        name: "Outer",
        kind: "module",
        fileIndex: 0,
        children: [
          makeEntry({
            name: "Inner",
            kind: "proc",
            fileIndex: 0,
            children: [
              makeEntry({ name: "Deepest", kind: "label", fileIndex: 0 })
            ]
          })
        ]
      })
    ]));
    const outer = computeDocumentSymbols(0, svc)[0];
    const inner = outer.children[0];
    expect(inner.name).toBe("Inner");
    expect(inner.children[0].name).toBe("Deepest");
  });

  // --- File isolation
  it("only returns symbols for the requested fileIndex", () => {
    svc.update(makeData([
      makeEntry({ name: "InFile0", fileIndex: 0 }),
      makeEntry({ name: "InFile1", fileIndex: 1 })
    ]));
    const syms0 = computeDocumentSymbols(0, svc);
    const syms1 = computeDocumentSymbols(1, svc);
    expect(syms0.map((s) => s.name)).toContain("InFile0");
    expect(syms0.map((s) => s.name)).not.toContain("InFile1");
    expect(syms1.map((s) => s.name)).toContain("InFile1");
    expect(syms1.map((s) => s.name)).not.toContain("InFile0");
  });
});
