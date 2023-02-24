import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - ld operations", async () => {
  it("ld: reg8 --> reg8", async () => {
    await testCodeEmit("ld b,b", 0x40);
    await testCodeEmit("ld b,c", 0x41);
    await testCodeEmit("ld b,d", 0x42);
    await testCodeEmit("ld b,e", 0x43);
    await testCodeEmit("ld b,h", 0x44);
    await testCodeEmit("ld b,l", 0x45);
    await testCodeEmit("ld b,a", 0x47);

    await testCodeEmit("ld c,b", 0x48);
    await testCodeEmit("ld c,c", 0x49);
    await testCodeEmit("ld c,d", 0x4a);
    await testCodeEmit("ld c,e", 0x4b);
    await testCodeEmit("ld c,h", 0x4c);
    await testCodeEmit("ld c,l", 0x4d);
    await testCodeEmit("ld c,a", 0x4f);

    await testCodeEmit("ld d,b", 0x50);
    await testCodeEmit("ld d,c", 0x51);
    await testCodeEmit("ld d,d", 0x52);
    await testCodeEmit("ld d,e", 0x53);
    await testCodeEmit("ld d,h", 0x54);
    await testCodeEmit("ld d,l", 0x55);
    await testCodeEmit("ld d,a", 0x57);

    await testCodeEmit("ld e,b", 0x58);
    await testCodeEmit("ld e,c", 0x59);
    await testCodeEmit("ld e,d", 0x5a);
    await testCodeEmit("ld e,e", 0x5b);
    await testCodeEmit("ld e,h", 0x5c);
    await testCodeEmit("ld e,l", 0x5d);
    await testCodeEmit("ld e,a", 0x5f);

    await testCodeEmit("ld h,b", 0x60);
    await testCodeEmit("ld h,c", 0x61);
    await testCodeEmit("ld h,d", 0x62);
    await testCodeEmit("ld h,e", 0x63);
    await testCodeEmit("ld h,h", 0x64);
    await testCodeEmit("ld h,l", 0x65);
    await testCodeEmit("ld h,a", 0x67);

    await testCodeEmit("ld l,b", 0x68);
    await testCodeEmit("ld l,c", 0x69);
    await testCodeEmit("ld l,d", 0x6a);
    await testCodeEmit("ld l,e", 0x6b);
    await testCodeEmit("ld l,h", 0x6c);
    await testCodeEmit("ld l,l", 0x6d);
    await testCodeEmit("ld l,a", 0x6f);

    await testCodeEmit("ld a,b", 0x78);
    await testCodeEmit("ld a,c", 0x79);
    await testCodeEmit("ld a,d", 0x7a);
    await testCodeEmit("ld a,e", 0x7b);
    await testCodeEmit("ld a,h", 0x7c);
    await testCodeEmit("ld a,l", 0x7d);
    await testCodeEmit("ld a,a", 0x7f);
  });

  it("ld: (reg16) --> reg8", async () => {
    await testCodeEmit("ld b,(hl)", 0x46);
    await testCodeEmit("ld c,(hl)", 0x4e);
    await testCodeEmit("ld d,(hl)", 0x56);
    await testCodeEmit("ld e,(hl)", 0x5e);
    await testCodeEmit("ld h,(hl)", 0x66);
    await testCodeEmit("ld l,(hl)", 0x6e);
    await testCodeEmit("ld a,(hl)", 0x7e);
    await testCodeEmit("ld a,(bc)", 0x0a);
    await testCodeEmit("ld a,(de)", 0x1a);
  });

  it("ld: spec/reg8", async () => {
    await testCodeEmit("ld i,a", 0xed, 0x47);
    await testCodeEmit("ld r,a", 0xed, 0x4f);
    await testCodeEmit("ld a,i", 0xed, 0x57);
    await testCodeEmit("ld a,r", 0xed, 0x5f);
  });

  it("ld: reg8Spec --> reg8", async () => {
    await testCodeEmit("ld b,xh", 0xdd, 0x44);
    await testCodeEmit("ld c,xh", 0xdd, 0x4c);
    await testCodeEmit("ld d,xh", 0xdd, 0x54);
    await testCodeEmit("ld e,xh", 0xdd, 0x5c);
    await testCodeEmit("ld a,xh", 0xdd, 0x7c);

    await testCodeEmit("ld b,xl", 0xdd, 0x45);
    await testCodeEmit("ld c,xl", 0xdd, 0x4d);
    await testCodeEmit("ld d,xl", 0xdd, 0x55);
    await testCodeEmit("ld e,xl", 0xdd, 0x5d);
    await testCodeEmit("ld a,xl", 0xdd, 0x7d);

    await testCodeEmit("ld b,yh", 0xfd, 0x44);
    await testCodeEmit("ld c,yh", 0xfd, 0x4c);
    await testCodeEmit("ld d,yh", 0xfd, 0x54);
    await testCodeEmit("ld e,yh", 0xfd, 0x5c);
    await testCodeEmit("ld a,yh", 0xfd, 0x7c);

    await testCodeEmit("ld b,yl", 0xfd, 0x45);
    await testCodeEmit("ld c,yl", 0xfd, 0x4d);
    await testCodeEmit("ld d,yl", 0xfd, 0x55);
    await testCodeEmit("ld e,yl", 0xfd, 0x5d);
    await testCodeEmit("ld a,yl", 0xfd, 0x7d);
  });

  it("ld: NN --> reg8", async () => {
    await testCodeEmit("ld b,48+#0A", 0x06, 0x3a);
    await testCodeEmit("ld c,48+#0A", 0x0e, 0x3a);
    await testCodeEmit("ld d,48+#0A", 0x16, 0x3a);
    await testCodeEmit("ld e,48+#0A", 0x1e, 0x3a);
    await testCodeEmit("ld h,48+#0A", 0x26, 0x3a);
    await testCodeEmit("ld l,48+#0A", 0x2e, 0x3a);
    await testCodeEmit("ld a,48+#0A", 0x3e, 0x3a);
  });

  it("ld: (NNNN) --> (reg8/16)", async () => {
    await testCodeEmit("ld a,(#4000)", 0x3a, 0x00, 0x40);
  });

  it("ld: (indexed) --> reg8", async () => {
    await testCodeEmit("ld b,(ix)", 0xdd, 0x46, 0x00);
    await testCodeEmit("ld b,(ix+8)", 0xdd, 0x46, 0x08);
    await testCodeEmit("ld b,(ix-6)", 0xdd, 0x46, 0xfa);
    await testCodeEmit("ld c,(ix)", 0xdd, 0x4e, 0x00);
    await testCodeEmit("ld c,(ix+8)", 0xdd, 0x4e, 0x08);
    await testCodeEmit("ld c,(ix-6)", 0xdd, 0x4e, 0xfa);
    await testCodeEmit("ld d,(ix)", 0xdd, 0x56, 0x00);
    await testCodeEmit("ld d,(ix+8)", 0xdd, 0x56, 0x08);
    await testCodeEmit("ld d,(ix-6)", 0xdd, 0x56, 0xfa);
    await testCodeEmit("ld e,(ix)", 0xdd, 0x5e, 0x00);
    await testCodeEmit("ld e,(ix+8)", 0xdd, 0x5e, 0x08);
    await testCodeEmit("ld e,(ix-6)", 0xdd, 0x5e, 0xfa);
    await testCodeEmit("ld h,(ix)", 0xdd, 0x66, 0x00);
    await testCodeEmit("ld h,(ix+8)", 0xdd, 0x66, 0x08);
    await testCodeEmit("ld h,(ix-6)", 0xdd, 0x66, 0xfa);
    await testCodeEmit("ld l,(ix)", 0xdd, 0x6e, 0x00);
    await testCodeEmit("ld l,(ix+8)", 0xdd, 0x6e, 0x08);
    await testCodeEmit("ld l,(ix-6)", 0xdd, 0x6e, 0xfa);
    await testCodeEmit("ld a,(ix)", 0xdd, 0x7e, 0x00);
    await testCodeEmit("ld a,(ix+8)", 0xdd, 0x7e, 0x08);
    await testCodeEmit("ld a,(ix-6)", 0xdd, 0x7e, 0xfa);
    await testCodeEmit("ld b,(iy)", 0xfd, 0x46, 0x00);
    await testCodeEmit("ld b,(iy+8)", 0xfd, 0x46, 0x08);
    await testCodeEmit("ld b,(iy-6)", 0xfd, 0x46, 0xfa);
    await testCodeEmit("ld c,(iy)", 0xfd, 0x4e, 0x00);
    await testCodeEmit("ld c,(iy+8)", 0xfd, 0x4e, 0x08);
    await testCodeEmit("ld c,(iy-6)", 0xfd, 0x4e, 0xfa);
    await testCodeEmit("ld d,(iy)", 0xfd, 0x56, 0x00);
    await testCodeEmit("ld d,(iy+8)", 0xfd, 0x56, 0x08);
    await testCodeEmit("ld d,(iy-6)", 0xfd, 0x56, 0xfa);
    await testCodeEmit("ld e,(iy)", 0xfd, 0x5e, 0x00);
    await testCodeEmit("ld e,(iy+8)", 0xfd, 0x5e, 0x08);
    await testCodeEmit("ld e,(iy-6)", 0xfd, 0x5e, 0xfa);
    await testCodeEmit("ld h,(iy)", 0xfd, 0x66, 0x00);
    await testCodeEmit("ld h,(iy+8)", 0xfd, 0x66, 0x08);
    await testCodeEmit("ld h,(iy-6)", 0xfd, 0x66, 0xfa);
    await testCodeEmit("ld l,(iy)", 0xfd, 0x6e, 0x00);
    await testCodeEmit("ld l,(iy+8)", 0xfd, 0x6e, 0x08);
    await testCodeEmit("ld l,(iy-6)", 0xfd, 0x6e, 0xfa);
    await testCodeEmit("ld a,(iy)", 0xfd, 0x7e, 0x00);
    await testCodeEmit("ld a,(iy+8)", 0xfd, 0x7e, 0x08);
    await testCodeEmit("ld a,(iy-6)", 0xfd, 0x7e, 0xfa);
  });

  it("ld: reg8 --> reg8Idx", async () => {
    await testCodeEmit("ld xh,b", 0xdd, 0x60);
    await testCodeEmit("ld xh,c", 0xdd, 0x61);
    await testCodeEmit("ld xh,d", 0xdd, 0x62);
    await testCodeEmit("ld xh,e", 0xdd, 0x63);
    await testCodeEmit("ld xh,xh", 0xdd, 0x64);
    await testCodeEmit("ld xh,xl", 0xdd, 0x65);
    await testCodeEmit("ld xh,a", 0xdd, 0x67);

    await testCodeEmit("ld xl,b", 0xdd, 0x68);
    await testCodeEmit("ld xl,c", 0xdd, 0x69);
    await testCodeEmit("ld xl,d", 0xdd, 0x6a);
    await testCodeEmit("ld xl,e", 0xdd, 0x6b);
    await testCodeEmit("ld xl,xh", 0xdd, 0x6c);
    await testCodeEmit("ld xl,xl", 0xdd, 0x6d);
    await testCodeEmit("ld xl,a", 0xdd, 0x6f);

    await testCodeEmit("ld yh,b", 0xfd, 0x60);
    await testCodeEmit("ld yh,c", 0xfd, 0x61);
    await testCodeEmit("ld yh,d", 0xfd, 0x62);
    await testCodeEmit("ld yh,e", 0xfd, 0x63);
    await testCodeEmit("ld yh,yh", 0xfd, 0x64);
    await testCodeEmit("ld yh,yl", 0xfd, 0x65);
    await testCodeEmit("ld yh,a", 0xfd, 0x67);

    await testCodeEmit("ld yl,b", 0xfd, 0x68);
    await testCodeEmit("ld yl,c", 0xfd, 0x69);
    await testCodeEmit("ld yl,d", 0xfd, 0x6a);
    await testCodeEmit("ld yl,e", 0xfd, 0x6b);
    await testCodeEmit("ld yl,yh", 0xfd, 0x6c);
    await testCodeEmit("ld yl,yl", 0xfd, 0x6d);
    await testCodeEmit("ld yl,a", 0xfd, 0x6f);
  });

  it("ld: NN --> reg8Idx", async () => {
    await testCodeEmit("ld xh,48+#0A", 0xdd, 0x26, 0x3a);
    await testCodeEmit("ld xl,48+#0A", 0xdd, 0x2e, 0x3a);
    await testCodeEmit("ld yh,48+#0A", 0xfd, 0x26, 0x3a);
    await testCodeEmit("ld yl,48+#0A", 0xfd, 0x2e, 0x3a);
  });

  it("ld: reg8 --> (reg16)", async () => {
    await testCodeEmit("ld (bc),a", 0x02);
    await testCodeEmit("ld (de),a", 0x12);
    await testCodeEmit("ld (hl),b", 0x70);
    await testCodeEmit("ld (hl),c", 0x71);
    await testCodeEmit("ld (hl),d", 0x72);
    await testCodeEmit("ld (hl),e", 0x73);
    await testCodeEmit("ld (hl),h", 0x74);
    await testCodeEmit("ld (hl),l", 0x75);
    await testCodeEmit("ld (hl),a", 0x77);
  });

  it("ld: NN --> (hl)", async () => {
    await testCodeEmit("ld (hl),48+#0A", 0x36, 0x3a);
  });

  it("ld: reg --> (NNNN)", async () => {
    await testCodeEmit("ld (#4000+32),hl", 0x22, 0x20, 0x40);
    await testCodeEmit("ld (#4000),a", 0x32, 0x00, 0x40);
    await testCodeEmit("ld (#4000+32),bc", 0xed, 0x43, 0x20, 0x40);
    await testCodeEmit("ld (#4000+32),de", 0xed, 0x53, 0x20, 0x40);
    await testCodeEmit("ld (#4000+32),sp", 0xed, 0x73, 0x20, 0x40);
    await testCodeEmit("ld (#4000+32),ix", 0xdd, 0x22, 0x20, 0x40);
    await testCodeEmit("ld (#4000+32),iy", 0xfd, 0x22, 0x20, 0x40);
  });

  it("ld: ... --> reg16", async () => {
    await testCodeEmit("ld sp,hl", 0xf9);
    await testCodeEmit("ld sp,ix", 0xdd, 0xf9);
    await testCodeEmit("ld sp,iy", 0xfd, 0xf9);
    await testCodeEmit("ld bc,#1000*2+#34", 0x01, 0x34, 0x20);
    await testCodeEmit("ld de,#1000*2+#34", 0x11, 0x34, 0x20);
    await testCodeEmit("ld hl,#1000*2+#34", 0x21, 0x34, 0x20);
    await testCodeEmit("ld sp,#1000*2+#34", 0x31, 0x34, 0x20);
    await testCodeEmit("ld iy,#1000*2+#34", 0xfd, 0x21, 0x34, 0x20);
    await testCodeEmit("ld bc,(#4000+32)", 0xed, 0x4b, 0x20, 0x40);
    await testCodeEmit("ld de,(#4000+32)", 0xed, 0x5b, 0x20, 0x40);
    await testCodeEmit("ld hl,(#4000+32)", 0x2a, 0x20, 0x40);
    await testCodeEmit("ld sp,(#4000+32)", 0xed, 0x7b, 0x20, 0x40);
    await testCodeEmit("ld ix,(#4000+32)", 0xdd, 0x2a, 0x20, 0x40);
    await testCodeEmit("ld iy,(#4000+32)", 0xfd, 0x2a, 0x20, 0x40);
  });

  it("ld: ... --> indexed", async () => {
    await testCodeEmit("ld (ix),b", 0xdd, 0x70, 0x00);
    await testCodeEmit("ld (ix+8),b", 0xdd, 0x70, 0x08);
    await testCodeEmit("ld (ix-6),b", 0xdd, 0x70, 0xfa);
    await testCodeEmit("ld (ix),c", 0xdd, 0x71, 0x00);
    await testCodeEmit("ld (ix+8),c", 0xdd, 0x71, 0x08);
    await testCodeEmit("ld (ix-6),c", 0xdd, 0x71, 0xfa);
    await testCodeEmit("ld (ix),d", 0xdd, 0x72, 0x00);
    await testCodeEmit("ld (ix+8),d", 0xdd, 0x72, 0x08);
    await testCodeEmit("ld (ix-6),d", 0xdd, 0x72, 0xfa);
    await testCodeEmit("ld (ix),e", 0xdd, 0x73, 0x00);
    await testCodeEmit("ld (ix+8),e", 0xdd, 0x73, 0x08);
    await testCodeEmit("ld (ix-6),e", 0xdd, 0x73, 0xfa);
    await testCodeEmit("ld (ix),h", 0xdd, 0x74, 0x00);
    await testCodeEmit("ld (ix+8),h", 0xdd, 0x74, 0x08);
    await testCodeEmit("ld (ix-6),h", 0xdd, 0x74, 0xfa);
    await testCodeEmit("ld (ix),l", 0xdd, 0x75, 0x00);
    await testCodeEmit("ld (ix+8),l", 0xdd, 0x75, 0x08);
    await testCodeEmit("ld (ix-6),l", 0xdd, 0x75, 0xfa);
    await testCodeEmit("ld (ix),a", 0xdd, 0x77, 0x00);
    await testCodeEmit("ld (ix+8),a", 0xdd, 0x77, 0x08);
    await testCodeEmit("ld (ix-6),a", 0xdd, 0x77, 0xfa);

    await testCodeEmit("ld (iy),b", 0xfd, 0x70, 0x00);
    await testCodeEmit("ld (iy+8),b", 0xfd, 0x70, 0x08);
    await testCodeEmit("ld (iy-6),b", 0xfd, 0x70, 0xfa);
    await testCodeEmit("ld (iy),c", 0xfd, 0x71, 0x00);
    await testCodeEmit("ld (iy+8),c", 0xfd, 0x71, 0x08);
    await testCodeEmit("ld (iy-6),c", 0xfd, 0x71, 0xfa);
    await testCodeEmit("ld (iy),d", 0xfd, 0x72, 0x00);
    await testCodeEmit("ld (iy+8),d", 0xfd, 0x72, 0x08);
    await testCodeEmit("ld (iy-6),d", 0xfd, 0x72, 0xfa);
    await testCodeEmit("ld (iy),e", 0xfd, 0x73, 0x00);
    await testCodeEmit("ld (iy+8),e", 0xfd, 0x73, 0x08);
    await testCodeEmit("ld (iy-6),e", 0xfd, 0x73, 0xfa);
    await testCodeEmit("ld (iy),h", 0xfd, 0x74, 0x00);
    await testCodeEmit("ld (iy+8),h", 0xfd, 0x74, 0x08);
    await testCodeEmit("ld (iy-6),h", 0xfd, 0x74, 0xfa);
    await testCodeEmit("ld (iy),l", 0xfd, 0x75, 0x00);
    await testCodeEmit("ld (iy+8),l", 0xfd, 0x75, 0x08);
    await testCodeEmit("ld (iy-6),l", 0xfd, 0x75, 0xfa);
    await testCodeEmit("ld (iy),a", 0xfd, 0x77, 0x00);
    await testCodeEmit("ld (iy+8),a", 0xfd, 0x77, 0x08);
    await testCodeEmit("ld (iy-6),a", 0xfd, 0x77, 0xfa);

    await testCodeEmit("ld (ix),#23", 0xdd, 0x36, 0x00, 0x23);
    await testCodeEmit("ld (ix+8),#23", 0xdd, 0x36, 0x08, 0x23);
    await testCodeEmit("ld (ix-6),#23", 0xdd, 0x36, 0xfa, 0x23);
    await testCodeEmit("ld (iy),#23", 0xfd, 0x36, 0x00, 0x23);
    await testCodeEmit("ld (iy+8),#23", 0xfd, 0x36, 0x08, 0x23);
    await testCodeEmit("ld (iy-6),#23", 0xfd, 0x36, 0xfa, 0x23);
  });

  it("ld: fails with invalid operand", async () => {
    await codeRaisesError("ld (hl),(hl)", "Z0604");

    await codeRaisesError("ld xh,h", "Z0604");
    await codeRaisesError("ld xh,l", "Z0604");
    await codeRaisesError("ld xh,(hl)", "Z0604");
    await codeRaisesError("ld xl,h", "Z0604");
    await codeRaisesError("ld xl,l", "Z0604");
    await codeRaisesError("ld xl,(hl)", "Z0604");

    await codeRaisesError("ld yh,h", "Z0604");
    await codeRaisesError("ld yh,l", "Z0604");
    await codeRaisesError("ld yh,(hl)", "Z0604");
    await codeRaisesError("ld yl,h", "Z0604");
    await codeRaisesError("ld yl,l", "Z0604");
    await codeRaisesError("ld yl,(hl)", "Z0604");

    await codeRaisesError("ld xh,yh", "Z0604");
    await codeRaisesError("ld xh,yl", "Z0604");
    await codeRaisesError("ld yh,xh", "Z0604");
    await codeRaisesError("ld yh,xl", "Z0604");

    await codeRaisesError("ld h,xh", "Z0604");
    await codeRaisesError("ld l,xh", "Z0604");
    await codeRaisesError("ld (hl),xh", "Z0604");
    await codeRaisesError("ld h,xl", "Z0604");
    await codeRaisesError("ld l,xl", "Z0604");
    await codeRaisesError("ld (hl),xl", "Z0604");

    await codeRaisesError("ld h,yh", "Z0604");
    await codeRaisesError("ld l,yh", "Z0604");
    await codeRaisesError("ld (hl),yh", "Z0604");
    await codeRaisesError("ld h,yl", "Z0604");
    await codeRaisesError("ld l,yl", "Z0604");
    await codeRaisesError("ld (hl),yl", "Z0604");
});


});
