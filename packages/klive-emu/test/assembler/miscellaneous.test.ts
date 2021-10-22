import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - miscellaneous operations", () => {
  it("im", () => {
    testCodeEmit("im 0", 0xed, 0x46);
    testCodeEmit("im 1", 0xed, 0x56);
    testCodeEmit("im 2", 0xed, 0x5e);
  });

  it("im: fails with invalid operand", () => {
    codeRaisesError("im 3", "Z0405");
    codeRaisesError("im -1", "Z0405");
  });

  it("ex", () => {
    testCodeEmit("ex (sp),ix", 0xdd, 0xe3);
    testCodeEmit("ex (sp),hl", 0xe3);
    testCodeEmit("ex (sp),iy", 0xfd, 0xe3);
    testCodeEmit("ex de,hl", 0xeb);
    testCodeEmit("ex af,af'", 0x08);
  });

  it("ex: fails with invalid operand", () => {
    codeRaisesError("ex hl, bc", "Z0604");
    codeRaisesError("ex af, bc", "Z0604");
    codeRaisesError("ex de, 123", "Z0604");
    codeRaisesError("ex (sp), bc", "Z0604");
  });

  it("in", () => {
    testCodeEmit("in b,(c)", 0xed, 0x40);
    testCodeEmit("in a,(#FE)", 0xdb, 0xfe);
    testCodeEmit("in a,(c)", 0xed, 0x78);
    testCodeEmit("in c,(c)", 0xed, 0x48);
    testCodeEmit("in d,(c)", 0xed, 0x50);
    testCodeEmit("in e,(c)", 0xed, 0x58);
    testCodeEmit("in h,(c)", 0xed, 0x60);
    testCodeEmit("in l,(c)", 0xed, 0x68);
    testCodeEmit("in (c)", 0xed, 0x70);
  });

  it("in: fails with invalid operand", () => {
    codeRaisesError("in (c), a", "Z0604");
    codeRaisesError("in b,(#fe)", "Z0604");
    codeRaisesError("in c,(#fe)", "Z0604");
    codeRaisesError("in d,(#fe)", "Z0604");
    codeRaisesError("in e,(#fe)", "Z0604");
    codeRaisesError("in h,(#fe)", "Z0604");
    codeRaisesError("in l,(#fe)", "Z0604");
  });

  it("out", () => {
    testCodeEmit("out (c),a", 0xed, 0x79);
    testCodeEmit("out (#FE),a", 0xd3, 0xfe);
    testCodeEmit("out (c),b", 0xed, 0x41);
    testCodeEmit("out (c),c", 0xed, 0x49);
    testCodeEmit("out (c),d", 0xed, 0x51);
    testCodeEmit("out (c),e", 0xed, 0x59);
    testCodeEmit("out (c),h", 0xed, 0x61);
    testCodeEmit("out (c),l", 0xed, 0x69);
    testCodeEmit("out (c),0", 0xed, 0x71);
  });

  it("out: fails with invalid operand", () => {
    codeRaisesError("out (#fe),b", "Z0604");
    codeRaisesError("out (#fe),c", "Z0604");
    codeRaisesError("out (#fe),d", "Z0604");
    codeRaisesError("out (#fe),e", "Z0604");
    codeRaisesError("out (#fe),h", "Z0604");
    codeRaisesError("out (#fe),l", "Z0604");
    codeRaisesError("out (c),1", "Z0406");
  });
});
