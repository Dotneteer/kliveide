import "mocha";
import * as expect from "expect";

import {
  codeRaisesError,
  testCodeEmit,
} from "./test-helpers";
import { Z80Assembler } from "../../main/z80-compiler/assembler";

describe("Assembler - .proc", () => {
  it("ent - fails in proc", () => {
    codeRaisesError(
      `
    .proc
    .ent #8000;
    .endp
    `,
      "Z0310"
    );
  });

  it("xent - fails in proc", () => {
    codeRaisesError(
      `
    .proc
    .xent #8000;
    .endp
    `,
      "Z0310"
    );
  });

  it(".endp - fails without proc", () => {
    codeRaisesError(".endp", "Z0704");
    codeRaisesError(".ENDP", "Z0704");
    codeRaisesError("endp", "Z0704");
    codeRaisesError("ENDP", "Z0704");
    codeRaisesError(".pend", "Z0704");
    codeRaisesError(".PEND", "Z0704");
    codeRaisesError("pend", "Z0704");
    codeRaisesError("PEND", "Z0704");
  });

  it("proc - missing proc end", () => {
    codeRaisesError(
      `
      .proc
      ld a,b
    `,
      "Z0701"
    );
  });

  it("proc - empty body", () => {
    testCodeEmit(
      `
      .proc
      .endp
    `
    );
  });

  it("proc - start label", async () => {
    const compiler = new Z80Assembler();
    const source = `
    Start: .proc
    .endp
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("Start")).toBe(true);
    expect(output.getSymbol("Start").value.value).toBe(0x8000);
  });

  it("proc - hanging start label", async () => {
    const compiler = new Z80Assembler();
    const source = `
    Start:
    .proc
    .endp
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("Start")).toBe(true);
    expect(output.getSymbol("Start").value.value).toBe(0x8000);
  });

  it("proc - end label", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .proc
    MyEnd: .endp
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyEnd")).toBe(false);
  });

  it("proc - hanging end label", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .proc
    MyEnd:
    .endp
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("MyEnd")).toBe(false);
  });

  it("emit - single line", () => {
    testCodeEmit(
      `
    .proc
      ld bc,#1234
    .endp
    `,
      0x01,
      0x34,
      0x12
    );
  });

  it("emit - multiple lines", () => {
    testCodeEmit(
      `
    .proc
      inc b
      inc c
      inc d
    .endp
    `,
      0x04,
      0x0c,
      0x14
    );
  });

  it("emit - internal label", () => {
    testCodeEmit(
      `
    .proc
      ThisLabel: ld bc,ThisLabel
    .endp
    `,
      0x01,
      0x00,
      0x80
    );
  });

  it("emit - fixup label", () => {
    testCodeEmit(
      `
    .proc
      ld bc,ThisLabel
      ThisLabel: nop
    .endp
    `,
      0x01,
      0x03,
      0x80,
      0x00
    );
  });

  it("emit - proc start label", () => {
    testCodeEmit(
      `
    StartLabel: .proc
      ld bc,StartLabel
      nop
    .endp
    `,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("emit - proc end label", () => {
    testCodeEmit(
      `
    .proc
      ld bc,EndLabel
      nop
    EndLabel: .endp
    `,
      0x01,
      0x04,
      0x80,
      0x00
    );
  });

  it("emit - external fixup label", () => {
    testCodeEmit(
      `
    .proc
      ld bc,OuterLabel
      nop
    .endp
    OuterLabel: nop
    `,
      0x01,
      0x04,
      0x80,
      0x00,
      0x00
    );
  });

  it("emit - nested proc", () => {
    testCodeEmit(
      `
    .proc
    ld bc,#1234
      .proc
          inc a
      .endp
    .endp
    `,
      0x01,
      0x34,
      0x12,
      0x3c
    );
  });

  it("emit - nested proc with labels", () => {
    testCodeEmit(
      `
    .proc
      inc a
      .proc
        ld hl,EndLabel
        ld bc,NopLabel
      EndLabel: .endp
    NopLabel: nop
    .endp
    `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x07,
      0x80,
      0x00
    );
  });

  it("emit - nested proc with labels #2", () => {
    testCodeEmit(
      `
    .proc
      inc a
      .proc
        ld hl,EndLabel
        ld bc,NopLabel
    EndLabel: 
        nop
        .endp
    NopLabel: nop
    .endp
    `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x08,
      0x80,
      0x00,
      0x00
    );
  });

  it("emit - proc with var", () => {
    testCodeEmit(
      `
    index = 1;
    .proc
      ld a,index
      index = index + 1
      nop
      ld a,index
    EndLabel: .endp
    `,
      0x3e,
      0x01,
      0x00,
      0x3e,
      0x02
    );
  });

  it("emit - proc with nested var", () => {
    testCodeEmit(
      `
    index = 1;
    .proc
      index = 5
      ld a,index
      index := index + 1
      nop
      ld a,index
    EndLabel: .endp
    `,
      0x3e,
      0x05,
      0x00,
      0x3e,
      0x06
    );
  });

  it("emit - nested proc with nested var #1", () => {
    testCodeEmit(
      `
    index = 1;
    .proc
      ld a,index
      .proc
        index = index + 1
        nop
        ld a,index
      .endp
    EndLabel: .endp
    `,
      0x3e,
      0x01,
      0x00,
      0x3e,
      0x02
    );
  });

  it("emit - nested proc with nested var #2", () => {
    testCodeEmit(
      `
    index .equ 1;
    .proc
      ld a,index
      .proc
        nop
        index .equ 5
        ld a,index
      .endp
      ld a,index
    EndLabel: .endp
    `,
      0x3e,
      0x01,
      0x00,
      0x3e,
      0x05,
      0x3e,
      0x01
    );
  });

});
