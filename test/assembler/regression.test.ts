import { describe, it, expect } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/assembler";

describe("Assembler - regression cases", async () => {
  it("Characters are just like numbers", async () => {
    await testCodeEmit("ld a,'A'", 0x3e, 0x41);
  });

  it("ld a,sin() fails", async () => {
    await codeRaisesError("ld a,sin()", "Z0606");
  });

  it("macro ivocation fails #1", async () => {
    await codeRaisesError(
      `
    erd .macro(arg)
    mamc({{arg}})
    .endm

    mamc .macro (sdds)
    .if isreg8({{sdds}})
    .endif
    .endm

    erd("(af)")
    `,
      "Z1012",
      "Z0111"
    );
  });

  it("equ - with parenthesized expression", async () => {
    const compiler = new Z80Assembler();
    const source = `MySymbol .equ 300 * (16 + 1)`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.getSymbol("MySymbol").value.value).toBe(5100);
  });

  it("equ - with bracketed expression", async () => {
    const compiler = new Z80Assembler();
    const source = `MySymbol .equ 300 * [16 + 1]`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.getSymbol("MySymbol").value.value).toBe(5100);
  });

  it("add with one operand", async () => {
    await testCodeEmit("add b", 0x80);
    await testCodeEmit("add 5", 0xc6, 0x05);
    await testCodeEmit("adc b", 0x88);
    await testCodeEmit("adc 5", 0xce, 0x05);
    await testCodeEmit("sbc b", 0x98);
    await testCodeEmit("sbc 5", 0xde, 0x05);
  });

  it("loop - without parentheses", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyCount equ 20
      loop MyCount
      endl
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("proc - without parentheses", async () => {
    const compiler = new Z80Assembler();
    const source = `
      proc
        ld bc,ThisLabel
        ThisLabel: nop
      endp
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("repeat - without parentheses", async () => {
    const compiler = new Z80Assembler();
    const source = `
      counter = 0
      repeat
        ThisLabel: ld bc,ThisLabel
        counter = counter + 1
      until counter == 2
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("for - without parentheses", async () => {
    const compiler = new Z80Assembler();
    const source = `
    for _i = 3 to 5 step 1
    next
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("nested loop", async () => {
    const compiler = new Z80Assembler();
    const source = `
    loop 8
      outerCount = $cnt
      loop outerCount
      endl
    endl
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("fixup - no missing output segments", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .db Bar & 0xFF

    #if ($ >> 8) > ($ & 0xFF)
    nop
    #endif

    Bar:
    jp 0
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });
});
