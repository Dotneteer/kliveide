import { describe, it, expect } from "vitest";
import {
  codeRaisesError,
  codeRaisesErrorWithOptions,
  testCodeEmitWithOptions
} from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/assembler";
import { AssemblerOptions } from "@main/z80-compiler/assembler-in-out";

describe("Assembler - struct definition", () => {
  it("fails with no label", async () => {
    await codeRaisesError(
      `
      .struct
      .ends
      `,
      "Z0804"
    );
  });

  it("fails with local label", async () => {
    await codeRaisesError(
      `
      \`local .struct
      .ends
      `,
      "Z0805"
    );
  });

  it("fails with end label", async () => {
    await codeRaisesError(
      `
      MyStruct .struct
      MyEnd .ends
      `,
      "Z0807"
    );
  });

  it("fails with hanging end label", async () => {
    await codeRaisesError(
      `
      MyStruct .struct
      MyEnd
        .ends
      `,
      "Z0807"
    );
  });

  it("struct with label", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyStruct: .struct
        .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(0);
    expect(def.section.lastLine).toBe(1);
    expect(def.structName).toBe("MyStruct");
  });

  it("struct with hanging label", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MyStruct:
        .struct
        .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.section.firstLine).toBe(1);
    expect(def.section.lastLine).toBe(2);
    expect(def.structName).toBe("MyStruct");
  });

  it("fails with existing label #1", async () => {
    await codeRaisesError(
      `
      MyStruct: nop
      MyStruct .struct
        .ends
      `,
      "Z0806"
    );
  });

  it("fails with existing label #2", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = false;
    await codeRaisesErrorWithOptions(
      `
      myStruct: nop
      MyStruct .struct
        .ends
      `,
      options,
      "Z0806"
    );
  });

  it("works with non-existing label #1", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      myStruct: nop
      MyStruct .struct
        .ends
      `,
      options,
      0x00
    );
  });

  it("fails with existing label #3", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await codeRaisesErrorWithOptions(
      `
      MyStruct: nop
      MyStruct .struct
        .ends
      `,
      options,
      "Z0806"
    );
  });

  it("fails with no end", async () => {
    await codeRaisesError(
      `
      MyStruct .struct
        .defb 0x00
      `,
      "Z0701"
    );
  });

  it("fails with orphan ends", async () => {
    await codeRaisesError(".ends", "Z0704");
    await codeRaisesError(".ENDS", "Z0704");
    await codeRaisesError("ends", "Z0704");
    await codeRaisesError("ENDS", "Z0704");
  });

  it("fails with invalid instruction", async () => {
    await codeRaisesError(
      `
      MyStruct .struct
        ld a,b
      .ends
      `,
      "Z0808"
    );
  });

  const validCases = [
    "; this is comment",
    "MyField",
    "MyField:",
    ".defb 0x80",
    ".defw 0x8078",
    '.defc "Hello"',
    '.defm "Hello"',
    '.defn "Hello"',
    '.defh "e345"',
    ".defs 100",
    ".fillb 10,#ff",
    ".fillw 10,#ffe3",
    '.defgx "....OOOO"',
    '.defg "....OOOO"'
  ];
  validCases.forEach((vc) => {
    it(`struct: ${vc}`, async () => {
      const compiler = new Z80Assembler();
      const source = `
        MyStruct .struct
        ${vc}
        .defb 0x80
        .ends
      `;

      const output = await compiler.compile(source);
      expect(output.errorCount).toBe(0);
    });
  });

  it("struct: defb", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defb 0x13, 0x15
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(2);
  });

  it("struct: defb, fixup", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defb 0x13, Symb1, 0x15, Sym1*Symb2
      .ends
    Symb1: .equ 1
    Symb2: .equ 2
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(4);
  });

  it("struct: defw", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defw 0x13A5, 0x15A6
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(4);
  });

  it("struct: defw, fixup", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defw 0x13A5, Symb1, 0x15A6, Sym1*Symb2
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(8);
  });

  it("struct: defm", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defm "ABCD"
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(4);
  });

  it("struct: defn", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defn "ABCD"
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(5);
  });

  it("struct: defc", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defc "ABCD"
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(4);
  });

  it("struct: defh", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defh "12AB23CD"
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(4);
  });

  it("struct: defs", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defs 3
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(3);
  });

  it("struct: fillb", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .fillb 3, #A5
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(3);
  });

  it("struct: fillw", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .fillw 2, #A5
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(4);
  });

  it("struct: defg", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct:
      .struct
        .defg ----OOOO OOOO----
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(2);
  });

  it("struct: defgx", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct:
      .struct
        .defgx "----OOOO OOOO----"
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(2);
  });

  it("struct: multiple pragmas", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defb 0x12, 0x13
        ; This is a comment
        .defgx "----OOOO OOOO----"
        .fillw 2, #12A3
        .defw #FEDC
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.size).toBe(10);
  });

  it("struct: fields #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        field1: .defb 0x12, 0x13
        field2: ; This is a comment
          .defgx "----OOOO OOOO----"
        field4: .fillw 2, #12A3
          .defw #FEDC
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.fields["field1"].offset).toBe(0);
    expect(def.fields["field2"].offset).toBe(2);
    expect(def.fields["field4"].offset).toBe(4);
    expect(output.getSymbol("MyStruct").value.asWord()).toBe(10);
  });

  it("struct: fields #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        field1: .defb 0x12, 0x13
        field2: ; This is a comment
        field3: .defgx "----OOOO OOOO----"
        field4: .fillw 2, #12A3
        .defw #FEDC
      .ends
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsStruct("MyStruct")).toBe(true);
    const def = output.getStruct("MyStruct");
    expect(def).toBeDefined();
    expect(def.fields["field1"].offset).toBe(0);
    expect(def.fields["field2"].offset).toBe(2);
    expect(def.fields["field3"].offset).toBe(2);
    expect(def.fields["field4"].offset).toBe(4);
    expect(output.getSymbol("MyStruct").value.asWord()).toBe(10);
  });

  it("fails with duplicated field #1", async () => {
    await codeRaisesError(
      `
      MyStruct: 
      .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
            .defgx "----OOOO OOOO----"
          field1: .fillw 2, #12A3
          .defw #FEDC
      .ends
      `,
      "Z0810"
    );
  });

  it("fails with duplicated field #2", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = false;
    await codeRaisesErrorWithOptions(
      `
      MyStruct: 
      .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
            .defgx "----OOOO OOOO----"
          Field1: .fillw 2, #12A3
          .defw #FEDC
      .ends
      `,
      options,
      "Z0810"
    );
  });

  it("fails with duplicated field #3", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await codeRaisesErrorWithOptions(
      `
      MyStruct: 
      .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
            .defgx "----OOOO OOOO----"
          field1: .fillw 2, #12A3
          .defw #FEDC
      .ends
      `,
      options,
      "Z0810"
    );
  });

  it("ok with non-duplicated field", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyStruct: 
      .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
            .defgx "----OOOO OOOO----"
          Field1: .fillw 2, #12A3
          .defw #FEDC
      .ends
      `,
      options
    );
  });

  it("fails with multiple duplicated fields", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        field1 .defb 0x12, 0x13
        field2 ; This is a comment
        field2 .defgx "----OOOO OOOO----"
        field1 .fillw 2, #12A3
        .defw #FEDC
      .ends
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z0810").toBe(true);
    expect(output.errors[1].errorCode === "Z0810").toBe(true);
  });

  it("struct labels show length", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyStruct: 
      .struct
        .defb 0x12, 0x13
        ; This is a comment
        .defgx "----OOOO OOOO----"
        .fillw 2, #12A3
        .defw #FEDC
      .ends
    .defs MyStruct*10
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
    expect(output.segments[0].emittedCode.length).toBe(100);
  });

  it("struct fields can be resolved", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyStruct: 
        .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
          field3: .defgx "----OOOO OOOO----"
          field4: .fillw 2, #12A3
            .defw #FEDC
          .ends
        .defb MyStruct.field1
        .defb MyStruct.field2
        .defb MyStruct.field3
        .defb MyStruct.field4
      `,
      options,
      0x00,
      0x02,
      0x02,
      0x04
    );
  });

  it("struct fields can be resolved with global module", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyStruct: 
        .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
          field3: .defgx "----OOOO OOOO----"
          field4: .fillw 2, #12A3
            .defw #FEDC
          .ends
        .defb ::MyStruct.field1
        .defb ::MyStruct.field2
        .defb ::MyStruct.field3
        .defb ::MyStruct.field4
      `,
      options,
      0x00,
      0x02,
      0x02,
      0x04
    );
  });

  it("struct fields can be resolved out of module", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyModule: .module
      MyStruct: 
        .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
          field3: .defgx "----OOOO OOOO----"
          field4: .fillw 2, #12A3
          .defw #FEDC
        .ends
      .endmodule
      .defb MyModule.MyStruct.field1
      .defb MyModule.MyStruct.field2
      .defb MyModule.MyStruct.field3
      .defb MyModule.MyStruct.field4
      `,
      options,
      0x00,
      0x02,
      0x02,
      0x04
    );
  });

  it("struct fields can be resolved out of module from global", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyModule: .module
      MyStruct: 
        .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
          field3: .defgx "----OOOO OOOO----"
          field4: .fillw 2, #12A3
          .defw #FEDC
        .ends
      .endmodule
      .defb ::MyModule.MyStruct.field1
      .defb ::MyModule.MyStruct.field2
      .defb ::MyModule.MyStruct.field3
      .defb ::MyModule.MyStruct.field4
      `,
      options,
      0x00,
      0x02,
      0x02,
      0x04
    );
  });

  it("struct fields can be resolved within module", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyModule: .module
      MyStruct: 
        .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
          field3: .defgx "----OOOO OOOO----"
          field4: .fillw 2, #12A3
          .defw #FEDC
        .ends
        .defb MyStruct.field1
        .defb MyStruct.field2
        .defb MyStruct.field3
        .defb MyStruct.field4
      .endmodule
      `,
      options,
      0x00,
      0x02,
      0x02,
      0x04
    );
  });

  it("struct can be resolved within module", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
      MyModule: .module
      MyStruct: 
        .struct
          field1: .defb 0x12, 0x13
          field2: ; This is a comment
          field3: .defgx "----OOOO OOOO----"
          field4: .fillw 2, #12A3
          .defw #FEDC
        .ends
        .defb ::MyModule.MyStruct
      .endmodule
      `,
      options,
      0x0a
    );
  });
});
