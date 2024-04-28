import { describe, it, expect } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/assembler";

describe("Assembler - macro definition", async () => {
  it("fails with no label", async () => {
    await codeRaisesError(
      `
      .macro()
      .endm
      `,
      "Z1002"
    );
  });

  it("fails with local label", async () => {
    await codeRaisesError(
      `
      \`local .macro()
      .endm
      `,
      "Z1003"
    );
  });

  it("macro with label", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro: .macro()
        .endm
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsMacro("MyMacro")).toBe(true);
    const def = output.getMacro("MyMacro");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(0);
    expect(def.section.lastLine).toBe(1);
    expect(def.macroName).toBe("MyMacro");
  });

  it("macro with hanging label", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro
         .macro()
        .endm
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsMacro("MyMacro")).toBe(true);
    const def = output.getMacro("MyMacro");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(1);
    expect(def.section.lastLine).toBe(2);
    expect(def.macroName).toBe("MyMacro");
  });

  it("fails with existing label", async () => {
    await codeRaisesError(
      `
      MyMacro: nop
      MyMacro: .macro()
        .endm
      `,
      "Z1004"
    );
  });

  it("macro with arguments", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro: .macro(first, second)
        .endm
    `;

    const output = await compiler.compile(source);

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

  it("fails with macro within macro", async () => {
    await codeRaisesError(
      `
      MyMacro: .macro(first, second)
      Nested:  .macro()
        .endm
        .endm
      `,
      "Z1005"
    );
  });

  it("macro with valid parameters", async () => {
    await testCodeEmit(
      `
      MyMacro: .macro(first, second)
        {{first}}
        ld a,{{second}}
        .endm
    `
    );
  });

  it("fails with invalid parameter names", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyMacro: .macro(first, second)
        {{first}}
        ld b,{{unknown}}
        ld {{other}},{{second}}
        {{what}}
      .endm
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(3);
    expect(output.errors[0].errorCode === "Z1006").toBe(true);
    expect(output.errors[1].errorCode === "Z1006").toBe(true);
    expect(output.errors[2].errorCode === "Z1006").toBe(true);
  });

  it("fails with no end", async () => {
    await codeRaisesError(
      `
      MyMacro: .macro(first, second)
        ld a,b
      `,
      "Z0701"
    );
  });

  it("fails with orphan ends", async () => {
    await codeRaisesError(".endm", "Z0704");
    await codeRaisesError(".ENDM", "Z0704");
    await codeRaisesError("endm", "Z0704");
    await codeRaisesError("ENDM", "Z0704");
    await codeRaisesError(".mend", "Z0704");
    await codeRaisesError(".MEND", "Z0704");
    await codeRaisesError("mend", "Z0704");
    await codeRaisesError("MEND", "Z0704");
  });

  it("fails with duplicated argument", async () => {
    await codeRaisesError(
      `
      MyMacro: .macro(first, second, first)
        .endm
      `,
      "Z1001"
    );
  });

  it("fails with invalid def argument", async () => {
    await codeRaisesError(
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
    "isregaf"
  ];
  failCases.forEach((fc) => {
    it(`${fc} fails out of macro`, async () => {
      await codeRaisesError(
        `
        ld a,${fc}(a)
        `,
        "Z1009"
      );
    });
  });

  it("macro defined in parent scope", async () => {
    const compiler = new Z80Assembler();
    const source = `
        MyMacro: .macro()
          nop
          .endm

        TheModule: .module
          MyMacro()

          TheInnerModule: .module
            MyMacro()
            .endmodule

          .endmodule
      `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsNestedModule("TheModule")).toBe(true);
    expect(output.getNestedModule("TheModule").containsNestedModule("TheInnerModule")).toBe(true);
  });
});
