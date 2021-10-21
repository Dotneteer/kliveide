import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - stack operations", () => {
  it("push", () => {
    testCodeEmit("push af", 0xf5);
    testCodeEmit("push bc", 0xc5);
    testCodeEmit("push de", 0xd5);
    testCodeEmit("push hl", 0xe5);
    testCodeEmit("push ix", 0xdd, 0xe5);
    testCodeEmit("push iy", 0xfd, 0xe5);
  });

  it("extended push", () => {
    testCodeEmit(".model next \r\n push #1234", 0xED, 0x8A, 0x12, 0x34);
  });

  it("pop", () => {
    testCodeEmit("pop af", 0xf1);
    testCodeEmit("pop bc", 0xc1);
    testCodeEmit("pop de", 0xd1);
    testCodeEmit("pop hl", 0xe1);
    testCodeEmit("pop ix", 0xdd, 0xe1);
    testCodeEmit("pop iy", 0xfd, 0xe1);
  });

  it("push/pop: invalid operand", () => {
    codeRaisesError("pop af'", "Z0413");
    codeRaisesError("push af'", "Z0413");
    codeRaisesError("pop a", "Z0413");
    codeRaisesError("push a", "Z0413");
    codeRaisesError("pop xl", "Z0413");
    codeRaisesError("push yh", "Z0413");
    codeRaisesError("pop (bc)", "Z0413");
    codeRaisesError("push (bc)", "Z0413");
    codeRaisesError("pop (#A234)", "Z0413");
    codeRaisesError("push (#A234)", "Z0413");
    codeRaisesError("pop (c)", "Z0413");
    codeRaisesError("push (c)", "Z0413");
    codeRaisesError("pop (ix+3)", "Z0413");
    codeRaisesError("push (iy-4)", "Z0413");
    codeRaisesError("pop #123", "Z0412");
    codeRaisesError("push #123", "Z0414");
  });
});
