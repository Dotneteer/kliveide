import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - miscellaneous operations", async () => {
  it("im", async () => {
    await testCodeEmit("im 0", 0xed, 0x46);
    await testCodeEmit("im 1", 0xed, 0x56);
    await testCodeEmit("im 2", 0xed, 0x5e);
  });

  it("im: fails with invalid operand", async () => {
    await codeRaisesError("im 3", "Z0405");
    await codeRaisesError("im -1", "Z0405");
  });

  it("ex", async () => {
    await testCodeEmit("ex (sp),ix", 0xdd, 0xe3);
    await testCodeEmit("ex (sp),hl", 0xe3);
    await testCodeEmit("ex (sp),iy", 0xfd, 0xe3);
    await testCodeEmit("ex de,hl", 0xeb);
    await testCodeEmit("ex af,af'", 0x08);
  });

  it("ex: fails with invalid operand", async () => {
    await codeRaisesError("ex hl, bc", "Z0604");
    await codeRaisesError("ex af, bc", "Z0604");
    await codeRaisesError("ex de, 123", "Z0604");
    await codeRaisesError("ex (sp), bc", "Z0604");
  });

  it("in", async () => {
    await testCodeEmit("in b,(c)", 0xed, 0x40);
    await testCodeEmit("in a,(#FE)", 0xdb, 0xfe);
    await testCodeEmit("in a,(c)", 0xed, 0x78);
    await testCodeEmit("in c,(c)", 0xed, 0x48);
    await testCodeEmit("in d,(c)", 0xed, 0x50);
    await testCodeEmit("in e,(c)", 0xed, 0x58);
    await testCodeEmit("in h,(c)", 0xed, 0x60);
    await testCodeEmit("in l,(c)", 0xed, 0x68);
    await testCodeEmit("in (c)", 0xed, 0x70);
  });

  it("in: fails with invalid operand", async () => {
    await codeRaisesError("in (c), a", "Z0604");
    await codeRaisesError("in b,(#fe)", "Z0604");
    await codeRaisesError("in c,(#fe)", "Z0604");
    await codeRaisesError("in d,(#fe)", "Z0604");
    await codeRaisesError("in e,(#fe)", "Z0604");
    await codeRaisesError("in h,(#fe)", "Z0604");
    await codeRaisesError("in l,(#fe)", "Z0604");
  });

  it("out", async () => {
    await testCodeEmit("out (c),a", 0xed, 0x79);
    await testCodeEmit("out (#FE),a", 0xd3, 0xfe);
    await testCodeEmit("out (c),b", 0xed, 0x41);
    await testCodeEmit("out (c),c", 0xed, 0x49);
    await testCodeEmit("out (c),d", 0xed, 0x51);
    await testCodeEmit("out (c),e", 0xed, 0x59);
    await testCodeEmit("out (c),h", 0xed, 0x61);
    await testCodeEmit("out (c),l", 0xed, 0x69);
    await testCodeEmit("out (c),0", 0xed, 0x71);
  });

  it("out: fails with invalid operand", async () => {
    await codeRaisesError("out (#fe),b", "Z0604");
    await codeRaisesError("out (#fe),c", "Z0604");
    await codeRaisesError("out (#fe),d", "Z0604");
    await codeRaisesError("out (#fe),e", "Z0604");
    await codeRaisesError("out (#fe),h", "Z0604");
    await codeRaisesError("out (#fe),l", "Z0604");
    await codeRaisesError("out (c),1", "Z0406");
  });
});
