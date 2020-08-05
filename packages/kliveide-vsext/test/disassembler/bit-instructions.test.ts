import { Z80Tester } from "./z80-tester";

describe("Disassembler - bit instructions", () => {
  it("Bit instructions 0x00-0x0F work as expected", () => {
    // --- Act
    Z80Tester.Test("rlc b", 0xcb, 0x00);
    Z80Tester.Test("rlc c", 0xcb, 0x01);
    Z80Tester.Test("rlc d", 0xcb, 0x02);
    Z80Tester.Test("rlc e", 0xcb, 0x03);
    Z80Tester.Test("rlc h", 0xcb, 0x04);
    Z80Tester.Test("rlc l", 0xcb, 0x05);
    Z80Tester.Test("rlc (hl)", 0xcb, 0x06);
    Z80Tester.Test("rlc a", 0xcb, 0x07);
    Z80Tester.Test("rrc b", 0xcb, 0x08);
    Z80Tester.Test("rrc c", 0xcb, 0x09);
    Z80Tester.Test("rrc d", 0xcb, 0x0a);
    Z80Tester.Test("rrc e", 0xcb, 0x0b);
    Z80Tester.Test("rrc h", 0xcb, 0x0c);
    Z80Tester.Test("rrc l", 0xcb, 0x0d);
    Z80Tester.Test("rrc (hl)", 0xcb, 0x0e);
    Z80Tester.Test("rrc a", 0xcb, 0x0f);
  });

  it("Bit instructions 0x10-0x1F work as expected", () => {
    // --- Act
    Z80Tester.Test("rl b", 0xcb, 0x10);
    Z80Tester.Test("rl c", 0xcb, 0x11);
    Z80Tester.Test("rl d", 0xcb, 0x12);
    Z80Tester.Test("rl e", 0xcb, 0x13);
    Z80Tester.Test("rl h", 0xcb, 0x14);
    Z80Tester.Test("rl l", 0xcb, 0x15);
    Z80Tester.Test("rl (hl)", 0xcb, 0x16);
    Z80Tester.Test("rl a", 0xcb, 0x17);
    Z80Tester.Test("rr b", 0xcb, 0x18);
    Z80Tester.Test("rr c", 0xcb, 0x19);
    Z80Tester.Test("rr d", 0xcb, 0x1a);
    Z80Tester.Test("rr e", 0xcb, 0x1b);
    Z80Tester.Test("rr h", 0xcb, 0x1c);
    Z80Tester.Test("rr l", 0xcb, 0x1d);
    Z80Tester.Test("rr (hl)", 0xcb, 0x1e);
    Z80Tester.Test("rr a", 0xcb, 0x1f);
  });

  it("Bit instructions 0x20-0x2F work as expected", () => {
    // --- Act
    Z80Tester.Test("sla b", 0xcb, 0x20);
    Z80Tester.Test("sla c", 0xcb, 0x21);
    Z80Tester.Test("sla d", 0xcb, 0x22);
    Z80Tester.Test("sla e", 0xcb, 0x23);
    Z80Tester.Test("sla h", 0xcb, 0x24);
    Z80Tester.Test("sla l", 0xcb, 0x25);
    Z80Tester.Test("sla (hl)", 0xcb, 0x26);
    Z80Tester.Test("sla a", 0xcb, 0x27);
    Z80Tester.Test("sra b", 0xcb, 0x28);
    Z80Tester.Test("sra c", 0xcb, 0x29);
    Z80Tester.Test("sra d", 0xcb, 0x2a);
    Z80Tester.Test("sra e", 0xcb, 0x2b);
    Z80Tester.Test("sra h", 0xcb, 0x2c);
    Z80Tester.Test("sra l", 0xcb, 0x2d);
    Z80Tester.Test("sra (hl)", 0xcb, 0x2e);
    Z80Tester.Test("sra a", 0xcb, 0x2f);
  });

  it("Bit instructions 0x30-0x3F work as expected", () => {
    // --- Act
    Z80Tester.Test("sll b", 0xcb, 0x30);
    Z80Tester.Test("sll c", 0xcb, 0x31);
    Z80Tester.Test("sll d", 0xcb, 0x32);
    Z80Tester.Test("sll e", 0xcb, 0x33);
    Z80Tester.Test("sll h", 0xcb, 0x34);
    Z80Tester.Test("sll l", 0xcb, 0x35);
    Z80Tester.Test("sll (hl)", 0xcb, 0x36);
    Z80Tester.Test("sll a", 0xcb, 0x37);
    Z80Tester.Test("srl b", 0xcb, 0x38);
    Z80Tester.Test("srl c", 0xcb, 0x39);
    Z80Tester.Test("srl d", 0xcb, 0x3a);
    Z80Tester.Test("srl e", 0xcb, 0x3b);
    Z80Tester.Test("srl h", 0xcb, 0x3c);
    Z80Tester.Test("srl l", 0xcb, 0x3d);
    Z80Tester.Test("srl (hl)", 0xcb, 0x3e);
    Z80Tester.Test("srl a", 0xcb, 0x3f);
  });

  it("Bit instructions 0x40-0x4F work as expected", () => {
    // --- Act
    Z80Tester.Test("bit 0,b", 0xcb, 0x40);
    Z80Tester.Test("bit 0,c", 0xcb, 0x41);
    Z80Tester.Test("bit 0,d", 0xcb, 0x42);
    Z80Tester.Test("bit 0,e", 0xcb, 0x43);
    Z80Tester.Test("bit 0,h", 0xcb, 0x44);
    Z80Tester.Test("bit 0,l", 0xcb, 0x45);
    Z80Tester.Test("bit 0,(hl)", 0xcb, 0x46);
    Z80Tester.Test("bit 0,a", 0xcb, 0x47);
    Z80Tester.Test("bit 1,b", 0xcb, 0x48);
    Z80Tester.Test("bit 1,c", 0xcb, 0x49);
    Z80Tester.Test("bit 1,d", 0xcb, 0x4a);
    Z80Tester.Test("bit 1,e", 0xcb, 0x4b);
    Z80Tester.Test("bit 1,h", 0xcb, 0x4c);
    Z80Tester.Test("bit 1,l", 0xcb, 0x4d);
    Z80Tester.Test("bit 1,(hl)", 0xcb, 0x4e);
    Z80Tester.Test("bit 1,a", 0xcb, 0x4f);
  });

  it("Bit instructions 0x50-0x5F work as expected", () => {
    // --- Act
    Z80Tester.Test("bit 2,b", 0xcb, 0x50);
    Z80Tester.Test("bit 2,c", 0xcb, 0x51);
    Z80Tester.Test("bit 2,d", 0xcb, 0x52);
    Z80Tester.Test("bit 2,e", 0xcb, 0x53);
    Z80Tester.Test("bit 2,h", 0xcb, 0x54);
    Z80Tester.Test("bit 2,l", 0xcb, 0x55);
    Z80Tester.Test("bit 2,(hl)", 0xcb, 0x56);
    Z80Tester.Test("bit 2,a", 0xcb, 0x57);
    Z80Tester.Test("bit 3,b", 0xcb, 0x58);
    Z80Tester.Test("bit 3,c", 0xcb, 0x59);
    Z80Tester.Test("bit 3,d", 0xcb, 0x5a);
    Z80Tester.Test("bit 3,e", 0xcb, 0x5b);
    Z80Tester.Test("bit 3,h", 0xcb, 0x5c);
    Z80Tester.Test("bit 3,l", 0xcb, 0x5d);
    Z80Tester.Test("bit 3,(hl)", 0xcb, 0x5e);
    Z80Tester.Test("bit 3,a", 0xcb, 0x5f);
  });

  it("Bit instructions 0x60-0x6F work as expected", () => {
    // --- Act
    Z80Tester.Test("bit 4,b", 0xcb, 0x60);
    Z80Tester.Test("bit 4,c", 0xcb, 0x61);
    Z80Tester.Test("bit 4,d", 0xcb, 0x62);
    Z80Tester.Test("bit 4,e", 0xcb, 0x63);
    Z80Tester.Test("bit 4,h", 0xcb, 0x64);
    Z80Tester.Test("bit 4,l", 0xcb, 0x65);
    Z80Tester.Test("bit 4,(hl)", 0xcb, 0x66);
    Z80Tester.Test("bit 4,a", 0xcb, 0x67);
    Z80Tester.Test("bit 5,b", 0xcb, 0x68);
    Z80Tester.Test("bit 5,c", 0xcb, 0x69);
    Z80Tester.Test("bit 5,d", 0xcb, 0x6a);
    Z80Tester.Test("bit 5,e", 0xcb, 0x6b);
    Z80Tester.Test("bit 5,h", 0xcb, 0x6c);
    Z80Tester.Test("bit 5,l", 0xcb, 0x6d);
    Z80Tester.Test("bit 5,(hl)", 0xcb, 0x6e);
    Z80Tester.Test("bit 5,a", 0xcb, 0x6f);
  });

  it("Bit instructions 0x70-0x7F work as expected", () => {
    // --- Act
    Z80Tester.Test("bit 6,b", 0xcb, 0x70);
    Z80Tester.Test("bit 6,c", 0xcb, 0x71);
    Z80Tester.Test("bit 6,d", 0xcb, 0x72);
    Z80Tester.Test("bit 6,e", 0xcb, 0x73);
    Z80Tester.Test("bit 6,h", 0xcb, 0x74);
    Z80Tester.Test("bit 6,l", 0xcb, 0x75);
    Z80Tester.Test("bit 6,(hl)", 0xcb, 0x76);
    Z80Tester.Test("bit 6,a", 0xcb, 0x77);
    Z80Tester.Test("bit 7,b", 0xcb, 0x78);
    Z80Tester.Test("bit 7,c", 0xcb, 0x79);
    Z80Tester.Test("bit 7,d", 0xcb, 0x7a);
    Z80Tester.Test("bit 7,e", 0xcb, 0x7b);
    Z80Tester.Test("bit 7,h", 0xcb, 0x7c);
    Z80Tester.Test("bit 7,l", 0xcb, 0x7d);
    Z80Tester.Test("bit 7,(hl)", 0xcb, 0x7e);
    Z80Tester.Test("bit 7,a", 0xcb, 0x7f);
  });

  it("Bit instructions 0x80-0x8F work as expected", () => {
    // --- Act
    Z80Tester.Test("res 0,b", 0xcb, 0x80);
    Z80Tester.Test("res 0,c", 0xcb, 0x81);
    Z80Tester.Test("res 0,d", 0xcb, 0x82);
    Z80Tester.Test("res 0,e", 0xcb, 0x83);
    Z80Tester.Test("res 0,h", 0xcb, 0x84);
    Z80Tester.Test("res 0,l", 0xcb, 0x85);
    Z80Tester.Test("res 0,(hl)", 0xcb, 0x86);
    Z80Tester.Test("res 0,a", 0xcb, 0x87);
    Z80Tester.Test("res 1,b", 0xcb, 0x88);
    Z80Tester.Test("res 1,c", 0xcb, 0x89);
    Z80Tester.Test("res 1,d", 0xcb, 0x8a);
    Z80Tester.Test("res 1,e", 0xcb, 0x8b);
    Z80Tester.Test("res 1,h", 0xcb, 0x8c);
    Z80Tester.Test("res 1,l", 0xcb, 0x8d);
    Z80Tester.Test("res 1,(hl)", 0xcb, 0x8e);
    Z80Tester.Test("res 1,a", 0xcb, 0x8f);
  });

  it("Bit instructions 0x90-0x9F work as expected", () => {
    // --- Act
    Z80Tester.Test("res 2,b", 0xcb, 0x90);
    Z80Tester.Test("res 2,c", 0xcb, 0x91);
    Z80Tester.Test("res 2,d", 0xcb, 0x92);
    Z80Tester.Test("res 2,e", 0xcb, 0x93);
    Z80Tester.Test("res 2,h", 0xcb, 0x94);
    Z80Tester.Test("res 2,l", 0xcb, 0x95);
    Z80Tester.Test("res 2,(hl)", 0xcb, 0x96);
    Z80Tester.Test("res 2,a", 0xcb, 0x97);
    Z80Tester.Test("res 3,b", 0xcb, 0x98);
    Z80Tester.Test("res 3,c", 0xcb, 0x99);
    Z80Tester.Test("res 3,d", 0xcb, 0x9a);
    Z80Tester.Test("res 3,e", 0xcb, 0x9b);
    Z80Tester.Test("res 3,h", 0xcb, 0x9c);
    Z80Tester.Test("res 3,l", 0xcb, 0x9d);
    Z80Tester.Test("res 3,(hl)", 0xcb, 0x9e);
    Z80Tester.Test("res 3,a", 0xcb, 0x9f);
  });

  it("Bit instructions 0xA0-0xAF work as expected", () => {
    // --- Act
    Z80Tester.Test("res 4,b", 0xcb, 0xa0);
    Z80Tester.Test("res 4,c", 0xcb, 0xa1);
    Z80Tester.Test("res 4,d", 0xcb, 0xa2);
    Z80Tester.Test("res 4,e", 0xcb, 0xa3);
    Z80Tester.Test("res 4,h", 0xcb, 0xa4);
    Z80Tester.Test("res 4,l", 0xcb, 0xa5);
    Z80Tester.Test("res 4,(hl)", 0xcb, 0xa6);
    Z80Tester.Test("res 4,a", 0xcb, 0xa7);
    Z80Tester.Test("res 5,b", 0xcb, 0xa8);
    Z80Tester.Test("res 5,c", 0xcb, 0xa9);
    Z80Tester.Test("res 5,d", 0xcb, 0xaa);
    Z80Tester.Test("res 5,e", 0xcb, 0xab);
    Z80Tester.Test("res 5,h", 0xcb, 0xac);
    Z80Tester.Test("res 5,l", 0xcb, 0xad);
    Z80Tester.Test("res 5,(hl)", 0xcb, 0xae);
    Z80Tester.Test("res 5,a", 0xcb, 0xaf);
  });

  it("Bit instructions 0xB0-0xBF work as expected", () => {
    // --- Act
    Z80Tester.Test("res 6,b", 0xcb, 0xb0);
    Z80Tester.Test("res 6,c", 0xcb, 0xb1);
    Z80Tester.Test("res 6,d", 0xcb, 0xb2);
    Z80Tester.Test("res 6,e", 0xcb, 0xb3);
    Z80Tester.Test("res 6,h", 0xcb, 0xb4);
    Z80Tester.Test("res 6,l", 0xcb, 0xb5);
    Z80Tester.Test("res 6,(hl)", 0xcb, 0xb6);
    Z80Tester.Test("res 6,a", 0xcb, 0xb7);
    Z80Tester.Test("res 7,b", 0xcb, 0xb8);
    Z80Tester.Test("res 7,c", 0xcb, 0xb9);
    Z80Tester.Test("res 7,d", 0xcb, 0xba);
    Z80Tester.Test("res 7,e", 0xcb, 0xbb);
    Z80Tester.Test("res 7,h", 0xcb, 0xbc);
    Z80Tester.Test("res 7,l", 0xcb, 0xbd);
    Z80Tester.Test("res 7,(hl)", 0xcb, 0xbe);
    Z80Tester.Test("res 7,a", 0xcb, 0xbf);
  });

  it("Bit instructions 0xC0-0xCF work as expected", () => {
    // --- Act
    Z80Tester.Test("set 0,b", 0xcb, 0xc0);
    Z80Tester.Test("set 0,c", 0xcb, 0xc1);
    Z80Tester.Test("set 0,d", 0xcb, 0xc2);
    Z80Tester.Test("set 0,e", 0xcb, 0xc3);
    Z80Tester.Test("set 0,h", 0xcb, 0xc4);
    Z80Tester.Test("set 0,l", 0xcb, 0xc5);
    Z80Tester.Test("set 0,(hl)", 0xcb, 0xc6);
    Z80Tester.Test("set 0,a", 0xcb, 0xc7);
    Z80Tester.Test("set 1,b", 0xcb, 0xc8);
    Z80Tester.Test("set 1,c", 0xcb, 0xc9);
    Z80Tester.Test("set 1,d", 0xcb, 0xca);
    Z80Tester.Test("set 1,e", 0xcb, 0xcb);
    Z80Tester.Test("set 1,h", 0xcb, 0xcc);
    Z80Tester.Test("set 1,l", 0xcb, 0xcd);
    Z80Tester.Test("set 1,(hl)", 0xcb, 0xce);
    Z80Tester.Test("set 1,a", 0xcb, 0xcf);
  });

  it("Bit instructions 0xD0-0xDF work as expected", () => {
    // --- Act
    Z80Tester.Test("set 2,b", 0xcb, 0xd0);
    Z80Tester.Test("set 2,c", 0xcb, 0xd1);
    Z80Tester.Test("set 2,d", 0xcb, 0xd2);
    Z80Tester.Test("set 2,e", 0xcb, 0xd3);
    Z80Tester.Test("set 2,h", 0xcb, 0xd4);
    Z80Tester.Test("set 2,l", 0xcb, 0xd5);
    Z80Tester.Test("set 2,(hl)", 0xcb, 0xd6);
    Z80Tester.Test("set 2,a", 0xcb, 0xd7);
    Z80Tester.Test("set 3,b", 0xcb, 0xd8);
    Z80Tester.Test("set 3,c", 0xcb, 0xd9);
    Z80Tester.Test("set 3,d", 0xcb, 0xda);
    Z80Tester.Test("set 3,e", 0xcb, 0xdb);
    Z80Tester.Test("set 3,h", 0xcb, 0xdc);
    Z80Tester.Test("set 3,l", 0xcb, 0xdd);
    Z80Tester.Test("set 3,(hl)", 0xcb, 0xde);
    Z80Tester.Test("set 3,a", 0xcb, 0xdf);
  });

  it("Bit instructions 0xE0-0xEF work as expected", () => {
    // --- Act
    Z80Tester.Test("set 4,b", 0xcb, 0xe0);
    Z80Tester.Test("set 4,c", 0xcb, 0xe1);
    Z80Tester.Test("set 4,d", 0xcb, 0xe2);
    Z80Tester.Test("set 4,e", 0xcb, 0xe3);
    Z80Tester.Test("set 4,h", 0xcb, 0xe4);
    Z80Tester.Test("set 4,l", 0xcb, 0xe5);
    Z80Tester.Test("set 4,(hl)", 0xcb, 0xe6);
    Z80Tester.Test("set 4,a", 0xcb, 0xe7);
    Z80Tester.Test("set 5,b", 0xcb, 0xe8);
    Z80Tester.Test("set 5,c", 0xcb, 0xe9);
    Z80Tester.Test("set 5,d", 0xcb, 0xea);
    Z80Tester.Test("set 5,e", 0xcb, 0xeb);
    Z80Tester.Test("set 5,h", 0xcb, 0xec);
    Z80Tester.Test("set 5,l", 0xcb, 0xed);
    Z80Tester.Test("set 5,(hl)", 0xcb, 0xee);
    Z80Tester.Test("set 5,a", 0xcb, 0xef);
  });

  it("Bit instructions 0xF0-0xFF work as expected", () => {
    // --- Act
    Z80Tester.Test("set 6,b", 0xcb, 0xf0);
    Z80Tester.Test("set 6,c", 0xcb, 0xf1);
    Z80Tester.Test("set 6,d", 0xcb, 0xf2);
    Z80Tester.Test("set 6,e", 0xcb, 0xf3);
    Z80Tester.Test("set 6,h", 0xcb, 0xf4);
    Z80Tester.Test("set 6,l", 0xcb, 0xf5);
    Z80Tester.Test("set 6,(hl)", 0xcb, 0xf6);
    Z80Tester.Test("set 6,a", 0xcb, 0xf7);
    Z80Tester.Test("set 7,b", 0xcb, 0xf8);
    Z80Tester.Test("set 7,c", 0xcb, 0xf9);
    Z80Tester.Test("set 7,d", 0xcb, 0xfa);
    Z80Tester.Test("set 7,e", 0xcb, 0xfb);
    Z80Tester.Test("set 7,h", 0xcb, 0xfc);
    Z80Tester.Test("set 7,l", 0xcb, 0xfd);
    Z80Tester.Test("set 7,(hl)", 0xcb, 0xfe);
    Z80Tester.Test("set 7,a", 0xcb, 0xff);
  });
});
