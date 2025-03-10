import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";

describe("Disassembler - IY bit instructions", function () {
  it("Bit instructions 0x00-0x0F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("rlc (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x00);
    await Z80Tester.TestWithTStates("rlc (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x01);
    await Z80Tester.TestWithTStates("rlc (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x02);
    await Z80Tester.TestWithTStates("rlc (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x03);
    await Z80Tester.TestWithTStates("rlc (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x04);
    await Z80Tester.TestWithTStates("rlc (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x05);
    await Z80Tester.TestWithTStates("rlc (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x06);
    await Z80Tester.TestWithTStates("rlc (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x07);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x08);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x09);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x0a);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x0b);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x0c);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x0d);
    await Z80Tester.TestWithTStates("rrc (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x0e);
    await Z80Tester.TestWithTStates("rrc (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x0f);
  });

  it("Bit instructions 0x10-0x1F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("rl (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x10);
    await Z80Tester.TestWithTStates("rl (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x11);
    await Z80Tester.TestWithTStates("rl (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x12);
    await Z80Tester.TestWithTStates("rl (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x13);
    await Z80Tester.TestWithTStates("rl (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x14);
    await Z80Tester.TestWithTStates("rl (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x15);
    await Z80Tester.TestWithTStates("rl (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x16);
    await Z80Tester.TestWithTStates("rl (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x17);
    await Z80Tester.TestWithTStates("rr (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x18);
    await Z80Tester.TestWithTStates("rr (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x19);
    await Z80Tester.TestWithTStates("rr (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x1a);
    await Z80Tester.TestWithTStates("rr (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x1b);
    await Z80Tester.TestWithTStates("rr (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x1c);
    await Z80Tester.TestWithTStates("rr (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x1d);
    await Z80Tester.TestWithTStates("rr (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x1e);
    await Z80Tester.TestWithTStates("rr (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x1f);
  });

  it("Bit instructions 0x20-0x2F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("sla (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x20);
    await Z80Tester.TestWithTStates("sla (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x21);
    await Z80Tester.TestWithTStates("sla (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x22);
    await Z80Tester.TestWithTStates("sla (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x23);
    await Z80Tester.TestWithTStates("sla (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x24);
    await Z80Tester.TestWithTStates("sla (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x25);
    await Z80Tester.TestWithTStates("sla (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x26);
    await Z80Tester.TestWithTStates("sla (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x27);
    await Z80Tester.TestWithTStates("sra (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x28);
    await Z80Tester.TestWithTStates("sra (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x29);
    await Z80Tester.TestWithTStates("sra (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x2a);
    await Z80Tester.TestWithTStates("sra (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x2b);
    await Z80Tester.TestWithTStates("sra (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x2c);
    await Z80Tester.TestWithTStates("sra (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x2d);
    await Z80Tester.TestWithTStates("sra (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x2e);
    await Z80Tester.TestWithTStates("sra (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x2f);
  });

  it("Bit instructions 0x30-0x3F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("sll (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x30);
    await Z80Tester.TestWithTStates("sll (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x31);
    await Z80Tester.TestWithTStates("sll (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x32);
    await Z80Tester.TestWithTStates("sll (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x33);
    await Z80Tester.TestWithTStates("sll (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x34);
    await Z80Tester.TestWithTStates("sll (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x35);
    await Z80Tester.TestWithTStates("sll (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x36);
    await Z80Tester.TestWithTStates("sll (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x37);
    await Z80Tester.TestWithTStates("srl (iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x38);
    await Z80Tester.TestWithTStates("srl (iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x39);
    await Z80Tester.TestWithTStates("srl (iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x3a);
    await Z80Tester.TestWithTStates("srl (iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x3b);
    await Z80Tester.TestWithTStates("srl (iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x3c);
    await Z80Tester.TestWithTStates("srl (iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x3d);
    await Z80Tester.TestWithTStates("srl (iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x3e);
    await Z80Tester.TestWithTStates("srl (iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x3f);
  });

  it("Bit instructions 0x40-0x4F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x40);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x41);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x42);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x43);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x44);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x45);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x46);
    await Z80Tester.TestWithTStates("bit 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x47);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x48);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x49);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x4a);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x4b);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x4c);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x4d);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x4e);
    await Z80Tester.TestWithTStates("bit 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x4f);
  });

  it("Bit instructions 0x50-0x5F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x50);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x51);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x52);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x53);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x54);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x55);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x56);
    await Z80Tester.TestWithTStates("bit 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x57);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x58);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x59);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x5a);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x5b);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x5c);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x5d);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x5e);
    await Z80Tester.TestWithTStates("bit 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x5f);
  });

  it("Bit instructions 0x60-0x6F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x60);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x61);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x62);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x63);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x64);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x65);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x66);
    await Z80Tester.TestWithTStates("bit 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x67);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x68);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x69);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x6a);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x6b);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x6c);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x6d);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x6e);
    await Z80Tester.TestWithTStates("bit 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x6f);
  });

  it("Bit instructions 0x70-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x70);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x71);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x72);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x73);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x74);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x75);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x76);
    await Z80Tester.TestWithTStates("bit 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x77);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x78);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x79);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x7a);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x7b);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x7c);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x7d);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x7e);
    await Z80Tester.TestWithTStates("bit 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x7f);
  });

  it("Bit instructions 0x80-0x8F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x80);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x81);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x82);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x83);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x84);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x85);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x86);
    await Z80Tester.TestWithTStates("res 0,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x87);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x88);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x89);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x8a);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x8b);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x8c);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x8d);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x8e);
    await Z80Tester.TestWithTStates("res 1,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x8f);
  });

  it("Bit instructions 0x90-0x9F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x90);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x91);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x92);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x93);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x94);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x95);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x96);
    await Z80Tester.TestWithTStates("res 2,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x97);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0x98);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0x99);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0x9a);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0x9b);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0x9c);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0x9d);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0x9e);
    await Z80Tester.TestWithTStates("res 3,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0x9f);
  });

  it("Bit instructions 0xA0-0xAF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xa0);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xa1);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xa2);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xa3);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xa4);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xa5);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xa6);
    await Z80Tester.TestWithTStates("res 4,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xa7);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xa8);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xa9);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xaa);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xab);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xac);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xad);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xae);
    await Z80Tester.TestWithTStates("res 5,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xaf);
  });

  it("Bit instructions 0xB0-0xBF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xb0);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xb1);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xb2);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xb3);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xb4);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xb5);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xb6);
    await Z80Tester.TestWithTStates("res 6,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xb7);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xb8);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xb9);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xba);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xbb);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xbc);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xbd);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xbe);
    await Z80Tester.TestWithTStates("res 7,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xbf);
  });

  it("Bit instructions 0xC0-0xCF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xc0);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xc1);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xc2);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xc3);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xc4);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xc5);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xc6);
    await Z80Tester.TestWithTStates("set 0,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xc7);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xc8);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xc9);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xca);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xcb);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xcc);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xcd);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xce);
    await Z80Tester.TestWithTStates("set 1,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xcf);
  });

  it("Bit instructions 0xD0-0xDF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xd0);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xd1);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xd2);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xd3);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xd4);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xd5);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xd6);
    await Z80Tester.TestWithTStates("set 2,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xd7);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xd8);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xd9);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xda);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xdb);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xdc);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xdd);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xde);
    await Z80Tester.TestWithTStates("set 3,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xdf);
  });

  it("Bit instructions 0xD0-0xDF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xe0);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xe1);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xe2);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xe3);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xe4);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xe5);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xe6);
    await Z80Tester.TestWithTStates("set 4,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xe7);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xe8);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xe9);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xea);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xeb);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xec);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xed);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xee);
    await Z80Tester.TestWithTStates("set 5,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xef);
  });

  it("Bit instructions 0xF0-0xFF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xf0);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xf1);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xf2);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xf3);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xf4);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xf5);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xf6);
    await Z80Tester.TestWithTStates("set 6,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xf7);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),b", 12, 0xfd, 0xcb, 0x3d, 0xf8);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),c", 12, 0xfd, 0xcb, 0x3d, 0xf9);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),d", 12, 0xfd, 0xcb, 0x3d, 0xfa);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),e", 12, 0xfd, 0xcb, 0x3d, 0xfb);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),h", 12, 0xfd, 0xcb, 0x3d, 0xfc);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),l", 12, 0xfd, 0xcb, 0x3d, 0xfd);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D)", 12, 0xfd, 0xcb, 0x3d, 0xfe);
    await Z80Tester.TestWithTStates("set 7,(iy+$3D),a", 12, 0xfd, 0xcb, 0x3d, 0xff);
  });
});
