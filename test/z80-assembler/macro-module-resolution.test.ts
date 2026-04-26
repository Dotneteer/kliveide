import { describe, it, expect } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

// These tests cover cross-module macro resolution changes:
//   1. Invoking a macro by qualified name (Module.Macro(...)) from global scope.
//   2. Invoking a macro by qualified name from inside a different module.
//   3. Module-local (@-prefixed) symbols inside a macro body must resolve to the
//      defining module's symbol table, not the calling module's one.
//   4. Non-@-prefixed symbols (including macro arguments that expand to labels)
//      must resolve in the *calling* module's context, not the defining module.

describe("Assembler - macro module resolution", async () => {
  // ---------------------------------------------------------------------------
  // Qualified invocation from global scope
  // ---------------------------------------------------------------------------

  it("global scope can invoke macro via qualified name", async () => {
    await testCodeEmit(
      `
      Display .module
        Nop .macro()
          nop
        .endm
      .endmodule

      Display.Nop()
      `,
      0x00
    );
  });

  it("global scope can invoke macro with argument via qualified name", async () => {
    await testCodeEmit(
      `
      Display .module
        LoadA .macro(val)
          ld a,{{val}}
        .endm
      .endmodule

      Display.LoadA(#42)
      `,
      0x3e,
      0x42
    );
  });

  it("unqualified name that does not exist in global scope still fails", async () => {
    await codeRaisesError(
      `
      Display .module
        Nop .macro()
          nop
        .endm
      .endmodule

      Nop()
      `,
      "Z1007"
    );
  });

  // ---------------------------------------------------------------------------
  // Qualified invocation from inside another module
  // ---------------------------------------------------------------------------

  it("module can invoke macro in sibling module via qualified name", async () => {
    await testCodeEmit(
      `
      Display .module
        Nop .macro()
          nop
        .endm
      .endmodule

      Title .module
        Display.Nop()
      .endmodule
      `,
      0x00
    );
  });

  it("module can invoke macro with argument in sibling module via qualified name", async () => {
    await testCodeEmit(
      `
      Display .module
        LoadA .macro(val)
          ld a,{{val}}
        .endm
      .endmodule

      Title .module
        Display.LoadA(#55)
      .endmodule
      `,
      0x3e,
      0x55
    );
  });

  it("multiple cross-module qualified macro invocations emit correct sequence", async () => {
    await testCodeEmit(
      `
      Helpers .module
        Nop2 .macro()
          nop
          nop
        .endm
      .endmodule

      App .module
        Helpers.Nop2()
        Helpers.Nop2()
      .endmodule
      `,
      0x00,
      0x00,
      0x00,
      0x00
    );
  });

  // ---------------------------------------------------------------------------
  // Module-local symbol resolution inside macro body
  // ---------------------------------------------------------------------------

  it("@-label defined in macro's module resolves correctly during invocation from same module", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      Display .module
        @Ink
          nop
          ret

        Ink .macro(color)
          ld a,{{color}}
          jp @Ink
        .endm

        Ink(1)
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  it("@-label defined in macro's module resolves correctly during invocation from global scope", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      Display .module
        @Ink
          nop
          ret

        Ink .macro(color)
          ld a,{{color}}
          jp @Ink
        .endm
      .endmodule

      Display.Ink(2)
    `);

    expect(output.errorCount).toBe(0);
  });

  it("@-label defined in macro's module resolves correctly during invocation from sibling module", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      Display .module
        @Ink
          nop
          ret

        Ink .macro(color)
          ld a,{{color}}
          jp @Ink
        .endm
      .endmodule

      Title .module
        Display.Ink(3)
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  it("@-label NOT present in calling module does not incorrectly resolve", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      Display .module
        @Ink
          nop
          ret

        Ink .macro(color)
          ld a,{{color}}
          jp @Ink
        .endm
      .endmodule

      Title .module
        @Ink        ; unrelated @Ink in Title — must NOT be used by Display.Ink
          halt
          ret
        Display.Ink(4)
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
    // Display@Ink: nop(1) + ret(1) = 2 bytes
    // Display.Ink(4): ld a,4(2) + jp @Ink(3) = 5 bytes
    // Title@Ink: halt(1) + ret(1) = 2 bytes
    expect(output.segments[0].emittedCode.length).toBe(9);
  });

  it("full Display module example compiles without errors", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      .module Display

        TMP_BUFF .defs $20
        @lastBorder .db 0

        Border .macro(color)
          ld a,{{color}}
          call @Border
        .endm

        @Border
          ld (@lastBorder),a
          out ($fe),a
          ret

        @Ink
          push af
          ld a,$10
          rst $10
          pop af
          rst $10
          ret

        Ink .macro(color)
          ld a,{{color}}
          jp @Ink
        .endm

      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  it("cross-module invocation of Display.Ink compiles without errors", async () => {
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      .module Display
        @Ink
          push af
          ld a,$10
          rst $10
          pop af
          rst $10
          ret

        Ink .macro(color)
          ld a,{{color}}
          jp @Ink
        .endm
      .endmodule

      .module Title
        Display.Ink(7)
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Non-@-prefixed symbols passed as macro arguments resolve in caller's context
  // ---------------------------------------------------------------------------

  it("label argument from calling module resolves when macro is in different module", async () => {
    // PrintTitle macro in Display uses {{title}} which expands to a label defined
    // in the calling module (PrintDemo). Both are already-defined labels.
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      .module Display
        PrintTitle .macro(title)
          ld hl,{{title}}
          ret
        .endm
      .endmodule

      .module PrintDemo
        TitleStr .dw #1234
        Display.PrintTitle(TitleStr)
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  it("forward-referenced label argument from calling module resolves correctly", async () => {
    // Title_Intro_1 is defined AFTER the macro invocation (forward reference).
    // This is the exact scenario from the bug report.
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      .module Display
        PrintTitle .macro(title)
          ld hl,{{title}}
          ret
        .endm
      .endmodule

      .module PrintDemo
      Welcome
          Display.PrintTitle(Title_Intro_1)
          ld hl,#0000
          ret

      Title_Intro_1
          .db #49,#6e,#74,#72,#6f
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  it("non-@ symbol from calling module resolves while @-symbol from defining module also resolves", async () => {
    // The macro body uses both a caller-provided label (via argument) and a
    // defining-module @-symbol — both must resolve correctly simultaneously.
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      .module Display
        @Default
          nop
          ret

        Print .macro(title)
          ld hl,{{title}}
          call @Default
        .endm
      .endmodule

      .module PrintDemo
        MyStr .db #68,#65,#6c,#6c,#6f
        Display.Print(MyStr)
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });

  it("forward-referenced label AND @-symbol from defining module both resolve", async () => {
    // Both the forward-referenced caller label and the defining-module @-symbol
    // must be resolved — this covers the hardest combined case.
    const compiler = new Z80Assembler();
    const output = await compiler.compile(`
      .org #8000
      .module Display
        @Helper
          nop
          ret

        Print .macro(title)
          ld hl,{{title}}
          call @Helper
        .endm
      .endmodule

      .module PrintDemo
      Entry
          Display.Print(MyStr)   ; MyStr is a forward reference
          ret

      MyStr .db #77,#6f,#72,#6c,#64
      .endmodule
    `);

    expect(output.errorCount).toBe(0);
  });
});
