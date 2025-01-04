import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";

describe("Disassembler - IX-related instructions", function () {
  it("Instructions 0x00-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("add ix,bc", 15, 0xdd, 0x09);
    await Z80Tester.TestWithTStates("add ix,de", 15, 0xdd, 0x19);
    await Z80Tester.TestWithTStates("ld ix,$1234", 14, 0xdd, 0x21, 0x34, 0x12);
    await Z80Tester.TestWithTStates("ld ($1234),ix", 20, 0xdd, 0x22, 0x34, 0x12);
    await Z80Tester.TestWithTStates("inc ix", 10, 0xdd, 0x23);
    await Z80Tester.TestWithTStates("inc xh", 8, 0xdd, 0x24);
    await Z80Tester.TestWithTStates("dec xh", 8, 0xdd, 0x25);
    await Z80Tester.TestWithTStates("ld xh,$AB", 11, 0xdd, 0x26, 0xab);
    await Z80Tester.TestWithTStates("add ix,ix", 15, 0xdd, 0x29);
    await Z80Tester.TestWithTStates("ld ix,($1234)", 20, 0xdd, 0x2a, 0x34, 0x12);
    await Z80Tester.TestWithTStates("dec ix", 10, 0xdd, 0x2b);
    await Z80Tester.TestWithTStates("inc xl", 8, 0xdd, 0x2c);
    await Z80Tester.TestWithTStates("dec xl", 8, 0xdd, 0x2d);
    await Z80Tester.TestWithTStates("ld xl,$AB", 11, 0xdd, 0x2e, 0xab);
    await Z80Tester.TestWithTStates("inc (ix+$3D)", 23, 0xdd, 0x34, 0x3d);
    await Z80Tester.TestWithTStates("inc (ix-$51)", 23, 0xdd, 0x34, 0xaf);
    await Z80Tester.TestWithTStates("dec (ix+$3D)", 23, 0xdd, 0x35, 0x3d);
    await Z80Tester.TestWithTStates("dec (ix-$51)", 23, 0xdd, 0x35, 0xaf);
    await Z80Tester.TestWithTStates("ld (ix+$3D),$12", 19, 0xdd, 0x36, 0x3d, 0x12);
    await Z80Tester.TestWithTStates("ld (ix-$51),$12", 19, 0xdd, 0x36, 0xaf, 0x12);
    await Z80Tester.TestWithTStates("add ix,sp", 15, 0xdd, 0x39);
  });

  it("Instructions 0x40-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ld b,xh", 8, 0xdd, 0x44);
    await Z80Tester.TestWithTStates("ld b,xl", 8, 0xdd, 0x45);
    await Z80Tester.TestWithTStates("ld b,(ix+$3D)", 19, 0xdd, 0x46, 0x3d);
    await Z80Tester.TestWithTStates("ld b,(ix-$51)", 19, 0xdd, 0x46, 0xaf);
    await Z80Tester.TestWithTStates("ld c,xh", 8, 0xdd, 0x4c);
    await Z80Tester.TestWithTStates("ld c,xl", 8, 0xdd, 0x4d);
    await Z80Tester.TestWithTStates("ld c,(ix+$3D)", 19, 0xdd, 0x4e, 0x3d);
    await Z80Tester.TestWithTStates("ld c,(ix-$51)", 19, 0xdd, 0x4e, 0xaf);
    await Z80Tester.TestWithTStates("ld d,xh", 8, 0xdd, 0x54);
    await Z80Tester.TestWithTStates("ld d,xl", 8, 0xdd, 0x55);
    await Z80Tester.TestWithTStates("ld d,(ix+$3D)", 19, 0xdd, 0x56, 0x3d);
    await Z80Tester.TestWithTStates("ld d,(ix-$51)", 19, 0xdd, 0x56, 0xaf);
    await Z80Tester.TestWithTStates("ld e,xh", 8, 0xdd, 0x5c);
    await Z80Tester.TestWithTStates("ld e,xl", 8, 0xdd, 0x5d);
    await Z80Tester.TestWithTStates("ld e,(ix+$3D)", 19, 0xdd, 0x5e, 0x3d);
    await Z80Tester.TestWithTStates("ld e,(ix-$51)", 19, 0xdd, 0x5e, 0xaf);
    await Z80Tester.TestWithTStates("ld xh,b", 8, 0xdd, 0x60);
    await Z80Tester.TestWithTStates("ld xh,c", 8, 0xdd, 0x61);
    await Z80Tester.TestWithTStates("ld xh,d", 8, 0xdd, 0x62);
    await Z80Tester.TestWithTStates("ld xh,e", 8, 0xdd, 0x63);
    await Z80Tester.TestWithTStates("ld xh,xh", 8, 0xdd, 0x64);
    await Z80Tester.TestWithTStates("ld xh,xl", 8, 0xdd, 0x65);
    await Z80Tester.TestWithTStates("ld h,(ix+$3D)", 19, 0xdd, 0x66, 0x3d);
    await Z80Tester.TestWithTStates("ld xh,a", 8, 0xdd, 0x67);
    await Z80Tester.TestWithTStates("ld xl,b", 8, 0xdd, 0x68);
    await Z80Tester.TestWithTStates("ld xl,c", 8, 0xdd, 0x69);
    await Z80Tester.TestWithTStates("ld xl,d", 8, 0xdd, 0x6a);
    await Z80Tester.TestWithTStates("ld xl,e", 8, 0xdd, 0x6b);
    await Z80Tester.TestWithTStates("ld xl,xh", 8, 0xdd, 0x6c);
    await Z80Tester.TestWithTStates("ld xl,xl", 8, 0xdd, 0x6d);
    await Z80Tester.TestWithTStates("ld l,(ix+$3D)", 19, 0xdd, 0x6e, 0x3d);
    await Z80Tester.TestWithTStates("ld xl,a", 8, 0xdd, 0x6f);
    await Z80Tester.TestWithTStates("ld (ix+$3D),b", 19, 0xdd, 0x70, 0x3d);
    await Z80Tester.TestWithTStates("ld (ix+$3D),c", 19, 0xdd, 0x71, 0x3d);
    await Z80Tester.TestWithTStates("ld (ix+$3D),d", 19, 0xdd, 0x72, 0x3d);
    await Z80Tester.TestWithTStates("ld (ix+$3D),e", 19, 0xdd, 0x73, 0x3d);
    await Z80Tester.TestWithTStates("ld (ix+$3D),h", 19, 0xdd, 0x74, 0x3d);
    await Z80Tester.TestWithTStates("ld (ix+$3D),l", 19, 0xdd, 0x75, 0x3d);
    await Z80Tester.TestWithTStates("halt", 8, 0xdd, 0x76);
    await Z80Tester.TestWithTStates("ld (ix+$3D),a", 19, 0xdd, 0x77, 0x3d);
    await Z80Tester.TestWithTStates("ld a,xh", 8, 0xdd, 0x7c);
    await Z80Tester.TestWithTStates("ld a,xl", 8, 0xdd, 0x7d);
    await Z80Tester.TestWithTStates("ld a,(ix+$3D)", 19, 0xdd, 0x7e, 0x3d);
  });

  it("Instructions 0x80-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("add a,xh", 8, 0xdd, 0x84);
    await Z80Tester.TestWithTStates("add a,xl", 8, 0xdd, 0x85);
    await Z80Tester.TestWithTStates("add a,(ix+$3D)", 19, 0xdd, 0x86, 0x3d);
    await Z80Tester.TestWithTStates("adc a,xh", 8, 0xdd, 0x8c);
    await Z80Tester.TestWithTStates("adc a,xl", 8, 0xdd, 0x8d);
    await Z80Tester.TestWithTStates("adc a,(ix+$3D)", 19, 0xdd, 0x8e, 0x3d);
    await Z80Tester.TestWithTStates("sub xh", 8, 0xdd, 0x94);
    await Z80Tester.TestWithTStates("sub xl", 8, 0xdd, 0x95);
    await Z80Tester.TestWithTStates("sub (ix+$3D)", 19, 0xdd, 0x96, 0x3d);
    await Z80Tester.TestWithTStates("sbc a,xh", 8, 0xdd, 0x9c);
    await Z80Tester.TestWithTStates("sbc a,xl", 8, 0xdd, 0x9d);
    await Z80Tester.TestWithTStates("sbc a,(ix+$3D)", 19, 0xdd, 0x9e, 0x3d);
    await Z80Tester.TestWithTStates("and xh", 8, 0xdd, 0xa4);
    await Z80Tester.TestWithTStates("and xl", 8, 0xdd, 0xa5);
    await Z80Tester.TestWithTStates("and (ix+$3D)", 19, 0xdd, 0xa6, 0x3d);
    await Z80Tester.TestWithTStates("xor xh", 8, 0xdd, 0xac);
    await Z80Tester.TestWithTStates("xor xl", 8, 0xdd, 0xad);
    await Z80Tester.TestWithTStates("xor (ix+$3D)", 19, 0xdd, 0xae, 0x3d);
    await Z80Tester.TestWithTStates("or xh", 8, 0xdd, 0xb4);
    await Z80Tester.TestWithTStates("or xl", 8, 0xdd, 0xb5);
    await Z80Tester.TestWithTStates("or (ix+$3D)", 19, 0xdd, 0xb6, 0x3d);
    await Z80Tester.TestWithTStates("cp xh", 8, 0xdd, 0xbc);
    await Z80Tester.TestWithTStates("cp xl", 8, 0xdd, 0xbd);
    await Z80Tester.TestWithTStates("cp (ix+$3D)", 19, 0xdd, 0xbe, 0x3d);
    await Z80Tester.TestWithTStates("pop ix", 14, 0xdd, 0xe1);
    await Z80Tester.TestWithTStates("ex (sp),ix", 23, 0xdd, 0xe3);
    await Z80Tester.TestWithTStates("push ix", 15, 0xdd, 0xe5);
    await Z80Tester.TestWithTStates("jp (ix)", 8, 0xdd, 0xe9);
    await Z80Tester.TestWithTStates("ld sp,ix", 10, 0xdd, 0xf9);
  });
});
