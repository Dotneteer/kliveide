import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { ExpressionValueType } from "@abstractions/CompilerInfo";
import { ExpressionValue } from "@main/compiler-common/expressions";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { relativeJumpDistance } from "@main/z80-compiler/z80-assembler";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";
import { testCodeEmit, testFlexibleCodeEmit } from "./test-helpers";

/**
 * Regression tests for the bugs the 2026-11-28 code review of the assembler found
 * (`dev/plans/ASSEMBLER_CPU_NEUTRAL_PLAN.md`, step 5)
 */
async function compile(source: string) {
  return await new Z80Assembler().compile(source);
}
const codes = (output: { errors: { errorCode: string }[] }) => output.errors.map((e) => e.errorCode);

describe("Assembler review fixes - index displacement", () => {
  it("a forward-referenced negative displacement keeps its sign", async () => {
    await testCodeEmit("ld a,(ix-Fwd)\nFwd .equ 3", 0xdd, 0x7e, 0xfd);
  });

  it("a forward-referenced negative displacement of a bit operation keeps its sign", async () => {
    await testCodeEmit("bit 1,(iy-Fwd)\nFwd .equ 2", 0xfd, 0xcb, 0xfe, 0x4e);
  });

  it("a displacement out of -128..127 is an error", async () => {
    expect(codes(await compile("ld a,(ix+200)"))).toEqual(["Z0415"]);
    expect(codes(await compile("ld a,(ix-129)"))).toEqual(["Z0415"]);
  });

  it("a forward-referenced displacement out of range is an error", async () => {
    expect(codes(await compile("ld a,(ix+Fwd)\nFwd .equ 128"))).toEqual(["Z0415"]);
  });

  it("the limits are accepted", async () => {
    await testCodeEmit("ld a,(ix+127)\nld a,(ix-128)", 0xdd, 0x7e, 0x7f, 0xdd, 0x7e, 0x80);
  });
});

describe("Assembler review fixes - instructions", () => {
  it("adc/sbc have no Z80N `rr,a` or `rr,nn` form", async () => {
    expect((await compile(".model next\nadc hl,a")).errorCount).toBeGreaterThan(0);
    expect((await compile(".model next\nsbc de,#1234")).errorCount).toBeGreaterThan(0);
  });

  it("add keeps its Z80N `rr,a` and `rr,nn` forms", async () => {
    const output = await compile(".model next\nadd hl,a\nadd de,#1234");
    expect(output.errorCount).toBe(0);
    expect(Array.from(output.segments[0].emittedCode)).toEqual([0xed, 0x31, 0xed, 0x35, 0x34, 0x12]);
  });

  it("a forward jr with a negative .disp is in range", async () => {
    await testCodeEmit(".org #8000\n.disp -#100\njr Fwd\nFwd: nop", 0x18, 0x00, 0x00);
  });

  it("relative jump distances wrap around the 64K address space", () => {
    expect(relativeJumpDistance(0x0002, 0xfffe)).toBe(2);
    expect(relativeJumpDistance(0xfffe, 0x0000)).toBe(-4);
    expect(relativeJumpDistance(0x8000, 0x8000)).toBe(-2);
  });
});

describe("Assembler review fixes - statements", () => {
  it(".while leaves no scope behind", async () => {
    const output = await compile(".while false\n.endw\nLbl: nop\n.ent Lbl");
    expect(codes(output)).toEqual([]);
    expect(output.getSymbol("Lbl")).toBeTruthy();
  });

  it(".repeat stopped by its errors leaves no scope behind", async () => {
    const output = await compile('.repeat\n.error "e"\n.until false\n.ent 0');
    expect(codes(output)).not.toContain("Z0310");
  });

  it(".if assembles the first true branch", async () => {
    await testCodeEmit(".if 1\nld a,1\n.elif 1\nld a,2\n.endif", 0x3e, 0x01);
  });

  it("the end label of an .if is defined when no branch is taken", async () => {
    await testCodeEmit(".if 0\nnop\nEnd: .endif\nld hl,End", 0x21, 0x00, 0x80);
  });

  it("an orphan .endm names .macro", async () => {
    const output = await compile(".endm");
    expect(codes(output)).toEqual(["Z0704"]);
    expect(output.errors[0].message).toContain(".macro");
  });
});

