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
});
