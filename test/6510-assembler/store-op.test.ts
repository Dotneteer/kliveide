import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - register store operations", async () => {
  it("sta", async () => {
    await testCodeEmit("sta $40", 0x85, 0x40);
    await testCodeEmit("sta $1234", 0x8d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sta hello`,
      0x85,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sta hello`,
      0x8d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sta hello
      hello .equ $1234`,
      0x8d,
      0x34,
      0x12
    );
    await testCodeEmit("sta $40,x", 0x95, 0x40);
    await testCodeEmit("sta $1234,x", 0x9d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sta hello,x`,
      0x95,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sta hello,x`,
      0x9d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sta hello,x
      hello .equ $1234`,
      0x9d,
      0x34,
      0x12
    );
    await testCodeEmit("sta $40,y", 0x99, 0x40, 0x00);
    await testCodeEmit("sta $1234,y", 0x99, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sta hello,y`,
      0x99,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sta hello,y`,
      0x99,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sta hello,y
      hello .equ $1234`,
      0x99,
      0x34,
      0x12
    );
    await testCodeEmit("sta ($40,x)", 0x81, 0x40);
    await testCodeEmit("sta ($1240,x)", 0x81, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      sta (hello,x)`,
      0x81,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sta (hello,x)`,
      0x81,
      0x34
    );
    await testCodeEmit(
      `
      sta (hello,x)
      hello .equ $1234`,
      0x81,
      0x34
    );
    await testCodeEmit("sta ($40),y", 0x91, 0x40);
    await testCodeEmit("sta ($1240), y", 0x91, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      sta (hello),y`,
      0x91,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sta (hello),y`,
      0x91,
      0x34
    );
    await testCodeEmit(
      `
      sta (hello),y
      hello .equ $1234`,
      0x91,
      0x34
    );
  });

  it("sta fails with invalid operand", async () => {
    await codeRaisesError("sta a", "M1005");
    await codeRaisesError("sta #$40", "M1002");
    await codeRaisesError("sta ($1234)", "M1007");
  });

  it("stx", async () => {
    await testCodeEmit("stx $40", 0x86, 0x40);
    await testCodeEmit("stx $1234", 0x8e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      stx hello`,
      0x86,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      stx hello`,
      0x8e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      stx hello
      hello .equ $1234`,
      0x8e,
      0x34,
      0x12
    );
    await testCodeEmit("stx $40,y", 0x96, 0x40);
    await testCodeEmit("stx $1234,y", 0x96, 0x34);
    await testCodeEmit(
      `
      hello .equ $34
      stx hello,y`,
      0x96,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      stx hello,y`,
      0x96,
      0x34
    );
    await testCodeEmit(
      `
      stx hello,y
      hello .equ $1234`,
      0x96,
      0x34
    );
  });

  it("stx fails with invalid operand", async () => {
    await codeRaisesError("stx a", "M1005");
    await codeRaisesError("stx #$40", "M1002");
    await codeRaisesError("stx ($40,x)", "M1004");
    await codeRaisesError("stx ($40),y", "M1004");
    await codeRaisesError("stx ($1234)", "M1007");
  });


  it("sty", async () => {
    await testCodeEmit("sty $40", 0x84, 0x40);
    await testCodeEmit("sty $1234", 0x8c, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sty hello`,
      0x84,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sty hello`,
      0x8c,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sty hello
      hello .equ $1234`,
      0x8c,
      0x34,
      0x12
    );
    await testCodeEmit("sty $40,x", 0x94, 0x40);
    await testCodeEmit("sty $1234,x", 0x94, 0x34);
    await testCodeEmit(
      `
      hello .equ $34
      sty hello,x`,
      0x94,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sty hello,x`,
      0x94,
      0x34
    );
    await testCodeEmit(
      `
      sty hello,x
      hello .equ $1234`,
      0x94,
      0x34
    );
  });

  it("sty fails with invalid operand", async () => {
    await codeRaisesError("sty a", "M1005");
    await codeRaisesError("sty #$40", "M1002");
    await codeRaisesError("sty $40,y", "M1006");
    await codeRaisesError("sty ($40,x)", "M1004");
    await codeRaisesError("sty ($40),y", "M1004");
    await codeRaisesError("sty ($1234)", "M1007");
  });

  it("dec", async () => {
    await testCodeEmit("dec $40", 0xc6, 0x40);
    await testCodeEmit("dec $1234", 0xce, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      dec hello`,
      0xc6,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      dec hello`,
      0xce,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      dec hello
      hello .equ $1234`,
      0xce,
      0x34,
      0x12
    );
    await testCodeEmit("dec $40,x", 0xd6, 0x40);
    await testCodeEmit("dec $1234,x", 0xde, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      dec hello,x`,
      0xd6,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      dec hello,x`,
      0xde,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      dec hello,x
      hello .equ $1234`,
      0xde,
      0x34,
      0x12
    );
  });

  it("dec fails with invalid operand", async () => {
    await codeRaisesError("dec a", "M1005");
    await codeRaisesError("dec #$40", "M1002");
    await codeRaisesError("dec $40,y", "M1006");
    await codeRaisesError("dec ($40,x)", "M1004");
    await codeRaisesError("dec ($40),y", "M1004");
    await codeRaisesError("dec ($1234)", "M1007");
  });

  it("inc", async () => {
    await testCodeEmit("inc $40", 0xe6, 0x40);
    await testCodeEmit("inc $1234", 0xee, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      inc hello`,
      0xe6,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      inc hello`,
      0xee,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      inc hello
      hello .equ $1234`,
      0xee,
      0x34,
      0x12
    );
    await testCodeEmit("inc $40,x", 0xf6, 0x40);
    await testCodeEmit("inc $1234,x", 0xfe, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      inc hello,x`,
      0xf6,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      inc hello,x`,
      0xfe,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      inc hello,x
      hello .equ $1234`,
      0xfe,
      0x34,
      0x12
    );
  });

  it("inc fails with invalid operand", async () => {
    await codeRaisesError("inc a", "M1005");
    await codeRaisesError("inc #$40", "M1002");
    await codeRaisesError("inc $40,y", "M1006");
    await codeRaisesError("inc ($40,x)", "M1004");
    await codeRaisesError("inc ($40),y", "M1004");
    await codeRaisesError("inc ($1234)", "M1007");
  });
});
