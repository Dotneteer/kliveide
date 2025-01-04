import { describe, it } from "vitest";
import { Z80Tester } from "./z80-tester";
import { getNextRegisters } from "@emu/machines/zxNext/NextRegDevice";

describe("Disassembler - extended instructions", function () {
  it("Next extended instructions work as expected", async () => {
    // --- Act
    await Z80Tester.TestExtWithTStates("swapnib", 8, 0xed, 0x23);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x23);

    await Z80Tester.TestExtWithTStates("mirror a", 8, 0xed, 0x24);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x24);

    await Z80Tester.TestExtWithTStates("test $C4", 11, 0xed, 0x27, 0xc4);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x27);

    await Z80Tester.TestExtWithTStates("bsla de,b", 8, 0xed, 0x28);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x28);

    await Z80Tester.TestExtWithTStates("bsra de,b", 8, 0xed, 0x29);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x29);

    await Z80Tester.TestExtWithTStates("bsrl de,b", 8, 0xed, 0x2a);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x2a);

    await Z80Tester.TestExtWithTStates("bsrf de,b", 8, 0xed, 0x2b);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x2b);

    await Z80Tester.TestExtWithTStates("brlc de,b", 8, 0xed, 0x2c);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x2c);

    await Z80Tester.TestExtWithTStates("mul d,e", 8, 0xed, 0x30);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x30);

    await Z80Tester.TestExtWithTStates("add hl,a", 8, 0xed, 0x31);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x31);

    await Z80Tester.TestExtWithTStates("add de,a", 8, 0xed, 0x32);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x32);

    await Z80Tester.TestExtWithTStates("add bc,a", 8, 0xed, 0x33);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x33);

    await Z80Tester.TestExtWithTStates("add hl,$789A", 16, 0xed, 0x34, 0x9a, 0x78);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x34);

    await Z80Tester.TestExtWithTStates("add de,$789A", 16, 0xed, 0x35, 0x9a, 0x78);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x35);

    await Z80Tester.TestExtWithTStates("add bc,$789A", 16, 0xed, 0x36, 0x9a, 0x78);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x36);

    await Z80Tester.TestExtWithTStates("push $34AF", 23, 0xed, 0x8a, 0x34, 0xaf);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x8a);

    await Z80Tester.TestExtWithTStates("outinb", 16, 0xed, 0x90);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x90);

    await Z80Tester.TestExtWithTStates("nextreg $34,$56", 20, 0xed, 0x91, 0x34, 0x56);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x91);

    await Z80Tester.TestExtWithTStates("nextreg $34,a", 17, 0xed, 0x92, 0x34);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x92);

    await Z80Tester.TestExtWithTStates("pixeldn", 8, 0xed, 0x93);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x93);

    await Z80Tester.TestExtWithTStates("pixelad", 8, 0xed, 0x94);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x94);

    await Z80Tester.TestExtWithTStates("setae", 8, 0xed, 0x95);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x95);

    await Z80Tester.TestExtWithTStates("jp (c)", 13, 0xed, 0x98);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x98);

    await Z80Tester.TestExtWithTStates("ldix", 16, 0xed, 0xa4);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xa4);

    await Z80Tester.TestExtWithTStates("ldws", 14, 0xed, 0xa5);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xa5);

    await Z80Tester.TestExtWithTStates("lddx", 16, 0xed, 0xac);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xac);

    await Z80Tester.TestExtWithTStates("ldirx", [21, 16], 0xed, 0xb4);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xb4);

    await Z80Tester.TestExtWithTStates("ldpirx", [21, 16], 0xed, 0xb7);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xb7);

    await Z80Tester.TestExtWithTStates("lddrx", [21, 16], 0xed, 0xbc);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xbc);
  });

  it("Extended instructions 0x40-0x4F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("in b,(c)", 12, 0xed, 0x40);
    await Z80Tester.TestWithTStates("out (c),b", 12, 0xed, 0x41);
    await Z80Tester.TestWithTStates("sbc hl,bc", 15, 0xed, 0x42);
    await Z80Tester.TestWithTStates("ld ($BC9A),bc", 20, 0xed, 0x43, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x44);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x45);
    await Z80Tester.TestWithTStates("im 0", 8, 0xed, 0x46);
    await Z80Tester.TestWithTStates("ld i,a", 9, 0xed, 0x47);
    await Z80Tester.TestWithTStates("in c,(c)", 12, 0xed, 0x48);
    await Z80Tester.TestWithTStates("out (c),c", 12, 0xed, 0x49);
    await Z80Tester.TestWithTStates("adc hl,bc", 15, 0xed, 0x4a);
    await Z80Tester.TestWithTStates("ld bc,($BC9A)", 20, 0xed, 0x4b, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x4c);
    await Z80Tester.TestWithTStates("reti", 14, 0xed, 0x4d);
    await Z80Tester.TestWithTStates("im 0", 8, 0xed, 0x4e);
    await Z80Tester.TestWithTStates("ld r,a", 9, 0xed, 0x4f);
  });

  it("Extended instructions 0x50-0x5F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("in d,(c)", 12, 0xed, 0x50);
    await Z80Tester.TestWithTStates("out (c),d", 12, 0xed, 0x51);
    await Z80Tester.TestWithTStates("sbc hl,de", 15, 0xed, 0x52);
    await Z80Tester.TestWithTStates("ld ($BC9A),de", 20, 0xed, 0x53, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x54);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x55);
    await Z80Tester.TestWithTStates("im 1", 8, 0xed, 0x56);
    await Z80Tester.TestWithTStates("ld a,i", 9, 0xed, 0x57);
    await Z80Tester.TestWithTStates("in e,(c)", 12, 0xed, 0x58);
    await Z80Tester.TestWithTStates("out (c),e", 12, 0xed, 0x59);
    await Z80Tester.TestWithTStates("adc hl,de", 15, 0xed, 0x5a);
    await Z80Tester.TestWithTStates("ld de,($BC9A)", 20, 0xed, 0x5b, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x5c);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x5d);
    await Z80Tester.TestWithTStates("im 2", 8, 0xed, 0x5e);
    await Z80Tester.TestWithTStates("ld a,r", 9, 0xed, 0x5f);
  });

  it("Extended instructions 0x60-0x6F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("in h,(c)", 12, 0xed, 0x60);
    await Z80Tester.TestWithTStates("out (c),h", 12, 0xed, 0x61);
    await Z80Tester.TestWithTStates("sbc hl,hl", 15, 0xed, 0x62);
    await Z80Tester.TestWithTStates("ld ($BC9A),hl", 20, 0xed, 0x63, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x64);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x65);
    await Z80Tester.TestWithTStates("im 0", 8, 0xed, 0x66);
    await Z80Tester.TestWithTStates("rrd", 18, 0xed, 0x67);
    await Z80Tester.TestWithTStates("in l,(c)", 12, 0xed, 0x68);
    await Z80Tester.TestWithTStates("out (c),l", 12, 0xed, 0x69);
    await Z80Tester.TestWithTStates("adc hl,hl", 15, 0xed, 0x6a);
    await Z80Tester.TestWithTStates("ld hl,($BC9A)", 20, 0xed, 0x6b, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x6c);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x6d);
    await Z80Tester.TestWithTStates("im 0", 8, 0xed, 0x6e);
    await Z80Tester.TestWithTStates("rld", 18, 0xed, 0x6f);
  });

  it("Extended instructions 0x70-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("in (c)", 12, 0xed, 0x70);
    await Z80Tester.TestWithTStates("out (c),0", 12, 0xed, 0x71);
    await Z80Tester.TestWithTStates("sbc hl,sp", 15, 0xed, 0x72);
    await Z80Tester.TestWithTStates("ld ($BC9A),sp", 20, 0xed, 0x73, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x74);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x75);
    await Z80Tester.TestWithTStates("im 1", 8, 0xed, 0x76);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x77);
    await Z80Tester.TestWithTStates("in a,(c)", 12, 0xed, 0x78);
    await Z80Tester.TestWithTStates("out (c),a", 12, 0xed, 0x79);
    await Z80Tester.TestWithTStates("adc hl,sp", 15, 0xed, 0x7a);
    await Z80Tester.TestWithTStates("ld sp,($BC9A)", 20, 0xed, 0x7b, 0x9a, 0xbc);
    await Z80Tester.TestWithTStates("neg", 8, 0xed, 0x7c);
    await Z80Tester.TestWithTStates("retn", 14, 0xed, 0x7d);
    await Z80Tester.TestWithTStates("im 2", 8, 0xed, 0x7e);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0x7f);
  });

  it("Extended instructions 0xA0-0xAF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ldi", 16, 0xed, 0xa0);
    await Z80Tester.TestWithTStates("cpi", 16, 0xed, 0xa1);
    await Z80Tester.TestWithTStates("ini", 16, 0xed, 0xa2);
    await Z80Tester.TestWithTStates("outi", 16, 0xed, 0xa3);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xa4);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xa5);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xa6);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xa7);
    await Z80Tester.TestWithTStates("ldd", 16, 0xed, 0xa8);
    await Z80Tester.TestWithTStates("cpd", 16, 0xed, 0xa9);
    await Z80Tester.TestWithTStates("ind", 16, 0xed, 0xaa);
    await Z80Tester.TestWithTStates("outd", 16, 0xed, 0xab);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xac);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xad);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xae);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xaf);
  });

  it("Extended instructions 0xB0-0xBF work as expected", async () => {
    // --- Act
    await Z80Tester.TestWithTStates("ldir", [21, 16], 0xed, 0xb0);
    await Z80Tester.TestWithTStates("cpir", [21, 16], 0xed, 0xb1);
    await Z80Tester.TestWithTStates("inir", [21, 16], 0xed, 0xb2);
    await Z80Tester.TestWithTStates("otir", [21, 16], 0xed, 0xb3);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xb4);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xb5);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xb6);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xb7);
    await Z80Tester.TestWithTStates("lddr", [21, 16], 0xed, 0xb8);
    await Z80Tester.TestWithTStates("cpdr", [21, 16], 0xed, 0xb9);
    await Z80Tester.TestWithTStates("indr", [21, 16], 0xed, 0xba);
    await Z80Tester.TestWithTStates("otdr", [21, 16], 0xed, 0xbb);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xbc);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xbd);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xbe);
    await Z80Tester.TestWithTStates("nop", 8, 0xed, 0xbf);
  });

  for (let op = 0x00; op < 0x40; op++) {
    it(`Invalid extended instruction 0x${op.toString(16)} work as NOP`, async () => {
      await Z80Tester.TestWithTStates("nop", 8, 0xed, op);
    });
  }

  for (let op = 0xc0; op < 0x100; op++) {
    it(`Invalid extended instruction 0x${op.toString(16)} work as NOP`, async () => {
      await Z80Tester.TestWithTStates("nop", 8, 0xed, op);
    });
  }

  const nextRegs = getNextRegisters();
  nextRegs.forEach((reg, idx) => {
    it(`nextreg N,N comment with reg #${idx}`, async () => {
      if (reg.id !== undefined) {
        await Z80Tester.TestExtComment(reg.description, 0xed, 0x91, reg.id, 0x56);
      }
    });

    it(`nextreg N,a comment with reg #${idx}`, async () => {
      if (reg.id !== undefined) {
        await Z80Tester.TestExtComment(reg.description, 0xed, 0x92, reg.id);
      }
    });
  });
});
