import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";

describe("Disassembler - IY instructions", function () {
  it("Instructions 0x00-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("add iy,bc", 15, 0xfd, 0x09);
    await Z80Tester.TestWithTStates("add iy,de", 15, 0xfd, 0x19);
    await Z80Tester.TestWithTStates("ld iy,$1234", 14, 0xfd, 0x21, 0x34, 0x12);
    await Z80Tester.TestWithTStates("ld ($1234),iy", 20, 0xfd, 0x22, 0x34, 0x12);
    await Z80Tester.TestWithTStates("inc iy", 10, 0xfd, 0x23);
    await Z80Tester.TestWithTStates("inc yh", 8, 0xfd, 0x24);
    await Z80Tester.TestWithTStates("dec yh", 8, 0xfd, 0x25);
    await Z80Tester.TestWithTStates("ld yh,$AB", 11, 0xfd, 0x26, 0xab);
    await Z80Tester.TestWithTStates("add iy,iy", 15, 0xfd, 0x29);
    await Z80Tester.TestWithTStates("ld iy,($1234)", 20, 0xfd, 0x2a, 0x34, 0x12);
    await Z80Tester.TestWithTStates("dec iy", 10, 0xfd, 0x2b);
    await Z80Tester.TestWithTStates("inc yl", 8, 0xfd, 0x2c);
    await Z80Tester.TestWithTStates("dec yl", 8, 0xfd, 0x2d);
    await Z80Tester.TestWithTStates("ld yl,$AB", 11, 0xfd, 0x2e, 0xab);
    await Z80Tester.TestWithTStates("inc (iy+$3D)", 23, 0xfd, 0x34, 0x3d);
    await Z80Tester.TestWithTStates("inc (iy-$51)", 23, 0xfd, 0x34, 0xaf);
    await Z80Tester.TestWithTStates("dec (iy+$3D)", 23, 0xfd, 0x35, 0x3d);
    await Z80Tester.TestWithTStates("dec (iy-$51)", 23, 0xfd, 0x35, 0xaf);
    await Z80Tester.TestWithTStates("ld (iy+$3D),$12", 19, 0xfd, 0x36, 0x3d, 0x12);
    await Z80Tester.TestWithTStates("ld (iy-$51),$12", 19, 0xfd, 0x36, 0xaf, 0x12);
    await Z80Tester.TestWithTStates("add iy,sp", 15, 0xfd, 0x39);
  });

  it("Instructions 0x40-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ld b,yh", 8, 0xfd, 0x44);
    await Z80Tester.TestWithTStates("ld b,yl", 8, 0xfd, 0x45);
    await Z80Tester.TestWithTStates("ld b,(iy+$3D)", 19, 0xfd, 0x46, 0x3d);
    await Z80Tester.TestWithTStates("ld b,(iy-$51)", 19, 0xfd, 0x46, 0xaf);
    await Z80Tester.TestWithTStates("ld c,yh", 8, 0xfd, 0x4c);
    await Z80Tester.TestWithTStates("ld c,yl", 8, 0xfd, 0x4d);
    await Z80Tester.TestWithTStates("ld c,(iy+$3D)", 19, 0xfd, 0x4e, 0x3d);
    await Z80Tester.TestWithTStates("ld c,(iy-$51)", 19, 0xfd, 0x4e, 0xaf);
    await Z80Tester.TestWithTStates("ld d,yh", 8, 0xfd, 0x54);
    await Z80Tester.TestWithTStates("ld d,yl", 8, 0xfd, 0x55);
    await Z80Tester.TestWithTStates("ld d,(iy+$3D)", 19, 0xfd, 0x56, 0x3d);
    await Z80Tester.TestWithTStates("ld d,(iy-$51)", 19, 0xfd, 0x56, 0xaf);
    await Z80Tester.TestWithTStates("ld e,yh", 8, 0xfd, 0x5c);
    await Z80Tester.TestWithTStates("ld e,yl", 8, 0xfd, 0x5d);
    await Z80Tester.TestWithTStates("ld e,(iy+$3D)", 19, 0xfd, 0x5e, 0x3d);
    await Z80Tester.TestWithTStates("ld e,(iy-$51)", 19, 0xfd, 0x5e, 0xaf);
    await Z80Tester.TestWithTStates("ld yh,b", 8, 0xfd, 0x60);
    await Z80Tester.TestWithTStates("ld yh,c", 8, 0xfd, 0x61);
    await Z80Tester.TestWithTStates("ld yh,d", 8, 0xfd, 0x62);
    await Z80Tester.TestWithTStates("ld yh,e", 8, 0xfd, 0x63);
    await Z80Tester.TestWithTStates("ld yh,yh", 8, 0xfd, 0x64);
    await Z80Tester.TestWithTStates("ld yh,yl", 8, 0xfd, 0x65);
    await Z80Tester.TestWithTStates("ld h,(iy+$3D)", 19, 0xfd, 0x66, 0x3d);
    await Z80Tester.TestWithTStates("ld yh,a", 8, 0xfd, 0x67);
    await Z80Tester.TestWithTStates("ld yl,b", 8, 0xfd, 0x68);
    await Z80Tester.TestWithTStates("ld yl,c", 8, 0xfd, 0x69);
    await Z80Tester.TestWithTStates("ld yl,d", 8, 0xfd, 0x6a);
    await Z80Tester.TestWithTStates("ld yl,e", 8, 0xfd, 0x6b);
    await Z80Tester.TestWithTStates("ld yl,yh", 8, 0xfd, 0x6c);
    await Z80Tester.TestWithTStates("ld yl,yl", 8, 0xfd, 0x6d);
    await Z80Tester.TestWithTStates("ld l,(iy+$3D)", 19, 0xfd, 0x6e, 0x3d);
    await Z80Tester.TestWithTStates("ld yl,a", 8, 0xfd, 0x6f);
    await Z80Tester.TestWithTStates("ld (iy+$3D),b", 19, 0xfd, 0x70, 0x3d);
    await Z80Tester.TestWithTStates("ld (iy+$3D),c", 19, 0xfd, 0x71, 0x3d);
    await Z80Tester.TestWithTStates("ld (iy+$3D),d", 19, 0xfd, 0x72, 0x3d);
    await Z80Tester.TestWithTStates("ld (iy+$3D),e", 19, 0xfd, 0x73, 0x3d);
    await Z80Tester.TestWithTStates("ld (iy+$3D),h", 19, 0xfd, 0x74, 0x3d);
    await Z80Tester.TestWithTStates("ld (iy+$3D),l", 19, 0xfd, 0x75, 0x3d);
    await Z80Tester.TestWithTStates("halt", 8, 0xfd, 0x76);
    await Z80Tester.TestWithTStates("ld (iy+$3D),a", 19, 0xfd, 0x77, 0x3d);
    await Z80Tester.TestWithTStates("ld a,yh", 8, 0xfd, 0x7c);
    await Z80Tester.TestWithTStates("ld a,yl", 8, 0xfd, 0x7d);
    await Z80Tester.TestWithTStates("ld a,(iy+$3D)", 19, 0xfd, 0x7e, 0x3d);
  });

  it("Instructions 0x80-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("add a,yh", 8, 0xfd, 0x84);
    await Z80Tester.TestWithTStates("add a,yl", 8, 0xfd, 0x85);
    await Z80Tester.TestWithTStates("add a,(iy+$3D)", 19, 0xfd, 0x86, 0x3d);
    await Z80Tester.TestWithTStates("adc a,yh", 8, 0xfd, 0x8c);
    await Z80Tester.TestWithTStates("adc a,yl", 8, 0xfd, 0x8d);
    await Z80Tester.TestWithTStates("adc a,(iy+$3D)", 19, 0xfd, 0x8e, 0x3d);
    await Z80Tester.TestWithTStates("sub yh", 8, 0xfd, 0x94);
    await Z80Tester.TestWithTStates("sub yl", 8, 0xfd, 0x95);
    await Z80Tester.TestWithTStates("sub (iy+$3D)", 19, 0xfd, 0x96, 0x3d);
    await Z80Tester.TestWithTStates("sbc a,yh", 8, 0xfd, 0x9c);
    await Z80Tester.TestWithTStates("sbc a,yl", 8, 0xfd, 0x9d);
    await Z80Tester.TestWithTStates("sbc a,(iy+$3D)", 19, 0xfd, 0x9e, 0x3d);
    await Z80Tester.TestWithTStates("and yh", 8, 0xfd, 0xa4);
    await Z80Tester.TestWithTStates("and yl", 8, 0xfd, 0xa5);
    await Z80Tester.TestWithTStates("and (iy+$3D)", 19, 0xfd, 0xa6, 0x3d);
    await Z80Tester.TestWithTStates("xor yh", 8, 0xfd, 0xac);
    await Z80Tester.TestWithTStates("xor yl", 8, 0xfd, 0xad);
    await Z80Tester.TestWithTStates("xor (iy+$3D)", 19, 0xfd, 0xae, 0x3d);
    await Z80Tester.TestWithTStates("or yh", 8, 0xfd, 0xb4);
    await Z80Tester.TestWithTStates("or yl", 8, 0xfd, 0xb5);
    await Z80Tester.TestWithTStates("or (iy+$3D)", 19, 0xfd, 0xb6, 0x3d);
    await Z80Tester.TestWithTStates("cp yh", 8, 0xfd, 0xbc);
    await Z80Tester.TestWithTStates("cp yl", 8, 0xfd, 0xbd);
    await Z80Tester.TestWithTStates("cp (iy+$3D)", 19, 0xfd, 0xbe, 0x3d);
    await Z80Tester.TestWithTStates("pop iy", 14, 0xfd, 0xe1);
    await Z80Tester.TestWithTStates("ex (sp),iy", 23, 0xfd, 0xe3);
    await Z80Tester.TestWithTStates("push iy", 15, 0xfd, 0xe5);
    await Z80Tester.TestWithTStates("jp (iy)", 8, 0xfd, 0xe9);
    await Z80Tester.TestWithTStates("ld sp,iy", 10, 0xfd, 0xf9);
  });
});
