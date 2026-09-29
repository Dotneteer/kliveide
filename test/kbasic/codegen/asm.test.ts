import { describe, expect, it } from "vitest";

import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { generateProgram } from "@main/kbasic/codegen";
import { runFrontEnd } from "@main/kbasic/KBasicCompiler";
import { defaultOptions } from "@main/kbasic/options/options";

import { runBasic } from "./run-kit";

/** Inline asm: the compiler's names (plan §8.4), zxbc's register contracts, and errors at their BASIC lines. */
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

  it("gives a FASTCALL asm body the parameter in registers, with no frame (compatibility plan C5)", async () => {
    // --- zxbc's frameless FASTCALL: the asm pops the return address and the stack parameter itself
    const source = [
      "FUNCTION FASTCALL add(a AS UByte, b AS UByte) AS UByte",
      " ASM",
      "    pop hl",
      "    ld e,a",
      "    pop af",
      "    add a,e",
      "    push hl",
      " END ASM",
      "END FUNCTION",
      "FUNCTION FASTCALL pick(a AS UByte) AS UByte",
      " ASM",
      "    or a : jr z,1f",
      "    ld a,5 : ret",
      "1:  ld a,7",
      " END ASM",
      "END FUNCTION",
      "PRINT add(30, 12); \" \"; pick(0); pick(1)",
      ""
    ].join("\n");
    const r = await runBasic(source);
    expect(r.screen(1)[0]).toBe("42 75");
    expect(r.generated.mir.functions.filter((f) => f.naked).map((f) => f.name)).toEqual(["add", "pick"]);
  });

  it("returns what the registers hold when a FUNCTION ends with asm", async () => {
    const source = [
      "FUNCTION word(a AS UInteger) AS UInteger",
      " ASM",
      "    ld l,(ix+4)",
      "    ld h,(ix+5)",
      "    add hl,hl",
      " END ASM",
      "END FUNCTION",
      "FUNCTION half() AS Float",
      " ASM",
      "    ld a,$80 : ld e,0 : ld d,0 : ld c,0 : ld b,0",
      " END ASM",
      "END FUNCTION",
      "PRINT word(1234); \" \"; half()",
      ""
    ].join("\n");
    expect((await runBasic(source)).screen(1)[0]).toBe("2468 0.5");
  });

  it("keeps Klive's own dialect under '#pragma asm_dialect = klive'", async () => {
    const source = ["#pragma asm_dialect = klive", "DIM x AS UInteger", "ASM", "    ld hl,[2+3]*4", "    ld (_x),hl", "END ASM", "PRINT x", ""].join("\n");
    expect((await runBasic(source)).screen(1)[0]).toBe("20");
  });
});
