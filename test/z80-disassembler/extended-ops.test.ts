import { Z80Tester } from "./z80-tester";

describe("Disassembler - extended instructions", function () {
  this.timeout(10000);

  it("Next extended instructions work as expected", async () => {
    // --- Act
    await Z80Tester.TestExt("swapnib", 0xed, 0x23);
    await Z80Tester.Test("nop", 0xed, 0x23);

    await Z80Tester.TestExt("mirror a", 0xed, 0x24);
    await Z80Tester.Test("nop", 0xed, 0x24);

    await Z80Tester.TestExt("test $C4", 0xed, 0x27, 0xc4);
    await Z80Tester.Test("nop", 0xed, 0x27);

    await Z80Tester.TestExt("bsla de,b", 0xed, 0x28);
    await Z80Tester.Test("nop", 0xed, 0x28);

    await Z80Tester.TestExt("bsra de,b", 0xed, 0x29);
    await Z80Tester.Test("nop", 0xed, 0x29);

    await Z80Tester.TestExt("bsrl de,b", 0xed, 0x2a);
    await Z80Tester.Test("nop", 0xed, 0x2a);

    await Z80Tester.TestExt("bsrf de,b", 0xed, 0x2b);
    await Z80Tester.Test("nop", 0xed, 0x2b);

    await Z80Tester.TestExt("brlc de,b", 0xed, 0x2c);
    await Z80Tester.Test("nop", 0xed, 0x2c);

    await Z80Tester.TestExt("mul d,e", 0xed, 0x30);
    await Z80Tester.Test("nop", 0xed, 0x30);

    await Z80Tester.TestExt("add hl,a", 0xed, 0x31);
    await Z80Tester.Test("nop", 0xed, 0x31);

    await Z80Tester.TestExt("add de,a", 0xed, 0x32);
    await Z80Tester.Test("nop", 0xed, 0x32);

    await Z80Tester.TestExt("add bc,a", 0xed, 0x33);
    await Z80Tester.Test("nop", 0xed, 0x33);

    await Z80Tester.TestExt("add hl,$789A", 0xed, 0x34, 0x9a, 0x78);
    await Z80Tester.Test("nop", 0xed, 0x34);

    await Z80Tester.TestExt("add de,$789A", 0xed, 0x35, 0x9a, 0x78);
    await Z80Tester.Test("nop", 0xed, 0x35);

    await Z80Tester.TestExt("add bc,$789A", 0xed, 0x36, 0x9a, 0x78);
    await Z80Tester.Test("nop", 0xed, 0x36);

    await Z80Tester.TestExt("push $34AF", 0xed, 0x8a, 0x34, 0xaf);
    await Z80Tester.Test("nop", 0xed, 0x8a);

    await Z80Tester.TestExt("outinb", 0xed, 0x90);
    await Z80Tester.Test("nop", 0xed, 0x90);

    await Z80Tester.TestExt("nextreg $34,$56", 0xed, 0x91, 0x34, 0x56);
    await Z80Tester.Test("nop", 0xed, 0x91);

    await Z80Tester.TestExt("nextreg $34,a", 0xed, 0x92, 0x34);
    await Z80Tester.Test("nop", 0xed, 0x92);

    await Z80Tester.TestExt("pixeldn", 0xed, 0x93);
    await Z80Tester.Test("nop", 0xed, 0x93);

    await Z80Tester.TestExt("pixelad", 0xed, 0x94);
    await Z80Tester.Test("nop", 0xed, 0x94);

    await Z80Tester.TestExt("setae", 0xed, 0x95);
    await Z80Tester.Test("nop", 0xed, 0x95);

    await Z80Tester.TestExt("jp (c)", 0xed, 0x98);
    await Z80Tester.Test("nop", 0xed, 0x98);

    await Z80Tester.TestExt("ldix", 0xed, 0xa4);
    await Z80Tester.Test("nop", 0xed, 0xa4);

    await Z80Tester.TestExt("ldws", 0xed, 0xa5);
    await Z80Tester.Test("nop", 0xed, 0xa5);

    await Z80Tester.TestExt("lddx", 0xed, 0xac);
    await Z80Tester.Test("nop", 0xed, 0xac);

    await Z80Tester.TestExt("ldirx", 0xed, 0xb4);
    await Z80Tester.Test("nop", 0xed, 0xb4);

    await Z80Tester.TestExt("ldpirx", 0xed, 0xb7);
    await Z80Tester.Test("nop", 0xed, 0xb7);

    await Z80Tester.TestExt("lddrx", 0xed, 0xbc);
    await Z80Tester.Test("nop", 0xed, 0xbc);
  });

  it("Extended instructions 0x40-0x4F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("in b,(c)", 0xed, 0x40);
    await Z80Tester.Test("out (c),b", 0xed, 0x41);
    await Z80Tester.Test("sbc hl,bc", 0xed, 0x42);
    await Z80Tester.Test("ld ($BC9A),bc", 0xed, 0x43, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x44);
    await Z80Tester.Test("retn", 0xed, 0x45);
    await Z80Tester.Test("im 0", 0xed, 0x46);
    await Z80Tester.Test("ld i,a", 0xed, 0x47);
    await Z80Tester.Test("in c,(c)", 0xed, 0x48);
    await Z80Tester.Test("out (c),c", 0xed, 0x49);
    await Z80Tester.Test("adc hl,bc", 0xed, 0x4a);
    await Z80Tester.Test("ld bc,($BC9A)", 0xed, 0x4b, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x4c);
    await Z80Tester.Test("reti", 0xed, 0x4d);
    await Z80Tester.Test("im 0", 0xed, 0x4e);
    await Z80Tester.Test("ld r,a", 0xed, 0x4f);
  });

  it("Extended instructions 0x50-0x5F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("in d,(c)", 0xed, 0x50);
    await Z80Tester.Test("out (c),d", 0xed, 0x51);
    await Z80Tester.Test("sbc hl,de", 0xed, 0x52);
    await Z80Tester.Test("ld ($BC9A),de", 0xed, 0x53, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x54);
    await Z80Tester.Test("retn", 0xed, 0x55);
    await Z80Tester.Test("im 1", 0xed, 0x56);
    await Z80Tester.Test("ld a,i", 0xed, 0x57);
    await Z80Tester.Test("in e,(c)", 0xed, 0x58);
    await Z80Tester.Test("out (c),e", 0xed, 0x59);
    await Z80Tester.Test("adc hl,de", 0xed, 0x5a);
    await Z80Tester.Test("ld de,($BC9A)", 0xed, 0x5b, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x5c);
    await Z80Tester.Test("retn", 0xed, 0x5d);
    await Z80Tester.Test("im 2", 0xed, 0x5e);
    await Z80Tester.Test("ld a,r", 0xed, 0x5f);
  });

  it("Extended instructions 0x60-0x6F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("in h,(c)", 0xed, 0x60);
    await Z80Tester.Test("out (c),h", 0xed, 0x61);
    await Z80Tester.Test("sbc hl,hl", 0xed, 0x62);
    await Z80Tester.Test("ld ($BC9A),hl", 0xed, 0x63, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x64);
    await Z80Tester.Test("retn", 0xed, 0x65);
    await Z80Tester.Test("im 0", 0xed, 0x66);
    await Z80Tester.Test("rrd", 0xed, 0x67);
    await Z80Tester.Test("in l,(c)", 0xed, 0x68);
    await Z80Tester.Test("out (c),l", 0xed, 0x69);
    await Z80Tester.Test("adc hl,hl", 0xed, 0x6a);
    await Z80Tester.Test("ld hl,($BC9A)", 0xed, 0x6b, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x6c);
    await Z80Tester.Test("retn", 0xed, 0x6d);
    await Z80Tester.Test("im 0", 0xed, 0x6e);
    await Z80Tester.Test("rld", 0xed, 0x6f);
  });

  it("Extended instructions 0x70-0x7F work as expected", async () => {
    // --- Act
    await Z80Tester.Test("in (c)", 0xed, 0x70);
    await Z80Tester.Test("out (c),0", 0xed, 0x71);
    await Z80Tester.Test("sbc hl,sp", 0xed, 0x72);
    await Z80Tester.Test("ld ($BC9A),sp", 0xed, 0x73, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x74);
    await Z80Tester.Test("retn", 0xed, 0x75);
    await Z80Tester.Test("im 1", 0xed, 0x76);
    await Z80Tester.Test("nop", 0xed, 0x77);
    await Z80Tester.Test("in a,(c)", 0xed, 0x78);
    await Z80Tester.Test("out (c),a", 0xed, 0x79);
    await Z80Tester.Test("adc hl,sp", 0xed, 0x7a);
    await Z80Tester.Test("ld sp,($BC9A)", 0xed, 0x7b, 0x9a, 0xbc);
    await Z80Tester.Test("neg", 0xed, 0x7c);
    await Z80Tester.Test("retn", 0xed, 0x7d);
    await Z80Tester.Test("im 2", 0xed, 0x7e);
    await Z80Tester.Test("nop", 0xed, 0x7f);
  });

  it("Extended instructions 0xA0-0xAF work as expected", async () => {
    // --- Act
    await Z80Tester.Test("ldi", 0xed, 0xa0);
    await Z80Tester.Test("cpi", 0xed, 0xa1);
    await Z80Tester.Test("ini", 0xed, 0xa2);
    await Z80Tester.Test("outi", 0xed, 0xa3);
    await Z80Tester.Test("nop", 0xed, 0xa4);
    await Z80Tester.Test("nop", 0xed, 0xa5);
    await Z80Tester.Test("nop", 0xed, 0xa6);
    await Z80Tester.Test("nop", 0xed, 0xa7);
    await Z80Tester.Test("ldd", 0xed, 0xa8);
    await Z80Tester.Test("cpd", 0xed, 0xa9);
    await Z80Tester.Test("ind", 0xed, 0xaa);
    await Z80Tester.Test("outd", 0xed, 0xab);
    await Z80Tester.Test("nop", 0xed, 0xac);
    await Z80Tester.Test("nop", 0xed, 0xad);
    await Z80Tester.Test("nop", 0xed, 0xae);
    await Z80Tester.Test("nop", 0xed, 0xaf);
  });

  it("Extended instructions 0xB0-0xBF work as expected", async () => {
    // --- Act
    await Z80Tester.Test("ldir", 0xed, 0xb0);
    await Z80Tester.Test("cpir", 0xed, 0xb1);
    await Z80Tester.Test("inir", 0xed, 0xb2);
    await Z80Tester.Test("otir", 0xed, 0xb3);
    await Z80Tester.Test("nop", 0xed, 0xb4);
    await Z80Tester.Test("nop", 0xed, 0xb5);
    await Z80Tester.Test("nop", 0xed, 0xb6);
    await Z80Tester.Test("nop", 0xed, 0xb7);
    await Z80Tester.Test("lddr", 0xed, 0xb8);
    await Z80Tester.Test("cpdr", 0xed, 0xb9);
    await Z80Tester.Test("indr", 0xed, 0xba);
    await Z80Tester.Test("otdr", 0xed, 0xbb);
    await Z80Tester.Test("nop", 0xed, 0xbc);
    await Z80Tester.Test("nop", 0xed, 0xbd);
    await Z80Tester.Test("nop", 0xed, 0xbe);
    await Z80Tester.Test("nop", 0xed, 0xbf);
  });

  for (let op = 0x00; op < 0x40; op++) {
    it(`Invalid extended instruction 0x${op.toString(
      16
    )} work as NOP`, async () => {
      await Z80Tester.Test("nop", 0xed, op);
    });
  }

  for (let op = 0xc0; op < 0x100; op++) {
    it(`Invalid extended instruction 0x${op.toString(
      16
    )} work as NOP`, async () => {
      await Z80Tester.Test("nop", 0xed, op);
    });
  }
});
