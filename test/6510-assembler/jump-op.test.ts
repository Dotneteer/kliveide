import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - jump operations", async () => {
  it("jmp", async () => {
    await testCodeEmit("jmp $1234", 0x4c, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $1234
      jmp hello`,
      0x4c,
      0x34,
      0x12
    );
    await testCodeEmit("jmp ($1234)", 0x6c, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $1234
      jmp (hello)`,
      0x6c,
      0x34,
      0x12
    );
  });

  it("jmp fails with invalid operand", async () => {
    await codeRaisesError("jmp a", "M1005");
    await codeRaisesError("jmp #$40", "M1002");
    await codeRaisesError("jmp $40,y", "M1006");
    await codeRaisesError("jmp $40,x", "M1003");
    await codeRaisesError("jmp ($40,x)", "M1004");
    await codeRaisesError("jmp ($40),y", "M1004");
  });

  it("jsr", async () => {
    await testCodeEmit("jsr $1234", 0x20, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $1234
      jsr hello`,
      0x20,
      0x34,
      0x12
    );
  });

  it("jsr fails with invalid operand", async () => {
    await codeRaisesError("jsr a", "M1005");
    await codeRaisesError("jsr #$40", "M1002");
    await codeRaisesError("jsr $40,y", "M1006");
    await codeRaisesError("jsr ($40,x)", "M1004");
    await codeRaisesError("jsr ($40),y", "M1004");
    await codeRaisesError("jsr ($1234)", "M1007");
  });

  it("bpl", async () => {
    await testCodeEmit(
      `
      org $8000
      bpl $8010
      `,
      0x10,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bpl $7fc0
      `,
      0x10,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bpl jpaddr
      jpaddr .equ $8010
      `,
      0x10,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bpl jpaddr
      jpaddr .equ $7fc0
      `,
      0x10,
      0xbe
    );
  });

  it("bpl fails with invalid operand", async () => {
    await codeRaisesError("bpl a", "M1009");
    await codeRaisesError("bpl #$40", "M1009");
    await codeRaisesError("bpl $40,y", "M1009");
    await codeRaisesError("bpl ($40,x)", "M1009");
    await codeRaisesError("bpl ($40),y", "M1009");
    await codeRaisesError("bpl ($1234)", "M1009");
  });

  it("bpl fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bpl $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bpl jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bpl $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bpl jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("bmi", async () => {
    await testCodeEmit(
      `
      org $8000
      bmi $8010
      `,
      0x30,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bmi $7fc0
      `,
      0x30,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bmi jpaddr
      jpaddr .equ $8010
      `,
      0x30,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bmi jpaddr
      jpaddr .equ $7fc0
      `,
      0x30,
      0xbe
    );
  });

  it("bmi fails with invalid operand", async () => {
    await codeRaisesError("bmi a", "M1009");
    await codeRaisesError("bmi #$40", "M1009");
    await codeRaisesError("bmi $40,y", "M1009");
    await codeRaisesError("bmi ($40,x)", "M1009");
    await codeRaisesError("bmi ($40),y", "M1009");
    await codeRaisesError("bmi ($1234)", "M1009");
  });

  it("bmi fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bmi $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bmi jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bmi $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bmi jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("bvc", async () => {
    await testCodeEmit(
      `
      org $8000
      bvc $8010
      `,
      0x50,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bvc $7fc0
      `,
      0x50,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bvc jpaddr
      jpaddr .equ $8010
      `,
      0x50,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bvc jpaddr
      jpaddr .equ $7fc0
      `,
      0x50,
      0xbe
    );
  });

  it("bvc fails with invalid operand", async () => {
    await codeRaisesError("bvc a", "M1009");
    await codeRaisesError("bvc #$40", "M1009");
    await codeRaisesError("bvc $40,y", "M1009");
    await codeRaisesError("bvc ($40,x)", "M1009");
    await codeRaisesError("bvc ($40),y", "M1009");
    await codeRaisesError("bvc ($1234)", "M1009");
  });

  it("bvc fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bvc $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bvc jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bvc $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bvc jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("bvs", async () => {
    await testCodeEmit(
      `
      org $8000
      bvs $8010
      `,
      0x70,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bvs $7fc0
      `,
      0x70,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bvs jpaddr
      jpaddr .equ $8010
      `,
      0x70,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bvs jpaddr
      jpaddr .equ $7fc0
      `,
      0x70,
      0xbe
    );
  });

  it("bvs fails with invalid operand", async () => {
    await codeRaisesError("bvs a", "M1009");
    await codeRaisesError("bvs #$40", "M1009");
    await codeRaisesError("bvs $40,y", "M1009");
    await codeRaisesError("bvs ($40,x)", "M1009");
    await codeRaisesError("bvs ($40),y", "M1009");
    await codeRaisesError("bvs ($1234)", "M1009");
  });

  it("bvs fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bvs $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bvs jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bvs $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bvs jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("bcc", async () => {
    await testCodeEmit(
      `
      org $8000
      bcc $8010
      `,
      0x90,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bcc $7fc0
      `,
      0x90,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bcc jpaddr
      jpaddr .equ $8010
      `,
      0x90,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bcc jpaddr
      jpaddr .equ $7fc0
      `,
      0x90,
      0xbe
    );
  });

  it("bcc fails with invalid operand", async () => {
    await codeRaisesError("bcc a", "M1009");
    await codeRaisesError("bcc #$40", "M1009");
    await codeRaisesError("bcc $40,y", "M1009");
    await codeRaisesError("bcc ($40,x)", "M1009");
    await codeRaisesError("bcc ($40),y", "M1009");
    await codeRaisesError("bcc ($1234)", "M1009");
  });

  it("bcc fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bcc $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bcc jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bcc $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bcc jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("bcs", async () => {
    await testCodeEmit(
      `
      org $8000
      bcs $8010
      `,
      0xb0,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bcs $7fc0
      `,
      0xb0,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bcs jpaddr
      jpaddr .equ $8010
      `,
      0xb0,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bcs jpaddr
      jpaddr .equ $7fc0
      `,
      0xb0,
      0xbe
    );
  });

  it("bcs fails with invalid operand", async () => {
    await codeRaisesError("bcs a", "M1009");
    await codeRaisesError("bcs #$40", "M1009");
    await codeRaisesError("bcs $40,y", "M1009");
    await codeRaisesError("bcs ($40,x)", "M1009");
    await codeRaisesError("bcs ($40),y", "M1009");
    await codeRaisesError("bcs ($1234)", "M1009");
  });

  it("bcs fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bcs $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bcs jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bcs $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bcs jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("bne", async () => {
    await testCodeEmit(
      `
      org $8000
      bne $8010
      `,
      0xd0,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bne $7fc0
      `,
      0xd0,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      bne jpaddr
      jpaddr .equ $8010
      `,
      0xd0,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      bne jpaddr
      jpaddr .equ $7fc0
      `,
      0xd0,
      0xbe
    );
  });

  it("bne fails with invalid operand", async () => {
    await codeRaisesError("bne a", "M1009");
    await codeRaisesError("bne #$40", "M1009");
    await codeRaisesError("bne $40,y", "M1009");
    await codeRaisesError("bne ($40,x)", "M1009");
    await codeRaisesError("bne ($40),y", "M1009");
    await codeRaisesError("bne ($1234)", "M1009");
  });

  it("bne fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      bne $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bne jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bne $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      bne jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });

  it("beq", async () => {
    await testCodeEmit(
      `
      org $8000
      beq $8010
      `,
      0xf0,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      beq $7fc0
      `,
      0xf0,
      0xbe
    );
    await testCodeEmit(
      `
      org $8000
      beq jpaddr
      jpaddr .equ $8010
      `,
      0xf0,
      0x0e
    );
    await testCodeEmit(
      `
      org $8000
      beq jpaddr
      jpaddr .equ $7fc0
      `,
      0xf0,
      0xbe
    );
  });

  it("beq fails with invalid operand", async () => {
    await codeRaisesError("beq a", "M1009");
    await codeRaisesError("beq #$40", "M1009");
    await codeRaisesError("beq $40,y", "M1009");
    await codeRaisesError("beq ($40,x)", "M1009");
    await codeRaisesError("beq ($40),y", "M1009");
    await codeRaisesError("beq ($1234)", "M1009");
  });

  it("beq fails with a too far branch", async () => {
    await codeRaisesError(
      `
      org $8000
      beq $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      beq jpaddr
      jpaddr .equ $8200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      beq $7200
      `,
      "Z0403"
    );
    await codeRaisesError(
      `
      org $8000
      beq jpaddr
      jpaddr .equ $7200
      `,
      "Z0403"
    );
  });
});
