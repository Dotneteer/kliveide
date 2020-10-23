import "mocha";
import * as expect from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

describe("Assembler - macro definition", () => {
  it("fails with no label", () => {
    codeRaisesError(
      `
      .macro()
      .endm
      `,
      "Z1002"
    );
  });

  it("fails with local label", () => {
    codeRaisesError(
      `
      \`local .macro()
      .endm
      `,
      "Z1003"
    );
  });

  it("macro with label", () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro: .macro()
        .endm
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsMacro("MyMacro")).toBe(true);
    const def = output.getMacro("MyMacro");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(0);
    expect(def.section.lastLine).toBe(1);
    expect(def.macroName).toBe("MyMacro");
  });

  it("macro with hanging label", () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro
         .macro()
        .endm
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsMacro("MyMacro")).toBe(true);
    const def = output.getMacro("MyMacro");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(1);
    expect(def.section.lastLine).toBe(2);
    expect(def.macroName).toBe("MyMacro");
  });

  it("fails with existing label", () => {
    codeRaisesError(
      `
      MyMacro: nop
      MyMacro: .macro()
        .endm
      `,
      "Z1004"
    );
  });

  it("macro with arguments", () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro: .macro(first, second)
        .endm
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsMacro("MyMacro")).toBe(true);
    const def = output.getMacro("MyMacro");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(0);
    expect(def.section.lastLine).toBe(1);
    expect(def.macroName).toBe("MyMacro");
    expect(def.argNames.length).toBe(2);
    expect(def.argNames[0].name).toBe("first");
    expect(def.argNames[1].name).toBe("second");
  });

  it("fails with macro within macro", () => {
    codeRaisesError(
      `
      MyMacro: .macro(first, second)
      Nested:  .macro()
        .endm
        .endm
      `,
      "Z1005"
    );
  });

  it("macro with valid parameters", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first, second)
        {{first}}
        ld a,{{second}}
        .endm
    `
    );
  });

  it("fails with invalid parameter names", () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro: .macro(first, second)
        {{first}}
        ld b,{{unknown}}
        ld {{other}},{{second}}
        {{what}}
      .endm
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(3);
    expect(output.errors[0].errorCode === "Z1006").toBe(true);
    expect(output.errors[1].errorCode === "Z1006").toBe(true);
    expect(output.errors[2].errorCode === "Z1006").toBe(true);
  });

  it("fails with no end", () => {
    codeRaisesError(
      `
      MyMacro: .macro(first, second)
        ld a,b
      `,
      "Z0701"
    );
  });

  it("fails with orphan ends", () => {
    codeRaisesError(".endm", "Z0704");
    codeRaisesError(".ENDM", "Z0704");
    codeRaisesError("endm", "Z0704");
    codeRaisesError("ENDM", "Z0704");
    codeRaisesError(".mend", "Z0704");
    codeRaisesError(".MEND", "Z0704");
    codeRaisesError("mend", "Z0704");
    codeRaisesError("MEND", "Z0704");
  });

  it("fails with duplicated argument", () => {
    codeRaisesError(
      `
      MyMacro: .macro(first, second, first)
        .endm
      `,
      "Z1001"
    );
  });

  it("fails with invalid def argument", () => {
    codeRaisesError(
      `
      Simple: .macro(arg1, arg2)
        .if def(arg1) ; This is en error
          ld a,b
        .endif
        .if def({{arg2}})
          ld b,a
        .endif
      .endm
      `,
      "Z1009"
    );
  });

  const failCases = [
    "def",
    "isreg8",
    "isreg8spec",
    "isreg8idx",
    "isreg16",
    "isreg16idx",
    "isregindirect",
    "iscport",
    "isindexedaddr",
    "iscondition",
    "isexpr",
    "isrega",
    "isregb",
    "isregc",
    "isregd",
    "isrege",
    "isregh",
    "isregl",
    "isregi",
    "isregr",
    "isregbc",
    "isregde",
    "isreghl",
    "isregsp",
    "isregxh",
    "isregxl",
    "isregyh",
    "isregyl",
    "isregix",
    "isregiy",
    "isregaf",
  ];
  failCases.forEach(fc => {
    it(`${fc} fails out of macro`, () => {
      codeRaisesError(
        `
        ld a,${fc}(a)
        `,
        "Z1009"
      );
      });
  });
});
