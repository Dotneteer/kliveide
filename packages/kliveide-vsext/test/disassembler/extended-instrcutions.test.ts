import { Z80Tester } from "./z80-tester";

describe("Disassembler - extended instructions", () => {
  it("Next extended instructions work as expected", () => {
    // --- Act
    Z80Tester.TestExt("swapnib", 0xed, 0x23);
    Z80Tester.Test("nop", 0xed, 0x23);

    Z80Tester.TestExt("mirror a", 0xed, 0x24);
    Z80Tester.Test("nop", 0xed, 0x24);

    Z80Tester.TestExt("mirror de", 0xed, 0x26);
    Z80Tester.Test("nop", 0xed, 0x26);

    Z80Tester.TestExt("test #C4", 0xed, 0x27, 0xc4);
    Z80Tester.Test("nop", 0xed, 0x27);

    Z80Tester.TestExt("mul", 0xed, 0x30);
    Z80Tester.Test("nop", 0xed, 0x30);

    Z80Tester.TestExt("add hl,a", 0xed, 0x31);
    Z80Tester.Test("nop", 0xed, 0x31);

    Z80Tester.TestExt("add de,a", 0xed, 0x32);
    Z80Tester.Test("nop", 0xed, 0x32);

    Z80Tester.TestExt("add bc,a", 0xed, 0x33);
    Z80Tester.Test("nop", 0xed, 0x33);

    Z80Tester.TestExt("add hl,#789A", 0xed, 0x34, 0x9a, 0x78);
    Z80Tester.Test("nop", 0xed, 0x34);

    Z80Tester.TestExt("add de,#789A", 0xed, 0x35, 0x9a, 0x78);
    Z80Tester.Test("nop", 0xed, 0x35);

    Z80Tester.TestExt("add bc,#789A", 0xed, 0x36, 0x9a, 0x78);
    Z80Tester.Test("nop", 0xed, 0x36);

    Z80Tester.TestExt("push #34AF", 0xed, 0x8a, 0xaf, 0x34);
    Z80Tester.Test("nop", 0xed, 0x8a);

    Z80Tester.TestExt("outinb", 0xed, 0x90);
    Z80Tester.Test("nop", 0xed, 0x90);

    Z80Tester.TestExt("nextreg #34,#56", 0xed, 0x91, 0x34, 0x56);
    Z80Tester.Test("nop", 0xed, 0x91);

    Z80Tester.TestExt("nextreg #34,a", 0xed, 0x92, 0x34);
    Z80Tester.Test("nop", 0xed, 0x92);

    Z80Tester.TestExt("pixeldn", 0xed, 0x93);
    Z80Tester.Test("nop", 0xed, 0x93);

    Z80Tester.TestExt("pixelad", 0xed, 0x94);
    Z80Tester.Test("nop", 0xed, 0x94);

    Z80Tester.TestExt("setae", 0xed, 0x95);
    Z80Tester.Test("nop", 0xed, 0x95);

    Z80Tester.TestExt("ldix", 0xed, 0xa4);
    Z80Tester.Test("nop", 0xed, 0xa4);

    Z80Tester.TestExt("lddx", 0xed, 0xac);
    Z80Tester.Test("nop", 0xed, 0xac);

    Z80Tester.TestExt("ldirx", 0xed, 0xb4);
    Z80Tester.Test("nop", 0xed, 0xb4);

    Z80Tester.TestExt("lddrx", 0xed, 0xbc);
    Z80Tester.Test("nop", 0xed, 0xbc);

    Z80Tester.TestExt("ldpirx", 0xed, 0xb7);
    Z80Tester.Test("nop", 0xed, 0xb7);

    Z80Tester.TestExt("ldirscale", 0xed, 0xb6);
    Z80Tester.Test("nop", 0xed, 0xb6);
  });

  it("Extended instructions 0x40-0x4F work as expected", () => {
    // --- Act
    Z80Tester.Test("in b,(c)", 0xed, 0x40);
    Z80Tester.Test("out (c),b", 0xed, 0x41);
    Z80Tester.Test("sbc hl,bc", 0xed, 0x42);
    Z80Tester.Test("ld (#BC9A),bc", 0xed, 0x43, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x44);
    Z80Tester.Test("retn", 0xed, 0x45);
    Z80Tester.Test("im 0", 0xed, 0x46);
    Z80Tester.Test("ld i,a", 0xed, 0x47);
    Z80Tester.Test("in c,(c)", 0xed, 0x48);
    Z80Tester.Test("out (c),c", 0xed, 0x49);
    Z80Tester.Test("adc hl,bc", 0xed, 0x4a);
    Z80Tester.Test("ld bc,(#BC9A)", 0xed, 0x4b, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x4c);
    Z80Tester.Test("reti", 0xed, 0x4d);
    Z80Tester.Test("im 0", 0xed, 0x4e);
    Z80Tester.Test("ld r,a", 0xed, 0x4f);
  });

  it("Extended instructions 0x50-0x5F work as expected", () => {
    // --- Act
    Z80Tester.Test("in d,(c)", 0xed, 0x50);
    Z80Tester.Test("out (c),d", 0xed, 0x51);
    Z80Tester.Test("sbc hl,de", 0xed, 0x52);
    Z80Tester.Test("ld (#BC9A),de", 0xed, 0x53, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x54);
    Z80Tester.Test("retn", 0xed, 0x55);
    Z80Tester.Test("im 1", 0xed, 0x56);
    Z80Tester.Test("ld a,i", 0xed, 0x57);
    Z80Tester.Test("in e,(c)", 0xed, 0x58);
    Z80Tester.Test("out (c),e", 0xed, 0x59);
    Z80Tester.Test("adc hl,de", 0xed, 0x5a);
    Z80Tester.Test("ld de,(#BC9A)", 0xed, 0x5b, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x5c);
    Z80Tester.Test("retn", 0xed, 0x5d);
    Z80Tester.Test("im 2", 0xed, 0x5e);
    Z80Tester.Test("ld a,r", 0xed, 0x5f);
  });

  it("Extended instructions 0x60-0x6F work as expected", () => {
    // --- Act
    Z80Tester.Test("in h,(c)", 0xed, 0x60);
    Z80Tester.Test("out (c),h", 0xed, 0x61);
    Z80Tester.Test("sbc hl,hl", 0xed, 0x62);
    Z80Tester.Test("ld (#BC9A),hl", 0xed, 0x63, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x64);
    Z80Tester.Test("retn", 0xed, 0x65);
    Z80Tester.Test("im 0", 0xed, 0x66);
    Z80Tester.Test("rrd", 0xed, 0x67);
    Z80Tester.Test("in l,(c)", 0xed, 0x68);
    Z80Tester.Test("out (c),l", 0xed, 0x69);
    Z80Tester.Test("adc hl,hl", 0xed, 0x6a);
    Z80Tester.Test("ld hl,(#BC9A)", 0xed, 0x6b, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x6c);
    Z80Tester.Test("retn", 0xed, 0x6d);
    Z80Tester.Test("im 0", 0xed, 0x6e);
    Z80Tester.Test("rld", 0xed, 0x6f);
  });

  it("Extended instructions 0x70-0x7F work as expected", () => {
    // --- Act
    Z80Tester.Test("in (c)", 0xed, 0x70);
    Z80Tester.Test("out (c),0", 0xed, 0x71);
    Z80Tester.Test("sbc hl,sp", 0xed, 0x72);
    Z80Tester.Test("ld (#BC9A),sp", 0xed, 0x73, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x74);
    Z80Tester.Test("retn", 0xed, 0x75);
    Z80Tester.Test("im 1", 0xed, 0x76);
    Z80Tester.Test("nop", 0xed, 0x77);
    Z80Tester.Test("in a,(c)", 0xed, 0x78);
    Z80Tester.Test("out (c),a", 0xed, 0x79);
    Z80Tester.Test("adc hl,sp", 0xed, 0x7a);
    Z80Tester.Test("ld sp,(#BC9A)", 0xed, 0x7b, 0x9a, 0xbc);
    Z80Tester.Test("neg", 0xed, 0x7c);
    Z80Tester.Test("retn", 0xed, 0x7d);
    Z80Tester.Test("im 2", 0xed, 0x7e);
    Z80Tester.Test("nop", 0xed, 0x7f);
  });

  it("Extended instructions 0xA0-0xAF work as expected", () => {
    // --- Act
    Z80Tester.Test("ldi", 0xed, 0xa0);
    Z80Tester.Test("cpi", 0xed, 0xa1);
    Z80Tester.Test("ini", 0xed, 0xa2);
    Z80Tester.Test("outi", 0xed, 0xa3);
    Z80Tester.Test("nop", 0xed, 0xa4);
    Z80Tester.Test("nop", 0xed, 0xa5);
    Z80Tester.Test("nop", 0xed, 0xa6);
    Z80Tester.Test("nop", 0xed, 0xa7);
    Z80Tester.Test("ldd", 0xed, 0xa8);
    Z80Tester.Test("cpd", 0xed, 0xa9);
    Z80Tester.Test("ind", 0xed, 0xaa);
    Z80Tester.Test("outd", 0xed, 0xab);
    Z80Tester.Test("nop", 0xed, 0xac);
    Z80Tester.Test("nop", 0xed, 0xad);
    Z80Tester.Test("nop", 0xed, 0xae);
    Z80Tester.Test("nop", 0xed, 0xaf);
  });

  it("Extended instructions 0xB0-0xBF work as expected", () => {
    // --- Act
    Z80Tester.Test("ldir", 0xed, 0xb0);
    Z80Tester.Test("cpir", 0xed, 0xb1);
    Z80Tester.Test("inir", 0xed, 0xb2);
    Z80Tester.Test("otir", 0xed, 0xb3);
    Z80Tester.Test("nop", 0xed, 0xb4);
    Z80Tester.Test("nop", 0xed, 0xb5);
    Z80Tester.Test("nop", 0xed, 0xb6);
    Z80Tester.Test("nop", 0xed, 0xb7);
    Z80Tester.Test("lddr", 0xed, 0xb8);
    Z80Tester.Test("cpdr", 0xed, 0xb9);
    Z80Tester.Test("indr", 0xed, 0xba);
    Z80Tester.Test("otdr", 0xed, 0xbb);
    Z80Tester.Test("nop", 0xed, 0xbc);
    Z80Tester.Test("nop", 0xed, 0xbd);
    Z80Tester.Test("nop", 0xed, 0xbe);
    Z80Tester.Test("nop", 0xed, 0xbf);
  });

  it("Invalid extended instructions work as NOP", () => {
    // --- Act
    for (let op = 0x00; op < 0x40; op++) {
      Z80Tester.Test("nop", 0xed, op);
    }
    for (let op = 0xc0; op < 0x100; op++) {
      Z80Tester.Test("nop", 0xed, op);
    }
  });
});
