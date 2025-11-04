import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - register load operations", async () => {
  it("lda", async () => {
    await testCodeEmit("lda #$40", 0xa9, 0x40);
    await testCodeEmit("lda #[$40+$20]", 0xa9, 0x60);
    await testCodeEmit("lda $40", 0xa5, 0x40);
    await testCodeEmit("lda $1234", 0xad, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      lda hello`,
      0xa5,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lda hello`,
      0xad,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lda hello
      hello .equ $1234`,
      0xad,
      0x34,
      0x12
    );
    await testCodeEmit("lda $40,x", 0xb5, 0x40);
    await testCodeEmit("lda $1234,x", 0xbd, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      lda hello,x`,
      0xb5,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lda hello,x`,
      0xbd,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lda hello,x
      hello .equ $1234`,
      0xbd,
      0x34,
      0x12
    );
    await testCodeEmit("lda $40,y", 0xb9, 0x40, 0x00);
    await testCodeEmit("lda $1234,y", 0xb9, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      lda hello,y`,
      0xb9,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lda hello,y`,
      0xb9,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lda hello,y
      hello .equ $1234`,
      0xb9,
      0x34,
      0x12
    );
    await testCodeEmit("lda ($40,x)", 0xa1, 0x40);
    await testCodeEmit("lda ($1240,x)", 0xa1, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      lda (hello,x)`,
      0xa1,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lda (hello,x)`,
      0xa1,
      0x34
    );
    await testCodeEmit(
      `
      lda (hello,x)
      hello .equ $1234`,
      0xa1,
      0x34
    );
    await testCodeEmit("lda ($40),y", 0xb1, 0x40);
    await testCodeEmit("lda ($1240), y", 0xb1, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      lda (hello),y`,
      0xb1,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lda (hello),y`,
      0xb1,
      0x34
    );
    await testCodeEmit(
      `
      lda (hello),y
      hello .equ $1234`,
      0xb1,
      0x34
    );
  });

  it("lda fails with invalid operand", async () => {
    await codeRaisesError("lda a", "M1005");
    await codeRaisesError("lda ($1234)", "M1007");
  });

  it("ldx", async () => {
    await testCodeEmit("ldx #$40", 0xa2, 0x40);
    await testCodeEmit("ldx #[$40+$20]", 0xa2, 0x60);
    await testCodeEmit("ldx $40", 0xa6, 0x40);
    await testCodeEmit("ldx $1234", 0xae, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ldx hello`,
      0xa6,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ldx hello`,
      0xae,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ldx hello
      hello .equ $1234`,
      0xae,
      0x34,
      0x12
    );
    await testCodeEmit("ldx $40,y", 0xb6, 0x40);
    await testCodeEmit("ldx $1234,y", 0xbe, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ldx hello,y`,
      0xb6,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ldx hello,y`,
      0xbe,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ldx hello,y
      hello .equ $1234`,
      0xbe,
      0x34,
      0x12
    );
  });

  it("ldx fails with invalid operand", async () => {
    await codeRaisesError("ldx a", "M1005");
    await codeRaisesError("ldx $40,x", "M1003");
    await codeRaisesError("ldx ($40,x)", "M1004");
    await codeRaisesError("ldx ($40),y", "M1004");
    await codeRaisesError("ldx ($1234)", "M1007");
  });

  it("ldy", async () => {
    await testCodeEmit("ldy #$40", 0xa0, 0x40);
    await testCodeEmit("ldy #[$40+$20]", 0xa0, 0x60);
    await testCodeEmit("ldy $40", 0xa4, 0x40);
    await testCodeEmit("ldy $1234", 0xac, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ldy hello`,
      0xa4,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ldy hello`,
      0xac,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ldy hello
      hello .equ $1234`,
      0xac,
      0x34,
      0x12
    );
    await testCodeEmit("ldy $40,x", 0xb4, 0x40);
    await testCodeEmit("ldy $1234,x", 0xbc, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ldy hello,x`,
      0xb4,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ldy hello,x`,
      0xbc,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ldy hello,x
      hello .equ $1234`,
      0xbc,
      0x34,
      0x12
    );
  });

  it("ldy fails with invalid operand", async () => {
    await codeRaisesError("ldy a", "M1005");
    await codeRaisesError("ldy $40,y", "M1006");
    await codeRaisesError("ldy ($40,x)", "M1004");
    await codeRaisesError("ldy ($40),y", "M1004");
    await codeRaisesError("ldy ($1234)", "M1007");
  });
});
