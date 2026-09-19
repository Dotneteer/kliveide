import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

/*
 * A warning is reported in `output.errors` with `isWarning` set, but it must not fail the
 * compilation: the code is still emitted and `errorCount` counts errors only.
 *
 * The one warning the Z80 assembler reports is Z0370: unbanked code above $BFFF under `.model Next`.
 * It used to be reported as Z0904 (the "module with a temporary name" message), and because
 * `errorCount` included warnings, the parse, emit and fixup steps treated it as a failure and the
 * output had no segments at all.
 */

async function compile(source: string, model?: number) {
  const options = new AssemblerOptions();
  if (model !== undefined) options.currentModel = model;
  return new Z80Assembler().compile(source, options);
}

const NEXT = 4;
const RANGE_MESSAGE =
  "Unbanked code address $C000 exceeds typical bank 2 range ($8000-$bfff). This will create a gap in bank 2 when exporting to NEX. Consider using explicit .bank for separate bank layout.";

describe("Assembler warnings", () => {
  it("code above $BFFF under .model Next is emitted and reports Z0370", async () => {
    const output = await compile("  .model Next\n .org $8000\n nop\n .org $c000\n nop\n", NEXT);

    expect(output.errors).toHaveLength(1);
    expect(output.errors[0].errorCode).toBe("Z0370");
    expect(output.errors[0].isWarning).toBe(true);
    expect(output.errors[0].message).toBe(RANGE_MESSAGE);
    expect(output.errorCount).toBe(0);

    const segments = output.segments.map((s) => [s.startAddress, Array.from(s.emittedCode)]);
    expect(segments).toEqual([
      [0x8000, [0x00]],
      [0xc000, [0x00]]
    ]);
  });

  it("the warning is reported once per segment, on the line that crosses $BFFF", async () => {
    const output = await compile(
      `
        .model Next
        .org $bffe
        nop
        nop
        nop
        nop
      `,
      NEXT
    );
    expect(output.errors.map((e) => [e.errorCode, e.line])).toEqual([["Z0370", 6]]);
    expect(Array.from(output.segments[0].emittedCode)).toEqual([0, 0, 0, 0]);
  });

  it("a warning does not stop forward references from being fixed up", async () => {
    // --- Labels used before they are defined are resolved in the fixup step, which also used to
    // --- give up on a warning.
    const output = await compile(
      `
        .model Next
        .org $c000
        ld hl,Data
        jp Done
Data:   .defb $11,$22
Done:   ret
      `,
      NEXT
    );
    expect(output.errorCount).toBe(0);
    expect(output.errors.every((e) => e.isWarning)).toBe(true);
    expect(Array.from(output.segments[0].emittedCode)).toEqual([
      0x21, 0x06, 0xc0, // ld hl,$C006
      0xc3, 0x08, 0xc0, // jp $C008
      0x11, 0x22,
      0xc9
    ]);
  });

  it("errorCount counts the errors next to a warning, and the errors still fail the compilation", async () => {
    const output = await compile("  .model Next\n .org $c000\n nop\n ld a,Undefined\n", NEXT);
    expect(output.errors.some((e) => e.isWarning && e.errorCode === "Z0370")).toBe(true);
    expect(output.errors.filter((e) => !e.isWarning).length).toBeGreaterThan(0);
    expect(output.errorCount).toBe(output.errors.filter((e) => !e.isWarning).length);
  });

  it("the same code without .model Next reports nothing", async () => {
    const output = await compile(" .org $8000\n nop\n .org $c000\n nop\n");
    expect(output.errors).toHaveLength(0);
    expect(output.segments.map((s) => s.startAddress)).toEqual([0x8000, 0xc000]);
  });

  it("a syntax error inside an expanded macro body is an error, not a warning", async () => {
    // --- It used to be created with isWarning = true, which the IDE's error count ignores
    const output = await compile(`
    erd .macro(arg)
    mamc({{arg}})
    .endm

    mamc .macro (sdds)
    .if isreg8({{sdds}})
    .endif
    .endm

    erd("(af)")
    `);
    expect(output.errors.map((e) => [e.errorCode, !!e.isWarning])).toEqual([
      ["Z1012", false],
      ["Z0111", false]
    ]);
    expect(output.errorCount).toBe(2);
  });

  it("Z0902 is again the message for a module with a temporary name", async () => {
    const output = await compile(" .org $6000\n .module `MyModule\n ld a,b\n .endmodule\n");
    expect(output.errors[0].errorCode).toBe("Z0902");
    expect(output.errors[0].message).toBe("You cannot define a module with a temporary name (`MyModule).");
  });
});
