import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - stack operations", () => {
  it("push", async () => {
    await testCodeEmit("push af", 0xf5);
    await testCodeEmit("push bc", 0xc5);
    await testCodeEmit("push de", 0xd5);
    await testCodeEmit("push hl", 0xe5);
    await testCodeEmit("push ix", 0xdd, 0xe5);
    await testCodeEmit("push iy", 0xfd, 0xe5);
  });

  it("extended push", async () => {
    await testCodeEmit(".model next \r\n push #1234", 0xed, 0x8a, 0x12, 0x34);
  });

  it("pop", async () => {
    await testCodeEmit("pop af", 0xf1);
    await testCodeEmit("pop bc", 0xc1);
    await testCodeEmit("pop de", 0xd1);
    await testCodeEmit("pop hl", 0xe1);
    await testCodeEmit("pop ix", 0xdd, 0xe1);
    await testCodeEmit("pop iy", 0xfd, 0xe1);
  });

  it("push/pop: invalid operand", async () => {
    await codeRaisesError("pop af'", "Z0413");
    await codeRaisesError("push af'", "Z0413");
    await codeRaisesError("pop a", "Z0413");
    await codeRaisesError("push a", "Z0413");
    await codeRaisesError("pop xl", "Z0413");
    await codeRaisesError("push yh", "Z0413");
    await codeRaisesError("pop (bc)", "Z0413");
    await codeRaisesError("push (bc)", "Z0413");
    await codeRaisesError("pop (#A234)", "Z0413");
    await codeRaisesError("push (#A234)", "Z0413");
    await codeRaisesError("pop (c)", "Z0413");
    await codeRaisesError("push (c)", "Z0413");
    await codeRaisesError("pop (ix+3)", "Z0413");
    await codeRaisesError("push (iy-4)", "Z0413");
    await codeRaisesError("pop #123", "Z0412");
    await codeRaisesError("push #123", "Z0414");
  });
});
