import "mocha";
import * as expect from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { AssemblerOptions } from "../../main/z80-compiler/assembler-in-out";
import { Z80Assembler } from "../../main/z80-compiler/assembler";

describe("Assembler - .loop", async () => {
  it("ent - fails in loop", async () => {
    await codeRaisesError(
      `
      .loop 3
      .ent #8000;
      .endl
    `,
      "Z0310"
    );
  });

  it("xent - fails in loop", async () => {
    await codeRaisesError(
      `
      .loop 3
      .xent #8000;
      .endl
    `,
      "Z0310"
    );
  });

  it(".endl - fails without loop", async () => {
    await codeRaisesError(".endl", "Z0704");
    await codeRaisesError(".ENDL", "Z0704");
    await codeRaisesError("endl", "Z0704");
    await codeRaisesError("ENDL", "Z0704");
    await codeRaisesError(".lend", "Z0704");
    await codeRaisesError(".LEND", "Z0704");
    await codeRaisesError("lend", "Z0704");
    await codeRaisesError("LEND", "Z0704");
  });

  it("loop - missing loop end", async () => {
    await codeRaisesError(
      `
      .loop 3
      ld a,b
    `,
      "Z0701"
    );
  });

  it("loop - fails with string", async () => {
    await codeRaisesError(
      `
      .loop "Hello"
      ld a,b
      .endl
    `,
      "Z0603"
    );
  });

  it("loop - empty body", async () => {
    await testCodeEmit(
      `
      .loop 3
      .endl
    `
    );
  });

  it("loop - labeled, empty body", async () => {
    await testCodeEmit(
      `
      MyLoop: .loop 3
      .endl
    `
    );
  });

  it("loop - hanging label, empty body", async () => {
    await testCodeEmit(
      `
      MyLoop:
        .loop 3
        .endl
    `
    );
  });

  it("loop - duplicate start label", async () => {
    await codeRaisesError(
      `
    MyLoop: .loop 3
      .endl
    MyLoop: .loop 3
      .endl
    `,
      "Z0501"
    );
  });

  it("loop - end label, empty body", async () => {
    await testCodeEmit(
      `
      .loop 3
    MyEnd: .endl
    `
    );
  });

  it("loop - hanging end label, empty body", async () => {
    await testCodeEmit(
      `
      .loop 3
    MyEnd:
      .endl
    `
    );
  });

  it("loop - invalid counter", async () => {
    await codeRaisesError(
      `
      .loop 3+unknown
      .endl
    `,
      "Z0605"
    );
  });

  it("loop - invalid fixup counter", async () => {
    await codeRaisesError(
      `
      .loop 3+later
      .endl
    later: .equ 5
    `,
      "Z0605"
    );
  });

  it("loop - valid counter, empty body", async () => {
    await testCodeEmit(
      `
    value: .equ 5
      .loop 3+value
      .endl
    `
    );
  });

  it("loop - too great value", async () => {
    await codeRaisesError(
      `
      .loop #FFFF + 1
      .endl
    `,
      "Z0702"
    );
  });

  it("emit - single line", async () => {
    await testCodeEmit(
      `
    .loop 2
      ld bc,#1234
    .endl
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
    .loop 2
      inc b
      inc c
      inc d
    .endl
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
    .loop 2
      ThisLabel: ld bc,ThisLabel
    .endl
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
    .loop 2
      ld bc,ThisLabel
      ThisLabel: nop
    .endl
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
    StartLabel: .loop 2
      ld bc,StartLabel
      nop
    .endl
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
    .loop 2
      ld bc,EndLabel
      nop
    EndLabel: .endl
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
    .loop 2
      ld bc,OuterLabel
      nop
    .endl
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
      .loop 100
    Value: .var 100 + Other;
      .endl
    `;

    const output = await compiler.compile(source, options);

    expect(output.errorCount).toBe(4);
    expect(output.errors[3].errorCode === "Z0703").toBe(true);
  });

  it("emit - nested loop, no label", async () => {
    await testCodeEmit(
      `
    .loop 2
      ld bc,#1234
      .loop 3
          inc a
      .endl
    .endl
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

  it("emit - nested loop, end labels #1", async () => {
    await testCodeEmit(
      `
    .loop 1
      inc a
    .loop 2
          ld hl,EndLabel
          ld bc,NopLabel
    EndLabel: .endl
    NopLabel: nop
    .endl
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

  it("emit - nested loop, end labels #2", async () => {
    await testCodeEmit(
      `
    .loop 1
      inc a
      .loop 2
          ld hl,EndLabel
          ld bc,NopLabel
      EndLabel: 
          nop
          .endl
      NopLabel: nop
    .endl
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

  it("emit - loop with .var", async () => {
    await testCodeEmit(
      `
    index = 1;
    .loop 2
        ld a,index
        index = index + 1
        nop
    EndLabel: .endl
    `,
      0x3e,
      0x01,
      0x00,
      0x3e,
      0x02,
      0x00
    );
  });

  it("emit - loop with nested .var", async () => {
    await testCodeEmit(
      `
    index = 1;
    .loop 2
        ld a,index
        .loop 3
            index = index + 1
        nop
        .endl
    EndLabel: .endl
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

  it("emit - loop with counter", async () => {
    await testCodeEmit(
      `
    .loop 3
      .db $cnt
    .endl
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - nested loop with counters", async () => {
    await testCodeEmit(
      `
    .loop 3
      .db $cnt
      .loop 2
          .db .cnt
      .endl
    .endl
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
