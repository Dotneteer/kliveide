import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - NEXT operations", async () => {
  it("mul d,e", async () => {
    await testNextCodeEmit("mul d,e", 0xed, 0x30);
  });

  it("test #NN", async () => {
    await testNextCodeEmit("test #1234", 0xed, 0x27, 0x34);
  });

  it("nextreg", async () => {
    await testNextCodeEmit("nextreg #12, #34", 0xed, 0x91, 0x12, 0x34);
    await testNextCodeEmit("nextreg #12, a", 0xed, 0x92, 0x12);
  });

  it("mirror a", async () => {
    await testNextCodeEmit("mirror a", 0xed, 0x24);
  });

  it("bsla de,b", async () => {
    await testNextCodeEmit("bsla de,b", 0xed, 0x28);
  });

  it("bsra de,b", async () => {
    await testNextCodeEmit("bsra de,b", 0xed, 0x29);
  });

  it("bsrl de,b", async () => {
    await testNextCodeEmit("bsrl de,b", 0xed, 0x2a);
  });

  it("bsrf de,b", async () => {
    await testNextCodeEmit("bsrf de,b", 0xed, 0x2b);
  });

  it("brlc de,b", async () => {
    await testNextCodeEmit("brlc de,b", 0xed, 0x2c);
  });

  it("next ops in non-next mode", async () => {
    await codeRaisesError("mul d,e", "Z0414");
    await codeRaisesError("test #1234", "Z0414");
    await codeRaisesError("nextreg #12, #34", "Z0414");
    await codeRaisesError("nextreg #12, a", "Z0414");
    await codeRaisesError("mirror a", "Z0414");
    await codeRaisesError("bsla de,b", "Z0414");
    await codeRaisesError("bsra de,b", "Z0414");
    await codeRaisesError("bsrl de,b", "Z0414");
    await codeRaisesError("bsrf de,b", "Z0414");
    await codeRaisesError("brlc de,b", "Z0414");
  });
});

async function testNextCodeEmit (
  op: string,
  ...expected: number[]
): Promise<void> {
  await testCodeEmit(
    `
      .model next
      ${op}
    `,
    ...expected
  );
}