describe("Assembler review fixes - structures and macros", () => {
  it("a field fixup in a procedure is not overwritten by the structure's bytes", async () => {
    await testCodeEmit(
      "MyS .struct\n.defb 0\n.ends\nMyP .proc\nMyS()\n-> .defb Later\nnop\nLater: nop\n.endp",
      0x02,
      0x00,
      0x00
    );
  });

  it("a numeric .defm is a structure field in flexible mode", async () => {
    await testFlexibleCodeEmit("MyS .struct\n.defm 0\n.ends\nMyS()\n-> .defm 65", 0x41);
  });

  it("a macro argument's `$$` is kept as it is", async () => {
    await testCodeEmit('MyM: .macro(t)\n.defm "{{t}}"\n.endm\nMyM("A$$B")', 0x41, 0x24, 0x24, 0x42);
  });

  it("a placeholder named like an Object member is not an argument", async () => {
    // --- `{{toString}}` is no argument of the macro, so it stays in the text as it is
    await testCodeEmit(
      'MyM: .macro(t)\n.defm "{{toString}}"\n.endm\nMyM(1)',
      ..."{{toString}}".split("").map((c) => c.charCodeAt(0))
    );
  });
});

describe("Assembler review fixes - values and strings", () => {
  it("the non-evaluated sentinel has its own type", () => {
    expect(ExpressionValue.NonEvaluated.type).toBe(ExpressionValueType.NonEvaluated);
    expect(ExpressionValue.NonEvaluated.isValid).toBe(false);
  });

  it("an empty string emits nothing", async () => {
    await testCodeEmit('.defm ""');
    await testCodeEmit('.defb 1,"",2', 0x01, 0x02);
    await testCodeEmit('.defc ""');
  });

  it("an empty .defn string emits its terminator only", async () => {
    await testCodeEmit('.defn ""', 0x00);
  });

  it("a string used as a number is an error, not an exception", async () => {
    for (const source of ['.org "a"', 'jr "a"', 'rst "a"', 'im "a"', '.align "a"', '.skip "a"']) {
      const output = await compile(source);
      expect(output.errorCount, source).toBeGreaterThan(0);
    }
  });

  it(".defh with a number reports one error", async () => {
    expect(codes(await compile(".defh 12"))).toEqual(["Z0316"]);
  });

  it(".tracehex shows $10000 with eight digits", async () => {
    const output = await compile(".tracehex 65536");
    expect(output.traceOutput).toEqual(["00010000"]);
  });
});

describe("Assembler review fixes - files and state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-asm-review-"));
  const bin16k = path.join(dir, "16k.bin");
  fs.writeFileSync(bin16k, Buffer.alloc(0x4000, 0x55));

  it(".includebin takes an absolute path", async () => {
    const output = await compile(`.includebin "${bin16k.replace(/\\/g, "/")}", 0, 2`);
    expect(codes(output)).toEqual([]);
    expect(Array.from(output.segments[0].emittedCode)).toEqual([0x55, 0x55]);
  });

  it(".includebin may fill a bank exactly", async () => {
    const output = await compile(`.model spectrum128\n.bank 1\n.includebin "${bin16k.replace(/\\/g, "/")}"`);
    expect(codes(output)).toEqual([]);
    expect(output.segments.find((s) => s.bank === 1)?.emittedCode.length).toBe(0x4000);
  });

  it("a second compilation on the same instance starts afresh", async () => {
    const assembler = new Z80Assembler();
    await assembler.compile("Foo: nop");
    const output = await assembler.compile(".proc\nnop\n.endp");
    expect(output.procedures.map((p) => p.name)).toEqual(["proc_8000"]);
  });

  it("Next auto mode tracks only the segments of the output", async () => {
    const output = await compile(".model next\nnop");
    expect(output.unbankedSegments?.every((s) => output.segments.includes(s))).toBe(true);
    expect(output.unbankedSegments?.length).toBe(1);
  });

  it(".bank N noexport stays out of the NEX file", async () => {
    const output = await compile('.model next\n.savenex file "t.nex"\n.bank 10 noexport\nnop\n.bank 11\nnop');
    expect(codes(output)).toEqual([]);
    const nex = await NexFileWriter.fromAssemblerOutput(output, dir, undefined, () => {});
    expect(nex[18 + 10]).toBe(0);
    expect(nex[18 + 11]).toBe(1);
  });
});
