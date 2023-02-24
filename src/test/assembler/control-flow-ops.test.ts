import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - control flow operations", async () => {
  it("ret", async () => {
    await testCodeEmit("ret", 0xc9);
    await testCodeEmit("ret nz", 0xc0);
    await testCodeEmit("ret z", 0xc8);
    await testCodeEmit("ret nc", 0xd0);
    await testCodeEmit("ret c", 0xd8);
    await testCodeEmit("ret po", 0xe0);
    await testCodeEmit("ret pe", 0xe8);
    await testCodeEmit("ret p", 0xf0);
    await testCodeEmit("ret m", 0xf8);
  });

  it("call NNNN", async () => {
    await testCodeEmit("call Z, #1234", 0xcc, 0x34, 0x12);
    await testCodeEmit("call #1234", 0xcd, 0x34, 0x12);
    await testCodeEmit("call nz, #1234", 0xc4, 0x34, 0x12);
    await testCodeEmit("call z, #1234", 0xcc, 0x34, 0x12);
    await testCodeEmit("call nc, #1234", 0xd4, 0x34, 0x12);
    await testCodeEmit("call c, #1234", 0xdc, 0x34, 0x12);
    await testCodeEmit("call po, #1234", 0xe4, 0x34, 0x12);
    await testCodeEmit("call pe, #1234", 0xec, 0x34, 0x12);
    await testCodeEmit("call p, #1234", 0xf4, 0x34, 0x12);
    await testCodeEmit("call m, #1234", 0xfc, 0x34, 0x12);
  });

  it("jp NNNN", async () => {
    await testCodeEmit("jp #1234", 0xc3, 0x34, 0x12);
    await testCodeEmit("jp nz, #1234", 0xc2, 0x34, 0x12);
    await testCodeEmit("jp z, #1234", 0xca, 0x34, 0x12);
    await testCodeEmit("jp nc, #1234", 0xd2, 0x34, 0x12);
    await testCodeEmit("jp c, #1234", 0xda, 0x34, 0x12);
    await testCodeEmit("jp po, #1234", 0xe2, 0x34, 0x12);
    await testCodeEmit("jp pe, #1234", 0xea, 0x34, 0x12);
    await testCodeEmit("jp p, #1234", 0xf2, 0x34, 0x12);
    await testCodeEmit("jp m, #1234", 0xfa, 0x34, 0x12);
  });

  it("jp spec", async () => {
    await testCodeEmit("jp (c)", 0xed, 0x98);
    await testCodeEmit("jp hl", 0xe9);
    await testCodeEmit("jp (hl)", 0xe9);
    await testCodeEmit("jp ix", 0xdd, 0xe9);
    await testCodeEmit("jp (ix)", 0xdd, 0xe9);
    await testCodeEmit("jp iy", 0xfd, 0xe9);
    await testCodeEmit("jp (iy)", 0xfd, 0xe9);
  });

  it("jp fails", async () => {
    codeRaisesError("jp bc", "Z0604");
    codeRaisesError("jp de", "Z0604");
    codeRaisesError("jp af", "Z0604");
    codeRaisesError("jp sp", "Z0604");
    codeRaisesError("jp (bc)", "Z0604");
    codeRaisesError("jp (de)", "Z0604");
    codeRaisesError("jp (sp)", "Z0604");
    codeRaisesError("jp (ix+1)", "Z0604");
    codeRaisesError("jp (ix-21)", "Z0604");
    codeRaisesError("jp (iy+1)", "Z0604");
    codeRaisesError("jp (iy-21)", "Z0604");
  });

  it("jr", async () => {
    await testCodeEmit("jr Z,#8022", 0x28, 0x20);

    // --- Start address is #8000
    await testCodeEmit("jr #8022", 0x18, 0x20);
    await testCodeEmit("jr #8000", 0x18, 0xfe);
    await testCodeEmit("jr #8081", 0x18, 0x7f);
    await testCodeEmit("jr #7F82", 0x18, 0x80);
    await testCodeEmit("jr #7F84", 0x18, 0x82);

    await testCodeEmit("jr nz,#8022", 0x20, 0x20);
    await testCodeEmit("jr nz,#8000", 0x20, 0xfe);
    await testCodeEmit("jr nz,#8081", 0x20, 0x7f);
    await testCodeEmit("jr nz,#7F82", 0x20, 0x80);
    await testCodeEmit("jr nz,#7F84", 0x20, 0x82);

    await testCodeEmit("jr z,#8022", 0x28, 0x20);
    await testCodeEmit("jr z,#8000", 0x28, 0xfe);
    await testCodeEmit("jr z,#8081", 0x28, 0x7f);
    await testCodeEmit("jr z,#7F82", 0x28, 0x80);
    await testCodeEmit("jr z,#7F84", 0x28, 0x82);

    await testCodeEmit("jr nc,#8022", 0x30, 0x20);
    await testCodeEmit("jr nc,#8000", 0x30, 0xfe);
    await testCodeEmit("jr nc,#8081", 0x30, 0x7f);
    await testCodeEmit("jr nc,#7F82", 0x30, 0x80);
    await testCodeEmit("jr nc,#7F84", 0x30, 0x82);

    await testCodeEmit("jr c,#8022", 0x38, 0x20);
    await testCodeEmit("jr c,#8000", 0x38, 0xfe);
    await testCodeEmit("jr c,#8081", 0x38, 0x7f);
    await testCodeEmit("jr c,#7F82", 0x38, 0x80);
    await testCodeEmit("jr c,#7F84", 0x38, 0x82);
  });

  it("jr: fails with far address", async () => {
    // --- Start address is #8000
    codeRaisesError("jr #8082", "Z0403");
    codeRaisesError("jr #8100", "Z0403");
    codeRaisesError("jr #7F81", "Z0403");
    codeRaisesError("jr #7F00", "Z0403");

    codeRaisesError("jr nz,#8082", "Z0403");
    codeRaisesError("jr nz,#8100", "Z0403");
    codeRaisesError("jr nz,#7F81", "Z0403");
    codeRaisesError("jr nz,#7F00", "Z0403");

    codeRaisesError("jr z,#8082", "Z0403");
    codeRaisesError("jr z,#8100", "Z0403");
    codeRaisesError("jr z,#7F81", "Z0403");
    codeRaisesError("jr z,#7F00", "Z0403");

    codeRaisesError("jr nc,#8082", "Z0403");
    codeRaisesError("jr nc,#8100", "Z0403");
    codeRaisesError("jr nc,#7F81", "Z0403");
    codeRaisesError("jr nc,#7F00", "Z0403");

    codeRaisesError("jr c,#8082", "Z0403");
    codeRaisesError("jr c,#8100", "Z0403");
    codeRaisesError("jr c,#7F81", "Z0403");
    codeRaisesError("jr c,#7F00", "Z0403");
  });

  it("jr: fails with invalid condition", async () => {
    // --- Start address is #8000
    codeRaisesError("jr po,$", "Z0402");
    codeRaisesError("jr pe,$", "Z0402");
    codeRaisesError("jr p,$", "Z0402");
    codeRaisesError("jr m,$", "Z0402");
  });

  it("rst", async () => {
    await testCodeEmit("rst 0", 0xc7);
    await testCodeEmit("rst 8", 0xcf);
    await testCodeEmit("rst #08", 0xcf);
    await testCodeEmit("rst 08h", 0xcf);
    await testCodeEmit("rst 08H", 0xcf);
    await testCodeEmit("rst #10", 0xd7);
    await testCodeEmit("rst #18", 0xdf);
    await testCodeEmit("rst #20", 0xe7);
    await testCodeEmit("rst #28", 0xef);
    await testCodeEmit("rst #30", 0xf7);
    await testCodeEmit("rst #38", 0xff);
  });

  it("rst: fails with invalid target", async () => {
    codeRaisesError("rst 2", "Z0404");
    codeRaisesError("rst #40", "Z0404");
  });

  it("djnz", async () => {
    // --- Start address is #8000!
    await testCodeEmit("djnz #8022", 0x10, 0x20);
    await testCodeEmit("djnz #8000", 0x10, 0xfe);
    await testCodeEmit("djnz #8081", 0x10, 0x7f);
    await testCodeEmit("djnz #7F82", 0x10, 0x80);
    await testCodeEmit("djnz #7F84", 0x10, 0x82);
  });

  it("djnz: fails with far address", async () => {
    // --- Start address is #8000!
    codeRaisesError("djnz #8082", "Z0403");
    codeRaisesError("djnz #8100", "Z0403");
    codeRaisesError("djnz #7F81", "Z0403");
    codeRaisesError("djnz #7F00", "Z0403");
  });

});
