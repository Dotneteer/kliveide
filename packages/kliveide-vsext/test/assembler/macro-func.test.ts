import "mocha";
import * as expect from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

describe("Assembler - macro-time functions", () => {
  const reg8Cases = [
    { expr: "b", expected: 0x78 },
    { expr: "c", expected: 0x79 },
    { expr: "d", expected: 0x7a },
    { expr: "e", expected: 0x7b },
    { expr: "h", expected: 0x7c },
    { expr: "l", expected: 0x7d },
    { expr: "a", expected: 0x7f },
    { expr: "bc", expected: 0x00 },
  ];
  reg8Cases.forEach((tc) => {
    it(`reg8: ${tc.expr}`, () => {
      const source = `
        MyMacro:
          .macro(mpar)
            .if isreg8({{mpar}})
              ld a,{{mpar}}
            .else
              nop
            .endif
          .endm
        MyMacro(${tc.expr})
        `;
      testCodeEmit(source, tc.expected);
    });
  });

  const reg8SpecCases = [
    { expr: "i", expected: 0x57 },
    { expr: "r", expected: 0x5f },
    { expr: "bc", expected: 0x00 },
  ];
  reg8SpecCases.forEach((tc) => {
    it(`reg8spec: ${tc.expr}`, () => {
      const source = `
      MyMacro:
      .macro(mpar)
          .if isreg8({{mpar}})
              ld a,{{mpar}}
          .else
              .defb 0xED, 0x00
          .endif
      .endm
      MyMacro(${tc.expr})
      `;
      testCodeEmit(source, 0xed, tc.expected);
    });
  });

  const reg8IdxCases = [
    { expr: "xh", expected: 0xdd7c },
    { expr: "ixh", expected: 0xdd7c },
    { expr: "xl", expected: 0xdd7d },
    { expr: "ixl", expected: 0xdd7d },
    { expr: "yh", expected: 0xfd7c },
    { expr: "iyh", expected: 0xfd7c },
    { expr: "yl", expected: 0xfd7d },
    { expr: "iyl", expected: 0xfd7d },
    { expr: "bc", expected: 0x0000 },
  ];
  reg8IdxCases.forEach((tc) => {
    it(`reg8Idx: ${tc.expr}`, () => {
      const source = `
      MyMacro:
      .macro(mpar)
          .if isreg8({{mpar}})
              ld a,{{mpar}}
          .else
              .defb 0x00, 0x00
          .endif
      .endm
      MyMacro(${tc.expr})
      `;
      testCodeEmit(source, tc.expected >> 8, tc.expected & 0xff);
    });
  });
});
