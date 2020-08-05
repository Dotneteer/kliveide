import { Z80Tester } from "./z80-tester";

describe("Disassembler - standard instructions", () => {
  it("Standard instructions 0x00-0x0F work as expected", () => {
    // --- Act
    Z80Tester.Test("nop", 0x00);
    Z80Tester.Test("ld bc,#1234", 0x01, 0x34, 0x12);
    Z80Tester.Test("ld (bc),a", 0x02);
    Z80Tester.Test("inc bc", 0x03);
    Z80Tester.Test("inc b", 0x04);
    Z80Tester.Test("dec b", 0x05);
    Z80Tester.Test("ld b,#23", 0x06, 0x23);
    Z80Tester.Test("rlca", 0x07);
    Z80Tester.Test("ex af,af'", 0x08);
    Z80Tester.Test("add hl,bc", 0x09);
    Z80Tester.Test("ld a,(bc)", 0x0a);
    Z80Tester.Test("dec bc", 0x0b);
    Z80Tester.Test("inc c", 0x0c);
    Z80Tester.Test("dec c", 0x0d);
    Z80Tester.Test("ld c,#23", 0x0e, 0x23);
    Z80Tester.Test("rrca", 0x0f);
  });

  it("Standard instructions 0x10-0x1F work as expected", () => {
    // --- Act
    Z80Tester.Test("djnz L0002", 0x10, 0x00);
    Z80Tester.Test("djnz L0022", 0x10, 0x20);
    Z80Tester.Test("djnz LFFF2", 0x10, 0xf0);
    Z80Tester.Test("ld de,#1234", 0x11, 0x34, 0x12);
    Z80Tester.Test("ld (de),a", 0x12);
    Z80Tester.Test("inc de", 0x13);
    Z80Tester.Test("inc d", 0x14);
    Z80Tester.Test("dec d", 0x15);
    Z80Tester.Test("ld d,#23", 0x16, 0x23);
    Z80Tester.Test("rla", 0x17);
    Z80Tester.Test("jr L0002", 0x18, 0x00);
    Z80Tester.Test("jr L0022", 0x18, 0x20);
    Z80Tester.Test("jr LFFF2", 0x18, 0xf0);
    Z80Tester.Test("add hl,de", 0x19);
    Z80Tester.Test("ld a,(de)", 0x1a);
    Z80Tester.Test("dec de", 0x1b);
    Z80Tester.Test("inc e", 0x1c);
    Z80Tester.Test("dec e", 0x1d);
    Z80Tester.Test("ld e,#23", 0x1e, 0x23);
    Z80Tester.Test("rra", 0x1f);
  });

  it("Standard instructions 0x20-0x2F work as expected", () => {
    // --- Act
    Z80Tester.Test("jr nz,L0002", 0x20, 0x00);
    Z80Tester.Test("jr nz,L0022", 0x20, 0x20);
    Z80Tester.Test("jr nz,LFFF2", 0x20, 0xf0);
    Z80Tester.Test("ld hl,#1234", 0x21, 0x34, 0x12);
    Z80Tester.Test("ld (#3456),hl", 0x22, 0x56, 0x34);
    Z80Tester.Test("inc hl", 0x23);
    Z80Tester.Test("inc h", 0x24);
    Z80Tester.Test("dec h", 0x25);
    Z80Tester.Test("ld h,#23", 0x26, 0x23);
    Z80Tester.Test("daa", 0x27);
    Z80Tester.Test("jr z,L0002", 0x28, 0x00);
    Z80Tester.Test("jr z,L0022", 0x28, 0x20);
    Z80Tester.Test("jr z,LFFF2", 0x28, 0xf0);
    Z80Tester.Test("add hl,hl", 0x29);
    Z80Tester.Test("ld hl,(#3456)", 0x2a, 0x56, 0x34);
    Z80Tester.Test("dec hl", 0x2b);
    Z80Tester.Test("inc l", 0x2c);
    Z80Tester.Test("dec l", 0x2d);
    Z80Tester.Test("ld l,#23", 0x2e, 0x23);
    Z80Tester.Test("cpl", 0x2f);
  });

  it("Standard instructions 0x30-0x3F work as expected", () => {
    // --- Act
    Z80Tester.Test("jr nc,L0002", 0x30, 0x00);
    Z80Tester.Test("jr nc,L0022", 0x30, 0x20);
    Z80Tester.Test("jr nc,LFFF2", 0x30, 0xf0);
    Z80Tester.Test("ld sp,#1234", 0x31, 0x34, 0x12);
    Z80Tester.Test("ld (#3456),a", 0x32, 0x56, 0x34);
    Z80Tester.Test("inc sp", 0x33);
    Z80Tester.Test("inc (hl)", 0x34);
    Z80Tester.Test("dec (hl)", 0x35);
    Z80Tester.Test("ld (hl),#23", 0x36, 0x23);
    Z80Tester.Test("scf", 0x37);
    Z80Tester.Test("jr c,L0002", 0x38, 0x00);
    Z80Tester.Test("jr c,L0022", 0x38, 0x20);
    Z80Tester.Test("jr c,LFFF2", 0x38, 0xf0);
    Z80Tester.Test("add hl,sp", 0x39);
    Z80Tester.Test("ld a,(#3456)", 0x3a, 0x56, 0x34);
    Z80Tester.Test("dec sp", 0x3b);
    Z80Tester.Test("inc a", 0x3c);
    Z80Tester.Test("dec a", 0x3d);
    Z80Tester.Test("ld a,#23", 0x3e, 0x23);
    Z80Tester.Test("ccf", 0x3f);
  });

  it("Standard instructions 0x40-0x4F work as expected", () => {
    // --- Act
    Z80Tester.Test("ld b,b", 0x40);
    Z80Tester.Test("ld b,c", 0x41);
    Z80Tester.Test("ld b,d", 0x42);
    Z80Tester.Test("ld b,e", 0x43);
    Z80Tester.Test("ld b,h", 0x44);
    Z80Tester.Test("ld b,l", 0x45);
    Z80Tester.Test("ld b,(hl)", 0x46);
    Z80Tester.Test("ld b,a", 0x47);
    Z80Tester.Test("ld c,b", 0x48);
    Z80Tester.Test("ld c,c", 0x49);
    Z80Tester.Test("ld c,d", 0x4a);
    Z80Tester.Test("ld c,e", 0x4b);
    Z80Tester.Test("ld c,h", 0x4c);
    Z80Tester.Test("ld c,l", 0x4d);
    Z80Tester.Test("ld c,(hl)", 0x4e);
    Z80Tester.Test("ld c,a", 0x4f);
  });

  it("Standard instructions 0x50-0x5F work as expected", () => {
    // --- Act
    Z80Tester.Test("ld d,b", 0x50);
    Z80Tester.Test("ld d,c", 0x51);
    Z80Tester.Test("ld d,d", 0x52);
    Z80Tester.Test("ld d,e", 0x53);
    Z80Tester.Test("ld d,h", 0x54);
    Z80Tester.Test("ld d,l", 0x55);
    Z80Tester.Test("ld d,(hl)", 0x56);
    Z80Tester.Test("ld d,a", 0x57);
    Z80Tester.Test("ld e,b", 0x58);
    Z80Tester.Test("ld e,c", 0x59);
    Z80Tester.Test("ld e,d", 0x5a);
    Z80Tester.Test("ld e,e", 0x5b);
    Z80Tester.Test("ld e,h", 0x5c);
    Z80Tester.Test("ld e,l", 0x5d);
    Z80Tester.Test("ld e,(hl)", 0x5e);
    Z80Tester.Test("ld e,a", 0x5f);
  });

  it("Standard instructions 0x60-0x6F work as expected", () => {
    // --- Act
    Z80Tester.Test("ld h,b", 0x60);
    Z80Tester.Test("ld h,c", 0x61);
    Z80Tester.Test("ld h,d", 0x62);
    Z80Tester.Test("ld h,e", 0x63);
    Z80Tester.Test("ld h,h", 0x64);
    Z80Tester.Test("ld h,l", 0x65);
    Z80Tester.Test("ld h,(hl)", 0x66);
    Z80Tester.Test("ld h,a", 0x67);
    Z80Tester.Test("ld l,b", 0x68);
    Z80Tester.Test("ld l,c", 0x69);
    Z80Tester.Test("ld l,d", 0x6a);
    Z80Tester.Test("ld l,e", 0x6b);
    Z80Tester.Test("ld l,h", 0x6c);
    Z80Tester.Test("ld l,l", 0x6d);
    Z80Tester.Test("ld l,(hl)", 0x6e);
    Z80Tester.Test("ld l,a", 0x6f);
  });

  it("Standard instructions 0x70-0x7F work as expected", () => {
    // --- Act
    Z80Tester.Test("ld (hl),b", 0x70);
    Z80Tester.Test("ld (hl),c", 0x71);
    Z80Tester.Test("ld (hl),d", 0x72);
    Z80Tester.Test("ld (hl),e", 0x73);
    Z80Tester.Test("ld (hl),h", 0x74);
    Z80Tester.Test("ld (hl),l", 0x75);
    Z80Tester.Test("halt", 0x76);
    Z80Tester.Test("ld (hl),a", 0x77);
    Z80Tester.Test("ld a,b", 0x78);
    Z80Tester.Test("ld a,c", 0x79);
    Z80Tester.Test("ld a,d", 0x7a);
    Z80Tester.Test("ld a,e", 0x7b);
    Z80Tester.Test("ld a,h", 0x7c);
    Z80Tester.Test("ld a,l", 0x7d);
    Z80Tester.Test("ld a,(hl)", 0x7e);
    Z80Tester.Test("ld a,a", 0x7f);
  });

  it("Standard instructions 0x80-0x8F work as expected", () => {
    // --- Act
    Z80Tester.Test("add a,b", 0x80);
    Z80Tester.Test("add a,c", 0x81);
    Z80Tester.Test("add a,d", 0x82);
    Z80Tester.Test("add a,e", 0x83);
    Z80Tester.Test("add a,h", 0x84);
    Z80Tester.Test("add a,l", 0x85);
    Z80Tester.Test("add a,(hl)", 0x86);
    Z80Tester.Test("add a,a", 0x87);
    Z80Tester.Test("adc a,b", 0x88);
    Z80Tester.Test("adc a,c", 0x89);
    Z80Tester.Test("adc a,d", 0x8a);
    Z80Tester.Test("adc a,e", 0x8b);
    Z80Tester.Test("adc a,h", 0x8c);
    Z80Tester.Test("adc a,l", 0x8d);
    Z80Tester.Test("adc a,(hl)", 0x8e);
    Z80Tester.Test("adc a,a", 0x8f);
  });

  it("Standard instructions 0x90-0x9F work as expected", () => {
    // --- Act
    Z80Tester.Test("sub b", 0x90);
    Z80Tester.Test("sub c", 0x91);
    Z80Tester.Test("sub d", 0x92);
    Z80Tester.Test("sub e", 0x93);
    Z80Tester.Test("sub h", 0x94);
    Z80Tester.Test("sub l", 0x95);
    Z80Tester.Test("sub (hl)", 0x96);
    Z80Tester.Test("sub a", 0x97);
    Z80Tester.Test("sbc a,b", 0x98);
    Z80Tester.Test("sbc a,c", 0x99);
    Z80Tester.Test("sbc a,d", 0x9a);
    Z80Tester.Test("sbc a,e", 0x9b);
    Z80Tester.Test("sbc a,h", 0x9c);
    Z80Tester.Test("sbc a,l", 0x9d);
    Z80Tester.Test("sbc a,(hl)", 0x9e);
    Z80Tester.Test("sbc a,a", 0x9f);
  });

  it("Standard instructions 0xA0-0xAF work as expected", () => {
    // --- Act
    Z80Tester.Test("and b", 0xa0);
    Z80Tester.Test("and c", 0xa1);
    Z80Tester.Test("and d", 0xa2);
    Z80Tester.Test("and e", 0xa3);
    Z80Tester.Test("and h", 0xa4);
    Z80Tester.Test("and l", 0xa5);
    Z80Tester.Test("and (hl)", 0xa6);
    Z80Tester.Test("and a", 0xa7);
    Z80Tester.Test("xor b", 0xa8);
    Z80Tester.Test("xor c", 0xa9);
    Z80Tester.Test("xor d", 0xaa);
    Z80Tester.Test("xor e", 0xab);
    Z80Tester.Test("xor h", 0xac);
    Z80Tester.Test("xor l", 0xad);
    Z80Tester.Test("xor (hl)", 0xae);
    Z80Tester.Test("xor a", 0xaf);
  });

  it("Standard instructions 0xB0-0xBF work as expected", () => {
    // --- Act
    Z80Tester.Test("or b", 0xb0);
    Z80Tester.Test("or c", 0xb1);
    Z80Tester.Test("or d", 0xb2);
    Z80Tester.Test("or e", 0xb3);
    Z80Tester.Test("or h", 0xb4);
    Z80Tester.Test("or l", 0xb5);
    Z80Tester.Test("or (hl)", 0xb6);
    Z80Tester.Test("or a", 0xb7);
    Z80Tester.Test("cp b", 0xb8);
    Z80Tester.Test("cp c", 0xb9);
    Z80Tester.Test("cp d", 0xba);
    Z80Tester.Test("cp e", 0xbb);
    Z80Tester.Test("cp h", 0xbc);
    Z80Tester.Test("cp l", 0xbd);
    Z80Tester.Test("cp (hl)", 0xbe);
    Z80Tester.Test("cp a", 0xbf);
  });

  it("Standard instructions 0xC0-0xCF work as expected", () => {
    // --- Act
    Z80Tester.Test("ret nz", 0xc0);
    Z80Tester.Test("pop bc", 0xc1);
    Z80Tester.Test("jp nz,L5678", 0xc2, 0x78, 0x56);
    Z80Tester.Test("jp L5678", 0xc3, 0x78, 0x56);
    Z80Tester.Test("call nz,L5678", 0xc4, 0x78, 0x56);
    Z80Tester.Test("push bc", 0xc5);
    Z80Tester.Test("add a,#34", 0xc6, 0x34);
    Z80Tester.Test("rst #00", 0xc7);
    Z80Tester.Test("ret z", 0xc8);
    Z80Tester.Test("ret", 0xc9);
    Z80Tester.Test("jp z,L5678", 0xca, 0x78, 0x56);
    // -- 0xCB is the bit operation prefix
    Z80Tester.Test("call z,L5678", 0xcc, 0x78, 0x56);
    Z80Tester.Test("call L5678", 0xcd, 0x78, 0x56);
    Z80Tester.Test("adc a,#34", 0xce, 0x34);
    Z80Tester.Test("rst #08", 0xcf);
  });

  it("Standard instructions 0xD0-0xDF work as expected", () => {
    // --- Act
    Z80Tester.Test("ret nc", 0xd0);
    Z80Tester.Test("pop de", 0xd1);
    Z80Tester.Test("jp nc,L5678", 0xd2, 0x78, 0x56);
    Z80Tester.Test("out (#78),a", 0xd3, 0x78);
    Z80Tester.Test("call nc,L5678", 0xd4, 0x78, 0x56);
    Z80Tester.Test("push de", 0xd5);
    Z80Tester.Test("sub #34", 0xd6, 0x34);
    Z80Tester.Test("rst #10", 0xd7);
    Z80Tester.Test("ret c", 0xd8);
    Z80Tester.Test("exx", 0xd9);
    Z80Tester.Test("jp c,L5678", 0xda, 0x78, 0x56);
    Z80Tester.Test("in a,(#78)", 0xdb, 0x78);
    Z80Tester.Test("call c,L5678", 0xdc, 0x78, 0x56);
    // -- 0xDD is the IX operation prefix
    Z80Tester.Test("sbc a,#34", 0xde, 0x34);
    Z80Tester.Test("rst #18", 0xdf);
  });

  it("Standard instructions 0xE0-0xEF work as expected", () => {
    // --- Act
    Z80Tester.Test("ret po", 0xe0);
    Z80Tester.Test("pop hl", 0xe1);
    Z80Tester.Test("jp po,L5678", 0xe2, 0x78, 0x56);
    Z80Tester.Test("ex (sp),hl", 0xe3);
    Z80Tester.Test("call po,L5678", 0xe4, 0x78, 0x56);
    Z80Tester.Test("push hl", 0xe5);
    Z80Tester.Test("and #34", 0xe6, 0x34);
    Z80Tester.Test("rst #20", 0xe7);
    Z80Tester.Test("ret pe", 0xe8);
    Z80Tester.Test("jp (hl)", 0xe9);
    Z80Tester.Test("jp pe,L5678", 0xea, 0x78, 0x56);
    Z80Tester.Test("ex de,hl", 0xeb);
    Z80Tester.Test("call pe,L5678", 0xec, 0x78, 0x56);
    // -- 0xED is the extended operation prefix
    Z80Tester.Test("xor #34", 0xee, 0x34);
    Z80Tester.Test("rst #28", 0xef);
  });

  it("Standard instructions 0xF0-0xFF work as expected", () => {
    // --- Act
    Z80Tester.Test("ret p", 0xf0);
    Z80Tester.Test("pop af", 0xf1);
    Z80Tester.Test("jp p,L5678", 0xf2, 0x78, 0x56);
    Z80Tester.Test("di", 0xf3);
    Z80Tester.Test("call p,L5678", 0xf4, 0x78, 0x56);
    Z80Tester.Test("push af", 0xf5);
    Z80Tester.Test("or #34", 0xf6, 0x34);
    Z80Tester.Test("rst #30", 0xf7);
    Z80Tester.Test("ret m", 0xf8);
    Z80Tester.Test("ld sp,hl", 0xf9);
    Z80Tester.Test("jp m,L5678", 0xfa, 0x78, 0x56);
    Z80Tester.Test("ei", 0xfb);
    Z80Tester.Test("call m,L5678", 0xfc, 0x78, 0x56);
    // -- 0xFD is the IY operation prefix
    Z80Tester.Test("cp #34", 0xfe, 0x34);
    Z80Tester.Test("rst #38", 0xff);
  });
});
