import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - math operations", async () => {
  it("adc", async () => {
    await testCodeEmit("adc #$40", 0x69, 0x40);
    await testCodeEmit("adc #[$40+$20]", 0x69, 0x60);
    await testCodeEmit("adc $40", 0x65, 0x40);
    await testCodeEmit("adc $1234", 0x6d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      adc hello`,
      0x65,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      adc hello`,
      0x6d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      adc hello
      hello .equ $1234`,
      0x6d,
      0x34,
      0x12
    );
    await testCodeEmit("adc $40,x", 0x75, 0x40);
    await testCodeEmit("adc $1234,x", 0x7d, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      adc hello,x`,
      0x75,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      adc hello,x`,
      0x7d,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      adc hello,x
      hello .equ $1234`,
      0x7d,
      0x34,
      0x12
    );
    await testCodeEmit("adc $40,y", 0x79, 0x40, 0x00);
    await testCodeEmit("adc $1234,y", 0x79, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      adc hello,y`,
      0x79,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      adc hello,y`,
      0x79,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      adc hello,y
      hello .equ $1234`,
      0x79,
      0x34,
      0x12
    );
    await testCodeEmit("adc ($40,x)", 0x61, 0x40);
    await testCodeEmit("adc ($1240,x)", 0x61, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      adc (hello,x)`,
      0x61,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      adc (hello,x)`,
      0x61,
      0x34
    );
    await testCodeEmit(
      `
      adc (hello,x)
      hello .equ $1234`,
      0x61,
      0x34
    );
    await testCodeEmit("adc ($40),y", 0x71, 0x40);
    await testCodeEmit("adc ($1240), y", 0x71, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      adc (hello),y`,
      0x71,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      adc (hello),y`,
      0x71,
      0x34
    );
    await testCodeEmit(
      `
      adc (hello),y
      hello .equ $1234`,
      0x71,
      0x34
    );
  });

  it("adc fails with invalid operand", async () => {
    await codeRaisesError("adc a", "M1005");
    await codeRaisesError("adc ($1234)", "M1007");
  });

  it("sbc", async () => {
    await testCodeEmit("sbc #$40", 0xe9, 0x40);
    await testCodeEmit("sbc #[$40+$20]", 0xe9, 0x60);
    await testCodeEmit("sbc $40", 0xe5, 0x40);
    await testCodeEmit("sbc $1234", 0xed, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sbc hello`,
      0xe5,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sbc hello`,
      0xed,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sbc hello
      hello .equ $1234`,
      0xed,
      0x34,
      0x12
    );
    await testCodeEmit("sbc $40,x", 0xf5, 0x40);
    await testCodeEmit("sbc $1234,x", 0xfd, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sbc hello,x`,
      0xf5,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sbc hello,x`,
      0xfd,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sbc hello,x
      hello .equ $1234`,
      0xfd,
      0x34,
      0x12
    );
    await testCodeEmit("sbc $40,y", 0xf9, 0x40, 0x00);
    await testCodeEmit("sbc $1234,y", 0xf9, 0x34, 0x12);
    await testCodeEmit(
      `
      hello .equ $34
      sbc hello,y`,
      0xf9,
      0x34,
      0x00
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sbc hello,y`,
      0xf9,
      0x34,
      0x12
    );
    await testCodeEmit(
      `
      sbc hello,y
      hello .equ $1234`,
      0xf9,
      0x34,
      0x12
    );
    await testCodeEmit("sbc ($40,x)", 0xe1, 0x40);
    await testCodeEmit("sbc ($1240,x)", 0xe1, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      adc (hello,x)`,
      0x61,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      adc (hello,x)`,
      0x61,
      0x34
    );
    await testCodeEmit(
      `
      adc (hello,x)
      hello .equ $1234`,
      0x61,
      0x34
    );
    await testCodeEmit("sbc ($40),y", 0xf1, 0x40);
    await testCodeEmit("sbc ($1240), y", 0xf1, 0x40);
    await testCodeEmit(
      `
      hello .equ $34
      sbc (hello),y`,
      0xf1,
      0x34
    );
    await testCodeEmit(
      `
      hello .equ $1234
      sbc (hello),y`,
      0xf1,
      0x34
    );
    await testCodeEmit(
      `
      sbc (hello),y
      hello .equ $1234`,
      0xf1,
      0x34
    );
  });

  it("sbc fails with invalid operand", async () => {
    await codeRaisesError("sbc a", "M1005");
    await codeRaisesError("sbc ($1234)", "M1007");
  });
});
