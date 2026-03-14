import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { extractLanguageIntelData } from "@main/compiler-integration/extractIntelData";
import { KliveCompilerOutput } from "@abstractions/CompilerInfo";

/**
 * Tests for extractLanguageIntelData — the function that turns a compiled
 * AssemblerOutput into a plain, IPC-serialisable LanguageIntelData object.
 * Covers Step 2.2 of the Language Intelligence plan.
 */
describe("extractLanguageIntelData", async () => {
  // ---------------------------------------------------------------------------
  // sourceFiles
  // ---------------------------------------------------------------------------

  it("maps sourceFileList to { index, filename } entries", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile("; empty\n  nop\n");
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    expect(intel.sourceFiles.length).toBeGreaterThanOrEqual(1);
    expect(intel.sourceFiles[0]).toHaveProperty("index");
    expect(intel.sourceFiles[0]).toHaveProperty("filename");
  });

  // ---------------------------------------------------------------------------
  // symbolDefinitions — labels
  // ---------------------------------------------------------------------------

  it("includes a plain label in symbolDefinitions", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
Entry:
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const entry = intel.symbolDefinitions.find((s) => s.name === "entry");
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe("label");
    expect(entry!.line).toBe(3);
    expect(entry!.fileIndex).toBe(0);
  });

  it("includes a .equ constant as a label in symbolDefinitions with its value", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
CONST equ #1234
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const sym = intel.symbolDefinitions.find((s) => s.name === "const");
    expect(sym).toBeDefined();
    expect(sym!.value).toBe(0x1234);
    expect(sym!.description).toMatch(/1234/i);
  });

  it("includes a .var symbol with kind 'var'", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      Counter: .var 0
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const sym = intel.symbolDefinitions.find((s) => s.name === "counter");
    expect(sym).toBeDefined();
    expect(sym!.kind).toBe("var");
  });

  it("collects multiple labels from different lines", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
Alpha:
      nop
Beta:
      nop
Gamma:
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const names = intel.symbolDefinitions.map((s) => s.name);
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).toContain("gamma");
  });

  // ---------------------------------------------------------------------------
  // symbolDefinitions — macros and structs
  // ---------------------------------------------------------------------------

  it("includes a macro in symbolDefinitions with kind 'macro'", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
DoStuff: .macro()
      nop
      .endm
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const macro = intel.symbolDefinitions.find(
      (s) => s.name.toLowerCase() === "dostuff" && s.kind === "macro"
    );
    expect(macro).toBeDefined();
  });

  it("includes a struct in symbolDefinitions with kind 'struct'", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
Point:
  .struct
    X: .db 0
    Y: .db 0
  .ends
  nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const struct = intel.symbolDefinitions.find(
      (s) => s.name.toLowerCase() === "point" && s.kind === "struct"
    );
    expect(struct).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // symbolReferences
  // ---------------------------------------------------------------------------

  it("passes through symbolReferences from the compiler output", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
Target:
      nop
      jp target
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const refs = intel.symbolReferences.filter((r) => r.symbolName === "target");
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty symbolReferences when no references exist", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    expect(Array.isArray(intel.symbolReferences)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // documentOutline
  // ---------------------------------------------------------------------------

  it("includes a label entry in the documentOutline", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
OutlineLabel:
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const entry = intel.documentOutline.find((e) => e.name === "outlinelabel");
    expect(entry).toBeDefined();
    expect(entry!.line).toBe(3);
    expect(entry!.kind).toBe("label");
  });

  it("docOutline macro entry has firstLine <= endLine", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
DoStuff: .macro()
      nop
      .endm
      nop
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const macroEntry = intel.documentOutline.find(
      (e) => e.name.toLowerCase() === "dostuff"
    );
    expect(macroEntry).toBeDefined();
    expect(macroEntry!.line).toBeLessThanOrEqual(macroEntry!.endLine);
  });

  // ---------------------------------------------------------------------------
  // Nested module symbols
  // ---------------------------------------------------------------------------

  it("symbols in a module are qualified with the module name", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
MyMod: .module
LocalLabel:
      nop
      .endmodule
`);
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    const sym = intel.symbolDefinitions.find((s) =>
      s.name.includes("mymod") && s.name.includes("locallabel")
    );
    expect(sym).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Return shape
  // ---------------------------------------------------------------------------

  it("always returns all four required fields", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile("  nop\n");
    expect(output.errorCount).toBe(0);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    expect(Array.isArray(intel.symbolDefinitions)).toBe(true);
    expect(Array.isArray(intel.symbolReferences)).toBe(true);
    expect(Array.isArray(intel.documentOutline)).toBe(true);
    expect(Array.isArray(intel.sourceFiles)).toBe(true);
  });
});
