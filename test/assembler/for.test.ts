import "mocha";
import { expect } from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/assembler";
import { AssemblerOptions } from "@main/z80-compiler/assembler-in-out";

describe("Assembler - .for", async () => {
  it("ent - fails in for", async () => {
    await codeRaisesError(
      `
      .for _i = 1 .to 3
      .ent #8000;
      .next
    `,
      "Z0310"
    );
  });

  it("xent - fails in for", async () => {
    await codeRaisesError(
      `
      .for _i = 1 .to 3
      .xent #8000;
      .next
    `,
      "Z0310"
    );
  });

  it("next - fails without for", async () => {
    await codeRaisesError(".next", "Z0704");
    await codeRaisesError(".NEXT", "Z0704");
    await codeRaisesError("next", "Z0704");
    await codeRaisesError("NEXT", "Z0704");
  });

  it("for - missing loop end", async () => {
    await codeRaisesError(
      `
    .for _i = 1 to 3
    ld a,b
    `,
      "Z0701"
    );
  });

  it("for - variable resuse in global scope fails", async () => {
    await codeRaisesError(
      `
    _i = 0
    .for _i = 1 .to 3
    .next
    `,
      "Z0502"
    );
  });

  it("for - variable resuse in local scope fails", async () => {
    await codeRaisesError(
      `
    _i = 0
    .for _i = 1 .to 3
        .for _i = 1 to 2
        .next
    .next
    `,
      "Z0502"
    );
  });

  it("for - fails with string start", async () => {
    await codeRaisesError(
      `
      .for _i = "hello" .to 3
      .next
    `,
      "Z0603"
    );
  });

  it("for - fails with string to", async () => {
    await codeRaisesError(
      `
      .for _i = 3 .to "hello"
      .next
    `,
      "Z0603"
    );
  });

  it("for - fails with string step", async () => {
    await codeRaisesError(
      `
      .for _i = 3 .to 10 .step "hello"
      .next
    `,
      "Z0603"
    );
  });

  it("for - empty body", async () => {
    await testCodeEmit(
      `
      .for _i = 1 .to 3
      .next
    `
    );
  });

  it("for - labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyLoop: .for _i = 1 to 3
    .next
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyLoop")).toBe(true);
    expect(output.getSymbol("MyLoop").value.value).toBe(0x8000);
  });

  it("for - hanging labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    MyLoop:
      .for _i = 1 to 3
      .next
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyLoop")).toBe(true);
    expect(output.getSymbol("MyLoop").value.value).toBe(0x8000);
  });

  it("for - end labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .for _i = 1 .to 3
    MyEnd: .next
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyEnd")).toBe(false);
  });

  it("for - hanging end labeled with empty body", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .for _i = 1 .to 3
    MyEnd:
      .next
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyEnd")).toBe(false);
  });

  it("for - invalid start value", async () => {
    await codeRaisesError(
      `
    .for _i = 3+unknown to 5
    .next
    `,
      "Z0605"
    );
  });

  it("for - invalid to value", async () => {
    await codeRaisesError(
      `
    .for _i = 3 to 5+unknown
    .next
    `,
      "Z0605"
    );
  });

  it("for - invalid step value", async () => {
    await codeRaisesError(
      `
    .for _i = 3 to 5 step 1+unknown
    .next
    `,
      "Z0605"
    );
  });

  it("for - zero step", async () => {
    await codeRaisesError(
      `
    .for _i = 3 to 5 step 0
    .next
    `,
      "Z0706"
    );
  });

  it("for - zero step (float)", async () => {
    await codeRaisesError(
      `
    .for _i = 3 to 5 step 0.0
    .next
    `,
      "Z0706"
    );
  });

  it("for - fixup start value", async () => {
    await codeRaisesError(
      `
    .for _i = 3+later to 4
    .next
    later: .equ 5
    `,
      "Z0605"
    );
  });

  it("for - fixup to value", async () => {
    await codeRaisesError(
      `
    .for _i = 3 to 4+later
    .next
    later: .equ 5
    `,
      "Z0605"
    );
  });

  it("for - fixup step value", async () => {
    await codeRaisesError(
      `
    .for _i = 3 to 4 step later
    .next
    later: .equ 5
    `,
      "Z0605"
    );
  });

  it("while - valid counter in start", async () => {
    await testCodeEmit(
      `
      value: .equ 5
      .for _i = 3+value .to 10
      .next
    `
    );
  });

  it("while - valid counter in to", async () => {
    await testCodeEmit(
      `
      value: .equ 5
      .for _i = 3 .to 10+value
      .next
    `
    );
  });

  it("while - valid counter in step", async () => {
    await testCodeEmit(
      `
      value: .equ 5
      .for _i = 3 .to 10 .step value
      .next
    `
    );
  });

  it("for - too long loop", async () => {
    await codeRaisesError(
      `
    .for _i = 0.0 to 100.0 step 0.00001
    .next
    `,
      "Z0702"
    );
  });

  it("emit - single line", async () => {
    await testCodeEmit(
      `
    .for _i = 1 .to 2
      ld bc,#1234
    .next
    `,
      0x01,
      0x34,
      0x12,
      0x01,
      0x34,
      0x12
    );
  });

  it("emit - multiple lines", async () => {
    await testCodeEmit(
      `
    .for _i = 1 .to 2
      inc b
      inc c
      inc d
    .next
    `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("emit - reverse loop", async () => {
    await testCodeEmit(
      `
    .for _i = 2 .to 1 step -1
      inc b
      inc c
      inc d
    .next
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
    .for _i = 1 .to 2
      ThisLabel: ld bc,ThisLabel
    .next
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
    .for _i = 2 .to 1 step -1
      ld bc,ThisLabel
      ThisLabel: nop
    .next
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
    StartLabel: .for _i = 1 to 2
      ld bc,StartLabel
      nop
    .next
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
    .for _i = 1 .to 2
      ld bc,EndLabel
      nop
    EndLabel: .next
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
    .for _i = 2 to 1 step -1
      ld bc,OuterLabel
      nop
    .next
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

  it("too many errors", async () => {
    const compiler = new Z80Assembler();
    const options = new AssemblerOptions();
    options.maxLoopErrorsToReport = 3;
    const source = `
    .for _i = 1 .to 100
      Value: .var 100 + Other;
    .next
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(4);
    expect(output.errors[3].errorCode === "Z0703").toBe(true);
  });

  it("emit - nested loop, no label", async () => {
    await testCodeEmit(
      `
    .for _i = 1 to 2
      ld bc,#1234
      .for _j = 1 to 3
          inc a
      .next
    .next
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

  it("emit - nested for, end labels #1", async () => {
    await testCodeEmit(
      `
    .for _i = 1 to 1
      inc a
      .for _j = 1 to 2
          ld hl,EndLabel
          ld bc,NopLabel
      EndLabel: .next
      NopLabel: nop
    .next
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

  it("emit - nested for, end labels #2", async () => {
    await testCodeEmit(
      `
    .for _i = 1 to 1
      inc a
      .for _j = 1 to 2
          ld hl,EndLabel
          ld bc,NopLabel
      EndLabel: 
          nop
          .next
      NopLabel: nop
    .next

    `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x0f,
      0x80,
      0x00,
      0x21,
      0x0e,
      0x80,
      0x01,
      0x0f,
      0x80,
      0x00,
      0x00
    );
  });

  it("emit - with var", async () => {
    await testCodeEmit(
      `
      index = 1;
      .for _i = 1 to 2
          ld a,index
          index = index + 1
          nop
      EndLabel: .next
    `,
      0x3e,
      0x01,
      0x00,
      0x3e,
      0x02,
      0x00
    );
  });

  it("emit - with nested var", async () => {
    await testCodeEmit(
      `
    index = 1;
    .for _i = 1 to 2
        ld a,index
        .for _j = 1 to 3
            index = index + 1
        nop
        .next
    EndLabel: .next
    `,
      0x3e,
      0x01,
      0x00,
      0x00,
      0x00,
      0x3e,
      0x04,
      0x00,
      0x00,
      0x00
    );
  });

  it("emit - for with counter", async () => {
    await testCodeEmit(
      `
    .for _i = 6 to 8
      .db $cnt
    .next
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - nested for with counters", async () => {
    await testCodeEmit(
      `
    .for _i = 6 to 8
      .db $cnt
      .for _j = 1 to 2
          .db $cnt
      .next
    .next
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

  it("emit - loop variable", async () => {
    await testCodeEmit(
      `
    .for _i = 6 to 8
      .db _i
    .next
    `,
      0x06,
      0x07,
      0x08
    );
  });

  it("emit - nested loop variables", async () => {
    await testCodeEmit(
      `
    .for _i = 6 to 8
      .for _j = 1 to 2
        .db #10 * _i + _j
      .next
    .next
    `,
      0x61,
      0x62,
      0x71,
      0x72,
      0x81,
      0x82
    );
  });
});
