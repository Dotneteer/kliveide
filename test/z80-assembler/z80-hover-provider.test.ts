import { describe, it, expect, beforeEach } from "vitest";
import { LanguageIntelService } from "@renderer/appIde/services/LanguageIntelService";
import { computeHover } from "@renderer/appIde/services/z80-providers";
import type { LanguageIntelData, SymbolDefinitionInfo } from "@abstractions/CompilerInfo";

function makeSym(partial: Partial<SymbolDefinitionInfo> & { name: string }): SymbolDefinitionInfo {
  return { kind: "label", fileIndex: 0, line: 10, startColumn: 0, endColumn: partial.name.length, ...partial };
}

function makeData(syms: SymbolDefinitionInfo[] = []): LanguageIntelData {
  return {
    symbolDefinitions: syms,
    symbolReferences: [],
    documentOutline: [],
    sourceFiles: [{ index: 0, filename: "/project/main.asm" }]
  };
}

describe("computeHover", () => {
  let svc: LanguageIntelService;

  beforeEach(() => {
    svc = new LanguageIntelService();
    svc.update(makeData([
      makeSym({ name: "Entry",  kind: "label", line: 5 }),
      makeSym({ name: "MAXVAL", kind: "equ",   line: 2, value: 255, description: "= $FF" }),
      makeSym({ name: "NextMacro", kind: "macro", line: 20 }),
    ]));
  });

  // --- Empty / whitespace
  it("returns null for empty word", () => {
    expect(computeHover("", svc)).toBeNull();
  });

  // --- Instructions
  it("returns hover for a known instruction mnemonic", () => {
    const result = computeHover("nop", svc);
    expect(result).not.toBeNull();
    expect(result!.contents.length).toBeGreaterThanOrEqual(1);
    expect(result!.contents.join("\n")).toMatch(/nop/i);
  });

  it("instruction hover is case-insensitive", () => {
    expect(computeHover("NOP", svc)).not.toBeNull();
    expect(computeHover("Ld", svc)).not.toBeNull();
  });

  it("instruction hover contents include the description", () => {
    const result = computeHover("ld", svc)!;
    const text = result.contents.join("\n");
    expect(text).toMatch(/load|move/i);
  });

  it("Next instruction hover mentions ZX Spectrum Next", () => {
    const result = computeHover("nextreg", svc)!;
    const text = result.contents.join("\n");
    expect(text).toMatch(/next/i);
  });

  // --- Registers
  it("returns hover for a known register", () => {
    const result = computeHover("hl", svc);
    expect(result).not.toBeNull();
    expect(result!.contents.join("\n")).toMatch(/register/i);
  });

  it("register hover is case-insensitive", () => {
    expect(computeHover("A", svc)).not.toBeNull();
    expect(computeHover("SP", svc)).not.toBeNull();
  });

  it("register hover contents include the description", () => {
    const result = computeHover("a", svc)!;
    const text = result.contents.join("\n");
    expect(text).toMatch(/accumulator/i);
  });

  // --- Compiled symbols
  it("returns hover for a compiled symbol", () => {
    const result = computeHover("Entry", svc);
    expect(result).not.toBeNull();
    const text = result!.contents.join("\n");
    expect(text).toContain("Entry");
  });

  it("symbol hover mentions the kind", () => {
    const result = computeHover("Entry", svc)!;
    const text = result.contents.join("\n");
    expect(text).toMatch(/label/i);
  });

  it("symbol hover mentions the source file path", () => {
    const result = computeHover("Entry", svc)!;
    const text = result.contents.join("\n");
    expect(text).toContain("main.asm");
  });

  it("symbol hover mentions the definition line", () => {
    const result = computeHover("Entry", svc)!;
    const text = result.contents.join("\n");
    expect(text).toContain("5");
  });

  it("symbol with a description includes that description in hover", () => {
    const result = computeHover("MAXVAL", svc)!;
    const text = result.contents.join("\n");
    expect(text).toContain("$FF");
  });

  // --- Unknown word
  it("returns null for an unknown non-instruction word", () => {
    expect(computeHover("UnknownXyz", svc)).toBeNull();
  });
});
