import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Extended ops 00-3f", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, {
        imports: { trace: (arg: number) => console.log(arg) }
    });
    api = (wasm.instance.exports as unknown) as CpuApi;
    testMachine = new TestZ80Machine(api);
  });

  beforeEach(() => {
    testMachine.reset();
  });

  for (let i = 0x00; i <= 0x22; i++) {
    it(`${i < 16 ? "0"+i.toString(16) : i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);
  
      s = testMachine.run();
  
      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("23: swapnip", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x23]);
    s.a = 0x3d;
    s = testMachine.run(s);

    expect(s.a).toBe(0xd3);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("23: swapnip need extset", () => {
    let s = testMachine.initCode([0xed, 0x23]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("24: mirror", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x24]);
    s.a = 0xc4;
    s = testMachine.run(s);

    expect(s.a).toBe(0x23);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("24: mirror need extset", () => {
    let s = testMachine.initCode([0xed, 0x24]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("25: nop", () => {
    let s = testMachine.initCode([0xed, 0x25]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("26: nop", () => {
    let s = testMachine.initCode([0xed, 0x26]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("27: test N", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x27, 0x83]);
    s.a = 0x81;
    s = testMachine.run(s);

    expect(s.f).toBe(0x94);
    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("27: test N need extset", () => {
    let s = testMachine.initCode([0xed, 0x27]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("28: bsla de,b #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x28]);
    s.de = 0x5555;
    s.b = 0x01;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaaaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("28: bsla de,b #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x28]);
    s.de = 0x5555;
    s.b = 0xd1;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaaaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("28: bsla de,b #3", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x28]);
    s.de = 0x5555;
    s.b = 0x03;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaaa8);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("28: bsla de,b need extset", () => {
    let s = testMachine.initCode([0xed, 0x28]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("29: bsra de,b #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x29]);
    s.de = 0x5555;
    s.b = 0x01;
    s = testMachine.run(s);

    expect(s.de).toBe(0x2aaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("29: bsra de,b #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x29]);
    s.de = 0x5555;
    s.b = 0xd1;
    s = testMachine.run(s);

    expect(s.de).toBe(0x2aaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("29: bsra de,b #3", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x29]);
    s.de = 0xaaaa;
    s.b = 0x03;
    s = testMachine.run(s);

    expect(s.de).toBe(0x9555);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("29: bsra de,b need extset", () => {
    let s = testMachine.initCode([0xed, 0x29]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2a: bsrl de,b #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2a]);
    s.de = 0x5555;
    s.b = 0x01;
    s = testMachine.run(s);

    expect(s.de).toBe(0x2aaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2a: bsrl de,b #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2a]);
    s.de = 0x5555;
    s.b = 0xd1;
    s = testMachine.run(s);

    expect(s.de).toBe(0x2aaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2a: bsrl de,b #3", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2a]);
    s.de = 0xaaaa;
    s.b = 0x03;
    s = testMachine.run(s);

    expect(s.de).toBe(0x1555);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2a: bsrl de,b need extset", () => {
    let s = testMachine.initCode([0xed, 0x2a]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2b: bsrf de,b #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2b]);
    s.de = 0x5555;
    s.b = 0x01;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaaaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2b: bsrf de,b #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2b]);
    s.de = 0x5555;
    s.b = 0xd1;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaaaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2b: bsrf de,b #3", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2b]);
    s.de = 0xaaaa;
    s.b = 0x03;
    s = testMachine.run(s);

    expect(s.de).toBe(0xf555);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2b: bsrf de,b #4", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2b]);
    s.de = 0xaaaa;
    s.b = 0x08;
    s = testMachine.run(s);

    expect(s.de).toBe(0xffaa);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2b: bsrf de,b need extset", () => {
    let s = testMachine.initCode([0xed, 0x2b]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: brlc de,b #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2c]);
    s.de = 0x5537;
    s.b = 0x01;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaa6e);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: brlc de,b #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2c]);
    s.de = 0x5537;
    s.b = 0xd1;
    s = testMachine.run(s);

    expect(s.de).toBe(0xaa6e);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: bsrf de,b #3", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2c]);
    s.de = 0x1234;
    s.b = 0x08;
    s = testMachine.run(s);

    expect(s.de).toBe(0x3412);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: brlc de,b #4", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x2c]);
    s.de = 0x1234;
    s.b = 0xd4;
    s = testMachine.run(s);

    expect(s.de).toBe(0x2341);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: brlc de,b need extset", () => {
    let s = testMachine.initCode([0xed, 0x2c]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0x2d; i <= 0x2f; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);
  
      s = testMachine.run();
  
      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("30: mul #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x30]);
    s.d = 0x12;
    s.e = 0x34;
    s = testMachine.run(s);

    expect(s.de).toBe((0x12*0x34) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("30: mul #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x30]);
    s.d = 0x82;
    s.e = 0x24;
    s = testMachine.run(s);

    expect(s.de).toBe((0x82*0x24) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("30: mul need extset", () => {
    let s = testMachine.initCode([0xed, 0x30]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("31: add hl,a #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x31]);
    s.hl = 0x8765;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.hl).toBe((0x8765+0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("31: add hl,a #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x31]);
    s.hl = 0xffa9;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.hl).toBe((0xffa9+0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("31: add hl,a need extset", () => {
    let s = testMachine.initCode([0xed, 0x31]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("32: add de,a #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x32]);
    s.de = 0x8765;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.de).toBe((0x8765+0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("32: add de,a #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x32]);
    s.de = 0xffa9;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.de).toBe((0xffa9+0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("32: add de,a need extset", () => {
    let s = testMachine.initCode([0xed, 0x32]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("33: add bc,a #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x33]);
    s.bc = 0x8765;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.bc).toBe((0x8765+0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("33: add bc,a #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x33]);
    s.bc = 0xffa9;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.bc).toBe((0xffa9+0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("33: add bc,a need extset", () => {
    let s = testMachine.initCode([0xed, 0x33]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("34: add hl,NN #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x34, 0x12, 0x34]);
    s.hl = 0x8765;
    s = testMachine.run(s);

    expect(s.hl).toBe((0x8765+0x3412) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("34: add hl,NN #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x34, 0x12, 0x97]);
    s.hl = 0x8765;
    s = testMachine.run(s);

    expect(s.hl).toBe((0x8765+0x9712) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });


  it("34: add hl,NN need extset", () => {
    let s = testMachine.initCode([0xed, 0x34]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("35: add de,NN #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x35, 0x12, 0x34]);
    s.de = 0x8765;
    s = testMachine.run(s);

    expect(s.de).toBe((0x8765+0x3412) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("35: add de,NN #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x35, 0x12, 0x97]);
    s.de = 0x8765;
    s = testMachine.run(s);

    expect(s.de).toBe((0x8765+0x9712) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });


  it("35: add de,NN need extset", () => {
    let s = testMachine.initCode([0xed, 0x35]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("36: add bc,NN #1", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x36, 0x12, 0x34]);
    s.bc = 0x8765;
    s = testMachine.run(s);

    expect(s.bc).toBe((0x8765+0x3412) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("36: add bc,NN #2", () => {
    testMachine.enableExtendedInstructions();
    let s = testMachine.initCode([0xed, 0x36, 0x12, 0x97]);
    s.bc = 0x8765;
    s = testMachine.run(s);

    expect(s.bc).toBe((0x8765+0x9712) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });


  it("36: add bc,NN need extset", () => {
    let s = testMachine.initCode([0xed, 0x36]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0x37; i <= 0x3f; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);
  
      s = testMachine.run();
  
      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }
});
