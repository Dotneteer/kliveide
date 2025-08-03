import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - register load operations", async () => {
  it("and", async () => {
    await testCodeEmit("and #$40", 0x29, 0x40);
    await testCodeEmit("and #[$40+$20]", 0x29, 0x60);
    await testCodeEmit("and $40", 0x25, 0x40);
    await testCodeEmit("and $1234", 0x2d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      and hello`,
      0x25,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      and hello`,
      0x2d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      and hello
      hello .equ $1234`,
      0x2d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      and hello
      hello .equ $1234`,
      0x2d,
      0x34,
      0x12
    );
    await testCodeEmit("and $40,x", 0x35, 0x40);
    await testCodeEmit("and $1234,x", 0x3d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      and hello,x`,
      0x35,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      and hello,x`,
      0x3d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      and hello,x
      hello .equ $1234`,
      0x3d,
      0x34,
      0x12
    );
    await testCodeEmit("and $40,y", 0x39, 0x40, 0x00);
    await testCodeEmit("and $1234,y", 0x39, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      and hello,y`,
      0x39,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      and hello,y`,
      0x39,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      and hello,y
      hello .equ $1234`,
      0x39,
      0x34,
      0x12
    );
    await testCodeEmit("and ($40,x)", 0x21, 0x40);
    await testCodeEmit("and ($1240,x)", 0x21, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      and (hello,x)`,
      0x21,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      and (hello,x)`,
      0x21,
      0x34
    );
    await testCodeEmit(
      `
      and (hello,x)
      hello .equ $1234`,
      0x21,
      0x34
    );
    await testCodeEmit("and ($40),y", 0x31, 0x40);
    await testCodeEmit("and ($1240), y", 0x31, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      and (hello),y`,
      0x31,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      and (hello),y`,
      0x31,
      0x34
    );
    await testCodeEmit(
      `
      and (hello),y
      hello .equ $1234`,
      0x31,
      0x34
    );
  });

  it("and fails with invalid addressing", async () => {
    await codeRaisesError("and a", "M1005");
    await codeRaisesError("and ($1234)", "M1007");
  });

  it("eor", async () => {
    await testCodeEmit("eor #$40", 0x49, 0x40);
    await testCodeEmit("eor #[$40+$20]", 0x49, 0x60);
    await testCodeEmit("eor $40", 0x45, 0x40);
    await testCodeEmit("eor $1234", 0x4d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      eor hello`,
      0x45,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      eor hello`,
      0x4d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      eor hello
      hello .equ $1234`,
      0x4d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      eor hello
      hello .equ $1234`,
      0x4d,
      0x34,
      0x12
    );
    await testCodeEmit("eor $40,x", 0x55, 0x40);
    await testCodeEmit("eor $1234,x", 0x5d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      eor hello,x`,
      0x55,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      eor hello,x`,
      0x5d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      eor hello,x
      hello .equ $1234`,
      0x5d,
      0x34,
      0x12
    );
    await testCodeEmit("eor $40,y", 0x59, 0x40, 0x00);
    await testCodeEmit("eor $1234,y", 0x59, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      eor hello,y`,
      0x59,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      eor hello,y`,
      0x59,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      eor hello,y
      hello .equ $1234`,
      0x59,
      0x34,
      0x12
    );
    await testCodeEmit("eor ($40,x)", 0x41, 0x40);
    await testCodeEmit("eor ($1240,x)", 0x41, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      eor (hello,x)`,
      0x41,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      eor (hello,x)`,
      0x41,
      0x34
    );
    await testCodeEmit(
      `
      eor (hello,x)
      hello .equ $1234`,
      0x41,
      0x34
    );
    await testCodeEmit("eor ($40),y", 0x51, 0x40);
    await testCodeEmit("eor ($1240), y", 0x51, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      eor (hello),y`,
      0x51,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      eor (hello),y`,
      0x51,
      0x34
    );
    await testCodeEmit(
      `
      eor (hello),y
      hello .equ $1234`,
      0x51,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      eor (hello),y`,
      0x51,
      0x34
    );
    await testCodeEmit(
      `
      eor (hello),y
      hello .equ $1234`,
      0x51,
      0x34
    );
  });

  it("eor fails with invalid addressing", async () => {
    await codeRaisesError("eor a", "M1005");
    await codeRaisesError("eor ($1234)", "M1007");
  });

  it("ora", async () => {
    await testCodeEmit("ora #$40", 0x09, 0x40);
    await testCodeEmit("ora #[$40+$20]", 0x09, 0x60);
    await testCodeEmit("ora $40", 0x05, 0x40);
    await testCodeEmit("ora $1234", 0x0d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ora hello`,
      0x05,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ora hello`,
      0x0d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ora hello
      hello .equ $1234`,
      0x0d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ora hello
      hello .equ $1234`,
      0x0d,
      0x34,
      0x12
    );
    await testCodeEmit("ora $40,x", 0x15, 0x40);
    await testCodeEmit("ora $1234,x", 0x1d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ora hello,x`,
      0x15,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ora hello,x`,
      0x1d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ora hello,x
      hello .equ $1234`,
      0x1d,
      0x34,
      0x12
    );
    await testCodeEmit("ora $40,y", 0x19, 0x40, 0x00);
    await testCodeEmit("ora $1234,y", 0x19, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ora hello,y`,
      0x19,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ora hello,y`,
      0x19,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ora hello,y
      hello .equ $1234`,
      0x19,
      0x34,
      0x12
    );
    await testCodeEmit("ora ($40,x)", 0x01, 0x40);
    await testCodeEmit("ora ($1240,x)", 0x01, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      ora (hello,x)`,
      0x01,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ora (hello,x)`,
      0x01,
      0x34
    );
    await testCodeEmit(
      `
      ora (hello,x)
      hello .equ $1234`,
      0x01,
      0x34
    );
    await testCodeEmit("ora ($40),y", 0x11, 0x40);
    await testCodeEmit("ora ($1240), y", 0x11, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      ora (hello),y`,
      0x11,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ora (hello),y`,
      0x11,
      0x34
    );
    await testCodeEmit(
      `
      ora (hello),y
      hello .equ $1234`,
      0x11,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ora (hello),y`,
      0x11,
      0x34
    );
    await testCodeEmit(
      `
      ora (hello),y
      hello .equ $1234`,
      0x11,
      0x34
    );
  });

  it("ora fails with invalid addressing", async () => {
    await codeRaisesError("ora a", "M1005");
    await codeRaisesError("ora ($1234)", "M1007");
  });

  it("asl", async () => {
    await testCodeEmit("asl a", 0x0a);
    await testCodeEmit("asl $40", 0x06, 0x40);
    await testCodeEmit("asl $1234", 0x0e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      asl hello`,
      0x06,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      asl hello`,
      0x0e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      asl hello
      hello .equ $1234`,
      0x0e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      asl hello
      hello .equ $1234`,
      0x0e,
      0x34,
      0x12
    );
    await testCodeEmit("asl $40,x", 0x16, 0x40);
    await testCodeEmit("asl $1234,x", 0x1e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      asl hello,x`,
      0x16,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      asl hello,x`,
      0x1e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      asl hello,x
      hello .equ $1234`,
      0x1e,
      0x34,
      0x12
    );
  });

  it("asl fails with invalid addressing", async () => {
    await codeRaisesError("asl #$40", "M1002");
    await codeRaisesError("asl ($1234)", "M1007");
    await codeRaisesError("asl $40,y", "M1006");
    await codeRaisesError("asl $40,y", "M1006");
    await codeRaisesError("asl ($40),y", "M1004");
    await codeRaisesError("asl ($40,x)", "M1004");
    await codeRaisesError("asl ($40),y", "M1004");
  });

  it("lsr", async () => {
    await testCodeEmit("lsr a", 0x4a);
    await testCodeEmit("lsr $40", 0x46, 0x40);
    await testCodeEmit("lsr $1234", 0x4e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      lsr hello`,
      0x46,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lsr hello`,
      0x4e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lsr hello
      hello .equ $1234`,
      0x4e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lsr hello
      hello .equ $1234`,
      0x4e,
      0x34,
      0x12
    );
    await testCodeEmit("lsr $40,x", 0x56, 0x40);
    await testCodeEmit("lsr $1234,x", 0x5e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      lsr hello,x`,
      0x56,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lsr hello,x`,
      0x5e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lsr hello,x
      hello .equ $1234`,
      0x5e,
      0x34,
      0x12
    );
  });

  it("lsr fails with invalid addressing", async () => {
    await codeRaisesError("lsr #$40", "M1002");
    await codeRaisesError("lsr ($1234)", "M1007");
    await codeRaisesError("lsr $40,y", "M1006");
    await codeRaisesError("lsr $40,y", "M1006");
    await codeRaisesError("lsr ($40),y", "M1004");
    await codeRaisesError("lsr ($40,x)", "M1004");
    await codeRaisesError("lsr ($40),y", "M1004");
  });

  it("rol", async () => {
    await testCodeEmit("rol a", 0x2a);
    await testCodeEmit("rol $40", 0x26, 0x40);
    await testCodeEmit("rol $1234", 0x2e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      rol hello`,
      0x26,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      rol hello`,
      0x2e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rol hello
      hello .equ $1234`,
      0x2e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rol hello
      hello .equ $1234`,
      0x2e,
      0x34,
      0x12
    );
    await testCodeEmit("rol $40,x", 0x36, 0x40);
    await testCodeEmit("rol $1234,x", 0x3e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      rol hello,x`,
      0x36,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      rol hello,x`,
      0x3e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rol hello,x
      hello .equ $1234`,
      0x3e,
      0x34,
      0x12
    );
  });

  it("rol fails with invalid addressing", async () => {
    await codeRaisesError("rol #$40", "M1002");
    await codeRaisesError("rol ($1234)", "M1007");
    await codeRaisesError("rol $40,y", "M1006");
    await codeRaisesError("rol $40,y", "M1006");
    await codeRaisesError("rol ($40),y", "M1004");
    await codeRaisesError("rol ($40,x)", "M1004");
    await codeRaisesError("rol ($40),y", "M1004");
  });

  it("ror", async () => {
    await testCodeEmit("ror a", 0x6a);
    await testCodeEmit("ror $40", 0x66, 0x40);
    await testCodeEmit("ror $1234", 0x6e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ror hello`,
      0x66,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ror hello`,
      0x6e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ror hello
      hello .equ $1234`,
      0x6e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ror hello
      hello .equ $1234`,
      0x6e,
      0x34,
      0x12
    );
    await testCodeEmit("ror $40,x", 0x76, 0x40);
    await testCodeEmit("ror $1234,x", 0x7e, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      ror hello,x`,
      0x76,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      ror hello,x`,
      0x7e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      ror hello,x
      hello .equ $1234`,
      0x7e,
      0x34,
      0x12
    );
  });

  it("ror fails with invalid addressing", async () => {
    await codeRaisesError("ror #$40", "M1002");
    await codeRaisesError("ror ($1234)", "M1007");
    await codeRaisesError("ror $40,y", "M1006");
    await codeRaisesError("ror $40,y", "M1006");
    await codeRaisesError("ror ($40),y", "M1004");
    await codeRaisesError("ror ($40,x)", "M1004");
    await codeRaisesError("ror ($40),y", "M1004");
  });
});
