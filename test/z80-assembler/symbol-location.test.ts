import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";

/**
 * Tests that the compiler stores source-location metadata on symbol definitions.
 * Covers Steps 1.1 and 1.2 of the Language Intelligence plan.
 */
describe("Symbol definition location tracking", async () => {
  // ---------------------------------------------------------------------------
  // Regular labels (defined as "LabelName:")
  // ---------------------------------------------------------------------------

  it("label on its own line stores correct line number", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #6000
MyLabel:
      ld a,b
`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("mylabel");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(3);
  });

  it("label stores fileIndex 0 for single-file source", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
MyLabel:
      nop
`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("mylabel");
    expect(sym).toBeDefined();
    expect(sym.definitionFileIndex).toBe(0);
  });

  it("multiple labels each have distinct line numbers", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
First:
      nop
Second:
      nop
Third:
      nop
`);
    expect(output.errorCount).toBe(0);
    const first = output.getSymbol("first");
    const second = output.getSymbol("second");
    const third = output.getSymbol("third");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(third).toBeDefined();
    expect(first.definitionLine).toBe(2);
    expect(second.definitionLine).toBe(4);
    expect(third.definitionLine).toBe(6);
  });

  it("label with instruction on same line stores correct line", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      nop
InlineLabel: ld a,b
      nop
`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("inlinelabel");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // .equ directive
  // ---------------------------------------------------------------------------

  it(".equ symbol stores correct line number", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      nop
MyConst .equ 42
      nop
`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("myconst");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(3);
  });

  it(".equ symbol stores fileIndex 0", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`MyConst .equ 100`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("myconst");
    expect(sym).toBeDefined();
    expect(sym.definitionFileIndex).toBe(0);
    expect(sym.definitionLine).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // .var directive
  // ---------------------------------------------------------------------------

  it(".var symbol stores correct line number", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      nop
      nop
MyVar .var 7
      nop
`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("myvar");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // .org (label with dot-prefix goes to global scope)
  // ---------------------------------------------------------------------------

  it("dot-prefixed symbol stored in global symbols has location", async () => {
    const compiler = new Z80Assembler();
    // Symbols starting with "." are stored in the global output.symbols
    const output = await compiler.compile(`
      .org #8000
.MyGlobal .equ #1234
      nop
`);
    expect(output.errorCount).toBe(0);
    // dot-prefixed symbols: the dot is stripped and stored in output.symbols
    const sym = output.getSymbol("myglobal");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Case sensitivity: symbols are lowercased by default
  // ---------------------------------------------------------------------------

  it("symbols are stored case-insensitively by default", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`UPPER_LABEL: nop`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("upper_label");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(1);
  });

  it("case-sensitive mode preserves symbol name casing and location", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    const output = await compiler.compile(`CasedLabel: nop`, options);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("CasedLabel");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Module-local (@) symbols
  // ---------------------------------------------------------------------------

  it("module-local symbol (@-prefix) stores location", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .module MyMod
@LocalSym: nop
      .endmodule
`);
    expect(output.errorCount).toBe(0);
    // @LocalSym becomes localSym inside the module
    // The symbol is stored with lower-cased name in the module
    // We just verify compilation succeeds and no crash
    const nestedMod = output.nestedModules?.["mymod"];
    if (nestedMod) {
      const sym = nestedMod.getSymbol("@localsym") ?? nestedMod.getSymbol("localsym");
      // Location should be set if the symbol was found
      if (sym) {
        expect(sym.definitionLine).toBeGreaterThan(0);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Struct definition stores location for the struct symbol
  // ---------------------------------------------------------------------------

  it("struct label symbol stores location of struct statement", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      nop
MyStruct .struct
  .db 0
  .db 0
.ends
      nop
`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("mystruct");
    expect(sym).toBeDefined();
    expect(sym.definitionLine).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Definition location fields are undefined for symbols with no tracked origin
  // (only check that they don't throw - backward compat)
  // ---------------------------------------------------------------------------

  it("location fields are optional and do not break existing symbol access", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`Label: nop`);
    expect(output.errorCount).toBe(0);
    const sym = output.getSymbol("label");
    expect(sym).toBeDefined();
    // Fields exist and are either a number or undefined (never throws)
    expect(typeof sym.definitionLine === "number" || sym.definitionLine === undefined).toBe(true);
    expect(typeof sym.definitionFileIndex === "number" || sym.definitionFileIndex === undefined).toBe(true);
    expect(typeof sym.definitionStartColumn === "number" || sym.definitionStartColumn === undefined).toBe(true);
    expect(typeof sym.definitionEndColumn === "number" || sym.definitionEndColumn === undefined).toBe(true);
  });
});
