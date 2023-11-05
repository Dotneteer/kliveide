import "mocha";
import { expect } from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/assembler";
import { AssemblerOptions } from "@main/z80-compiler/assembler-in-out";

describe("Assembler - .repeat", async () => {
  it("ent - fails in repeat", async () => {
    await codeRaisesError(
      `
      .repeat
      .ent #8000
      .until true
    `,
      "Z0310"
    );
  });

  it("xent - fails in repeat", async () => {
    await codeRaisesError(
      `
      .repeat
      .xent #8000
      .until true
    `,
      "Z0310"
    );
  });

  it(".until - fails without repeat", async () => {
    await codeRaisesError(".until true", "Z0704");
    await codeRaisesError(".UNTIL true", "Z0704");
    await codeRaisesError("until true", "Z0704");
    await codeRaisesError("UNTIL true", "Z0704");
  });

  it("repeat - missing until", async () => {
    await codeRaisesError(
      `
      .repeat
      ld a,b
    `,
      "Z0701"
    );
  });

  it("until - fails with string", async () => {
    await codeRaisesError(
      `
      .repeat 
      .until "Hello"

    `,
      "Z0603"
    );
  });

  it("repeat - too long loop", async () => {
    await codeRaisesError(
      `
      .repeat 
      .until false
    `,
      "Z0702"
    );
  });

  it("too many errors", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.maxLoopErrorsToReport = 3;
    const source = `
    counter = 0;
    .repeat
        Value: .var 100 + Other;
        counter = counter + 1;
    .until counter >= 100
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(4);
    expect(output.errors[3].errorCode === "Z0703").toBe(true);
  });

  it("repeat - empty body", async () => {
    await testCodeEmit(
      `
    .repeat
    .until true
    `
    );
  });

  it("repeat - executes once", async () => {
    await testCodeEmit(
      `
    .repeat
      inc a
    .until true
    `,
      0x3c
    );
  });

  it("repeat - labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    counter = 1;
    MyLoop: .repeat
      counter = counter + 1
      .until counter > 3
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyLoop")).toBe(true);
    expect(output.getSymbol("MyLoop").value.value).toBe(0x8000);
  });

  it("repeat - hanging labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    counter = 1;
    MyLoop
      .repeat
      counter = counter + 1
      .until counter > 3
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyLoop")).toBe(true);
    expect(output.getSymbol("MyLoop").value.value).toBe(0x8000);
  });

  it("repeat - end labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    counter = 1;
    .repeat
        counter = counter + 1
    MyEnd: .until counter > 3
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyEnd")).toBe(false);
  });

  it("repeat - hanging end labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    counter = 1;
    .repeat
      counter = counter + 1
    MyEnd:
      .until counter > 3
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyEnd")).toBe(false);
  });

  it("repeat - invalid condition", async () => {
    await codeRaisesError(
      `
      .repeat
      .until 3+unknown
    `,
      "Z0605"
    );
  });

  it("repeat - fixup counter caught", async () => {
    await codeRaisesError(
      `
    count = 1
    .repeat
        count = count + 1
    .until count > later
    later: .equ 5      `,
      "Z0605"
    );
  });

  it("repeat - valid counter", async () => {
    await testCodeEmit(
      `
    later: .equ 5
    count = 1
    .repeat
        count = count + 1
    .until count > later
    `
    );
  });

  it("emit - single line", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ld bc,#1234
        counter = counter + 1
    .until counter == 2
    `,
      0x01,
      0x34,
      0x12,
      0x01,
      0x34,
      0x12
    );
  });

  it("emit - muliple lines", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        inc b
        inc c
        inc d
        counter = counter + 1
    .until counter == 2
    `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("emit - internal label", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ThisLabel: ld bc,ThisLabel
        counter = counter + 1
    .until counter == 2
    `,
      0x01,
      0x00,
      0x80,
      0x01,
      0x03,
      0x80
    );
  });

  it("emit - internal label with fixup", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ld bc,ThisLabel
        ThisLabel: nop
        counter = counter + 1
    .until counter == 2
    `,
      0x01,
      0x03,
      0x80,
      0x00,
      0x01,
      0x07,
      0x80,
      0x00
    );
  });

  it("emit - with start label", async () => {
    await testCodeEmit(
      `
    counter = 0
    StartLabel: .repeat
        ld bc,StartLabel
        nop
        counter = counter + 1
    .until counter == 2
    `,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("emit - with end label", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ld bc,EndLabel
        nop
        counter = counter + 1
    EndLabel .until counter == 2
    `,
      0x01,
      0x04,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00
    );
  });

  it("emit - external fixup label", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ld bc,OuterLabel
        nop
        counter = counter + 1
    .until counter == 2
    OuterLabel: nop
    `,
      0x01,
      0x08,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00,
      0x00
    );
  });

  it("emit - nested loop, no label", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ld bc,#1234
        .loop 3
            inc a
        .endl
        counter = counter + 1
    .until counter == 2
    `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c
    );
  });

  it("emit - nested repeat, no label", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        ld bc,#1234
        counter1 = 0
        .repeat
            inc a
            counter1 = counter1 + 1
        .until counter1 == 3
        counter = counter + 1
    .until counter == 2
    `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c
    );
  });

  it("emit - nested loop, end labels", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        inc a
        .loop 2
            ld hl,EndLabel
            ld bc,NopLabel
        EndLabel: .endl
        NopLabel: nop
        counter = counter + 1
    .until counter == 1
    `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x0d,
      0x80,
      0x21,
      0x0d,
      0x80,
      0x01,
      0x0d,
      0x80,
      0x00
    );
  });

  it("emit - nested repeat, end labels", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        inc a
        counter1 = 0
        .repeat
            ld hl,EndLabel
            ld bc,NopLabel
            counter1 = counter1 + 1
        EndLabel:.until counter1 == 2
        NopLabel: nop
        counter = counter + 1
    .until counter == 1
    `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x0d,
      0x80,
      0x21,
      0x0d,
      0x80,
      0x01,
      0x0d,
      0x80,
      0x00
    );
  });

  it("emit - repeat with counter", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        .db $cnt
        counter = counter + 1
    .until counter == 3
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - nested loop with counters", async () => {
    await testCodeEmit(
      `
    counter = 0
    .repeat
        .db $cnt
        .loop 2
            .db $cnt
        .endl
        counter = counter + 1
    .until counter == 3
    `,
      0x01,
      0x01,
      0x02,
      0x02,
      0x01,
      0x02,
      0x03,
      0x01,
      0x02
    );
  });
});
