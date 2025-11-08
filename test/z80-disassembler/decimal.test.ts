import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";

describe("Disassembler - decimal", function () {
  it("Standard instructions 0x00-0x0F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithDecimal("ld bc,4660", 0x01, 0x34, 0x12);
    await Z80Tester.TestWithDecimal("ld b,35", 0x06, 0x23);
    await Z80Tester.TestWithDecimal("djnz L00002", 0x10, 0x00);
    await Z80Tester.TestWithDecimal("djnz L00034", 0x10, 0x20);
    await Z80Tester.TestWithDecimal("djnz L65522", 0x10, 0xf0);
    await Z80Tester.TestWithDecimal("ld (13398),hl", 0x22, 0x56, 0x34);
    await Z80Tester.TestWithDecimal("jp L22136", 0xc3, 0x78, 0x56);
    await Z80Tester.TestWithDecimal("rst 8", 0xcf);
    await Z80Tester.TestWithDecimal("out (120),a", 0xd3, 0x78);
    await Z80Tester.TestWithDecimal("in a,(120)", 0xdb, 0x78);
    await Z80Tester.TestWithDecimal("rst 24", 0xdf);
    await Z80Tester.TestWithDecimal("and 52", 0xe6, 0x34);
    await Z80Tester.TestWithDecimal("rst 32", 0xe7);
    await Z80Tester.TestWithDecimal("ld (48282),bc", 0xed, 0x43, 0x9a, 0xbc);
    await Z80Tester.TestWithDecimal("ld bc,(48282)", 0xed, 0x4b, 0x9a, 0xbc);
    await Z80Tester.TestWithDecimal("rlc (ix+61),b", 0xdd, 0xcb, 0x3d, 0x00);
    await Z80Tester.TestWithDecimal("rlc (ix-100),b", 0xdd, 0xcb, 0x9c, 0x00);
    await Z80Tester.TestWithDecimal("ld (ix+61),18", 0xdd, 0x36, 0x3d, 0x12);
    await Z80Tester.TestWithDecimal("ld (ix-81),18", 0xdd, 0x36, 0xaf, 0x12);
  });
});
