import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - control flow operations", () => {
  it("ret", () => {
    testCodeEmit("ret", 0xc9);
    testCodeEmit("ret nz", 0xc0);
    testCodeEmit("ret z", 0xc8);
    testCodeEmit("ret nc", 0xd0);
    testCodeEmit("ret c", 0xd8);
    testCodeEmit("ret po", 0xe0);
    testCodeEmit("ret pe", 0xe8);
    testCodeEmit("ret p", 0xf0);
    testCodeEmit("ret m", 0xf8);
  });

  it("call NNNN", () => {
    testCodeEmit("call #1234", 0xcd, 0x34, 0x12);
    testCodeEmit("call nz, #1234", 0xc4, 0x34, 0x12);
    testCodeEmit("call z, #1234", 0xcc, 0x34, 0x12);
    testCodeEmit("call nc, #1234", 0xd4, 0x34, 0x12);
    testCodeEmit("call c, #1234", 0xdc, 0x34, 0x12);
    testCodeEmit("call po, #1234", 0xe4, 0x34, 0x12);
    testCodeEmit("call pe, #1234", 0xec, 0x34, 0x12);
    testCodeEmit("call p, #1234", 0xf4, 0x34, 0x12);
    testCodeEmit("call m, #1234", 0xfc, 0x34, 0x12);
  });

  it("jp NNNN", () => {
    testCodeEmit("jp #1234", 0xc3, 0x34, 0x12);
    testCodeEmit("jp nz, #1234", 0xc2, 0x34, 0x12);
    testCodeEmit("jp z, #1234", 0xca, 0x34, 0x12);
    testCodeEmit("jp nc, #1234", 0xd2, 0x34, 0x12);
    testCodeEmit("jp c, #1234", 0xda, 0x34, 0x12);
    testCodeEmit("jp po, #1234", 0xe2, 0x34, 0x12);
    testCodeEmit("jp pe, #1234", 0xea, 0x34, 0x12);
    testCodeEmit("jp p, #1234", 0xf2, 0x34, 0x12);
    testCodeEmit("jp m, #1234", 0xfa, 0x34, 0x12);
  });

  it("jp spec", () => {
    testCodeEmit("jp (c)", 0xed, 0x98);
    testCodeEmit("jp hl", 0xe9);
    testCodeEmit("jp (hl)", 0xe9);
    testCodeEmit("jp ix", 0xdd, 0xe9);
    testCodeEmit("jp (ix)", 0xdd, 0xe9);
    testCodeEmit("jp iy", 0xfd, 0xe9);
    testCodeEmit("jp (iy)", 0xfd, 0xe9);
  });

  it("jp fails", () => {
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

  it("jr", () => {
    // --- Start address is #8000
    testCodeEmit("jr #8022", 0x18, 0x20);
    testCodeEmit("jr #8000", 0x18, 0xfe);
    testCodeEmit("jr #8081", 0x18, 0x7f);
    testCodeEmit("jr #7F82", 0x18, 0x80);
    testCodeEmit("jr #7F84", 0x18, 0x82);

    testCodeEmit("jr nz,#8022", 0x20, 0x20);
    testCodeEmit("jr nz,#8000", 0x20, 0xfe);
    testCodeEmit("jr nz,#8081", 0x20, 0x7f);
    testCodeEmit("jr nz,#7F82", 0x20, 0x80);
    testCodeEmit("jr nz,#7F84", 0x20, 0x82);

    testCodeEmit("jr z,#8022", 0x28, 0x20);
    testCodeEmit("jr z,#8000", 0x28, 0xfe);
    testCodeEmit("jr z,#8081", 0x28, 0x7f);
    testCodeEmit("jr z,#7F82", 0x28, 0x80);
    testCodeEmit("jr z,#7F84", 0x28, 0x82);

    testCodeEmit("jr nc,#8022", 0x30, 0x20);
    testCodeEmit("jr nc,#8000", 0x30, 0xfe);
    testCodeEmit("jr nc,#8081", 0x30, 0x7f);
    testCodeEmit("jr nc,#7F82", 0x30, 0x80);
    testCodeEmit("jr nc,#7F84", 0x30, 0x82);

    testCodeEmit("jr c,#8022", 0x38, 0x20);
    testCodeEmit("jr c,#8000", 0x38, 0xfe);
    testCodeEmit("jr c,#8081", 0x38, 0x7f);
    testCodeEmit("jr c,#7F82", 0x38, 0x80);
    testCodeEmit("jr c,#7F84", 0x38, 0x82);
  });

  it("jr: fails with far address", () => {
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

  it("jr: fails with invalid condition", () => {
    // --- Start address is #8000
    codeRaisesError("jr po,$", "Z0402");
    codeRaisesError("jr pe,$", "Z0402");
    codeRaisesError("jr p,$", "Z0402");
    codeRaisesError("jr m,$", "Z0402");
  });

  it("rst", () => {
    testCodeEmit("rst 0", 0xc7);
    testCodeEmit("rst 8", 0xcf);
    testCodeEmit("rst #08", 0xcf);
    testCodeEmit("rst 08h", 0xcf);
    testCodeEmit("rst 08H", 0xcf);
    testCodeEmit("rst #10", 0xd7);
    testCodeEmit("rst #18", 0xdf);
    testCodeEmit("rst #20", 0xe7);
    testCodeEmit("rst #28", 0xef);
    testCodeEmit("rst #30", 0xf7);
    testCodeEmit("rst #38", 0xff);
  });

  it("rst: fails with invalid target", () => {
    codeRaisesError("rst 2", "Z0404");
    codeRaisesError("rst #40", "Z0404");
  });

  it("djnz", () => {
    // --- Start address is #8000!
    testCodeEmit("djnz #8022", 0x10, 0x20);
    testCodeEmit("djnz #8000", 0x10, 0xfe);
    testCodeEmit("djnz #8081", 0x10, 0x7f);
    testCodeEmit("djnz #7F82", 0x10, 0x80);
    testCodeEmit("djnz #7F84", 0x10, 0x82);
  });

  it("djnz: fails with far address", () => {
    // --- Start address is #8000!
    codeRaisesError("djnz #8082", "Z0403");
    codeRaisesError("djnz #8100", "Z0403");
    codeRaisesError("djnz #7F81", "Z0403");
    codeRaisesError("djnz #7F00", "Z0403");
  });

});
