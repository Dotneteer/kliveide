import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeDefinition } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData, SymbolDefinitionInfo } from "@abstractions/CompilerInfo";

function makeSym(partial: Partial<SymbolDefinitionInfo> & { name: string }): SymbolDefinitionInfo {
  return {
    kind: "label",
    fileIndex: 0,
    line: 10,
    startColumn: 0,
    endColumn: partial.name.length,
    ...partial
  };
}

function makeData(syms: SymbolDefinitionInfo[] = []): LanguageIntelData {
  return {
    symbolDefinitions: syms,
    symbolReferences: [],
    documentOutline: [],
    sourceFiles: [
      { index: 0, filename: "/project/main.asm" },
      { index: 1, filename: "/project/lib.asm" }
    ]
  };
}

describe("computeDefinition", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
    svc.update(makeData([
      makeSym({ name: "Entry",     line: 5,  startColumn: 0,  endColumn: 5 }),
      makeSym({ name: "Helper",    line: 30, startColumn: 0,  endColumn: 6, fileIndex: 1 }),
      makeSym({ name: "MAXVAL",    kind: "equ", line: 2, startColumn: 0, endColumn: 6 }),
      makeSym({ name: "PointType", kind: "struct", line: 8 }),
    ]));
  });

  // --- Basic: found in same file
  it("returns a definition for a known label in fileIndex 0", () => {
    const result = computeDefinition("Entry", svc);
    expect(result).not.toBeNull();
    expect(result!.filePath).toBe("/project/main.asm");
    expect(result!.line).toBe(5);
  });

  it("includes startColumn and endColumn in result", () => {
    const result = computeDefinition("Entry", svc)!;
    expect(result.startColumn).toBe(0);
    expect(result.endColumn).toBe(5);
  });

  // --- Cross-file symbol
  it("resolves to the correct file path for a symbol in fileIndex 1", () => {
    const result = computeDefinition("Helper", svc);
    expect(result).not.toBeNull();
    expect(result!.filePath).toBe("/project/lib.asm");
    expect(result!.line).toBe(30);
  });

  // --- Case-insensitive lookup
  it("lookup is case-insensitive", () => {
    expect(computeDefinition("ENTRY", svc)).not.toBeNull();
    expect(computeDefinition("entry", svc)).not.toBeNull();
    expect(computeDefinition("Entry", svc)).not.toBeNull();
  });

  // --- .equ and struct symbols have definitions too
  it("returns a definition for an .equ symbol", () => {
    const result = computeDefinition("MAXVAL", svc);
    expect(result).not.toBeNull();
    expect(result!.filePath).toBe("/project/main.asm");
  });

  it("returns a definition for a struct", () => {
    const result = computeDefinition("PointType", svc);
    expect(result).not.toBeNull();
  });

  // --- Should return null for unknowns, instructions, and registers
  it("returns null for an unknown word", () => {
    expect(computeDefinition("NonExistent", svc)).toBeNull();
  });

  it("returns null for an instruction mnemonic", () => {
    expect(computeDefinition("nop", svc)).toBeNull();
    expect(computeDefinition("ld", svc)).toBeNull();
    expect(computeDefinition("call", svc)).toBeNull();
  });

  it("returns null for a register name", () => {
    expect(computeDefinition("a", svc)).toBeNull();
    expect(computeDefinition("hl", svc)).toBeNull();
    expect(computeDefinition("ix", svc)).toBeNull();
  });

  it("returns null for empty word", () => {
    expect(computeDefinition("", svc)).toBeNull();
  });
});
