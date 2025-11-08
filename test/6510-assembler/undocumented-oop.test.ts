import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - undocumented operations", async () => {
  it("slo", async () => {
    await testCodeEmit("slo ($40,x)", 0x03, 0x40);
    await testCodeEmit("slo $40", 0x07, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      slo hello`,
      0x07,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      slo hello`,
      0x0f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      slo hello
      hello .equ $1234`,
      0x0f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      slo hello
      hello .equ $1234`,
      0x0f,
      0x34,
      0x12
    );
    await testCodeEmit("slo $40,x", 0x17, 0x40);
    await testCodeEmit("slo $1234,x", 0x1f, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      slo hello,x`,
      0x17,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      slo hello,x`,
      0x1f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      slo hello,x
      hello .equ $1234`,
      0x1f,
      0x34,
      0x12
    );
    await testCodeEmit("slo ($40),y", 0x13, 0x40);
    await testCodeEmit("slo $40,y", 0x1b, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $1234
      slo hello,y`,
      0x1b,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      slo hello,y
      hello .equ $1234`,
      0x1b,
      0x34,
      0x12
    );
  });

  it("slo fails with invalid addressing", async () => {
    await codeRaisesError("slo a", "M1005");
    await codeRaisesError("slo #$40", "M1002");
    await codeRaisesError("slo ($1234)", "M1007");
  });

  it("dop", async () => {
    await testCodeEmit("dop $40", 0x04, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      dop hello`,
      0x04,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      dop hello`,
      0x04,
      0x34
    );
    await testCodeEmit(
      `
      dop hello
      hello .equ $1234`,
      0x04,
      0x34
    );
  });

  it("dop fails with invalid addressing", async () => {
    await codeRaisesError("dop a", "M1005");
    await codeRaisesError("dop ($1234)", "M1007");
    await codeRaisesError("dop $40,y", "M1006");
    await codeRaisesError("dop $40,y", "M1006");
    await codeRaisesError("dop ($40),y", "M1004");
    await codeRaisesError("dop ($40,x)", "M1004");
    await codeRaisesError("dop ($40),y", "M1004");
  });

  it("aac", async () => {
    await testCodeEmit("aac #$40", 0x0b, 0x40);
  });

  it("aac fails with invalid addressing", async () => {
    await codeRaisesError("aac a", "M1005");
    await codeRaisesError("aac ($1234)", "M1007");
    await codeRaisesError("aac $40,y", "M1006");
    await codeRaisesError("aac ($40),y", "M1004");
    await codeRaisesError("aac ($40,x)", "M1004");
  });

  it("top", async () => {
    await testCodeEmit("top $40", 0x0c, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $34
      top hello`,
      0x0c,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      top hello`,
      0x0c,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      top hello
      hello .equ $1234`,
      0x0c,
      0x34,
      0x12
    );
  });

  it("top fails with invalid addressing", async () => {
    await codeRaisesError("top a", "M1005");
    await codeRaisesError("top #$40", "M1002");
    await codeRaisesError("top ($1234)", "M1007");
    await codeRaisesError("top $40,y", "M1006");
    await codeRaisesError("top ($40),y", "M1004");
    await codeRaisesError("top ($40,x)", "M1004");
    await codeRaisesError("top ($40),y", "M1004");
  });

  it("rla", async () => {
    await testCodeEmit("rla ($40,x)", 0x23, 0x40);
    await testCodeEmit("rla $40", 0x27, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      rla hello`,
      0x27,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      rla hello`,
      0x2f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rla hello
      hello .equ $1234`,
      0x2f,
      0x34,
      0x12
    );
    await testCodeEmit("rla $40,x", 0x37, 0x40);
    await testCodeEmit("rla $1234,x", 0x3f, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      rla hello,x`,
      0x37,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      rla hello,x`,
      0x3f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rla hello,x
      hello .equ $1234`,
      0x3f,
      0x34,
      0x12
    );
    await testCodeEmit("rla ($40),y", 0x33, 0x40);
    await testCodeEmit("rla $40,y", 0x3b, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $1234
      rla hello,y`,
      0x3b,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rla hello,y
      hello .equ $1234`,
      0x3b,
      0x34,
      0x12
    );
  });

  it("rla fails with invalid addressing", async () => {
    await codeRaisesError("rla a", "M1005");
    await codeRaisesError("rla #$40", "M1002");
    await codeRaisesError("rla ($1234)", "M1007");
  });

  it("sre", async () => {
    await testCodeEmit("sre ($40,x)", 0x43, 0x40);
    await testCodeEmit("sre $40", 0x47, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      sre hello`,
      0x47,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sre hello`,
      0x4f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sre hello
      hello .equ $1234`,
      0x4f,
      0x34,
      0x12
    );
    await testCodeEmit("sre $40,x", 0x57, 0x40);
    await testCodeEmit("sre $1234,x", 0x5f, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sre hello,x`,
      0x57,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sre hello,x`,
      0x5f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sre hello,x
      hello .equ $1234`,
      0x5f,
      0x34,
      0x12
    );
    await testCodeEmit("sre ($40),y", 0x53, 0x40);
    await testCodeEmit("sre $40,y", 0x5b, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $1234
      sre hello,y`,
      0x5b,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sre hello,y
      hello .equ $1234`,
      0x5b,
      0x34,
      0x12
    );
  });

  it("sre fails with invalid addressing", async () => {
    await codeRaisesError("sre a", "M1005");
    await codeRaisesError("sre #$40", "M1002");
    await codeRaisesError("sre ($1234)", "M1007");
  });

  it("sax", async () => {
    await testCodeEmit("sax ($40,x)", 0x83, 0x40);
    await testCodeEmit("sax $40", 0x87, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      sax hello`,
      0x87,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sax hello`,
      0x8f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sax hello
      hello .equ $1234`,
      0x8f,
      0x34,
      0x12
    );
    await testCodeEmit("sax $40,y", 0x97, 0x40);
    await testCodeEmit(
      `
      hello .equ $1234
      sax hello,y`,
      0x97,
      0x34
    );
    await testCodeEmit(
      `
      sax hello,y
      hello .equ $1234`,
      0x97,
      0x34
    );
  });

  it("sax fails with invalid addressing", async () => {
    await codeRaisesError("sax a", "M1005");
    await codeRaisesError("sax #$40", "M1002");
    await codeRaisesError("sax ($1234)", "M1007");
  });

  it("arr", async () => {
    await testCodeEmit("arr #$40", 0x6b, 0x40);
  });

  it("arr fails with invalid addressing", async () => {
    await codeRaisesError("arr a", "M1005");
    await codeRaisesError("arr ($1234)", "M1007");
    await codeRaisesError("arr $40,y", "M1006");
    await codeRaisesError("arr ($40),y", "M1004");
    await codeRaisesError("arr ($40,x)", "M1004");
  });

  it("asr", async () => {
    await testCodeEmit("asr #$40", 0x4b, 0x40);
  });

  it("asr fails with invalid addressing", async () => {
    await codeRaisesError("asr a", "M1005");
    await codeRaisesError("asr ($1234)", "M1007");
    await codeRaisesError("asr $40,y", "M1006");
    await codeRaisesError("asr ($40),y", "M1004");
    await codeRaisesError("asr ($40,x)", "M1004");
  });

  it("atx", async () => {
    await testCodeEmit("atx #$40", 0xab, 0x40);
  });

  it("atx fails with invalid addressing", async () => {
    await codeRaisesError("atx a", "M1005");
    await codeRaisesError("atx ($1234)", "M1007");
    await codeRaisesError("atx $40,y", "M1006");
    await codeRaisesError("atx ($40),y", "M1004");
    await codeRaisesError("atx ($40,x)", "M1004");
  });

  it("axa", async () => {
    await testCodeEmit("axa ($40),y", 0x93, 0x40);
    await testCodeEmit("axa $40,y", 0x9f, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $34
      axa hello,y`,
      0x9f,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      axa hello,y`,
      0x9f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      axa hello,y
      hello .equ $1234`,
      0x9f,
      0x34,
      0x12
    );
  });

  it("axa fails with invalid addressing", async () => {
    await codeRaisesError("axa a", "M1005");
    await codeRaisesError("axa #$40", "M1002");
    await codeRaisesError("axa ($1234)", "M1007");
  });

  it("sax", async () => {
    await testCodeEmit("sax ($40,x)", 0x83, 0x40);
    await testCodeEmit("sax $40", 0x87, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      sax hello,y`,
      0x97,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sax hello,y`,
      0x97,
      0x34
    );
    await testCodeEmit(
      `
      sax hello,y
      hello .equ $1234`,
      0x97,
      0x34
    );
    await testCodeEmit("sax $1234", 0x8f, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $1234
      sax hello`,
      0x8f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sax hello
      hello .equ $1234`,
      0x8f,
      0x34,
      0x12
    );
  });

  it("sax fails with invalid addressing", async () => {
    await codeRaisesError("sax a", "M1005");
    await codeRaisesError("sax #$40", "M1002");
    await codeRaisesError("sax ($1234)", "M1007");
    await codeRaisesError("sax ($40),y", "M1004");
  });

  it("dcp", async () => {
    await testCodeEmit("dcp ($40,x)", 0xc3, 0x40);
    await testCodeEmit("dcp $40", 0xc7, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      dcp hello`,
      0xc7,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      dcp hello`,
      0xcf,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      dcp hello
      hello .equ $1234`,
      0xcf,
      0x34,
      0x12
    );
    await testCodeEmit("dcp $40,x", 0xd7, 0x40);
    await testCodeEmit("dcp $1234,x", 0xdf, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      dcp hello,x`,
      0xd7,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      dcp hello,x`,
      0xdf,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      dcp hello,x
      hello .equ $1234`,
      0xdf,
      0x34,
      0x12
    );
    await testCodeEmit("dcp ($40),y", 0xd3, 0x40);
    await testCodeEmit("dcp $40,y", 0xdb, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $1234
      dcp hello,y`,
      0xdb,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      dcp hello,y
      hello .equ $1234`,
      0xdb,
      0x34,
      0x12
    );
  });

  it("dcp fails with invalid addressing", async () => {
    await codeRaisesError("dcp a", "M1005");
    await codeRaisesError("dcp #$40", "M1002");
    await codeRaisesError("dcp ($1234)", "M1007");
  });

  it("isc", async () => {
    await testCodeEmit("isc ($40,x)", 0xe3, 0x40);
    await testCodeEmit("isc $40", 0xe7, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      isc hello`,
      0xe7,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      isc hello`,
      0xef,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      isc hello
      hello .equ $1234`,
      0xef,
      0x34,
      0x12
    );
    await testCodeEmit("isc $40,x", 0xf7, 0x40);
    await testCodeEmit("isc $1234,x", 0xff, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      isc hello,x`,
      0xf7,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      isc hello,x`,
      0xff,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      isc hello,x
      hello .equ $1234`,
      0xff,
      0x34,
      0x12
    );
    await testCodeEmit("isc ($40),y", 0xf3, 0x40);
    await testCodeEmit("isc $40,y", 0xfb, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $1234
      isc hello,y`,
      0xfb,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      isc hello,y
      hello .equ $1234`,
      0xfb,
      0x34,
      0x12
    );
  });

  it("isc fails with invalid addressing", async () => {
    await codeRaisesError("isc a", "M1005");
    await codeRaisesError("isc #$40", "M1002");
    await codeRaisesError("isc ($1234)", "M1007");
  });

  it("lar", async () => {
    await testCodeEmit("lar $1234,y", 0xbb, 0x34, 0x12);
  });

  it("lar fails with invalid addressing", async () => {
    await codeRaisesError("lar a", "M1005");
    await codeRaisesError("lar ($1234)", "M1007");
    await codeRaisesError("lar ($40),y", "M1004");
    await codeRaisesError("lar ($40,x)", "M1004");
    await codeRaisesError("lar ($40),y", "M1004");
  });

  it("lax", async () => {
    await testCodeEmit("lax ($40,x)", 0xa3, 0x40);
    await testCodeEmit("lax $40", 0xa7, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      lax hello`,
      0xa7,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      lax hello`,
      0xaf,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lax hello
      hello .equ $1234`,
      0xaf,
      0x34,
      0x12
    );
    await testCodeEmit("lax ($40),y", 0xb3, 0x40);
    await testCodeEmit("lax $40,y", 0xb7, 0x40);
    await testCodeEmit(
      `
      hello .equ $1234
      lax hello,y`,
      0xbf,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      lax hello,y
      hello .equ $1234`,
      0xbf,
      0x34,
      0x12
    );
  });

  it("lax fails with invalid addressing", async () => {
    await codeRaisesError("lax a", "M1005");
    await codeRaisesError("lax #$40", "M1002");
    await codeRaisesError("lax ($1234)", "M1007");
  });

  it("rra", async () => {
    await testCodeEmit("rra ($40,x)", 0x63, 0x40);
    await testCodeEmit("rra $40", 0x67, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      rra hello`,
      0x67,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      rra hello`,
      0x6f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rra hello
      hello .equ $1234`,
      0x6f,
      0x34,
      0x12
    );
    await testCodeEmit("rra $40,x", 0x77, 0x40);
    await testCodeEmit("rra $1234,x", 0x7f, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      rra hello,x`,
      0x77,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      rra hello,x`,
      0x7f,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rra hello,x
      hello .equ $1234`,
      0x7f,
      0x34,
      0x12
    );
    await testCodeEmit("rra ($40),y", 0x73, 0x40);
    await testCodeEmit("rra $40,y", 0x7b, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $1234
      rra hello,y`,
      0x7b,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      rra hello,y
      hello .equ $1234`,
      0x7b,
      0x34,
      0x12
    );
  });

  it("rra fails with invalid addressing", async () => {
    await codeRaisesError("rra a", "M1005");
    await codeRaisesError("rra #$40", "M1002");
    await codeRaisesError("rra ($1234)", "M1007");
  });

  it("sxa", async () => {
    await testCodeEmit("sxa $40,y", 0x9e, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $34
      sxa hello,y`,
      0x9e,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sxa hello,y`,
      0x9e,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sxa hello,y
      hello .equ $1234`,
      0x9e,
      0x34,
      0x12
    );
  });

  it("sxa fails with invalid addressing", async () => {
    await codeRaisesError("sxa a", "M1005");
    await codeRaisesError("sxa #$40", "M1002");
    await codeRaisesError("sxa ($1234)", "M1007");
  });

  it("sya", async () => {
    await testCodeEmit("sya $40,x", 0x9c, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $34
      sya hello,x`,
      0x9c,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sya hello,x`,
      0x9c,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sya hello,x
      hello .equ $1234`,
      0x9c,
      0x34,
      0x12
    );
  });

  it("sya fails with invalid addressing", async () => {
    await codeRaisesError("sya a", "M1005");
    await codeRaisesError("sya #$40", "M1002");
    await codeRaisesError("sya ($1234)", "M1007");
  });

  it("xaa", async () => {
    await testCodeEmit("xaa #$40", 0x8b, 0x40);
  });

  it("xaa fails with invalid addressing", async () => {
    await codeRaisesError("xaa a", "M1005");
    await codeRaisesError("xaa ($1234)", "M1007");
    await codeRaisesError("xaa $40,y", "M1006");
    await codeRaisesError("xaa ($40),y", "M1004");
    await codeRaisesError("xaa ($40,x)", "M1004");
  });

  it("xas", async () => {
    await testCodeEmit("xas $40,y", 0x9b, 0x40, 0x00);
    await testCodeEmit(
      `
      hello .equ $34
      xas hello,y`,
      0x9b,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      xas hello,y`,
      0x9b,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      xas hello,y
      hello .equ $1234`,
      0x9b,
      0x34,
      0x12
    );
  });
});
