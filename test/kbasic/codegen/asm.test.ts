import { describe, expect, it } from "vitest";

import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { generateProgram } from "@main/kbasic/codegen";
import { runFrontEnd } from "@main/kbasic/KBasicCompiler";
import { defaultOptions } from "@main/kbasic/options/options";

import { runBasic } from "./run-kit";

/** Inline asm (Klive dialect): the compiler's names (plan §8.4), and errors at their BASIC lines. */
describe("inline asm", () => {
  it("reaches globals, labels and routines by their fixed names", async () => {
    const source = [
      "DIM x AS UByte",
      "DIM w AS UInteger",
      "FUNCTION three() AS UByte",
      " RETURN 3",
      "END FUNCTION",
      "ASM",
      "    call _three",
      "    add a,39",
      "    ld (_x),a",
      "    ld hl,_label.done",
      "    ld (_w),hl",
      "END ASM",
      "done:",
      "PRINT x; \" \"; w = @done",
      ""
    ].join("\n");
    const r = await runBasic(source);
    expect(r.screen(1)[0]).toBe("42 1");
  });

  it("reads a routine's parameters through IX", async () => {
    // --- The first parameter is at IX+4; a FUNCTION with no locals keeps its result at IX-2, and
    // --- falling off the end returns it
    const source = [
      "FUNCTION twice(a AS UInteger) AS UInteger",
      " ASM",
      "    ld l,(ix+4)",
      "    ld h,(ix+5)",
      "    add hl,hl",
      "    ld (ix-2),l",
      "    ld (ix-1),h",
      " END ASM",
      "END FUNCTION",
      "PRINT twice(21)",
      ""
    ].join("\n");
    expect((await runBasic(source)).screen(1)[0]).toBe("42");
  });

  it("reports an assembler error in the block at its own BASIC line (E503)", async () => {
    const source = "PRINT 1\nASM\n    nop\n    ld a,(no_such_label)\nEND ASM\n";
    const diagnostics = new DiagnosticBag();
    const front = runFrontEnd("/test/main.bas", source, { read: () => undefined }, { ...defaultOptions(), optimize: 0 }, diagnostics);
    const generated = await generateProgram(front.bound!, front.sources, front.options, "main", diagnostics);
    expect(generated).toBeUndefined();
    const errors = diagnostics.items.filter((d) => d.severity === "error");
    expect(errors.map((d) => d.code)).toEqual(["E503"]);
    const line = source.slice(0, errors[0].span.start).split("\n").length;
    expect(line).toBe(4);
  });
});
