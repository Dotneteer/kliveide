import "mocha";
import * as expect from "expect";

import { Z80Assembler } from "../../main/z80-compiler/assembler";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - regression cases", () => {
  it("Characters are just like numbers", () => {
    testCodeEmit("ld a,'A'", 0x3e, 0x41);
  });

  it("ld a,sin() fails", () => {
    codeRaisesError("ld a,sin()", "Z0606");
  });

  it("macro ivocation fails #1", () => {
    codeRaisesError(`
    erd .macro(arg)
    mamc({{arg}})
    .endm

    mamc .macro (sdds)
    .if isreg8({{sdds}})
    .endif
    .endm

    erd("(af)")
    `, "Z1012", "Z0111");
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

  it("add with one operand", () => {
    testCodeEmit("add b", 0x80);
    testCodeEmit("add 5", 0xc6, 0x05);
    testCodeEmit("adc b", 0x88);
    testCodeEmit("adc 5", 0xce, 0x05);
    testCodeEmit("sbc b", 0x98);
    testCodeEmit("sbc 5", 0xde, 0x05);
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

  it("Generate parity", () => {
    let line = ``;
    for(let i=0; i< 0x100; i++) {
      let j=i; let parity=0;
      for(let k=0; k<8; k++) { parity ^= j & 1; j >>=1; }
      const parValue = parity ? 0 : 0x04;
      line += `0x${parValue.toString(16).padStart(2, "0")}, `;
    };
    console.log(line);
  });
});

