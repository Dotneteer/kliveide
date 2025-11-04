import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";

describe("Disassembler - standard instructions", function () {
  it("Standard instructions 0x00-0x0F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("nop", 4, 0x00);
    await Z80Tester.TestWithTStates("ld bc,$1234", 10, 0x01, 0x34, 0x12);
    await Z80Tester.TestWithTStates("ld (bc),a", 7, 0x02);
    await Z80Tester.TestWithTStates("inc bc", 6, 0x03);
    await Z80Tester.TestWithTStates("inc b", 4, 0x04);
    await Z80Tester.TestWithTStates("dec b", 4, 0x05);
    await Z80Tester.TestWithTStates("ld b,$23", 7, 0x06, 0x23);
    await Z80Tester.TestWithTStates("rlca", 4, 0x07);
    await Z80Tester.TestWithTStates("ex af,af'", 4, 0x08);
    await Z80Tester.TestWithTStates("add hl,bc", 11, 0x09);
    await Z80Tester.TestWithTStates("ld a,(bc)", 7, 0x0a);
    await Z80Tester.TestWithTStates("dec bc", 6, 0x0b);
    await Z80Tester.TestWithTStates("inc c", 4, 0x0c);
    await Z80Tester.TestWithTStates("dec c", 4, 0x0d);
    await Z80Tester.TestWithTStates("ld c,$23", 7, 0x0e, 0x23);
    await Z80Tester.TestWithTStates("rrca", 4, 0x0f);
  });

  it("Standard instructions 0x10-0x1F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("djnz L0002", [13, 8], 0x10, 0x00);
    await Z80Tester.Test("djnz L0022", 0x10, 0x20);
    await Z80Tester.Test("djnz LFFF2", 0x10, 0xf0);
    await Z80Tester.TestWithTStates("ld de,$1234", 10, 0x11, 0x34, 0x12);
    await Z80Tester.TestWithTStates("ld (de),a", 7, 0x12);
    await Z80Tester.TestWithTStates("inc de", 6, 0x13);
    await Z80Tester.TestWithTStates("inc d", 4, 0x14);
    await Z80Tester.TestWithTStates("dec d", 4, 0x15);
    await Z80Tester.TestWithTStates("ld d,$23", 7, 0x16, 0x23);
    await Z80Tester.TestWithTStates("rla", 4, 0x17);
    await Z80Tester.TestWithTStates("jr L0002", 12, 0x18, 0x00);
    await Z80Tester.Test("jr L0022", 0x18, 0x20);
    await Z80Tester.Test("jr LFFF2", 0x18, 0xf0);
    await Z80Tester.TestWithTStates("add hl,de", 11, 0x19);
    await Z80Tester.TestWithTStates("ld a,(de)", 7, 0x1a);
    await Z80Tester.TestWithTStates("dec de", 6, 0x1b);
    await Z80Tester.TestWithTStates("inc e", 4, 0x1c);
    await Z80Tester.TestWithTStates("dec e", 4, 0x1d);
    await Z80Tester.TestWithTStates("ld e,$23", 7, 0x1e, 0x23);
    await Z80Tester.TestWithTStates("rra", 4, 0x1f);
  });

  it("Standard instructions 0x20-0x2F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("jr nz,L0002", [12, 7], 0x20, 0x00);
    await Z80Tester.Test("jr nz,L0022", 0x20, 0x20);
    await Z80Tester.Test("jr nz,LFFF2", 0x20, 0xf0);
    await Z80Tester.TestWithTStates("ld hl,$1234", 10, 0x21, 0x34, 0x12);
    await Z80Tester.TestWithTStates("ld ($3456),hl", 16, 0x22, 0x56, 0x34);
    await Z80Tester.TestWithTStates("inc hl", 6, 0x23);
    await Z80Tester.TestWithTStates("inc h", 4, 0x24);
    await Z80Tester.TestWithTStates("dec h", 4, 0x25);
    await Z80Tester.TestWithTStates("ld h,$23", 7, 0x26, 0x23);
    await Z80Tester.TestWithTStates("daa", 4, 0x27);
    await Z80Tester.TestWithTStates("jr z,L0002", [12, 7], 0x28, 0x00);
    await Z80Tester.Test("jr z,L0022", 0x28, 0x20);
    await Z80Tester.Test("jr z,LFFF2", 0x28, 0xf0);
    await Z80Tester.TestWithTStates("add hl,hl", 11, 0x29);
    await Z80Tester.TestWithTStates("ld hl,($3456)", 16, 0x2a, 0x56, 0x34);
    await Z80Tester.TestWithTStates("dec hl", 6, 0x2b);
    await Z80Tester.TestWithTStates("inc l", 4, 0x2c);
    await Z80Tester.TestWithTStates("dec l", 4, 0x2d);
    await Z80Tester.TestWithTStates("ld l,$23", 7, 0x2e, 0x23);
    await Z80Tester.TestWithTStates("cpl", 4, 0x2f);
  });

  it("Standard instructions 0x30-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("jr nc,L0002", [12, 7], 0x30, 0x00);
    await Z80Tester.Test("jr nc,L0022", 0x30, 0x20);
    await Z80Tester.Test("jr nc,LFFF2", 0x30, 0xf0);
    await Z80Tester.TestWithTStates("ld sp,$1234", 10, 0x31, 0x34, 0x12);
    await Z80Tester.TestWithTStates("ld ($3456),a", 13, 0x32, 0x56, 0x34);
    await Z80Tester.TestWithTStates("inc sp", 6, 0x33);
    await Z80Tester.TestWithTStates("inc (hl)", 11, 0x34);
    await Z80Tester.TestWithTStates("dec (hl)", 11, 0x35);
    await Z80Tester.TestWithTStates("ld (hl),$23", 10, 0x36, 0x23);
    await Z80Tester.TestWithTStates("scf", 4, 0x37);
    await Z80Tester.TestWithTStates("jr c,L0002", [12, 7], 0x38, 0x00);
    await Z80Tester.Test("jr c,L0022", 0x38, 0x20);
    await Z80Tester.Test("jr c,LFFF2", 0x38, 0xf0);
    await Z80Tester.TestWithTStates("add hl,sp", 11, 0x39);
    await Z80Tester.TestWithTStates("ld a,($3456)", 13, 0x3a, 0x56, 0x34);
    await Z80Tester.TestWithTStates("dec sp", 6, 0x3b);
    await Z80Tester.TestWithTStates("inc a", 4, 0x3c);
    await Z80Tester.TestWithTStates("dec a", 4, 0x3d);
    await Z80Tester.TestWithTStates("ld a,$23", 7, 0x3e, 0x23);
    await Z80Tester.TestWithTStates("ccf", 4, 0x3f);
  });

  it("Standard instructions 0x40-0x4F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ld b,b", 4, 0x40);
    await Z80Tester.TestWithTStates("ld b,c", 4, 0x41);
    await Z80Tester.TestWithTStates("ld b,d", 4, 0x42);
    await Z80Tester.TestWithTStates("ld b,e", 4, 0x43);
    await Z80Tester.TestWithTStates("ld b,h", 4, 0x44);
    await Z80Tester.TestWithTStates("ld b,l", 4, 0x45);
    await Z80Tester.TestWithTStates("ld b,(hl)", 7, 0x46);
    await Z80Tester.TestWithTStates("ld b,a", 4, 0x47);
    await Z80Tester.TestWithTStates("ld c,b", 4, 0x48);
    await Z80Tester.TestWithTStates("ld c,c", 4, 0x49);
    await Z80Tester.TestWithTStates("ld c,d", 4, 0x4a);
    await Z80Tester.TestWithTStates("ld c,e", 4, 0x4b);
    await Z80Tester.TestWithTStates("ld c,h", 4, 0x4c);
    await Z80Tester.TestWithTStates("ld c,l", 4, 0x4d);
    await Z80Tester.TestWithTStates("ld c,(hl)", 7, 0x4e);
    await Z80Tester.TestWithTStates("ld c,a", 4, 0x4f);
  });

  it("Standard instructions 0x50-0x5F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ld d,b", 4, 0x50);
    await Z80Tester.TestWithTStates("ld d,c", 4, 0x51);
    await Z80Tester.TestWithTStates("ld d,d", 4, 0x52);
    await Z80Tester.TestWithTStates("ld d,e", 4, 0x53);
    await Z80Tester.TestWithTStates("ld d,h", 4, 0x54);
    await Z80Tester.TestWithTStates("ld d,l", 4, 0x55);
    await Z80Tester.TestWithTStates("ld d,(hl)", 7, 0x56);
    await Z80Tester.TestWithTStates("ld d,a", 4, 0x57);
    await Z80Tester.TestWithTStates("ld e,b", 4, 0x58);
    await Z80Tester.TestWithTStates("ld e,c", 4, 0x59);
    await Z80Tester.TestWithTStates("ld e,d", 4, 0x5a);
    await Z80Tester.TestWithTStates("ld e,e", 4, 0x5b);
    await Z80Tester.TestWithTStates("ld e,h", 4, 0x5c);
    await Z80Tester.TestWithTStates("ld e,l", 4, 0x5d);
    await Z80Tester.TestWithTStates("ld e,(hl)", 7, 0x5e);
    await Z80Tester.TestWithTStates("ld e,a", 4, 0x5f);
  });

  it("Standard instructions 0x60-0x6F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ld h,b", 4, 0x60);
    await Z80Tester.TestWithTStates("ld h,c", 4, 0x61);
    await Z80Tester.TestWithTStates("ld h,d", 4, 0x62);
    await Z80Tester.TestWithTStates("ld h,e", 4, 0x63);
    await Z80Tester.TestWithTStates("ld h,h", 4, 0x64);
    await Z80Tester.TestWithTStates("ld h,l", 4, 0x65);
    await Z80Tester.TestWithTStates("ld h,(hl)", 7, 0x66);
    await Z80Tester.TestWithTStates("ld h,a", 4, 0x67);
    await Z80Tester.TestWithTStates("ld l,b", 4, 0x68);
    await Z80Tester.TestWithTStates("ld l,c", 4, 0x69);
    await Z80Tester.TestWithTStates("ld l,d", 4, 0x6a);
    await Z80Tester.TestWithTStates("ld l,e", 4, 0x6b);
    await Z80Tester.TestWithTStates("ld l,h", 4, 0x6c);
    await Z80Tester.TestWithTStates("ld l,l", 4, 0x6d);
    await Z80Tester.TestWithTStates("ld l,(hl)", 7, 0x6e);
    await Z80Tester.TestWithTStates("ld l,a", 4, 0x6f);
  });

  it("Standard instructions 0x70-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ld (hl),b", 7, 0x70);
    await Z80Tester.TestWithTStates("ld (hl),c", 7, 0x71);
    await Z80Tester.TestWithTStates("ld (hl),d", 7, 0x72);
    await Z80Tester.TestWithTStates("ld (hl),e", 7, 0x73);
    await Z80Tester.TestWithTStates("ld (hl),h", 7, 0x74);
    await Z80Tester.TestWithTStates("ld (hl),l", 7, 0x75);
    await Z80Tester.Test("halt", 0x76);
    await Z80Tester.TestWithTStates("ld (hl),a", 7, 0x77);
    await Z80Tester.TestWithTStates("ld a,b", 4, 0x78);
    await Z80Tester.TestWithTStates("ld a,c", 4, 0x79);
    await Z80Tester.TestWithTStates("ld a,d", 4, 0x7a);
    await Z80Tester.TestWithTStates("ld a,e", 4, 0x7b);
    await Z80Tester.TestWithTStates("ld a,h", 4, 0x7c);
    await Z80Tester.TestWithTStates("ld a,l", 4, 0x7d);
    await Z80Tester.TestWithTStates("ld a,(hl)", 7, 0x7e);
    await Z80Tester.TestWithTStates("ld a,a", 4, 0x7f);
  });

  it("Standard instructions 0x80-0x8F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("add a,b", 4, 0x80);
    await Z80Tester.TestWithTStates("add a,c", 4, 0x81);
    await Z80Tester.TestWithTStates("add a,d", 4, 0x82);
    await Z80Tester.TestWithTStates("add a,e", 4, 0x83);
    await Z80Tester.TestWithTStates("add a,h", 4, 0x84);
    await Z80Tester.TestWithTStates("add a,l", 4, 0x85);
    await Z80Tester.TestWithTStates("add a,(hl)", 7, 0x86);
    await Z80Tester.TestWithTStates("add a,a", 4, 0x87);
    await Z80Tester.TestWithTStates("adc a,b", 4, 0x88);
    await Z80Tester.TestWithTStates("adc a,c", 4, 0x89);
    await Z80Tester.TestWithTStates("adc a,d", 4, 0x8a);
    await Z80Tester.TestWithTStates("adc a,e", 4, 0x8b);
    await Z80Tester.TestWithTStates("adc a,h", 4, 0x8c);
    await Z80Tester.TestWithTStates("adc a,l", 4, 0x8d);
    await Z80Tester.TestWithTStates("adc a,(hl)", 7, 0x8e);
    await Z80Tester.TestWithTStates("adc a,a", 4, 0x8f);
  });

  it("Standard instructions 0x90-0x9F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("sub b", 4, 0x90);
    await Z80Tester.TestWithTStates("sub c", 4, 0x91);
    await Z80Tester.TestWithTStates("sub d", 4, 0x92);
    await Z80Tester.TestWithTStates("sub e", 4, 0x93);
    await Z80Tester.TestWithTStates("sub h", 4, 0x94);
    await Z80Tester.TestWithTStates("sub l", 4, 0x95);
    await Z80Tester.TestWithTStates("sub (hl)", 7, 0x96);
    await Z80Tester.TestWithTStates("sub a", 4, 0x97);
    await Z80Tester.TestWithTStates("sbc a,b", 4, 0x98);
    await Z80Tester.TestWithTStates("sbc a,c", 4, 0x99);
    await Z80Tester.TestWithTStates("sbc a,d", 4, 0x9a);
    await Z80Tester.TestWithTStates("sbc a,e", 4, 0x9b);
    await Z80Tester.TestWithTStates("sbc a,h", 4, 0x9c);
    await Z80Tester.TestWithTStates("sbc a,l", 4, 0x9d);
    await Z80Tester.TestWithTStates("sbc a,(hl)", 7, 0x9e);
    await Z80Tester.TestWithTStates("sbc a,a", 4, 0x9f);
  });

  it("Standard instructions 0xA0-0xAF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("and b", 4, 0xa0);
    await Z80Tester.TestWithTStates("and c", 4, 0xa1);
    await Z80Tester.TestWithTStates("and d", 4, 0xa2);
    await Z80Tester.TestWithTStates("and e", 4, 0xa3);
    await Z80Tester.TestWithTStates("and h", 4, 0xa4);
    await Z80Tester.TestWithTStates("and l", 4, 0xa5);
    await Z80Tester.TestWithTStates("and (hl)", 7, 0xa6);
    await Z80Tester.TestWithTStates("and a", 4, 0xa7);
    await Z80Tester.TestWithTStates("xor b", 4, 0xa8);
    await Z80Tester.TestWithTStates("xor c", 4, 0xa9);
    await Z80Tester.TestWithTStates("xor d", 4, 0xaa);
    await Z80Tester.TestWithTStates("xor e", 4, 0xab);
    await Z80Tester.TestWithTStates("xor h", 4, 0xac);
    await Z80Tester.TestWithTStates("xor l", 4, 0xad);
    await Z80Tester.TestWithTStates("xor (hl)", 7, 0xae);
    await Z80Tester.TestWithTStates("xor a", 4, 0xaf);
  });

  it("Standard instructions 0xB0-0xBF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("or b", 4, 0xb0);
    await Z80Tester.TestWithTStates("or c", 4, 0xb1);
    await Z80Tester.TestWithTStates("or d", 4, 0xb2);
    await Z80Tester.TestWithTStates("or e", 4, 0xb3);
    await Z80Tester.TestWithTStates("or h", 4, 0xb4);
    await Z80Tester.TestWithTStates("or l", 4, 0xb5);
    await Z80Tester.TestWithTStates("or (hl)", 7, 0xb6);
    await Z80Tester.TestWithTStates("or a", 4, 0xb7);
    await Z80Tester.TestWithTStates("cp b", 4, 0xb8);
    await Z80Tester.TestWithTStates("cp c", 4, 0xb9);
    await Z80Tester.TestWithTStates("cp d", 4, 0xba);
    await Z80Tester.TestWithTStates("cp e", 4, 0xbb);
    await Z80Tester.TestWithTStates("cp h", 4, 0xbc);
    await Z80Tester.TestWithTStates("cp l", 4, 0xbd);
    await Z80Tester.TestWithTStates("cp (hl)", 7, 0xbe);
    await Z80Tester.TestWithTStates("cp a", 4, 0xbf);
  });

  it("Standard instructions 0xC0-0xCF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ret nz", [11, 5], 0xc0);
    await Z80Tester.TestWithTStates("pop bc", 10, 0xc1);
    await Z80Tester.TestWithTStates("jp nz,L5678", 10, 0xc2, 0x78, 0x56);
    await Z80Tester.TestWithTStates("jp L5678", 10, 0xc3, 0x78, 0x56);
    await Z80Tester.TestWithTStates("call nz,L5678", [17, 10], 0xc4, 0x78, 0x56);
    await Z80Tester.TestWithTStates("push bc", 11, 0xc5);
    await Z80Tester.TestWithTStates("add a,$34", 7, 0xc6, 0x34);
    await Z80Tester.TestWithTStates("rst $00", 11, 0xc7);
    await Z80Tester.TestWithTStates("ret z", [11, 5], 0xc8);
    await Z80Tester.TestWithTStates("ret", 10, 0xc9);
    await Z80Tester.TestWithTStates("jp z,L5678", 10, 0xca, 0x78, 0x56);
    // -- 0xCB is the bit operation prefix
    await Z80Tester.TestWithTStates("call z,L5678", [17, 10], 0xcc, 0x78, 0x56);
    await Z80Tester.TestWithTStates("call L5678", 17, 0xcd, 0x78, 0x56);
    await Z80Tester.TestWithTStates("adc a,$34", 7, 0xce, 0x34);
    await Z80Tester.TestWithTStates("rst $08", 11, 0xcf);
  });

  it("Standard instructions 0xD0-0xDF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ret nc", [11, 5], 0xd0);
    await Z80Tester.TestWithTStates("pop de", 10, 0xd1);
    await Z80Tester.TestWithTStates("jp nc,L5678", 10, 0xd2, 0x78, 0x56);
    await Z80Tester.TestWithTStates("out ($78),a", 11, 0xd3, 0x78);
    await Z80Tester.TestWithTStates("call nc,L5678", [17, 10], 0xd4, 0x78, 0x56);
    await Z80Tester.TestWithTStates("push de", 11, 0xd5);
    await Z80Tester.TestWithTStates("sub $34", 7, 0xd6, 0x34);
    await Z80Tester.TestWithTStates("rst $10", 11, 0xd7);
    await Z80Tester.TestWithTStates("ret c", [11, 5], 0xd8);
    await Z80Tester.TestWithTStates("exx", 4, 0xd9);
    await Z80Tester.TestWithTStates("jp c,L5678", 10, 0xda, 0x78, 0x56);
    await Z80Tester.TestWithTStates("in a,($78)", 11, 0xdb, 0x78);
    await Z80Tester.TestWithTStates("call c,L5678", [17, 10], 0xdc, 0x78, 0x56);
    // -- 0xDD is the IX operation prefix
    await Z80Tester.TestWithTStates("sbc a,$34", 7, 0xde, 0x34);
    await Z80Tester.TestWithTStates("rst $18", 11, 0xdf);
  });

  it("Standard instructions 0xE0-0xEF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ret po", [11, 5], 0xe0);
    await Z80Tester.TestWithTStates("pop hl", 10, 0xe1);
    await Z80Tester.TestWithTStates("jp po,L5678", 10, 0xe2, 0x78, 0x56);
    await Z80Tester.TestWithTStates("ex (sp),hl", 19, 0xe3);
    await Z80Tester.TestWithTStates("call po,L5678", [17, 10], 0xe4, 0x78, 0x56);
    await Z80Tester.TestWithTStates("push hl", 11, 0xe5);
    await Z80Tester.TestWithTStates("and $34", 7, 0xe6, 0x34);
    await Z80Tester.TestWithTStates("rst $20", 11, 0xe7);
    await Z80Tester.TestWithTStates("ret pe", [11, 5], 0xe8);
    await Z80Tester.TestWithTStates("jp (hl)", 4, 0xe9);
    await Z80Tester.TestWithTStates("jp pe,L5678", 10, 0xea, 0x78, 0x56);
    await Z80Tester.TestWithTStates("ex de,hl", 4, 0xeb);
    await Z80Tester.TestWithTStates("call pe,L5678", [17, 10], 0xec, 0x78, 0x56);
    // -- 0xED is the extended operation prefix
    await Z80Tester.TestWithTStates("xor $34", 7, 0xee, 0x34);
    await Z80Tester.TestWithTStates("rst $28", 11, 0xef);
  });

  it("Standard instructions 0xF0-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ret p", [11, 5], 0xf0);
    await Z80Tester.TestWithTStates("pop af", 10, 0xf1);
    await Z80Tester.TestWithTStates("jp p,L5678", 10, 0xf2, 0x78, 0x56);
    await Z80Tester.TestWithTStates("di", 4, 0xf3);
    await Z80Tester.TestWithTStates("call p,L5678", [17, 10], 0xf4, 0x78, 0x56);
    await Z80Tester.TestWithTStates("push af", 11, 0xf5);
    await Z80Tester.TestWithTStates("or $34", 7, 0xf6, 0x34);
    await Z80Tester.TestWithTStates("rst $30", 11, 0xf7);
    await Z80Tester.TestWithTStates("ret m", [11, 5], 0xf8);
    await Z80Tester.TestWithTStates("ld sp,hl", 6, 0xf9);
    await Z80Tester.TestWithTStates("jp m,L5678", 10, 0xfa, 0x78, 0x56);
    await Z80Tester.TestWithTStates("ei", 4, 0xfb);
    await Z80Tester.TestWithTStates("call m,L5678", [17, 10], 0xfc, 0x78, 0x56);
    // -- 0xFD is the IY operation prefix
    await Z80Tester.TestWithTStates("cp $34", 7, 0xfe, 0x34);
    await Z80Tester.TestWithTStates("rst $38", 11, 0xff);
  });
});
