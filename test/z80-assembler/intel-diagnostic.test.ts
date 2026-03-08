import { describe, it, expect } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { extractLanguageIntelData } from "@main/compiler-integration/extractIntelData";
import { KliveCompilerOutput } from "@abstractions/CompilerInfo";

/**
 * Diagnostic tests to verify:
 * 1. No duplicate symbol entries (label + macro) for macro names
 * 2. Macro hover shows correct kind and parameter info
 */
describe("intel-diagnostic: macro deduplication and info", () => {
  it("macro name appears exactly once in symbolDefinitions (not as both label and macro)", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
Delay: .macro(wait)
    ld b,{{wait}}
DelayLoop:
    djnz DelayLoop
    .endm
    nop
`);
    expect(output.errorCount).toBe(0);

    // Dump raw data for diagnostic
    const syms = Object.keys(output.symbols);
    const macros = Object.keys(output.macros);
    console.log("output.symbols keys:", syms);
    console.log("output.macros keys:", macros);
    console.log("output.symbols['delay']:", JSON.stringify(output.symbols["delay"], null, 2));
    console.log("output.macros['delay']:", JSON.stringify(output.macros["delay"], null, 2));

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    
    // Check there's exactly ONE entry for "delay"
    const delayEntries = intel.symbolDefinitions.filter(
      (s) => s.name.toLowerCase() === "delay"
    );
    console.log("delay entries in symbolDefinitions:", JSON.stringify(delayEntries, null, 2));
    
    expect(delayEntries.length).toBe(1);
    expect(delayEntries[0].kind).toBe("macro");
  });

  it("macro definition includes parameter names in description", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
RepeatLight: .macro(count, body)
    .loop {{count}}
        {{body}}
    .endl
    .endm
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const macro = intel.symbolDefinitions.find(
      (s) => s.name.toLowerCase() === "repeatlight"
    );
    
    console.log("RepeatLight entry:", JSON.stringify(macro, null, 2));
    
    expect(macro).toBeDefined();
    expect(macro!.kind).toBe("macro");
    expect(macro!.description).toContain("count");
    expect(macro!.description).toContain("body");
  });

  it("macro with no args has empty parens description", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
DoNothing: .macro()
    nop
    .endm
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const macro = intel.symbolDefinitions.find(
      (s) => s.name.toLowerCase() === "donothing"
    );
    
    console.log("DoNothing entry:", JSON.stringify(macro, null, 2));
    
    expect(macro).toBeDefined();
    expect(macro!.kind).toBe("macro");
    expect(macro!.description).toBe("()");
  });

  it("macro has correct fileIndex and line from the compiler", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
    nop
Delay: .macro(wait)
    ld b,{{wait}}
    .endm
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const macro = intel.symbolDefinitions.find(
      (s) => s.name.toLowerCase() === "delay"
    );
    
    console.log("Delay entry with location:", JSON.stringify(macro, null, 2));
    
    expect(macro).toBeDefined();
    expect(macro!.kind).toBe("macro");
    // The label "Delay:" and ".macro(wait)" are on line 3 (same line)
    expect(macro!.line).toBe(3);
    expect(macro!.fileIndex).toBe(0);
  });
});

describe("intel-diagnostic: macro references", () => {
  it("macro invocations are recorded as symbol references", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
Delay: .macro(wait)
    ld b,{{wait}}
DelayLoop:
    djnz DelayLoop
    .endm
    Delay(10)
    Delay(20)
    nop
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);

    // Filter references for "delay"
    const delayRefs = intel.symbolReferences.filter(
      (r) => r.symbolName === "delay"
    );
    console.log("delay symbolReferences:", JSON.stringify(delayRefs, null, 2));

    // Two invocations should produce two references
    expect(delayRefs.length).toBe(2);
    expect(delayRefs[0].line).toBe(7);
    expect(delayRefs[1].line).toBe(8);
  });

  it("single macro invocation produces one reference", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
MyMacro: .macro()
    nop
    .endm
    MyMacro()
`);
    expect(output.errorCount).toBe(0);

    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    const refs = intel.symbolReferences.filter(
      (r) => r.symbolName === "mymacro"
    );
    
    expect(refs.length).toBe(1);
    expect(refs[0].line).toBe(5);
  });
});
