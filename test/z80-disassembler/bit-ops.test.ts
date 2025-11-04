import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";

describe("Disassembler - bit instructions", function () {
  it("Bit instructions 0x00-0x0F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("rlc b", 8, 0xcb, 0x00);
    await Z80Tester.TestWithTStates("rlc c", 8, 0xcb, 0x01);
    await Z80Tester.TestWithTStates("rlc d", 8, 0xcb, 0x02);
    await Z80Tester.TestWithTStates("rlc e", 8, 0xcb, 0x03);
    await Z80Tester.TestWithTStates("rlc h", 8, 0xcb, 0x04);
    await Z80Tester.TestWithTStates("rlc l", 8, 0xcb, 0x05);
    await Z80Tester.TestWithTStates("rlc (hl)", 8, 0xcb, 0x06);
    await Z80Tester.TestWithTStates("rlc a", 8, 0xcb, 0x07);
    await Z80Tester.TestWithTStates("rrc b", 8, 0xcb, 0x08);
    await Z80Tester.TestWithTStates("rrc c", 8, 0xcb, 0x09);
    await Z80Tester.TestWithTStates("rrc d", 8, 0xcb, 0x0a);
    await Z80Tester.TestWithTStates("rrc e", 8, 0xcb, 0x0b);
    await Z80Tester.TestWithTStates("rrc h", 8, 0xcb, 0x0c);
    await Z80Tester.TestWithTStates("rrc l", 8, 0xcb, 0x0d);
    await Z80Tester.TestWithTStates("rrc (hl)", 8, 0xcb, 0x0e);
    await Z80Tester.TestWithTStates("rrc a", 8, 0xcb, 0x0f);
  });

  it("Bit instructions 0x10-0x1F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("rl b", 8, 0xcb, 0x10);
    await Z80Tester.TestWithTStates("rl c", 8, 0xcb, 0x11);
    await Z80Tester.TestWithTStates("rl d", 8, 0xcb, 0x12);
    await Z80Tester.TestWithTStates("rl e", 8, 0xcb, 0x13);
    await Z80Tester.TestWithTStates("rl h", 8, 0xcb, 0x14);
    await Z80Tester.TestWithTStates("rl l", 8, 0xcb, 0x15);
    await Z80Tester.TestWithTStates("rl (hl)", 8, 0xcb, 0x16);
    await Z80Tester.TestWithTStates("rl a", 8, 0xcb, 0x17);
    await Z80Tester.TestWithTStates("rr b", 8, 0xcb, 0x18);
    await Z80Tester.TestWithTStates("rr c", 8, 0xcb, 0x19);
    await Z80Tester.TestWithTStates("rr d", 8, 0xcb, 0x1a);
    await Z80Tester.TestWithTStates("rr e", 8, 0xcb, 0x1b);
    await Z80Tester.TestWithTStates("rr h", 8, 0xcb, 0x1c);
    await Z80Tester.TestWithTStates("rr l", 8, 0xcb, 0x1d);
    await Z80Tester.TestWithTStates("rr (hl)", 8, 0xcb, 0x1e);
    await Z80Tester.TestWithTStates("rr a", 8, 0xcb, 0x1f);
  });

  it("Bit instructions 0x20-0x2F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("sla b", 8, 0xcb, 0x20);
    await Z80Tester.TestWithTStates("sla c", 8, 0xcb, 0x21);
    await Z80Tester.TestWithTStates("sla d", 8, 0xcb, 0x22);
    await Z80Tester.TestWithTStates("sla e", 8, 0xcb, 0x23);
    await Z80Tester.TestWithTStates("sla h", 8, 0xcb, 0x24);
    await Z80Tester.TestWithTStates("sla l", 8, 0xcb, 0x25);
    await Z80Tester.TestWithTStates("sla (hl)", 8, 0xcb, 0x26);
    await Z80Tester.TestWithTStates("sla a", 8, 0xcb, 0x27);
    await Z80Tester.TestWithTStates("sra b", 8, 0xcb, 0x28);
    await Z80Tester.TestWithTStates("sra c", 8, 0xcb, 0x29);
    await Z80Tester.TestWithTStates("sra d", 8, 0xcb, 0x2a);
    await Z80Tester.TestWithTStates("sra e", 8, 0xcb, 0x2b);
    await Z80Tester.TestWithTStates("sra h", 8, 0xcb, 0x2c);
    await Z80Tester.TestWithTStates("sra l", 8, 0xcb, 0x2d);
    await Z80Tester.TestWithTStates("sra (hl)", 8, 0xcb, 0x2e);
    await Z80Tester.TestWithTStates("sra a", 8, 0xcb, 0x2f);
  });

  it("Bit instructions 0x30-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("sll b", 8, 0xcb, 0x30);
    await Z80Tester.TestWithTStates("sll c", 8, 0xcb, 0x31);
    await Z80Tester.TestWithTStates("sll d", 8, 0xcb, 0x32);
    await Z80Tester.TestWithTStates("sll e", 8, 0xcb, 0x33);
    await Z80Tester.TestWithTStates("sll h", 8, 0xcb, 0x34);
    await Z80Tester.TestWithTStates("sll l", 8, 0xcb, 0x35);
    await Z80Tester.TestWithTStates("sll (hl)", 8, 0xcb, 0x36);
    await Z80Tester.TestWithTStates("sll a", 8, 0xcb, 0x37);
    await Z80Tester.TestWithTStates("srl b", 8, 0xcb, 0x38);
    await Z80Tester.TestWithTStates("srl c", 8, 0xcb, 0x39);
    await Z80Tester.TestWithTStates("srl d", 8, 0xcb, 0x3a);
    await Z80Tester.TestWithTStates("srl e", 8, 0xcb, 0x3b);
    await Z80Tester.TestWithTStates("srl h", 8, 0xcb, 0x3c);
    await Z80Tester.TestWithTStates("srl l", 8, 0xcb, 0x3d);
    await Z80Tester.TestWithTStates("srl (hl)", 8, 0xcb, 0x3e);
    await Z80Tester.TestWithTStates("srl a", 8, 0xcb, 0x3f);
  });

  it("Bit instructions 0x40-0x4F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 0,b", 8, 0xcb, 0x40);
    await Z80Tester.TestWithTStates("bit 0,c", 8, 0xcb, 0x41);
    await Z80Tester.TestWithTStates("bit 0,d", 8, 0xcb, 0x42);
    await Z80Tester.TestWithTStates("bit 0,e", 8, 0xcb, 0x43);
    await Z80Tester.TestWithTStates("bit 0,h", 8, 0xcb, 0x44);
    await Z80Tester.TestWithTStates("bit 0,l", 8, 0xcb, 0x45);
    await Z80Tester.TestWithTStates("bit 0,(hl)", 8, 0xcb, 0x46);
    await Z80Tester.TestWithTStates("bit 0,a", 8, 0xcb, 0x47);
    await Z80Tester.TestWithTStates("bit 1,b", 8, 0xcb, 0x48);
    await Z80Tester.TestWithTStates("bit 1,c", 8, 0xcb, 0x49);
    await Z80Tester.TestWithTStates("bit 1,d", 8, 0xcb, 0x4a);
    await Z80Tester.TestWithTStates("bit 1,e", 8, 0xcb, 0x4b);
    await Z80Tester.TestWithTStates("bit 1,h", 8, 0xcb, 0x4c);
    await Z80Tester.TestWithTStates("bit 1,l", 8, 0xcb, 0x4d);
    await Z80Tester.TestWithTStates("bit 1,(hl)", 8, 0xcb, 0x4e);
    await Z80Tester.TestWithTStates("bit 1,a", 8, 0xcb, 0x4f);
  });

  it("Bit instructions 0x50-0x5F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 2,b", 8, 0xcb, 0x50);
    await Z80Tester.TestWithTStates("bit 2,c", 8, 0xcb, 0x51);
    await Z80Tester.TestWithTStates("bit 2,d", 8, 0xcb, 0x52);
    await Z80Tester.TestWithTStates("bit 2,e", 8, 0xcb, 0x53);
    await Z80Tester.TestWithTStates("bit 2,h", 8, 0xcb, 0x54);
    await Z80Tester.TestWithTStates("bit 2,l", 8, 0xcb, 0x55);
    await Z80Tester.TestWithTStates("bit 2,(hl)", 8, 0xcb, 0x56);
    await Z80Tester.TestWithTStates("bit 2,a", 8, 0xcb, 0x57);
    await Z80Tester.TestWithTStates("bit 3,b", 8, 0xcb, 0x58);
    await Z80Tester.TestWithTStates("bit 3,c", 8, 0xcb, 0x59);
    await Z80Tester.TestWithTStates("bit 3,d", 8, 0xcb, 0x5a);
    await Z80Tester.TestWithTStates("bit 3,e", 8, 0xcb, 0x5b);
    await Z80Tester.TestWithTStates("bit 3,h", 8, 0xcb, 0x5c);
    await Z80Tester.TestWithTStates("bit 3,l", 8, 0xcb, 0x5d);
    await Z80Tester.TestWithTStates("bit 3,(hl)", 8, 0xcb, 0x5e);
    await Z80Tester.TestWithTStates("bit 3,a", 8, 0xcb, 0x5f);
  });

  it("Bit instructions 0x60-0x6F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 4,b", 8, 0xcb, 0x60);
    await Z80Tester.TestWithTStates("bit 4,c", 8, 0xcb, 0x61);
    await Z80Tester.TestWithTStates("bit 4,d", 8, 0xcb, 0x62);
    await Z80Tester.TestWithTStates("bit 4,e", 8, 0xcb, 0x63);
    await Z80Tester.TestWithTStates("bit 4,h", 8, 0xcb, 0x64);
    await Z80Tester.TestWithTStates("bit 4,l", 8, 0xcb, 0x65);
    await Z80Tester.TestWithTStates("bit 4,(hl)", 8, 0xcb, 0x66);
    await Z80Tester.TestWithTStates("bit 4,a", 8, 0xcb, 0x67);
    await Z80Tester.TestWithTStates("bit 5,b", 8, 0xcb, 0x68);
    await Z80Tester.TestWithTStates("bit 5,c", 8, 0xcb, 0x69);
    await Z80Tester.TestWithTStates("bit 5,d", 8, 0xcb, 0x6a);
    await Z80Tester.TestWithTStates("bit 5,e", 8, 0xcb, 0x6b);
    await Z80Tester.TestWithTStates("bit 5,h", 8, 0xcb, 0x6c);
    await Z80Tester.TestWithTStates("bit 5,l", 8, 0xcb, 0x6d);
    await Z80Tester.TestWithTStates("bit 5,(hl)", 8, 0xcb, 0x6e);
    await Z80Tester.TestWithTStates("bit 5,a", 8, 0xcb, 0x6f);
  });

  it("Bit instructions 0x70-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 6,b", 8, 0xcb, 0x70);
    await Z80Tester.TestWithTStates("bit 6,c", 8, 0xcb, 0x71);
    await Z80Tester.TestWithTStates("bit 6,d", 8, 0xcb, 0x72);
    await Z80Tester.TestWithTStates("bit 6,e", 8, 0xcb, 0x73);
    await Z80Tester.TestWithTStates("bit 6,h", 8, 0xcb, 0x74);
    await Z80Tester.TestWithTStates("bit 6,l", 8, 0xcb, 0x75);
    await Z80Tester.TestWithTStates("bit 6,(hl)", 8, 0xcb, 0x76);
    await Z80Tester.TestWithTStates("bit 6,a", 8, 0xcb, 0x77);
    await Z80Tester.TestWithTStates("bit 7,b", 8, 0xcb, 0x78);
    await Z80Tester.TestWithTStates("bit 7,c", 8, 0xcb, 0x79);
    await Z80Tester.TestWithTStates("bit 7,d", 8, 0xcb, 0x7a);
    await Z80Tester.TestWithTStates("bit 7,e", 8, 0xcb, 0x7b);
    await Z80Tester.TestWithTStates("bit 7,h", 8, 0xcb, 0x7c);
    await Z80Tester.TestWithTStates("bit 7,l", 8, 0xcb, 0x7d);
    await Z80Tester.TestWithTStates("bit 7,(hl)", 8, 0xcb, 0x7e);
    await Z80Tester.TestWithTStates("bit 7,a", 8, 0xcb, 0x7f);
  });

  it("Bit instructions 0x80-0x8F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 0,b", 8, 0xcb, 0x80);
    await Z80Tester.TestWithTStates("res 0,c", 8, 0xcb, 0x81);
    await Z80Tester.TestWithTStates("res 0,d", 8, 0xcb, 0x82);
    await Z80Tester.TestWithTStates("res 0,e", 8, 0xcb, 0x83);
    await Z80Tester.TestWithTStates("res 0,h", 8, 0xcb, 0x84);
    await Z80Tester.TestWithTStates("res 0,l", 8, 0xcb, 0x85);
    await Z80Tester.TestWithTStates("res 0,(hl)", 8, 0xcb, 0x86);
    await Z80Tester.TestWithTStates("res 0,a", 8, 0xcb, 0x87);
    await Z80Tester.TestWithTStates("res 1,b", 8, 0xcb, 0x88);
    await Z80Tester.TestWithTStates("res 1,c", 8, 0xcb, 0x89);
    await Z80Tester.TestWithTStates("res 1,d", 8, 0xcb, 0x8a);
    await Z80Tester.TestWithTStates("res 1,e", 8, 0xcb, 0x8b);
    await Z80Tester.TestWithTStates("res 1,h", 8, 0xcb, 0x8c);
    await Z80Tester.TestWithTStates("res 1,l", 8, 0xcb, 0x8d);
    await Z80Tester.TestWithTStates("res 1,(hl)", 8, 0xcb, 0x8e);
    await Z80Tester.TestWithTStates("res 1,a", 8, 0xcb, 0x8f);
  });

  it("Bit instructions 0x90-0x9F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 2,b", 8, 0xcb, 0x90);
    await Z80Tester.TestWithTStates("res 2,c", 8, 0xcb, 0x91);
    await Z80Tester.TestWithTStates("res 2,d", 8, 0xcb, 0x92);
    await Z80Tester.TestWithTStates("res 2,e", 8, 0xcb, 0x93);
    await Z80Tester.TestWithTStates("res 2,h", 8, 0xcb, 0x94);
    await Z80Tester.TestWithTStates("res 2,l", 8, 0xcb, 0x95);
    await Z80Tester.TestWithTStates("res 2,(hl)", 8, 0xcb, 0x96);
    await Z80Tester.TestWithTStates("res 2,a", 8, 0xcb, 0x97);
    await Z80Tester.TestWithTStates("res 3,b", 8, 0xcb, 0x98);
    await Z80Tester.TestWithTStates("res 3,c", 8, 0xcb, 0x99);
    await Z80Tester.TestWithTStates("res 3,d", 8, 0xcb, 0x9a);
    await Z80Tester.TestWithTStates("res 3,e", 8, 0xcb, 0x9b);
    await Z80Tester.TestWithTStates("res 3,h", 8, 0xcb, 0x9c);
    await Z80Tester.TestWithTStates("res 3,l", 8, 0xcb, 0x9d);
    await Z80Tester.TestWithTStates("res 3,(hl)", 8, 0xcb, 0x9e);
    await Z80Tester.TestWithTStates("res 3,a", 8, 0xcb, 0x9f);
  });

  it("Bit instructions 0xA0-0xAF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 4,b", 8, 0xcb, 0xa0);
    await Z80Tester.TestWithTStates("res 4,c", 8, 0xcb, 0xa1);
    await Z80Tester.TestWithTStates("res 4,d", 8, 0xcb, 0xa2);
    await Z80Tester.TestWithTStates("res 4,e", 8, 0xcb, 0xa3);
    await Z80Tester.TestWithTStates("res 4,h", 8, 0xcb, 0xa4);
    await Z80Tester.TestWithTStates("res 4,l", 8, 0xcb, 0xa5);
    await Z80Tester.TestWithTStates("res 4,(hl)", 8, 0xcb, 0xa6);
    await Z80Tester.TestWithTStates("res 4,a", 8, 0xcb, 0xa7);
    await Z80Tester.TestWithTStates("res 5,b", 8, 0xcb, 0xa8);
    await Z80Tester.TestWithTStates("res 5,c", 8, 0xcb, 0xa9);
    await Z80Tester.TestWithTStates("res 5,d", 8, 0xcb, 0xaa);
    await Z80Tester.TestWithTStates("res 5,e", 8, 0xcb, 0xab);
    await Z80Tester.TestWithTStates("res 5,h", 8, 0xcb, 0xac);
    await Z80Tester.TestWithTStates("res 5,l", 8, 0xcb, 0xad);
    await Z80Tester.TestWithTStates("res 5,(hl)", 8, 0xcb, 0xae);
    await Z80Tester.TestWithTStates("res 5,a", 8, 0xcb, 0xaf);
  });

  it("Bit instructions 0xB0-0xBF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 6,b", 8, 0xcb, 0xb0);
    await Z80Tester.TestWithTStates("res 6,c", 8, 0xcb, 0xb1);
    await Z80Tester.TestWithTStates("res 6,d", 8, 0xcb, 0xb2);
    await Z80Tester.TestWithTStates("res 6,e", 8, 0xcb, 0xb3);
    await Z80Tester.TestWithTStates("res 6,h", 8, 0xcb, 0xb4);
    await Z80Tester.TestWithTStates("res 6,l", 8, 0xcb, 0xb5);
    await Z80Tester.TestWithTStates("res 6,(hl)", 8, 0xcb, 0xb6);
    await Z80Tester.TestWithTStates("res 6,a", 8, 0xcb, 0xb7);
    await Z80Tester.TestWithTStates("res 7,b", 8, 0xcb, 0xb8);
    await Z80Tester.TestWithTStates("res 7,c", 8, 0xcb, 0xb9);
    await Z80Tester.TestWithTStates("res 7,d", 8, 0xcb, 0xba);
    await Z80Tester.TestWithTStates("res 7,e", 8, 0xcb, 0xbb);
    await Z80Tester.TestWithTStates("res 7,h", 8, 0xcb, 0xbc);
    await Z80Tester.TestWithTStates("res 7,l", 8, 0xcb, 0xbd);
    await Z80Tester.TestWithTStates("res 7,(hl)", 8, 0xcb, 0xbe);
    await Z80Tester.TestWithTStates("res 7,a", 8, 0xcb, 0xbf);
  });

  it("Bit instructions 0xC0-0xCF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 0,b", 8, 0xcb, 0xc0);
    await Z80Tester.TestWithTStates("set 0,c", 8, 0xcb, 0xc1);
    await Z80Tester.TestWithTStates("set 0,d", 8, 0xcb, 0xc2);
    await Z80Tester.TestWithTStates("set 0,e", 8, 0xcb, 0xc3);
    await Z80Tester.TestWithTStates("set 0,h", 8, 0xcb, 0xc4);
    await Z80Tester.TestWithTStates("set 0,l", 8, 0xcb, 0xc5);
    await Z80Tester.TestWithTStates("set 0,(hl)", 8, 0xcb, 0xc6);
    await Z80Tester.TestWithTStates("set 0,a", 8, 0xcb, 0xc7);
    await Z80Tester.TestWithTStates("set 1,b", 8, 0xcb, 0xc8);
    await Z80Tester.TestWithTStates("set 1,c", 8, 0xcb, 0xc9);
    await Z80Tester.TestWithTStates("set 1,d", 8, 0xcb, 0xca);
    await Z80Tester.TestWithTStates("set 1,e", 8, 0xcb, 0xcb);
    await Z80Tester.TestWithTStates("set 1,h", 8, 0xcb, 0xcc);
    await Z80Tester.TestWithTStates("set 1,l", 8, 0xcb, 0xcd);
    await Z80Tester.TestWithTStates("set 1,(hl)", 8, 0xcb, 0xce);
    await Z80Tester.TestWithTStates("set 1,a", 8, 0xcb, 0xcf);
  });

  it("Bit instructions 0xD0-0xDF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 2,b", 8, 0xcb, 0xd0);
    await Z80Tester.TestWithTStates("set 2,c", 8, 0xcb, 0xd1);
    await Z80Tester.TestWithTStates("set 2,d", 8, 0xcb, 0xd2);
    await Z80Tester.TestWithTStates("set 2,e", 8, 0xcb, 0xd3);
    await Z80Tester.TestWithTStates("set 2,h", 8, 0xcb, 0xd4);
    await Z80Tester.TestWithTStates("set 2,l", 8, 0xcb, 0xd5);
    await Z80Tester.TestWithTStates("set 2,(hl)", 8, 0xcb, 0xd6);
    await Z80Tester.TestWithTStates("set 2,a", 8, 0xcb, 0xd7);
    await Z80Tester.TestWithTStates("set 3,b", 8, 0xcb, 0xd8);
    await Z80Tester.TestWithTStates("set 3,c", 8, 0xcb, 0xd9);
    await Z80Tester.TestWithTStates("set 3,d", 8, 0xcb, 0xda);
    await Z80Tester.TestWithTStates("set 3,e", 8, 0xcb, 0xdb);
    await Z80Tester.TestWithTStates("set 3,h", 8, 0xcb, 0xdc);
    await Z80Tester.TestWithTStates("set 3,l", 8, 0xcb, 0xdd);
    await Z80Tester.TestWithTStates("set 3,(hl)", 8, 0xcb, 0xde);
    await Z80Tester.TestWithTStates("set 3,a", 8, 0xcb, 0xdf);
  });

  it("Bit instructions 0xE0-0xEF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 4,b", 8, 0xcb, 0xe0);
    await Z80Tester.TestWithTStates("set 4,c", 8, 0xcb, 0xe1);
    await Z80Tester.TestWithTStates("set 4,d", 8, 0xcb, 0xe2);
    await Z80Tester.TestWithTStates("set 4,e", 8, 0xcb, 0xe3);
    await Z80Tester.TestWithTStates("set 4,h", 8, 0xcb, 0xe4);
    await Z80Tester.TestWithTStates("set 4,l", 8, 0xcb, 0xe5);
    await Z80Tester.TestWithTStates("set 4,(hl)", 8, 0xcb, 0xe6);
    await Z80Tester.TestWithTStates("set 4,a", 8, 0xcb, 0xe7);
    await Z80Tester.TestWithTStates("set 5,b", 8, 0xcb, 0xe8);
    await Z80Tester.TestWithTStates("set 5,c", 8, 0xcb, 0xe9);
    await Z80Tester.TestWithTStates("set 5,d", 8, 0xcb, 0xea);
    await Z80Tester.TestWithTStates("set 5,e", 8, 0xcb, 0xeb);
    await Z80Tester.TestWithTStates("set 5,h", 8, 0xcb, 0xec);
    await Z80Tester.TestWithTStates("set 5,l", 8, 0xcb, 0xed);
    await Z80Tester.TestWithTStates("set 5,(hl)", 8, 0xcb, 0xee);
    await Z80Tester.TestWithTStates("set 5,a", 8, 0xcb, 0xef);
  });

  it("Bit instructions 0xF0-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 6,b", 8, 0xcb, 0xf0);
    await Z80Tester.TestWithTStates("set 6,c", 8, 0xcb, 0xf1);
    await Z80Tester.TestWithTStates("set 6,d", 8, 0xcb, 0xf2);
    await Z80Tester.TestWithTStates("set 6,e", 8, 0xcb, 0xf3);
    await Z80Tester.TestWithTStates("set 6,h", 8, 0xcb, 0xf4);
    await Z80Tester.TestWithTStates("set 6,l", 8, 0xcb, 0xf5);
    await Z80Tester.TestWithTStates("set 6,(hl)", 8, 0xcb, 0xf6);
    await Z80Tester.TestWithTStates("set 6,a", 8, 0xcb, 0xf7);
    await Z80Tester.TestWithTStates("set 7,b", 8, 0xcb, 0xf8);
    await Z80Tester.TestWithTStates("set 7,c", 8, 0xcb, 0xf9);
    await Z80Tester.TestWithTStates("set 7,d", 8, 0xcb, 0xfa);
    await Z80Tester.TestWithTStates("set 7,e", 8, 0xcb, 0xfb);
    await Z80Tester.TestWithTStates("set 7,h", 8, 0xcb, 0xfc);
    await Z80Tester.TestWithTStates("set 7,l", 8, 0xcb, 0xfd);
    await Z80Tester.TestWithTStates("set 7,(hl)", 8, 0xcb, 0xfe);
    await Z80Tester.TestWithTStates("set 7,a", 8, 0xcb, 0xff);
  });
});
