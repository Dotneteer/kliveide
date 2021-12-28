import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - NEXT operations", () => {
  it("mul d,e", () => {
    testNextCodeEmit("mul d,e", 0xed, 0x30);
  });

  it("test #NN", async () => {
    testNextCodeEmit("test #1234", 0xed, 0x27, 0x34);
  });

  it("nextreg", async () => {
    testNextCodeEmit("nextreg #12, #34", 0xed, 0x91, 0x12, 0x34);
    testNextCodeEmit("nextreg #12, a", 0xed, 0x92, 0x12);
  });

  it("mirror a", async () => {
    testNextCodeEmit("mirror a", 0xed, 0x24);
  });

  it("bsla de,b", async () => {
    testNextCodeEmit("bsla de,b", 0xed, 0x28);
  });

  it("bsra de,b", async () => {
    testNextCodeEmit("bsra de,b", 0xed, 0x29);
  });

  it("bsrl de,b", async () => {
    testNextCodeEmit("bsrl de,b", 0xed, 0x2a);
  });

  it("bsrf de,b", async () => {
    testNextCodeEmit("bsrf de,b", 0xed, 0x2b);
  });

  it("brlc de,b", async () => {
    testNextCodeEmit("brlc de,b", 0xed, 0x2c);
  });

  it("next ops in non-next mode", async () => {
    codeRaisesError("mul d,e", "Z0414");
    codeRaisesError("test #1234", "Z0414");
    codeRaisesError("nextreg #12, #34", "Z0414");
    codeRaisesError("nextreg #12, a", "Z0414");
    codeRaisesError("mirror a", "Z0414");
    codeRaisesError("bsla de,b", "Z0414");
    codeRaisesError("bsra de,b", "Z0414");
    codeRaisesError("bsrl de,b", "Z0414");
    codeRaisesError("bsrf de,b", "Z0414");
    codeRaisesError("brlc de,b", "Z0414");
  });
});

async function testNextCodeEmit(op: string, ...expected: number[]): Promise<void> {
  testCodeEmit(
    `
      .model next
      ${op}
    `,
    ...expected
  );
}
