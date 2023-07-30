import "mocha";
import { expect } from "expect";

import {
  codeRaisesError,
  testCodeEmit,
  testCodeEmitWithOptions
} from "./test-helpers";
import { AssemblerOptions } from "@electron/z80-compiler/assembler-in-out";
import { Z80Assembler } from "@electron/z80-compiler/assembler";

describe("Assembler - macro parameter emit", async () => {
  it("fails in global scope", async () => {
    await codeRaisesError(
      `
      {{MyParam}}
      `,
      "Z1011"
    );
  });

  it("fails in local scope", async () => {
    await codeRaisesError(
      `
      .loop 3
      {{MyParam}}
      .endl
      `,
      "Z1011"
    );
  });

  it("single argument #1", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(MyArg)
      ld a,{{MyArg}}
      .endm
      MyMacro(#A3)
    `,
      0x3e,
      0xa3
    );
  });

  it("single argument #2", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyMacro: .macro(MyArg)
      ld a,{{MyArg}}
      .endm
      MyMacro(#A3)
    `,
      options,
      0x3e,
      0xa3
    );
  });

  it("single argument #3", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = false;
    await testCodeEmitWithOptions(
      `
      MyMacro: .macro(myArg)
      ld a,{{MyArg}}
      .endm
      MyMacro(#A3)
    `,
      options,
      0x3e,
      0xa3
    );
  });

  it("single argument #4", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    const source = `
      MyMacro: .macro(myArg)
      ld a,{{MyArg}}
      .endm
      MyMacro(#A3)
    `;
    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z1006").toBe(true);
    expect(output.errors[1].errorCode === "Z1007").toBe(true);
  });

  const reg8Cases = [
    { expr: "b", expected: 0x78 },
    { expr: "c", expected: 0x79 },
    { expr: "d", expected: 0x7a },
    { expr: "e", expected: 0x7b },
    { expr: "h", expected: 0x7c },
    { expr: "l", expected: 0x7d },
    { expr: "a", expected: 0x7f }
  ];
  reg8Cases.forEach(tc => {
    it(`wotks with reg8: ${tc.expr}`, async () => {
      const source = `
      MyMacro: .macro(MyArg)
      ld a,{{MyArg}}
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, tc.expected);
    });
  });

  it("with instruction #1", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(MyArg)
      {{MyArg}}
      .endm
      MyMacro("ld a,b")
    `,
      0x78
    );
  });

  it("with instruction #2", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(MyArg)
      {{MyArg}}
      .endm
      MyMacro("ld a,b" & "ld a,c")
    `,
      0x78,
      0x79
    );
  });

  it("with labeled instruction #1", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(MyArg)
      {{MyArg}}
      .endm
      MyMacro("MyLabel: jp MyLabel")
    `,
      0xc3,
      0x00,
      0x80
    );
  });

  it("with labeled instruction #2", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(MyArg)
      {{MyArg}}
      .endm
      MyMacro("MyLabel: jp MyLabel")
      MyMacro("MyLabel: jp MyLabel")
    `,
      0xc3,
      0x00,
      0x80,
      0xc3,
      0x03,
      0x80
    );
  });

  it("fails with double labels", async () => {
    await codeRaisesError(
      `
      MyMacro: .macro(MyArg)
      Label: {{MyArg}}
      .endm
      MyMacro("MyLabel: jp MyLabel")
      `,
      "Z1012",
      "Z0004"
    );
  });

  it("with loop injection #1", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(MyArg)
      {{MyArg}}
      .endm
      MyMacro(".loop 3" & "ld a,b" & ".endl")
    `,
      0x78,
      0x78,
      0x78
    );
  });

  it("with loop injection #2", async () => {
    await testCodeEmit(
      `
      DoIt: .macro(count, body)
        .loop {{count}}
        {{body}}
        .endl
      .endm
      DoIt(3, "ld a,b")
    `,
      0x78,
      0x78,
      0x78
    );
  });

  it("lreg/hreg #1", async () => {
    await testCodeEmit(
      `
      LdHl: .macro(reg16)
        ld h,hreg({{reg16}})
        ld l,lreg({{reg16}})
      .endm
      LdHl(bc)
      LdHl(de)
      LdHl(hl)
    `,
      0x60,
      0x69,
      0x62,
      0x6b,
      0x64,
      0x6d
    );
  });

  it("lreg/hreg #2", async () => {
    await testCodeEmit(
      `
      LdAB: .macro(reg16)
        ld a,hreg({{reg16}})
        ld b,lreg({{reg16}})
      .endm
      LdAB(ix)
      LdAB(iy)
    `,
      0xdd,
      0x7c,
      0xdd,
      0x45,
      0xfd,
      0x7c,
      0xfd,
      0x45
    );
  });
});
