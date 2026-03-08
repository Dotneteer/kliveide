import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import type { LanguageIntelData, SymbolDefinitionInfo, SymbolReferenceInfo, DocumentOutlineEntry } from "@abstractions/CompilerInfo";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSym(partial: Partial<SymbolDefinitionInfo> & { name: string }): SymbolDefinitionInfo {
  return {
    kind: "label",
    fileIndex: 0,
    line: 1,
    startColumn: 0,
    endColumn: 8,
    ...partial
  };
}

function makeRef(partial: Partial<SymbolReferenceInfo> & { symbolName: string }): SymbolReferenceInfo {
  return {
    fileIndex: 0,
    line: 5,
    startColumn: 6,
    endColumn: 14,
    ...partial
  };
}

function makeOutlineEntry(partial: Partial<DocumentOutlineEntry> & { name: string }): DocumentOutlineEntry {
  return {
    kind: "label",
    fileIndex: 0,
    line: 1,
    endLine: 1,
    children: [],
    ...partial
  };
}

function makeIntelData(overrides: Partial<LanguageIntelData> = {}): LanguageIntelData {
  return {
    symbolDefinitions: [],
    symbolReferences: [],
    documentOutline: [],
    sourceFiles: [],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LanguageIntelService", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
  });

  // -------------------------------------------------------------------------
  // Initial / empty state
  // -------------------------------------------------------------------------

  it("returns null for unknown symbol definition", () => {
    svc.update(makeIntelData());
    expect(svc.getSymbolDefinition("Anything")).toBeNull();
  });

  it("returns empty array for unknown symbol references", () => {
    svc.update(makeIntelData());
    expect(svc.getSymbolReferences("Anything")).toEqual([]);
  });

  it("returns empty array for outline of unknown file", () => {
    svc.update(makeIntelData());
    expect(svc.getDocumentOutline(0)).toEqual([]);
  });

  it("returns undefined for path of unknown fileIndex", () => {
    svc.update(makeIntelData());
    expect(svc.getFilePath(0)).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // update() — symbol definitions
  // -------------------------------------------------------------------------

  it("finds a symbol by exact name after update", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "MyLabel", line: 3 })]
    }));
    const sym = svc.getSymbolDefinition("MyLabel");
    expect(sym).not.toBeNull();
    expect(sym!.name).toBe("MyLabel");
  });

  it("lookup is case-insensitive", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "myLabel" })]
    }));
    expect(svc.getSymbolDefinition("MYLABEL")).not.toBeNull();
    expect(svc.getSymbolDefinition("mylabel")).not.toBeNull();
    expect(svc.getSymbolDefinition("MyLabel")).not.toBeNull();
  });

  it("update() replaces previous index completely", () => {
    svc.update(makeIntelData({ symbolDefinitions: [makeSym({ name: "OldLabel" })] }));
    svc.update(makeIntelData({ symbolDefinitions: [makeSym({ name: "NewLabel" })] }));
    expect(svc.getSymbolDefinition("OldLabel")).toBeNull();
    expect(svc.getSymbolDefinition("NewLabel")).not.toBeNull();
  });

  it("stores the correct line number", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "Entry", line: 42 })]
    }));
    expect(svc.getSymbolDefinition("entry")!.line).toBe(42);
  });

  it("stores the correct kind", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [
        makeSym({ name: "Lbl", kind: "label" }),
        makeSym({ name: "V", kind: "var" })
      ]
    }));
    expect(svc.getSymbolDefinition("lbl")!.kind).toBe("label");
    expect(svc.getSymbolDefinition("v")!.kind).toBe("var");
  });

  it("stores optional value / description fields", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "SCREEN", value: 0x4000, description: "= $4000" })]
    }));
    const sym = svc.getSymbolDefinition("screen")!;
    expect(sym.value).toBe(0x4000);
    expect(sym.description).toBe("= $4000");
  });

  // -------------------------------------------------------------------------
  // getCompletionCandidates()
  // -------------------------------------------------------------------------

  it("returns symbols matching the given prefix", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [
        makeSym({ name: "MyLabel" }),
        makeSym({ name: "MyMacro" }),
        makeSym({ name: "Other" })
      ]
    }));
    const results = svc.getCompletionCandidates("my");
    const names = results.map((s) => s.name.toLowerCase());
    expect(names).toContain("mylabel");
    expect(names).toContain("mymacro");
    expect(names).not.toContain("other");
  });

  it("returns all symbols for empty prefix", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "A" }), makeSym({ name: "B" })]
    }));
    expect(svc.getCompletionCandidates("").length).toBe(2);
  });

  it("returns empty array when no symbol matches prefix", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "Alpha" })]
    }));
    expect(svc.getCompletionCandidates("Z")).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // getSymbolAtPosition()
  // -------------------------------------------------------------------------

  it("returns symbol when position is within its column range", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "Lbl", fileIndex: 0, line: 5, startColumn: 6, endColumn: 9 })]
    }));
    expect(svc.getSymbolAtPosition(0, 5, 7)).not.toBeNull();
  });

  it("returns null when line does not match", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "Lbl", fileIndex: 0, line: 5, startColumn: 0, endColumn: 9 })]
    }));
    expect(svc.getSymbolAtPosition(0, 99, 5)).toBeNull();
  });

  it("returns null when column is outside the range", () => {
    svc.update(makeIntelData({
      symbolDefinitions: [makeSym({ name: "Lbl", fileIndex: 0, line: 5, startColumn: 4, endColumn: 7 })]
    }));
    expect(svc.getSymbolAtPosition(0, 5, 1)).toBeNull();
    expect(svc.getSymbolAtPosition(0, 5, 10)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // getSymbolReferences()
  // -------------------------------------------------------------------------

  it("returns references for a known symbol", () => {
    svc.update(makeIntelData({
      symbolReferences: [
        makeRef({ symbolName: "Target", line: 10 }),
        makeRef({ symbolName: "Target", line: 20 })
      ]
    }));
    const refs = svc.getSymbolReferences("target");
    expect(refs.length).toBe(2);
  });

  it("reference lookup is case-insensitive", () => {
    svc.update(makeIntelData({
      symbolReferences: [makeRef({ symbolName: "target" })]
    }));
    expect(svc.getSymbolReferences("TARGET").length).toBe(1);
  });

  it("does not mix references from different symbols", () => {
    svc.update(makeIntelData({
      symbolReferences: [
        makeRef({ symbolName: "Alpha" }),
        makeRef({ symbolName: "Beta" })
      ]
    }));
    expect(svc.getSymbolReferences("alpha").length).toBe(1);
    expect(svc.getSymbolReferences("beta").length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // getDocumentOutline()
  // -------------------------------------------------------------------------

  it("returns outline entries for a known file", () => {
    svc.update(makeIntelData({
      documentOutline: [
        makeOutlineEntry({ name: "Main", fileIndex: 0 }),
        makeOutlineEntry({ name: "Loop", fileIndex: 0 })
      ]
    }));
    expect(svc.getDocumentOutline(0).length).toBe(2);
  });

  it("does not mix outline entries from different files", () => {
    svc.update(makeIntelData({
      documentOutline: [
        makeOutlineEntry({ name: "InFile0", fileIndex: 0 }),
        makeOutlineEntry({ name: "InFile1", fileIndex: 1 })
      ]
    }));
    expect(svc.getDocumentOutline(0).length).toBe(1);
    expect(svc.getDocumentOutline(1).length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // File path / index mapping
  // -------------------------------------------------------------------------

  it("maps file index to path after update", () => {
    svc.update(makeIntelData({
      sourceFiles: [{ index: 0, filename: "/project/main.asm" }]
    }));
    expect(svc.getFilePath(0)).toBe("/project/main.asm");
  });

  it("maps file path to index after update", () => {
    svc.update(makeIntelData({
      sourceFiles: [{ index: 2, filename: "/project/lib.asm" }]
    }));
    expect(svc.getFileIndex("/project/lib.asm")).toBe(2);
  });

  it("handles multiple source files", () => {
    svc.update(makeIntelData({
      sourceFiles: [
        { index: 0, filename: "/a.asm" },
        { index: 1, filename: "/b.asm" }
      ]
    }));
    expect(svc.getFilePath(0)).toBe("/a.asm");
    expect(svc.getFilePath(1)).toBe("/b.asm");
    expect(svc.getFileIndex("/a.asm")).toBe(0);
    expect(svc.getFileIndex("/b.asm")).toBe(1);
  });
});
