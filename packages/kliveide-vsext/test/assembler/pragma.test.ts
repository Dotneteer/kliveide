import "mocha";
import * as expect from "expect";

import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

describe("Assembler - pragmas", () => {
  it("org - existing segment", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("equ - immediate evaluation", () => {
    const compiler = new Z80Assembler();
    const source = `
      MySymbol .equ 200
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.symbols["MySymbol"].value.value).toBe(200);
  });
});
