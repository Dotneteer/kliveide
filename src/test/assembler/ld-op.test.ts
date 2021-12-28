import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - ld operations", () => {
  it("ld: reg8 --> reg8", () => {
    testCodeEmit("ld b,b", 0x40);
    testCodeEmit("ld b,c", 0x41);
    testCodeEmit("ld b,d", 0x42);
    testCodeEmit("ld b,e", 0x43);
    testCodeEmit("ld b,h", 0x44);
    testCodeEmit("ld b,l", 0x45);
    testCodeEmit("ld b,a", 0x47);

    testCodeEmit("ld c,b", 0x48);
    testCodeEmit("ld c,c", 0x49);
    testCodeEmit("ld c,d", 0x4a);
    testCodeEmit("ld c,e", 0x4b);
    testCodeEmit("ld c,h", 0x4c);
    testCodeEmit("ld c,l", 0x4d);
    testCodeEmit("ld c,a", 0x4f);

    testCodeEmit("ld d,b", 0x50);
    testCodeEmit("ld d,c", 0x51);
    testCodeEmit("ld d,d", 0x52);
    testCodeEmit("ld d,e", 0x53);
    testCodeEmit("ld d,h", 0x54);
    testCodeEmit("ld d,l", 0x55);
    testCodeEmit("ld d,a", 0x57);

    testCodeEmit("ld e,b", 0x58);
    testCodeEmit("ld e,c", 0x59);
    testCodeEmit("ld e,d", 0x5a);
    testCodeEmit("ld e,e", 0x5b);
    testCodeEmit("ld e,h", 0x5c);
    testCodeEmit("ld e,l", 0x5d);
    testCodeEmit("ld e,a", 0x5f);

    testCodeEmit("ld h,b", 0x60);
    testCodeEmit("ld h,c", 0x61);
    testCodeEmit("ld h,d", 0x62);
    testCodeEmit("ld h,e", 0x63);
    testCodeEmit("ld h,h", 0x64);
    testCodeEmit("ld h,l", 0x65);
    testCodeEmit("ld h,a", 0x67);

    testCodeEmit("ld l,b", 0x68);
    testCodeEmit("ld l,c", 0x69);
    testCodeEmit("ld l,d", 0x6a);
    testCodeEmit("ld l,e", 0x6b);
    testCodeEmit("ld l,h", 0x6c);
    testCodeEmit("ld l,l", 0x6d);
    testCodeEmit("ld l,a", 0x6f);

    testCodeEmit("ld a,b", 0x78);
    testCodeEmit("ld a,c", 0x79);
    testCodeEmit("ld a,d", 0x7a);
    testCodeEmit("ld a,e", 0x7b);
    testCodeEmit("ld a,h", 0x7c);
    testCodeEmit("ld a,l", 0x7d);
    testCodeEmit("ld a,a", 0x7f);
  });

  it("ld: (reg16) --> reg8", () => {
    testCodeEmit("ld b,(hl)", 0x46);
    testCodeEmit("ld c,(hl)", 0x4e);
    testCodeEmit("ld d,(hl)", 0x56);
    testCodeEmit("ld e,(hl)", 0x5e);
    testCodeEmit("ld h,(hl)", 0x66);
    testCodeEmit("ld l,(hl)", 0x6e);
    testCodeEmit("ld a,(hl)", 0x7e);
    testCodeEmit("ld a,(bc)", 0x0a);
    testCodeEmit("ld a,(de)", 0x1a);
  });

  it("ld: spec/reg8", () => {
    testCodeEmit("ld i,a", 0xed, 0x47);
    testCodeEmit("ld r,a", 0xed, 0x4f);
    testCodeEmit("ld a,i", 0xed, 0x57);
    testCodeEmit("ld a,r", 0xed, 0x5f);
  });

  it("ld: reg8Spec --> reg8", () => {
    testCodeEmit("ld b,xh", 0xdd, 0x44);
    testCodeEmit("ld c,xh", 0xdd, 0x4c);
    testCodeEmit("ld d,xh", 0xdd, 0x54);
    testCodeEmit("ld e,xh", 0xdd, 0x5c);
    testCodeEmit("ld a,xh", 0xdd, 0x7c);

    testCodeEmit("ld b,xl", 0xdd, 0x45);
    testCodeEmit("ld c,xl", 0xdd, 0x4d);
    testCodeEmit("ld d,xl", 0xdd, 0x55);
    testCodeEmit("ld e,xl", 0xdd, 0x5d);
    testCodeEmit("ld a,xl", 0xdd, 0x7d);

    testCodeEmit("ld b,yh", 0xfd, 0x44);
    testCodeEmit("ld c,yh", 0xfd, 0x4c);
    testCodeEmit("ld d,yh", 0xfd, 0x54);
    testCodeEmit("ld e,yh", 0xfd, 0x5c);
    testCodeEmit("ld a,yh", 0xfd, 0x7c);

    testCodeEmit("ld b,yl", 0xfd, 0x45);
    testCodeEmit("ld c,yl", 0xfd, 0x4d);
    testCodeEmit("ld d,yl", 0xfd, 0x55);
    testCodeEmit("ld e,yl", 0xfd, 0x5d);
    testCodeEmit("ld a,yl", 0xfd, 0x7d);
  });

  it("ld: NN --> reg8", () => {
    testCodeEmit("ld b,48+#0A", 0x06, 0x3a);
    testCodeEmit("ld c,48+#0A", 0x0e, 0x3a);
    testCodeEmit("ld d,48+#0A", 0x16, 0x3a);
    testCodeEmit("ld e,48+#0A", 0x1e, 0x3a);
    testCodeEmit("ld h,48+#0A", 0x26, 0x3a);
    testCodeEmit("ld l,48+#0A", 0x2e, 0x3a);
    testCodeEmit("ld a,48+#0A", 0x3e, 0x3a);
  });

  it("ld: (NNNN) --> (reg8/16)", () => {
    testCodeEmit("ld a,(#4000)", 0x3a, 0x00, 0x40);
  });

  it("ld: (indexed) --> reg8", () => {
    testCodeEmit("ld b,(ix)", 0xdd, 0x46, 0x00);
    testCodeEmit("ld b,(ix+8)", 0xdd, 0x46, 0x08);
    testCodeEmit("ld b,(ix-6)", 0xdd, 0x46, 0xfa);
    testCodeEmit("ld c,(ix)", 0xdd, 0x4e, 0x00);
    testCodeEmit("ld c,(ix+8)", 0xdd, 0x4e, 0x08);
    testCodeEmit("ld c,(ix-6)", 0xdd, 0x4e, 0xfa);
    testCodeEmit("ld d,(ix)", 0xdd, 0x56, 0x00);
    testCodeEmit("ld d,(ix+8)", 0xdd, 0x56, 0x08);
    testCodeEmit("ld d,(ix-6)", 0xdd, 0x56, 0xfa);
    testCodeEmit("ld e,(ix)", 0xdd, 0x5e, 0x00);
    testCodeEmit("ld e,(ix+8)", 0xdd, 0x5e, 0x08);
    testCodeEmit("ld e,(ix-6)", 0xdd, 0x5e, 0xfa);
    testCodeEmit("ld h,(ix)", 0xdd, 0x66, 0x00);
    testCodeEmit("ld h,(ix+8)", 0xdd, 0x66, 0x08);
    testCodeEmit("ld h,(ix-6)", 0xdd, 0x66, 0xfa);
    testCodeEmit("ld l,(ix)", 0xdd, 0x6e, 0x00);
    testCodeEmit("ld l,(ix+8)", 0xdd, 0x6e, 0x08);
    testCodeEmit("ld l,(ix-6)", 0xdd, 0x6e, 0xfa);
    testCodeEmit("ld a,(ix)", 0xdd, 0x7e, 0x00);
    testCodeEmit("ld a,(ix+8)", 0xdd, 0x7e, 0x08);
    testCodeEmit("ld a,(ix-6)", 0xdd, 0x7e, 0xfa);
    testCodeEmit("ld b,(iy)", 0xfd, 0x46, 0x00);
    testCodeEmit("ld b,(iy+8)", 0xfd, 0x46, 0x08);
    testCodeEmit("ld b,(iy-6)", 0xfd, 0x46, 0xfa);
    testCodeEmit("ld c,(iy)", 0xfd, 0x4e, 0x00);
    testCodeEmit("ld c,(iy+8)", 0xfd, 0x4e, 0x08);
    testCodeEmit("ld c,(iy-6)", 0xfd, 0x4e, 0xfa);
    testCodeEmit("ld d,(iy)", 0xfd, 0x56, 0x00);
    testCodeEmit("ld d,(iy+8)", 0xfd, 0x56, 0x08);
    testCodeEmit("ld d,(iy-6)", 0xfd, 0x56, 0xfa);
    testCodeEmit("ld e,(iy)", 0xfd, 0x5e, 0x00);
    testCodeEmit("ld e,(iy+8)", 0xfd, 0x5e, 0x08);
    testCodeEmit("ld e,(iy-6)", 0xfd, 0x5e, 0xfa);
    testCodeEmit("ld h,(iy)", 0xfd, 0x66, 0x00);
    testCodeEmit("ld h,(iy+8)", 0xfd, 0x66, 0x08);
    testCodeEmit("ld h,(iy-6)", 0xfd, 0x66, 0xfa);
    testCodeEmit("ld l,(iy)", 0xfd, 0x6e, 0x00);
    testCodeEmit("ld l,(iy+8)", 0xfd, 0x6e, 0x08);
    testCodeEmit("ld l,(iy-6)", 0xfd, 0x6e, 0xfa);
    testCodeEmit("ld a,(iy)", 0xfd, 0x7e, 0x00);
    testCodeEmit("ld a,(iy+8)", 0xfd, 0x7e, 0x08);
    testCodeEmit("ld a,(iy-6)", 0xfd, 0x7e, 0xfa);
  });

  it("ld: reg8 --> reg8Idx", () => {
    testCodeEmit("ld xh,b", 0xdd, 0x60);
    testCodeEmit("ld xh,c", 0xdd, 0x61);
    testCodeEmit("ld xh,d", 0xdd, 0x62);
    testCodeEmit("ld xh,e", 0xdd, 0x63);
    testCodeEmit("ld xh,xh", 0xdd, 0x64);
    testCodeEmit("ld xh,xl", 0xdd, 0x65);
    testCodeEmit("ld xh,a", 0xdd, 0x67);

    testCodeEmit("ld xl,b", 0xdd, 0x68);
    testCodeEmit("ld xl,c", 0xdd, 0x69);
    testCodeEmit("ld xl,d", 0xdd, 0x6a);
    testCodeEmit("ld xl,e", 0xdd, 0x6b);
    testCodeEmit("ld xl,xh", 0xdd, 0x6c);
    testCodeEmit("ld xl,xl", 0xdd, 0x6d);
    testCodeEmit("ld xl,a", 0xdd, 0x6f);

    testCodeEmit("ld yh,b", 0xfd, 0x60);
    testCodeEmit("ld yh,c", 0xfd, 0x61);
    testCodeEmit("ld yh,d", 0xfd, 0x62);
    testCodeEmit("ld yh,e", 0xfd, 0x63);
    testCodeEmit("ld yh,yh", 0xfd, 0x64);
    testCodeEmit("ld yh,yl", 0xfd, 0x65);
    testCodeEmit("ld yh,a", 0xfd, 0x67);

    testCodeEmit("ld yl,b", 0xfd, 0x68);
    testCodeEmit("ld yl,c", 0xfd, 0x69);
    testCodeEmit("ld yl,d", 0xfd, 0x6a);
    testCodeEmit("ld yl,e", 0xfd, 0x6b);
    testCodeEmit("ld yl,yh", 0xfd, 0x6c);
    testCodeEmit("ld yl,yl", 0xfd, 0x6d);
    testCodeEmit("ld yl,a", 0xfd, 0x6f);
  });

  it("ld: NN --> reg8Idx", () => {
    testCodeEmit("ld xh,48+#0A", 0xdd, 0x26, 0x3a);
    testCodeEmit("ld xl,48+#0A", 0xdd, 0x2e, 0x3a);
    testCodeEmit("ld yh,48+#0A", 0xfd, 0x26, 0x3a);
    testCodeEmit("ld yl,48+#0A", 0xfd, 0x2e, 0x3a);
  });

  it("ld: reg8 --> (reg16)", () => {
    testCodeEmit("ld (bc),a", 0x02);
    testCodeEmit("ld (de),a", 0x12);
    testCodeEmit("ld (hl),b", 0x70);
    testCodeEmit("ld (hl),c", 0x71);
    testCodeEmit("ld (hl),d", 0x72);
    testCodeEmit("ld (hl),e", 0x73);
    testCodeEmit("ld (hl),h", 0x74);
    testCodeEmit("ld (hl),l", 0x75);
    testCodeEmit("ld (hl),a", 0x77);
  });

  it("ld: NN --> (hl)", () => {
    testCodeEmit("ld (hl),48+#0A", 0x36, 0x3a);
  });

  it("ld: reg --> (NNNN)", () => {
    testCodeEmit("ld (#4000+32),hl", 0x22, 0x20, 0x40);
    testCodeEmit("ld (#4000),a", 0x32, 0x00, 0x40);
    testCodeEmit("ld (#4000+32),bc", 0xed, 0x43, 0x20, 0x40);
    testCodeEmit("ld (#4000+32),de", 0xed, 0x53, 0x20, 0x40);
    testCodeEmit("ld (#4000+32),sp", 0xed, 0x73, 0x20, 0x40);
    testCodeEmit("ld (#4000+32),ix", 0xdd, 0x22, 0x20, 0x40);
    testCodeEmit("ld (#4000+32),iy", 0xfd, 0x22, 0x20, 0x40);
  });

  it("ld: ... --> reg16", () => {
    testCodeEmit("ld sp,hl", 0xf9);
    testCodeEmit("ld sp,ix", 0xdd, 0xf9);
    testCodeEmit("ld sp,iy", 0xfd, 0xf9);
    testCodeEmit("ld bc,#1000*2+#34", 0x01, 0x34, 0x20);
    testCodeEmit("ld de,#1000*2+#34", 0x11, 0x34, 0x20);
    testCodeEmit("ld hl,#1000*2+#34", 0x21, 0x34, 0x20);
    testCodeEmit("ld sp,#1000*2+#34", 0x31, 0x34, 0x20);
    testCodeEmit("ld iy,#1000*2+#34", 0xfd, 0x21, 0x34, 0x20);
    testCodeEmit("ld bc,(#4000+32)", 0xed, 0x4b, 0x20, 0x40);
    testCodeEmit("ld de,(#4000+32)", 0xed, 0x5b, 0x20, 0x40);
    testCodeEmit("ld hl,(#4000+32)", 0x2a, 0x20, 0x40);
    testCodeEmit("ld sp,(#4000+32)", 0xed, 0x7b, 0x20, 0x40);
    testCodeEmit("ld ix,(#4000+32)", 0xdd, 0x2a, 0x20, 0x40);
    testCodeEmit("ld iy,(#4000+32)", 0xfd, 0x2a, 0x20, 0x40);
  });

  it("ld: ... --> indexed", () => {
    testCodeEmit("ld (ix),b", 0xdd, 0x70, 0x00);
    testCodeEmit("ld (ix+8),b", 0xdd, 0x70, 0x08);
    testCodeEmit("ld (ix-6),b", 0xdd, 0x70, 0xfa);
    testCodeEmit("ld (ix),c", 0xdd, 0x71, 0x00);
    testCodeEmit("ld (ix+8),c", 0xdd, 0x71, 0x08);
    testCodeEmit("ld (ix-6),c", 0xdd, 0x71, 0xfa);
    testCodeEmit("ld (ix),d", 0xdd, 0x72, 0x00);
    testCodeEmit("ld (ix+8),d", 0xdd, 0x72, 0x08);
    testCodeEmit("ld (ix-6),d", 0xdd, 0x72, 0xfa);
    testCodeEmit("ld (ix),e", 0xdd, 0x73, 0x00);
    testCodeEmit("ld (ix+8),e", 0xdd, 0x73, 0x08);
    testCodeEmit("ld (ix-6),e", 0xdd, 0x73, 0xfa);
    testCodeEmit("ld (ix),h", 0xdd, 0x74, 0x00);
    testCodeEmit("ld (ix+8),h", 0xdd, 0x74, 0x08);
    testCodeEmit("ld (ix-6),h", 0xdd, 0x74, 0xfa);
    testCodeEmit("ld (ix),l", 0xdd, 0x75, 0x00);
    testCodeEmit("ld (ix+8),l", 0xdd, 0x75, 0x08);
    testCodeEmit("ld (ix-6),l", 0xdd, 0x75, 0xfa);
    testCodeEmit("ld (ix),a", 0xdd, 0x77, 0x00);
    testCodeEmit("ld (ix+8),a", 0xdd, 0x77, 0x08);
    testCodeEmit("ld (ix-6),a", 0xdd, 0x77, 0xfa);

    testCodeEmit("ld (iy),b", 0xfd, 0x70, 0x00);
    testCodeEmit("ld (iy+8),b", 0xfd, 0x70, 0x08);
    testCodeEmit("ld (iy-6),b", 0xfd, 0x70, 0xfa);
    testCodeEmit("ld (iy),c", 0xfd, 0x71, 0x00);
    testCodeEmit("ld (iy+8),c", 0xfd, 0x71, 0x08);
    testCodeEmit("ld (iy-6),c", 0xfd, 0x71, 0xfa);
    testCodeEmit("ld (iy),d", 0xfd, 0x72, 0x00);
    testCodeEmit("ld (iy+8),d", 0xfd, 0x72, 0x08);
    testCodeEmit("ld (iy-6),d", 0xfd, 0x72, 0xfa);
    testCodeEmit("ld (iy),e", 0xfd, 0x73, 0x00);
    testCodeEmit("ld (iy+8),e", 0xfd, 0x73, 0x08);
    testCodeEmit("ld (iy-6),e", 0xfd, 0x73, 0xfa);
    testCodeEmit("ld (iy),h", 0xfd, 0x74, 0x00);
    testCodeEmit("ld (iy+8),h", 0xfd, 0x74, 0x08);
    testCodeEmit("ld (iy-6),h", 0xfd, 0x74, 0xfa);
    testCodeEmit("ld (iy),l", 0xfd, 0x75, 0x00);
    testCodeEmit("ld (iy+8),l", 0xfd, 0x75, 0x08);
    testCodeEmit("ld (iy-6),l", 0xfd, 0x75, 0xfa);
    testCodeEmit("ld (iy),a", 0xfd, 0x77, 0x00);
    testCodeEmit("ld (iy+8),a", 0xfd, 0x77, 0x08);
    testCodeEmit("ld (iy-6),a", 0xfd, 0x77, 0xfa);

    testCodeEmit("ld (ix),#23", 0xdd, 0x36, 0x00, 0x23);
    testCodeEmit("ld (ix+8),#23", 0xdd, 0x36, 0x08, 0x23);
    testCodeEmit("ld (ix-6),#23", 0xdd, 0x36, 0xfa, 0x23);
    testCodeEmit("ld (iy),#23", 0xfd, 0x36, 0x00, 0x23);
    testCodeEmit("ld (iy+8),#23", 0xfd, 0x36, 0x08, 0x23);
    testCodeEmit("ld (iy-6),#23", 0xfd, 0x36, 0xfa, 0x23);
  });

  it("ld: fails with invalid operand", () => {
    codeRaisesError("ld (hl),(hl)", "Z0604");

    codeRaisesError("ld xh,h", "Z0604");
    codeRaisesError("ld xh,l", "Z0604");
    codeRaisesError("ld xh,(hl)", "Z0604");
    codeRaisesError("ld xl,h", "Z0604");
    codeRaisesError("ld xl,l", "Z0604");
    codeRaisesError("ld xl,(hl)", "Z0604");

    codeRaisesError("ld yh,h", "Z0604");
    codeRaisesError("ld yh,l", "Z0604");
    codeRaisesError("ld yh,(hl)", "Z0604");
    codeRaisesError("ld yl,h", "Z0604");
    codeRaisesError("ld yl,l", "Z0604");
    codeRaisesError("ld yl,(hl)", "Z0604");

    codeRaisesError("ld xh,yh", "Z0604");
    codeRaisesError("ld xh,yl", "Z0604");
    codeRaisesError("ld yh,xh", "Z0604");
    codeRaisesError("ld yh,xl", "Z0604");

    codeRaisesError("ld h,xh", "Z0604");
    codeRaisesError("ld l,xh", "Z0604");
    codeRaisesError("ld (hl),xh", "Z0604");
    codeRaisesError("ld h,xl", "Z0604");
    codeRaisesError("ld l,xl", "Z0604");
    codeRaisesError("ld (hl),xl", "Z0604");

    codeRaisesError("ld h,yh", "Z0604");
    codeRaisesError("ld l,yh", "Z0604");
    codeRaisesError("ld (hl),yh", "Z0604");
    codeRaisesError("ld h,yl", "Z0604");
    codeRaisesError("ld l,yl", "Z0604");
    codeRaisesError("ld (hl),yl", "Z0604");
});


});
