import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { extractLanguageIntelData } from "@main/compiler-integration/extractIntelData";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";

/*
 * The assembler's `.proc`/`.endp` extents (`.plans/PROFILER_PLAN.md` D7): the profiler's routine
 * source after Klive BASIC callables (D6), and the editor outline's "proc" entries.
 */

async function compile(source: string) {
  const output = await new Z80Assembler().compile(source);
  expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  return output;
}

describe("the assembler's procedure extents", () => {
  it("records a labelled procedure's name, addresses and lines", async () => {
    const output = await compile(`
      .org $8000
Main:   call Print
        ret
Print:  .proc
        ld a,1
Loop:   dec a
        jr nz,Loop
        ret
        .endp
After:  nop
`);
    expect(output.procedures).toEqual([
      { name: "Print", startAddress: 0x8004, endAddress: 0x800a, segmentIndex: 0, fileIndex: 0, startLine: 5, endLine: 10 }
    ]);
  });

  it("names a procedure after the label on the line before it, or the last global label", async () => {
    const output = await compile(`
      .org $8000
Hanging:
        .proc
        nop
        .endp
Owner:  nop
        .proc
        ret
        .endp
`);
    expect(output.procedures.map((p) => [p.name, p.startAddress, p.endAddress])).toEqual([
      ["Hanging", 0x8000, 0x8001],
      ["Owner", 0x8002, 0x8003]
    ]);
  });

  it("dots a nested procedure's name with its outer one's", async () => {
    const output = await compile(`
      .org $8000
Outer:  .proc
        call Inner
        ret
Inner:  .proc
        nop
        ret
        .endp
        .endp
`);
    expect(output.procedures.map((p) => [p.name, p.startAddress, p.endAddress])).toEqual([
      ["Outer.Inner", 0x8004, 0x8006],
      ["Outer", 0x8000, 0x8006]
    ]);
  });

  it("prefixes a procedure in a module with the module's path", async () => {
    const output = await compile(`
      .org $8000
Gfx:    .module
Plot:   .proc
        ret
        .endp
        .endmodule
`);
    // --- Module names are case-insensitive, kept lower-case, as the outline shows them
    expect(output.procedures.map((p) => p.name)).toEqual(["gfx.Plot"]);
  });

  it("records the segment of a banked procedure", async () => {
    const output = await compile(`
      .model next
      .org $8000
        nop
      .bank 5
Banked: .proc
        nop
        ret
        .endp
`);
    const proc = output.procedures[0];
    expect(proc.name).toBe("Banked");
    expect(output.segments[proc.segmentIndex].bank).toBe(5);
    expect(proc.startAddress).toBe(0xc000);
  });

  it("skips a procedure that emits nothing", async () => {
    const output = await compile(`
Empty:  .proc
        .endp
`);
    expect(output.procedures).toEqual([]);
  });

  it("puts procedures into the document outline", async () => {
    const output = await compile(`
      .org $8000
Print:  .proc
        ret
        .endp
`);
    const intel = extractLanguageIntelData(output as unknown as KliveCompilerOutput);
    expect(intel.documentOutline).toContainEqual(
      expect.objectContaining({ name: "Print", kind: "proc", fileIndex: 0, line: 3, endLine: 5 })
    );
  });
});
