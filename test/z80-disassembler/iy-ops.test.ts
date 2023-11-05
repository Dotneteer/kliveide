import { Z80Tester } from "./z80-tester";

describe("Disassembler - IY instructions", function () {
  this.timeout(10000);

  it("Instructions 0x00-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("add iy,bc", 0xfd, 0x09);
    await Z80Tester.Test("add iy,de", 0xfd, 0x19);
    await Z80Tester.Test("ld iy,$1234", 0xfd, 0x21, 0x34, 0x12);
    await Z80Tester.Test("ld ($1234),iy", 0xfd, 0x22, 0x34, 0x12);
    await Z80Tester.Test("inc iy", 0xfd, 0x23);
    await Z80Tester.Test("inc yh", 0xfd, 0x24);
    await Z80Tester.Test("dec yh", 0xfd, 0x25);
    await Z80Tester.Test("ld yh,$AB", 0xfd, 0x26, 0xab);
    await Z80Tester.Test("add iy,iy", 0xfd, 0x29);
    await Z80Tester.Test("ld iy,($1234)", 0xfd, 0x2a, 0x34, 0x12);
    await Z80Tester.Test("dec iy", 0xfd, 0x2b);
    await Z80Tester.Test("inc yl", 0xfd, 0x2c);
    await Z80Tester.Test("dec yl", 0xfd, 0x2d);
    await Z80Tester.Test("ld yl,$AB", 0xfd, 0x2e, 0xab);
    await Z80Tester.Test("inc (iy+$3D)", 0xfd, 0x34, 0x3d);
    await Z80Tester.Test("inc (iy-$51)", 0xfd, 0x34, 0xaf);
    await Z80Tester.Test("dec (iy+$3D)", 0xfd, 0x35, 0x3d);
    await Z80Tester.Test("dec (iy-$51)", 0xfd, 0x35, 0xaf);
    await Z80Tester.Test("ld (iy+$3D),$12", 0xfd, 0x36, 0x3d, 0x12);
    await Z80Tester.Test("ld (iy-$51),$12", 0xfd, 0x36, 0xaf, 0x12);
    await Z80Tester.Test("add iy,sp", 0xfd, 0x39);
  });

  it("Instructions 0x40-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("ld b,yh", 0xfd, 0x44);
    await Z80Tester.Test("ld b,yl", 0xfd, 0x45);
    await Z80Tester.Test("ld b,(iy+$3D)", 0xfd, 0x46, 0x3d);
    await Z80Tester.Test("ld b,(iy-$51)", 0xfd, 0x46, 0xaf);
    await Z80Tester.Test("ld c,yh", 0xfd, 0x4c);
    await Z80Tester.Test("ld c,yl", 0xfd, 0x4d);
    await Z80Tester.Test("ld c,(iy+$3D)", 0xfd, 0x4e, 0x3d);
    await Z80Tester.Test("ld c,(iy-$51)", 0xfd, 0x4e, 0xaf);
    await Z80Tester.Test("ld d,yh", 0xfd, 0x54);
    await Z80Tester.Test("ld d,yl", 0xfd, 0x55);
    await Z80Tester.Test("ld d,(iy+$3D)", 0xfd, 0x56, 0x3d);
    await Z80Tester.Test("ld d,(iy-$51)", 0xfd, 0x56, 0xaf);
    await Z80Tester.Test("ld e,yh", 0xfd, 0x5c);
    await Z80Tester.Test("ld e,yl", 0xfd, 0x5d);
    await Z80Tester.Test("ld e,(iy+$3D)", 0xfd, 0x5e, 0x3d);
    await Z80Tester.Test("ld e,(iy-$51)", 0xfd, 0x5e, 0xaf);
    await Z80Tester.Test("ld yh,b", 0xfd, 0x60);
    await Z80Tester.Test("ld yh,c", 0xfd, 0x61);
    await Z80Tester.Test("ld yh,d", 0xfd, 0x62);
    await Z80Tester.Test("ld yh,e", 0xfd, 0x63);
    await Z80Tester.Test("ld yh,yh", 0xfd, 0x64);
    await Z80Tester.Test("ld yh,yl", 0xfd, 0x65);
    await Z80Tester.Test("ld h,(iy+$3D)", 0xfd, 0x66, 0x3d);
    await Z80Tester.Test("ld yh,a", 0xfd, 0x67);
    await Z80Tester.Test("ld yl,b", 0xfd, 0x68);
    await Z80Tester.Test("ld yl,c", 0xfd, 0x69);
    await Z80Tester.Test("ld yl,d", 0xfd, 0x6a);
    await Z80Tester.Test("ld yl,e", 0xfd, 0x6b);
    await Z80Tester.Test("ld yl,yh", 0xfd, 0x6c);
    await Z80Tester.Test("ld yl,yl", 0xfd, 0x6d);
    await Z80Tester.Test("ld l,(iy+$3D)", 0xfd, 0x6e, 0x3d);
    await Z80Tester.Test("ld yl,a", 0xfd, 0x6f);
    await Z80Tester.Test("ld (iy+$3D),b", 0xfd, 0x70, 0x3d);
    await Z80Tester.Test("ld (iy+$3D),c", 0xfd, 0x71, 0x3d);
    await Z80Tester.Test("ld (iy+$3D),d", 0xfd, 0x72, 0x3d);
    await Z80Tester.Test("ld (iy+$3D),e", 0xfd, 0x73, 0x3d);
    await Z80Tester.Test("ld (iy+$3D),h", 0xfd, 0x74, 0x3d);
    await Z80Tester.Test("ld (iy+$3D),l", 0xfd, 0x75, 0x3d);
    await Z80Tester.Test("halt", 0xfd, 0x76);
    await Z80Tester.Test("ld (iy+$3D),a", 0xfd, 0x77, 0x3d);
    await Z80Tester.Test("ld a,yh", 0xfd, 0x7c);
    await Z80Tester.Test("ld a,yl", 0xfd, 0x7d);
    await Z80Tester.Test("ld a,(iy+$3D)", 0xfd, 0x7e, 0x3d);
  });

  it("Instructions 0x80-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.Test("add a,yh", 0xfd, 0x84);
    await Z80Tester.Test("add a,yl", 0xfd, 0x85);
    await Z80Tester.Test("add a,(iy+$3D)", 0xfd, 0x86, 0x3d);
    await Z80Tester.Test("adc a,yh", 0xfd, 0x8c);
    await Z80Tester.Test("adc a,yl", 0xfd, 0x8d);
    await Z80Tester.Test("adc a,(iy+$3D)", 0xfd, 0x8e, 0x3d);
    await Z80Tester.Test("sub yh", 0xfd, 0x94);
    await Z80Tester.Test("sub yl", 0xfd, 0x95);
    await Z80Tester.Test("sub (iy+$3D)", 0xfd, 0x96, 0x3d);
    await Z80Tester.Test("sbc a,yh", 0xfd, 0x9c);
    await Z80Tester.Test("sbc a,yl", 0xfd, 0x9d);
    await Z80Tester.Test("sbc a,(iy+$3D)", 0xfd, 0x9e, 0x3d);
    await Z80Tester.Test("and yh", 0xfd, 0xa4);
    await Z80Tester.Test("and yl", 0xfd, 0xa5);
    await Z80Tester.Test("and (iy+$3D)", 0xfd, 0xa6, 0x3d);
    await Z80Tester.Test("xor yh", 0xfd, 0xac);
    await Z80Tester.Test("xor yl", 0xfd, 0xad);
    await Z80Tester.Test("xor (iy+$3D)", 0xfd, 0xae, 0x3d);
    await Z80Tester.Test("or yh", 0xfd, 0xb4);
    await Z80Tester.Test("or yl", 0xfd, 0xb5);
    await Z80Tester.Test("or (iy+$3D)", 0xfd, 0xb6, 0x3d);
    await Z80Tester.Test("cp yh", 0xfd, 0xbc);
    await Z80Tester.Test("cp yl", 0xfd, 0xbd);
    await Z80Tester.Test("cp (iy+$3D)", 0xfd, 0xbe, 0x3d);
    await Z80Tester.Test("pop iy", 0xfd, 0xe1);
    await Z80Tester.Test("ex (sp),iy", 0xfd, 0xe3);
    await Z80Tester.Test("push iy", 0xfd, 0xe5);
    await Z80Tester.Test("jp (iy)", 0xfd, 0xe9);
    await Z80Tester.Test("ld sp,iy", 0xfd, 0xf9);
  });
});
