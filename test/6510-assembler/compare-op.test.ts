import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - compare operations", async () => {
  it("cmp", async () => {
    await testCodeEmit("cmp #$40", 0xc9, 0x40);
    await testCodeEmit("cmp #[$40+$20]", 0xc9, 0x60);
    await testCodeEmit("cmp $40", 0xc5, 0x40);
    await testCodeEmit("cmp $1234", 0xcd, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      cmp hello`,
      0xc5,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cmp hello`,
      0xcd,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      cmp hello
      hello .equ $1234`,
      0xcd,
      0x34,
      0x12
    );
    await testCodeEmit("cmp $40,x", 0xd5, 0x40);
    await testCodeEmit("cmp $1234,x", 0xdd, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      cmp hello,x`,
      0xd5,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cmp hello,x`,
      0xdd,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      cmp hello,x
      hello .equ $1234`,
      0xdd,
      0x34,
      0x12
    );
    await testCodeEmit("cmp $40,y", 0xd9, 0x40, 0x00);
    await testCodeEmit("cmp $1234,y", 0xd9, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      cmp hello,y`,
      0xd9,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cmp hello,y`,
      0xd9,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      cmp hello,y
      hello .equ $1234`,
      0xd9,
      0x34,
      0x12
    );
    await testCodeEmit("cmp ($40,x)", 0xc1, 0x40);
    await testCodeEmit("cmp ($1240,x)", 0xc1, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      cmp (hello,x)`,
      0xc1,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cmp (hello,x)`,
      0xc1,
      0x34
    );
    await testCodeEmit(
      `
      cmp (hello,x)
      hello .equ $1234`,
      0xc1,
      0x34
    );
    await testCodeEmit("cmp ($40),y", 0xd1, 0x40);
    await testCodeEmit("cmp ($1240), y", 0xd1, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      cmp (hello),y`,
      0xd1,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cmp (hello),y`,
      0xd1,
      0x34
    );
    await testCodeEmit(
      `
      cmp (hello),y
      hello .equ $1234`,
      0xd1,
      0x34
    );
  });

  it("cmp fails with invalid operand", async () => {
    await codeRaisesError("cmp a", "M1005");
    await codeRaisesError("cmp ($1234)", "M1007");
  });

  it("cpx", async () => {
    await testCodeEmit("cpx #$40", 0xe0, 0x40);
    await testCodeEmit("cpx #[$40+$20]", 0xe0, 0x60);
    await testCodeEmit("cpx $40", 0xe4, 0x40);
    await testCodeEmit("cpx $1234", 0xec, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      cpx hello`,
      0xe4,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cpx hello`,
      0xec,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      cpx hello
      hello .equ $1234`,
      0xec,
      0x34,
      0x12
    );
  });

  it("cpx fails with invalid operand", async () => {
    await codeRaisesError("cpx a", "M1005");
    await codeRaisesError("cpx $1234,x", "M1003");
    await codeRaisesError("cpx $1234,y", "M1006");
    await codeRaisesError("cpx ($1234,x)", "M1004");
    await codeRaisesError("cpx ($1234),y", "M1004");
    await codeRaisesError("cpx ($1234)", "M1007");
  });

  it("cpy", async () => {
    await testCodeEmit("cpy #$40", 0xc0, 0x40);
    await testCodeEmit("cpy #[$40+$20]", 0xc0, 0x60);
    await testCodeEmit("cpy $40", 0xc4, 0x40);
    await testCodeEmit("cpy $1234", 0xcc, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      cpy hello`,
      0xc4,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      cpy hello`,
      0xcc,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      cpy hello
      hello .equ $1234`,
      0xcc,
      0x34,
      0x12
    );
  });

  it("cpy fails with invalid operand", async () => {
    await codeRaisesError("cpy a", "M1005");
    await codeRaisesError("cpy $1234,x", "M1003");
    await codeRaisesError("cpy $1234,y", "M1006");
    await codeRaisesError("cpy ($1234,x)", "M1004");
    await codeRaisesError("cpy ($1234),y", "M1004");
    await codeRaisesError("cpy ($1234)", "M1007");
  });

  it("bit", async () => {
    await testCodeEmit("bit $40", 0x24, 0x40);
    await testCodeEmit("bit $1234", 0x2c, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      bit hello`,
      0x24,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      bit hello`,
      0x2c,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      bit hello
      hello .equ $1234`,
      0x2c,
      0x34,
      0x12
    );
  });

  it("bit fails with invalid operand", async () => {
    await codeRaisesError("bit a", "M1005");
    await codeRaisesError("bit #$40", "M1002");
    await codeRaisesError("bit $1234,x", "M1003");
    await codeRaisesError("bit $1234,y", "M1006");
    await codeRaisesError("bit ($1234,x)", "M1004");
    await codeRaisesError("bit ($1234),y", "M1004");
    await codeRaisesError("bit ($1234)", "M1007");
  });
});
