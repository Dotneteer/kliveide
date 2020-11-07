import { Z80Tester } from "./z80-tester";

describe("Disassembler - IX-related instructions", () => {
  it("Instructions 0x00-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("add ix,bc", 0xdd, 0x09);
    await Z80Tester.Test("add ix,de", 0xdd, 0x19);
    await Z80Tester.Test("ld ix,#1234", 0xdd, 0x21, 0x34, 0x12);
    await Z80Tester.Test("ld (#1234),ix", 0xdd, 0x22, 0x34, 0x12);
    await Z80Tester.Test("inc ix", 0xdd, 0x23);
    await Z80Tester.Test("inc xh", 0xdd, 0x24);
    await Z80Tester.Test("dec xh", 0xdd, 0x25);
    await Z80Tester.Test("ld xh,#AB", 0xdd, 0x26, 0xab);
    await Z80Tester.Test("add ix,ix", 0xdd, 0x29);
    await Z80Tester.Test("ld ix,(#1234)", 0xdd, 0x2a, 0x34, 0x12);
    await Z80Tester.Test("dec ix", 0xdd, 0x2b);
    await Z80Tester.Test("inc xl", 0xdd, 0x2c);
    await Z80Tester.Test("dec xl", 0xdd, 0x2d);
    await Z80Tester.Test("ld xl,#AB", 0xdd, 0x2e, 0xab);
    await Z80Tester.Test("inc (ix+#3D)", 0xdd, 0x34, 0x3d);
    await Z80Tester.Test("inc (ix-#51)", 0xdd, 0x34, 0xaf);
    await Z80Tester.Test("dec (ix+#3D)", 0xdd, 0x35, 0x3d);
    await Z80Tester.Test("dec (ix-#51)", 0xdd, 0x35, 0xaf);
    await Z80Tester.Test("ld (ix+#3D),#12", 0xdd, 0x36, 0x3d, 0x12);
    await Z80Tester.Test("ld (ix-#51),#12", 0xdd, 0x36, 0xaf, 0x12);
    await Z80Tester.Test("add ix,sp", 0xdd, 0x39);
  });

  it("Instructions 0x40-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("ld b,xh", 0xdd, 0x44);
    await Z80Tester.Test("ld b,xl", 0xdd, 0x45);
    await Z80Tester.Test("ld b,(ix+#3D)", 0xdd, 0x46, 0x3d);
    await Z80Tester.Test("ld b,(ix-#51)", 0xdd, 0x46, 0xaf);
    await Z80Tester.Test("ld c,xh", 0xdd, 0x4c);
    await Z80Tester.Test("ld c,xl", 0xdd, 0x4d);
    await Z80Tester.Test("ld c,(ix+#3D)", 0xdd, 0x4e, 0x3d);
    await Z80Tester.Test("ld c,(ix-#51)", 0xdd, 0x4e, 0xaf);
    await Z80Tester.Test("ld d,xh", 0xdd, 0x54);
    await Z80Tester.Test("ld d,xl", 0xdd, 0x55);
    await Z80Tester.Test("ld d,(ix+#3D)", 0xdd, 0x56, 0x3d);
    await Z80Tester.Test("ld d,(ix-#51)", 0xdd, 0x56, 0xaf);
    await Z80Tester.Test("ld e,xh", 0xdd, 0x5c);
    await Z80Tester.Test("ld e,xl", 0xdd, 0x5d);
    await Z80Tester.Test("ld e,(ix+#3D)", 0xdd, 0x5e, 0x3d);
    await Z80Tester.Test("ld e,(ix-#51)", 0xdd, 0x5e, 0xaf);
    await Z80Tester.Test("ld xh,b", 0xdd, 0x60);
    await Z80Tester.Test("ld xh,c", 0xdd, 0x61);
    await Z80Tester.Test("ld xh,d", 0xdd, 0x62);
    await Z80Tester.Test("ld xh,e", 0xdd, 0x63);
    await Z80Tester.Test("ld xh,xh", 0xdd, 0x64);
    await Z80Tester.Test("ld xh,xl", 0xdd, 0x65);
    await Z80Tester.Test("ld h,(ix+#3D)", 0xdd, 0x66, 0x3d);
    await Z80Tester.Test("ld xh,a", 0xdd, 0x67);
    await Z80Tester.Test("ld xl,b", 0xdd, 0x68);
    await Z80Tester.Test("ld xl,c", 0xdd, 0x69);
    await Z80Tester.Test("ld xl,d", 0xdd, 0x6a);
    await Z80Tester.Test("ld xl,e", 0xdd, 0x6b);
    await Z80Tester.Test("ld xl,xh", 0xdd, 0x6c);
    await Z80Tester.Test("ld xl,xl", 0xdd, 0x6d);
    await Z80Tester.Test("ld l,(ix+#3D)", 0xdd, 0x6e, 0x3d);
    await Z80Tester.Test("ld xl,a", 0xdd, 0x6f);
    await Z80Tester.Test("ld (ix+#3D),b", 0xdd, 0x70, 0x3d);
    await Z80Tester.Test("ld (ix+#3D),c", 0xdd, 0x71, 0x3d);
    await Z80Tester.Test("ld (ix+#3D),d", 0xdd, 0x72, 0x3d);
    await Z80Tester.Test("ld (ix+#3D),e", 0xdd, 0x73, 0x3d);
    await Z80Tester.Test("ld (ix+#3D),h", 0xdd, 0x74, 0x3d);
    await Z80Tester.Test("ld (ix+#3D),l", 0xdd, 0x75, 0x3d);
    await Z80Tester.Test("halt", 0xdd, 0x76);
    await Z80Tester.Test("ld (ix+#3D),a", 0xdd, 0x77, 0x3d);
    await Z80Tester.Test("ld a,xh", 0xdd, 0x7c);
    await Z80Tester.Test("ld a,xl", 0xdd, 0x7d);
    await Z80Tester.Test("ld a,(ix+#3D)", 0xdd, 0x7e, 0x3d);
  });

  it("Instructions 0x80-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.Test("add a,xh", 0xdd, 0x84);
    await Z80Tester.Test("add a,xl", 0xdd, 0x85);
    await Z80Tester.Test("add a,(ix+#3D)", 0xdd, 0x86, 0x3d);
    await Z80Tester.Test("adc a,xh", 0xdd, 0x8c);
    await Z80Tester.Test("adc a,xl", 0xdd, 0x8d);
    await Z80Tester.Test("adc a,(ix+#3D)", 0xdd, 0x8e, 0x3d);
    await Z80Tester.Test("sub xh", 0xdd, 0x94);
    await Z80Tester.Test("sub xl", 0xdd, 0x95);
    await Z80Tester.Test("sub (ix+#3D)", 0xdd, 0x96, 0x3d);
    await Z80Tester.Test("sbc a,xh", 0xdd, 0x9c);
    await Z80Tester.Test("sbc a,xl", 0xdd, 0x9d);
    await Z80Tester.Test("sbc a,(ix+#3D)", 0xdd, 0x9e, 0x3d);
    await Z80Tester.Test("and xh", 0xdd, 0xa4);
    await Z80Tester.Test("and xl", 0xdd, 0xa5);
    await Z80Tester.Test("and (ix+#3D)", 0xdd, 0xa6, 0x3d);
    await Z80Tester.Test("xor xh", 0xdd, 0xac);
    await Z80Tester.Test("xor xl", 0xdd, 0xad);
    await Z80Tester.Test("xor (ix+#3D)", 0xdd, 0xae, 0x3d);
    await Z80Tester.Test("or xh", 0xdd, 0xb4);
    await Z80Tester.Test("or xl", 0xdd, 0xb5);
    await Z80Tester.Test("or (ix+#3D)", 0xdd, 0xb6, 0x3d);
    await Z80Tester.Test("cp xh", 0xdd, 0xbc);
    await Z80Tester.Test("cp xl", 0xdd, 0xbd);
    await Z80Tester.Test("cp (ix+#3D)", 0xdd, 0xbe, 0x3d);
    await Z80Tester.Test("pop ix", 0xdd, 0xe1);
    await Z80Tester.Test("ex (sp),ix", 0xdd, 0xe3);
    await Z80Tester.Test("push ix", 0xdd, 0xe5);
    await Z80Tester.Test("jp (ix)", 0xdd, 0xe9);
    await Z80Tester.Test("ld sp,ix", 0xdd, 0xf9);
  });
});
