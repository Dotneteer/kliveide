import "mocha";
import { testCodeEmit } from "./test-helpers";

describe("Assembler - macro-time functions", async () => {
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
    it(`reg8/reg8: ${tc.expr}`, async () => {
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
      await testCodeEmit(source, tc.expected);
    });
  });

  const reg8SpecCases = [
    { expr: "i", expected: 0x57 },
    { expr: "r", expected: 0x5f },
    { expr: "bc", expected: 0x00 },
  ];
  reg8SpecCases.forEach((tc) => {
    it(`reg8/reg8spec: ${tc.expr}`, async () => {
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
      await testCodeEmit(source, 0xed, tc.expected);
    });
  });

  reg8SpecCases.forEach((tc) => {
    it(`reg8spec: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
          .if isreg8spec({{mpar}})
              ld a,{{mpar}}
          .else
              .defb 0xED, 0x00
          .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, 0xed, tc.expected);
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
    it(`reg8/reg8Idx: ${tc.expr}`, async () => {
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
      await testCodeEmit(source, tc.expected >> 8, tc.expected & 0xff);
    });
  });

  reg8IdxCases.forEach((tc) => {
    it(`reg8Idx: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
          .if isreg8idx({{mpar}})
              ld a,{{mpar}}
          .else
              .defb 0x00, 0x00
          .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, tc.expected >> 8, tc.expected & 0xff);
    });
  });

  const reg16Cases = [
    { expr: "bc", expected: 0x01 },
    { expr: "de", expected: 0x11 },
    { expr: "hl", expected: 0x21 },
    { expr: "sp", expected: 0x31 },
    { expr: "a", expected: 0x00 },
  ];
  reg16Cases.forEach((tc) => {
    it(`reg16/reg16: ${tc.expr}`, async () => {
      const source = `
        MyMacro:
          .macro(mpar)
            .if isreg16({{mpar}})
              ld {{mpar}},0x1234
            .else
              .defb 0x00, 0x34, 0x12
            .endif
          .endm
        MyMacro(${tc.expr})
        `;
      await testCodeEmit(source, tc.expected, 0x34, 0x12);
    });
  });

  const reg16IdxCases = [
    { expr: "ix", expected: 0xdd21 },
    { expr: "iy", expected: 0xfd21 },
    { expr: "a", expected: 0x0000 },
  ];
  reg16IdxCases.forEach((tc) => {
    it(`reg16/reg16Idx: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if isreg16({{mpar}})
          ld {{mpar}},0x1234
        .else
          .defb 0x00, 0x00, 0x34, 0x12
        .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, tc.expected >> 8, tc.expected & 0xff, 0x34, 0x12);
    });
  });

  const regIndirectCases = [
    { expr: "(bc)", expected: 0x02 },
    { expr: "(de)", expected: 0x12 },
    { expr: "(hl)", expected: 0x77 },
    { expr: "ix", expected: 0x00 },
  ];
  regIndirectCases.forEach((tc) => {
    it(`regIndirect: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if isregindirect({{mpar}})
          ld {{mpar}},a
        .else
          .defb 0x00
        .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, tc.expected);
    });
  });

  const cportCases = [
    { expr: "(c)", expected: 0x78 },
    { expr: "c", expected: 0x00 },
    { expr: "ix", expected: 0x00 },
  ];
  cportCases.forEach((tc) => {
    it(`regIndirect: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if iscport({{mpar}})
          in a,{{mpar}}
        .else
          .defb 0xED, 0x00
        .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, 0xed, tc.expected);
    });
  });

  const indexedAddrCases = [
    { expr: "(ix)", expected: 0xdd77, dist: 0x00 },
    { expr: "(ix+2)", expected: 0xdd77, dist: 0x02 },
    { expr: "(ix-2)", expected: 0xdd77, dist: 0xfe },
    { expr: "(iy)", expected: 0xfd77, dist: 0x00 },
    { expr: "(iy+2)", expected: 0xfd77, dist: 0x02 },
    { expr: "(iy-2)", expected: 0xfd77, dist: 0xfe },
    { expr: "a", expected: 0x0000, dist: 0x00 },
  ];
  indexedAddrCases.forEach((tc) => {
    it(`indexedAddr: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if isindexedaddr({{mpar}})
          ld {{mpar}},a
        .else
          .defb 0x00, 0x00, 0x00
        .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, tc.expected >> 8, tc.expected & 0xff, tc.dist);
    });
  });

  const conditionCases = [
    { expr: "nz", expected: 0xc2 },
    { expr: "z", expected: 0xca },
    { expr: "nc", expected: 0xd2 },
    { expr: "c", expected: 0xda },
    { expr: "po", expected: 0xe2 },
    { expr: "pe", expected: 0xea },
    { expr: "p", expected: 0xf2 },
    { expr: "m", expected: 0xfa },
    { expr: "ix", expected: 0x00 },
  ];
  conditionCases.forEach((tc) => {
    it(`condition: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if iscondition({{mpar}})
          jp {{mpar}},#1234
        .else
          .defb 0x00, 0x34, 0x12
        .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, tc.expected, 0x34, 0x12);
    });
  });

  const exprCases = [
    { expr: "1 * 3", expected: 0x03 },
    { expr: "1 << 2", expected: 0x04 },
    { expr: "#10", expected: 0x10 },
    { expr: "ix", expected: 0x00 },
  ];
  exprCases.forEach((tc) => {
    it(`expression: ${tc.expr}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if isexpr({{mpar}})
          ld a,{{mpar}}
        .else
          .defb 0x3E, 0x00
        .endif
      .endm
      MyMacro(${tc.expr})
      `;
      await testCodeEmit(source, 0x3e, tc.expected);
    });
  });

  const singleReg8Cases = [
    { expr: "isrega", arg: "a", expected: 0x7f },
    { expr: "isrega", arg: "sp", expected: 0x00 },
    { expr: "isregb", arg: "b", expected: 0x78 },
    { expr: "isregb", arg: "sp", expected: 0x00 },
    { expr: "isregc", arg: "c", expected: 0x79 },
    { expr: "isregc", arg: "sp", expected: 0x00 },
    { expr: "isregd", arg: "d", expected: 0x7a },
    { expr: "isregd", arg: "sp", expected: 0x00 },
    { expr: "isrege", arg: "e", expected: 0x7b },
    { expr: "isrege", arg: "sp", expected: 0x00 },
    { expr: "isregh", arg: "h", expected: 0x7c },
    { expr: "isregh", arg: "sp", expected: 0x00 },
    { expr: "isregl", arg: "l", expected: 0x7d },
    { expr: "isregl", arg: "sp", expected: 0x00 },
  ];
  singleReg8Cases.forEach((rc) => {
    it(`single regs: ${rc.expr}/${rc.arg}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if ${rc.expr}({{mpar}})
          ld a,{{mpar}}
        .else
          nop
        .endif
      .endm
      MyMacro(${rc.arg})
      `;
      await testCodeEmit(source, rc.expected);
    });
  });

  const singleReg8SpecCases = [
    { expr: "isregi", arg: "i", expected: 0x57 },
    { expr: "isregi", arg: "sp", expected: 0x00 },
    { expr: "isregr", arg: "r", expected: 0x5f },
    { expr: "isregr", arg: "sp", expected: 0x00 },
  ];
  singleReg8SpecCases.forEach((rc) => {
    it(`single regs: ${rc.expr}/${rc.arg}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if ${rc.expr}({{mpar}})
          ld a,{{mpar}}
        .else
          .defb 0xed, 0x00
        .endif
      .endm
      MyMacro(${rc.arg})
      `;
      await testCodeEmit(source, 0xed, rc.expected);
    });
  });

  const singleReg16Cases = [
    { expr: "isregbc", arg: "bc", expected: 0x03 },
    { expr: "isregbc", arg: "a", expected: 0x00 },
    { expr: "isregde", arg: "de", expected: 0x13 },
    { expr: "isregde", arg: "a", expected: 0x00 },
    { expr: "isreghl", arg: "hl", expected: 0x23 },
    { expr: "isreghl", arg: "a", expected: 0x00 },
    { expr: "isregsp", arg: "sp", expected: 0x33 },
    { expr: "isregsp", arg: "a", expected: 0x00 },
  ];
  singleReg16Cases.forEach((rc) => {
    it(`single regs: ${rc.expr}/${rc.arg}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if ${rc.expr}({{mpar}})
          inc {{mpar}}
        .else
          nop
        .endif
      .endm
      MyMacro(${rc.arg})
      `;
      await testCodeEmit(source, rc.expected);
    });
  });

  const singleReg8IdxCases = [
    { expr: "isregxh", arg: "xh", expected: 0xdd24 },
    { expr: "isregxh", arg: "ixh", expected: 0xdd24 },
    { expr: "isregxh", arg: "a", expected: 0x0000 },
    { expr: "isregxl", arg: "xl", expected: 0xdd2c },
    { expr: "isregxl", arg: "ixl", expected: 0xdd2c },
    { expr: "isregxl", arg: "a", expected: 0x0000 },
    { expr: "isregyh", arg: "yh", expected: 0xfd24 },
    { expr: "isregyh", arg: "iyh", expected: 0xfd24 },
    { expr: "isregyh", arg: "a", expected: 0x0000 },
    { expr: "isregyl", arg: "yl", expected: 0xfd2c },
    { expr: "isregyl", arg: "iyl", expected: 0xfd2c },
    { expr: "isregyl", arg: "a", expected: 0x0000 },
  ];
  singleReg8IdxCases.forEach((rc) => {
    it(`single regs: ${rc.expr}/${rc.arg}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if ${rc.expr}({{mpar}})
          inc {{mpar}}
        .else
          .defb 0x00, 0x00
        .endif
      .endm
      MyMacro(${rc.arg})
      `;
      await testCodeEmit(source, rc.expected >> 8, rc.expected & 0xff);
    });
  });

  const singleReg16IdxCases = [
    { expr: "isregix", arg: "ix", expected: 0xdd23 },
    { expr: "isregix", arg: "a", expected: 0x00 },
    { expr: "isregiy", arg: "iy", expected: 0xfd23 },
    { expr: "isregiy", arg: "a", expected: 0x0000 },
  ];
  singleReg16IdxCases.forEach((rc) => {
    it(`single regs: ${rc.expr}/${rc.arg}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if ${rc.expr}({{mpar}})
          inc {{mpar}}
        .else
          .defb 0x00, 0x00
        .endif
      .endm
      MyMacro(${rc.arg})
      `;
      await testCodeEmit(source, rc.expected >> 8, rc.expected & 0xff);
    });
  });
  const singleRegAfCases = [
    { expr: "isregaf", arg: "af", expected: 0xf5 },
    { expr: "isregaf", arg: "a", expected: 0x00 },
  ];
  singleRegAfCases.forEach((rc) => {
    it(`single regs: ${rc.expr}/${rc.arg}`, async () => {
      const source = `
      MyMacro:
      .macro(mpar)
        .if ${rc.expr}({{mpar}})
          push {{mpar}}
        .else
          nop
        .endif
      .endm
      MyMacro(${rc.arg})
      `;
      await testCodeEmit(source, rc.expected);
    });
  });


});
