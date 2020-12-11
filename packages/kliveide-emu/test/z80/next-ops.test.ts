import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { TestCpuApi } from "../../src/renderer/machines/wa-api";
import { TestZ80Machine } from "../../src/renderer/machines/TestZ80Machine";
import { importObject } from "../import-object";

const buffer = fs.readFileSync(path.join(__dirname, "../../build/tz80n.wasm"));
let api: TestCpuApi;
let testMachine: TestZ80Machine;

describe("Z80 Next ops", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as TestCpuApi;
    testMachine = new TestZ80Machine(api);
  });

  beforeEach(() => {
    testMachine.reset();
  });

  it("23: swapnip", () => {
    let s = testMachine.initCode([0xed, 0x23]);
    s.a = 0x3d;
    s = testMachine.run(s);

    expect(s.a).toBe(0xd3);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("24: mirror", () => {
    let s = testMachine.initCode([0xed, 0x24]);
    s.a = 0xc4;
    s = testMachine.run(s);

    expect(s.a).toBe(0x23);
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("27: test N", () => {
    let s = testMachine.initCode([0xed, 0x27, 0x83]);
    s.a = 0x81;
    s = testMachine.run(s);

    expect(s.f).toBe(0x94);
    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("28: bsla de,b #1", () => {
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

  it("29: bsra de,b #1", () => {
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

  it("2a: bsrl de,b #1", () => {
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

  it("2b: bsrf de,b #1", () => {
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

  it("2c: brlc de,b #1", () => {
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
    let s = testMachine.initCode([0xed, 0x30]);
    s.d = 0x12;
    s.e = 0x34;
    s = testMachine.run(s);

    expect(s.de).toBe((0x12 * 0x34) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("30: mul #2", () => {
    let s = testMachine.initCode([0xed, 0x30]);
    s.d = 0x82;
    s.e = 0x24;
    s = testMachine.run(s);

    expect(s.de).toBe((0x82 * 0x24) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("31: add hl,a #1", () => {
    let s = testMachine.initCode([0xed, 0x31]);
    s.hl = 0x8765;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.hl).toBe((0x8765 + 0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("31: add hl,a #2", () => {
    let s = testMachine.initCode([0xed, 0x31]);
    s.hl = 0xffa9;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.hl).toBe((0xffa9 + 0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("32: add de,a #1", () => {
    let s = testMachine.initCode([0xed, 0x32]);
    s.de = 0x8765;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.de).toBe((0x8765 + 0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("32: add de,a #2", () => {
    let s = testMachine.initCode([0xed, 0x32]);
    s.de = 0xffa9;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.de).toBe((0xffa9 + 0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("33: add bc,a #1", () => {
    let s = testMachine.initCode([0xed, 0x33]);
    s.bc = 0x8765;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.bc).toBe((0x8765 + 0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("33: add bc,a #2", () => {
    let s = testMachine.initCode([0xed, 0x33]);
    s.bc = 0xffa9;
    s.a = 0xa4;
    s = testMachine.run(s);

    expect(s.bc).toBe((0xffa9 + 0xa4) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("34: add hl,NN #1", () => {
    let s = testMachine.initCode([0xed, 0x34, 0x12, 0x34]);
    s.hl = 0x8765;
    s = testMachine.run(s);

    expect(s.hl).toBe((0x8765 + 0x3412) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("34: add hl,NN #2", () => {
    let s = testMachine.initCode([0xed, 0x34, 0x12, 0x97]);
    s.hl = 0x8765;
    s = testMachine.run(s);

    expect(s.hl).toBe((0x8765 + 0x9712) & 0xffff);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("35: add de,NN #1", () => {
    let s = testMachine.initCode([0xed, 0x35, 0x12, 0x34]);
    s.de = 0x8765;
    s = testMachine.run(s);

    expect(s.de).toBe((0x8765 + 0x3412) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("35: add de,NN #2", () => {
    let s = testMachine.initCode([0xed, 0x35, 0x12, 0x97]);
    s.de = 0x8765;
    s = testMachine.run(s);

    expect(s.de).toBe((0x8765 + 0x9712) & 0xffff);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("36: add bc,NN #1", () => {
    let s = testMachine.initCode([0xed, 0x36, 0x12, 0x34]);
    s.bc = 0x8765;
    s = testMachine.run(s);

    expect(s.bc).toBe((0x8765 + 0x3412) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("36: add bc,NN #2", () => {
    let s = testMachine.initCode([0xed, 0x36, 0x12, 0x97]);
    s.bc = 0x8765;
    s = testMachine.run(s);

    expect(s.bc).toBe((0x8765 + 0x9712) & 0xffff);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(16);
  });

  it("8a: push NN", () => {
    let s = testMachine.initCode([
      0xed,
      0x8a,
      0x52,
      0x23, // PUSH #2352
      0xe1, // POP HL
    ]);
    s.sp = 0x0000;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2352);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory("fffe-ffff");
    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(30);
  });

  it("90: outinb", () => {
    let s = testMachine.initCode([0xed, 0x90]);
    const m = testMachine.memory;
    s.bc = 0x10cc;
    s.hl = 0x1000;
    m[s.hl] = 0x29;

    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x10);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1001);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10cc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBe(true);

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("91: nextreg reg,val", () => {
    let s = testMachine.initCode([0xed, 0x91, 0x07, 0x23]);
    s = testMachine.run(s);
    const tbLog = testMachine.tbBlueAccessLog;
    const ioLog = testMachine.ioAccessLog;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();

    expect(tbLog.length).toBe(2);
    expect(tbLog[0].isIndex).toBe(true);
    expect(tbLog[0].data).toBe(0x07);
    expect(tbLog[1].isIndex).toBe(false);
    expect(tbLog[1].data).toBe(0x23);

    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("92: nextreg reg,a", () => {
    let s = testMachine.initCode([0xed, 0x92, 0x07]);
    s.a = 0x23;
    s = testMachine.run(s);
    const log = testMachine.tbBlueAccessLog;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(2);
    expect(log[0].isIndex).toBe(true);
    expect(log[0].data).toBe(0x07);
    expect(log[1].isIndex).toBe(false);
    expect(log[1].data).toBe(0x23);

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(17);
  });

  const pixeldnTests = [
    { orig: 0x4000, down: 0x4100 },
    { orig: 0x401f, down: 0x411f },
    { orig: 0x411e, down: 0x421e },
    { orig: 0x471f, down: 0x403f },
    { orig: 0x471e, down: 0x403e },
    { orig: 0x47e2, down: 0x4802 },
    { orig: 0x47ff, down: 0x481f },
    { orig: 0x491e, down: 0x4a1e },
    { orig: 0x4f1f, down: 0x483f },
    { orig: 0x4f1e, down: 0x483e },
    { orig: 0x4fe2, down: 0x5002 },
    { orig: 0x4fff, down: 0x501f },
  ];
  pixeldnTests.forEach((c, index) => {
    it(`93: pixeldn #${index + 1}`, () => {
      let s = testMachine.initCode([0xed, 0x93]);
      s.hl = c.orig;
      s = testMachine.run(s);

      expect(s.hl).toBe(c.down);
      testMachine.shouldKeepRegisters("HL");
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  });

  const pixeladTests = [
    { row: 0x00, col: 0x00, addr: 0x4000 },
    { row: 0x00, col: 0xf7, addr: 0x401e },
    { row: 0x00, col: 0xfe, addr: 0x401f },
    { row: 0x06, col: 0x00, addr: 0x4600 },
    { row: 0x06, col: 0xf7, addr: 0x461e },
    { row: 0x06, col: 0xfe, addr: 0x461f },
    { row: 0x0c, col: 0x00, addr: 0x4420 },
    { row: 0x0c, col: 0xf7, addr: 0x443e },
    { row: 0x0c, col: 0xfe, addr: 0x443f },
    { row: 0x40, col: 0x00, addr: 0x4800 },
    { row: 0x40, col: 0xf7, addr: 0x481e },
    { row: 0x40, col: 0xfe, addr: 0x481f },
    { row: 0x46, col: 0x00, addr: 0x4e00 },
    { row: 0x46, col: 0xf7, addr: 0x4e1e },
    { row: 0x46, col: 0xfe, addr: 0x4e1f },
    { row: 0x4c, col: 0x00, addr: 0x4c20 },
    { row: 0x4c, col: 0xf7, addr: 0x4c3e },
    { row: 0x4c, col: 0xfe, addr: 0x4c3f },
    { row: 0x80, col: 0x00, addr: 0x5000 },
    { row: 0x80, col: 0xf7, addr: 0x501e },
    { row: 0x80, col: 0xfe, addr: 0x501f },
    { row: 0x86, col: 0x00, addr: 0x5600 },
    { row: 0x86, col: 0xf7, addr: 0x561e },
    { row: 0x86, col: 0xfe, addr: 0x561f },
    { row: 0x8c, col: 0x00, addr: 0x5420 },
    { row: 0x8c, col: 0xf7, addr: 0x543e },
    { row: 0x8c, col: 0xfe, addr: 0x543f },
  ];
  pixeladTests.forEach((c, index) => {
    it(`94: pixelad #${index + 1}`, () => {
      let s = testMachine.initCode([0xed, 0x94]);
      s.d = c.row;
      s.e = c.col;
      s = testMachine.run(s);

      expect(s.hl).toBe(c.addr);
      testMachine.shouldKeepRegisters("HL");
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  });

  const setaeTests = [
    { a: 0x00, e: 0xff, res: 0x01 },
    { a: 0x00, e: 0x07, res: 0x01 },
    { a: 0x00, e: 0x06, res: 0x02 },
    { a: 0x00, e: 0x05, res: 0x04 },
    { a: 0x00, e: 0x04, res: 0x08 },
    { a: 0x00, e: 0x03, res: 0x10 },
    { a: 0x00, e: 0x02, res: 0x20 },
    { a: 0x00, e: 0x01, res: 0x40 },
    { a: 0x00, e: 0x00, res: 0x80 },
    { a: 0x30, e: 0xff, res: 0x01 },
    { a: 0x30, e: 0x07, res: 0x01 },
    { a: 0x30, e: 0x06, res: 0x02 },
    { a: 0x30, e: 0x05, res: 0x04 },
    { a: 0x30, e: 0x04, res: 0x08 },
    { a: 0x30, e: 0x03, res: 0x10 },
    { a: 0x30, e: 0x02, res: 0x20 },
    { a: 0x30, e: 0x01, res: 0x40 },
    { a: 0x30, e: 0x00, res: 0x80 },
  ];
  setaeTests.forEach((c, index) => {
    it(`95: setae #${index + 1}`, () => {
      let s = testMachine.initCode([0xed, 0x95]);
      s.a = c.a;
      s.e = c.e;
      s = testMachine.run(s);

      expect(s.a).toBe(c.res);
      testMachine.shouldKeepRegisters("A");
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  });

  it("98: jp (c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x98]);
    s.bc = 0x10ff;
    s = testMachine.run(s);

    expect(s.pc).toBe(0x3540);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.tacts).toBe(13);
  });

  it("a4: ldix #1", () => {
    let s = testMachine.initCode([0xed, 0xa4]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0x00;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.de = 0x1001;
    m[s.hl] = 0xa5;
    m[s.de] = 0x11;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0xa5);
    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x1001);
    expect(s.de).toBe(0x1002);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a4: ldix #2", () => {
    let s = testMachine.initCode([0xed, 0xa4]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0xa5;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.de = 0x1001;
    m[s.hl] = 0xa5;
    m[s.de] = 0x11;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0x11);
    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x1001);
    expect(s.de).toBe(0x1002);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a5: ldws #1", () => {
    let s = testMachine.initCode([0xed, 0xa5]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.hl = 0x1000;
    s.de = 0x2000;
    m[s.hl] = 0xa5;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x2000]).toBe(0xa5);
    expect(s.hl).toBe(0x1001);
    expect(s.de).toBe(0x2100);

    testMachine.shouldKeepRegisters("F, DE, HL");
    testMachine.shouldKeepMemory("2000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(14);
  });

  it("ac: lddx #1", () => {
    let s = testMachine.initCode([0xed, 0xac]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0x00;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.de = 0x1001;
    m[s.hl] = 0xa5;
    m[s.de] = 0x11;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0xa5);
    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x0fff);
    expect(s.de).toBe(0x1000);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("ac: lddx #2", () => {
    let s = testMachine.initCode([0xed, 0xac]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0xa5;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.de = 0x1001;
    m[s.hl] = 0xa5;
    m[s.de] = 0x11;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0x11);
    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x0fff);
    expect(s.de).toBe(0x1000);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("ac: lddx #3", () => {
    let s = testMachine.initCode([0xed, 0xac]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0x00;
    s.bc = 0x0001;
    s.hl = 0x1000;
    s.de = 0x1001;
    m[s.hl] = 0xa5;
    m[s.de] = 0x11;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0xa5);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);
    expect(s.de).toBe(0x1000);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("b4: ldirx #1", () => {
    let s = testMachine.initCode([0xed, 0xb4]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0x00;
    s.bc = 0x0003;
    s.hl = 0x1001;
    s.de = 0x1000;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0xa5);
    expect(m[0x1001]).toBe(0xa6);
    expect(m[0x1002]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1004);
    expect(s.de).toBe(0x1003);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1000-1002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b4: ldirx #2", () => {
    let s = testMachine.initCode([0xed, 0xb4]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0xa6;
    s.bc = 0x0003;
    s.hl = 0x1001;
    s.de = 0x2000;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;
    m[s.de + 1] = 0xcc;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x2000]).toBe(0xa5);
    expect(m[0x2001]).toBe(0xcc);
    expect(m[0x2002]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1004);
    expect(s.de).toBe(0x2003);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("2000-2002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b7: ldpirx #1", () => {
    let s = testMachine.initCode([0xed, 0xb7]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0x00;
    s.bc = 0x0003;
    s.hl = 0x1000;
    s.de = 0x2000;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x2000]).toBe(0xa5);
    expect(m[0x2001]).toBe(0xa6);
    expect(m[0x2002]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1000);
    expect(s.de).toBe(0x2003);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("2000-2002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b7: ldpirx #2", () => {
    let s = testMachine.initCode([0xed, 0xb7]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0xa6;
    s.bc = 0x0003;
    s.hl = 0x1000;
    s.de = 0x2000;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;
    m[s.de + 1] = 0xcc;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x2000]).toBe(0xa5);
    expect(m[0x2001]).toBe(0xcc);
    expect(m[0x2002]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1000);
    expect(s.de).toBe(0x2003);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("2000-2002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("bc: lddrx #1", () => {
    let s = testMachine.initCode([0xed, 0xbc]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0x00;
    s.bc = 0x0003;
    s.hl = 0x1002;
    s.de = 0x1003;
    m[s.hl - 2] = 0xa5;
    m[s.hl - 1] = 0xa6;
    m[s.hl] = 0xa7;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0xa5);
    expect(m[0x1002]).toBe(0xa6);
    expect(m[0x1003]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);
    expect(s.de).toBe(0x1000);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("1001-1003");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("bc: lddrx #2", () => {
    let s = testMachine.initCode([0xed, 0xbc]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.a = 0xa6;
    s.bc = 0x0003;
    s.hl = 0x1002;
    s.de = 0x2002;
    m[s.hl - 2] = 0xa5;
    m[s.hl - 1] = 0xa6;
    m[s.hl] = 0xa7;
    m[s.de - 1] = 0xcc;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x2000]).toBe(0xa5);
    expect(m[0x2001]).toBe(0xcc);
    expect(m[0x2002]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);
    expect(s.de).toBe(0x1fff);

    testMachine.shouldKeepRegisters("BC, DE, HL");
    testMachine.shouldKeepMemory("2000-2002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

});
