import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Extended ops 80-bf", () => {
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

  for (let i = 0x80; i <= 0x89; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("8a: push NN", () => {
    testMachine.enableExtendedInstructions();
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

  it("8a: push NN need extset", () => {
    let s = testMachine.initCode([0xed, 0x8a]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0x8b; i <= 0x8f; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("90: outinb", () => {
    testMachine.enableExtendedInstructions();
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

  it("90: outinb need extset", () => {
    let s = testMachine.initCode([0xed, 0x90]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("91: nextreg reg,val", () => {
    testMachine.enableExtendedInstructions();
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

  it("91: nextreg reg,val need extset", () => {
    let s = testMachine.initCode([0xed, 0x91]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("92: nextreg reg,a", () => {
    testMachine.enableExtendedInstructions();
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

  it("92: nextreg reg,a need extset", () => {
    let s = testMachine.initCode([0xed, 0x92]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
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
      testMachine.enableExtendedInstructions();
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

  it("93: pixeldn need extset", () => {
    let s = testMachine.initCode([0xed, 0x93]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
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
      testMachine.enableExtendedInstructions();
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

  it("94: pixelad need extset", () => {
    let s = testMachine.initCode([0xed, 0x94]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
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
      testMachine.enableExtendedInstructions();
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

  for (let i = 0x96; i <= 0x97; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("98: jp (c)", () => {
    testMachine.enableExtendedInstructions();
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x98]);
    s.bc = 0x10ff;
    s = testMachine.run(s);

    expect(s.pc).toBe(0x3540);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.tacts).toBe(13);
  });

  it("98: jp (c) need extset", () => {
    let s = testMachine.initCode([0xed, 0x98]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0x99; i <= 0x9f; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("a0: ldi #1", () => {
    let s = testMachine.initCode([0xed, 0xa0]);
    let m = testMachine.memory;
    s.f &= 0xfe;
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
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a0: ldi #2", () => {
    let s = testMachine.initCode([0xed, 0xa0]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x001;
    s.hl = 0x1000;
    s.de = 0x1001;
    m[s.hl] = 0xa5;
    m[s.de] = 0x11;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0xa5);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1001);
    expect(s.de).toBe(0x1002);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a1: cpi #1", () => {
    let s = testMachine.initCode([0xed, 0xa1]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.a = 0x11;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x1001);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a1: cpi #2", () => {
    let s = testMachine.initCode([0xed, 0xa1]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0001;
    s.hl = 0x1000;
    s.a = 0x11;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1001);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a1: cpi #3", () => {
    let s = testMachine.initCode([0xed, 0xa1]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.a = 0xa5;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x1001);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a1: cpi #4", () => {
    let s = testMachine.initCode([0xed, 0xa1]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0001;
    s.hl = 0x1000;
    s.a = 0xa5;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1001);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a2: ini #1", () => {
    let s = testMachine.initCode([0xed, 0xa2]);
    s.f &= 0xfe;
    s.bc = 0x10cc;
    s.hl = 0x1000;
    testMachine.initInput([0x69]);

    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x69);
    expect(s.b).toBe(0x0f);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1001);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a2: ini #2", () => {
    let s = testMachine.initCode([0xed, 0xa2]);
    s.f &= 0xfe;
    s.bc = 0x01cc;
    s.hl = 0x1000;
    testMachine.initInput([0x69]);

    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x69);
    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1001);
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a3: outi #1", () => {
    let s = testMachine.initCode([0xed, 0xa3]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x10cc;
    s.hl = 0x1000;
    m[s.hl] = 0x29;
    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x0f);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1001);

    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x0fcc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a3: outi #2", () => {
    let s = testMachine.initCode([0xed, 0xa3]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x01cc;
    s.hl = 0x1000;
    m[s.hl] = 0x29;
    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1001);

    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x00cc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a4: ldix #1", () => {
    testMachine.enableExtendedInstructions();
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
    testMachine.enableExtendedInstructions();
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

  it("a4: ldix need extset", () => {
    let s = testMachine.initCode([0xed, 0xa4]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a5: ldws #1", () => {
    testMachine.enableExtendedInstructions();
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

  it("a5: ldws need extset", () => {
    let s = testMachine.initCode([0xed, 0xa5]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0xa6; i <= 0xa7; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("a8: ldd #1", () => {
    let s = testMachine.initCode([0xed, 0xa8]);
    let m = testMachine.memory;
    s.f &= 0xfe;
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
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a8: ldd #2", () => {
    let s = testMachine.initCode([0xed, 0xa8]);
    let m = testMachine.memory;
    s.f &= 0xfe;
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
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, DE, HL");
    testMachine.shouldKeepMemory("1001");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a9: cpd #1", () => {
    let s = testMachine.initCode([0xed, 0xa9]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.a = 0x11;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a9: cpd #2", () => {
    let s = testMachine.initCode([0xed, 0xa9]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0001;
    s.hl = 0x1000;
    s.a = 0x11;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a9: cpd #3", () => {
    let s = testMachine.initCode([0xed, 0xa9]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0010;
    s.hl = 0x1000;
    s.a = 0xa5;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x000f);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("a9: cpd #4", () => {
    let s = testMachine.initCode([0xed, 0xa9]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0001;
    s.hl = 0x1000;
    s.a = 0xa5;
    m[s.hl] = 0xa5;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("aa: ind #1", () => {
    let s = testMachine.initCode([0xed, 0xaa]);
    s.f &= 0xfe;
    s.bc = 0x10cc;
    s.hl = 0x1000;
    testMachine.initInput([0x69]);

    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x69);
    expect(s.b).toBe(0x0f);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("aa: ind #2", () => {
    let s = testMachine.initCode([0xed, 0xaa]);
    s.f &= 0xfe;
    s.bc = 0x01cc;
    s.hl = 0x1000;
    testMachine.initInput([0x69]);

    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x69);
    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("ab: outd #1", () => {
    let s = testMachine.initCode([0xed, 0xab]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x10cc;
    s.hl = 0x1000;
    m[s.hl] = 0x29;
    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x0f);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x0fff);

    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x0fcc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("ab: outd #2", () => {
    let s = testMachine.initCode([0xed, 0xab]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x01cc;
    s.hl = 0x1000;
    m[s.hl] = 0x29;
    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x0fff);

    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x00cc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  it("ac: lddx #1", () => {
    testMachine.enableExtendedInstructions();
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
    testMachine.enableExtendedInstructions();
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
    testMachine.enableExtendedInstructions();
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

  it("ac: lddx need extset", () => {
    let s = testMachine.initCode([0xed, 0xac]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0xad; i <= 0xaf; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("b0: ldir", () => {
    let s = testMachine.initCode([0xed, 0xb0]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0003;
    s.hl = 0x1001;
    s.de = 0x1000;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;
    m[s.de] = 0x11;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0xa5);
    expect(m[0x1001]).toBe(0xa6);
    expect(m[0x1002]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1004);
    expect(s.de).toBe(0x1003);
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, DE, HL");
    testMachine.shouldKeepMemory("1000-1002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b1: cpir #1", () => {
    let s = testMachine.initCode([0xed, 0xb1]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0003;
    s.hl = 0x1000;
    s.a = 0x11;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x1003);

    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b1: cpir #2", () => {
    let s = testMachine.initCode([0xed, 0xb1]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0003;
    s.hl = 0x1000;
    s.a = 0xa6;
    m[s.hl] = 0xa5;
    m[s.hl + 1] = 0xa6;
    m[s.hl + 2] = 0xa7;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0001);
    expect(s.hl).toBe(0x1002);

    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(37);
  });

  it("b2: inir", () => {
    let s = testMachine.initCode([0xed, 0xb2]);
    s.f &= 0xfe;
    s.bc = 0x03cc;
    s.hl = 0x1000;
    testMachine.initInput([0x69, 0x6a, 0x6b]);

    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x69);
    expect(m[0x1001]).toBe(0x6a);
    expect(m[0x1002]).toBe(0x6b);
    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1003);
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory("1000-1002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b3: otir", () => {
    let s = testMachine.initCode([0xed, 0xb3]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x03cc;
    s.hl = 0x1000;
    m[s.hl] = 0x29;
    m[s.hl + 1] = 0x2a;
    m[s.hl + 2] = 0x2b;
    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x1003);

    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(3);
    expect(log[0].address).toBe(0x02cc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBeTruthy();
    expect(log[1].address).toBe(0x01cc);
    expect(log[1].value).toBe(0x2a);
    expect(log[1].isOutput).toBeTruthy();
    expect(log[2].address).toBe(0x00cc);
    expect(log[2].value).toBe(0x2b);
    expect(log[2].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b4: ldirx #1", () => {
    testMachine.enableExtendedInstructions();
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
    testMachine.enableExtendedInstructions();
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

  it("b4: ldirx NN need extset", () => {
    let s = testMachine.initCode([0xed, 0xb4]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0xb5; i <= 0xb6; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("b7: ldpirx #1", () => {
    testMachine.enableExtendedInstructions();
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
    testMachine.enableExtendedInstructions();
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

  it("b7: ldpirx NN need extset", () => {
    let s = testMachine.initCode([0xed, 0xb7]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b8: lddr", () => {
    let s = testMachine.initCode([0xed, 0xb8]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0003;
    s.hl = 0x1002;
    s.de = 0x1003;
    m[s.hl - 2] = 0xa5;
    m[s.hl - 1] = 0xa6;
    m[s.hl] = 0xa7;
    m[s.de] = 0x11;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1001]).toBe(0xa5);
    expect(m[0x1002]).toBe(0xa6);
    expect(m[0x1003]).toBe(0xa7);
    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);
    expect(s.de).toBe(0x1000);
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, DE, HL");
    testMachine.shouldKeepMemory("1000-1003");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b9: cpdr #1", () => {
    let s = testMachine.initCode([0xed, 0xb9]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0003;
    s.hl = 0x1002;
    s.a = 0x11;
    m[s.hl - 2] = 0xa5;
    m[s.hl - 1] = 0xa6;
    m[s.hl] = 0xa7;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0000);
    expect(s.hl).toBe(0x0fff);

    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("b9: cpdr #2", () => {
    let s = testMachine.initCode([0xed, 0xb9]);
    let m = testMachine.memory;
    s.f &= 0xfe;
    s.bc = 0x0003;
    s.hl = 0x1002;
    s.a = 0xa6;
    m[s.hl - 2] = 0xa5;
    m[s.hl - 1] = 0xa6;
    m[s.hl] = 0xa7;

    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.bc).toBe(0x0001);
    expect(s.hl).toBe(0x1000);

    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(37);
  });

  it("ba: indr", () => {
    let s = testMachine.initCode([0xed, 0xba]);
    s.f &= 0xfe;
    s.bc = 0x03cc;
    s.hl = 0x1002;
    testMachine.initInput([0x69, 0x6a, 0x6b]);

    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x6b);
    expect(m[0x1001]).toBe(0x6a);
    expect(m[0x1002]).toBe(0x69);
    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x0fff);
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory("1000-1002");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("bb: otdr", () => {
    let s = testMachine.initCode([0xed, 0xbb]);
    let m = testMachine.memory;
    s.bc = 0x03cc;
    s.hl = 0x1002;
    m[s.hl - 2] = 0x29;
    m[s.hl - 1] = 0x2a;
    m[s.hl] = 0x2b;
    s = testMachine.run(s, m);
    const log = testMachine.ioAccessLog;

    expect(s.b).toBe(0x00);
    expect(s.c).toBe(0xcc);
    expect(s.hl).toBe(0x0fff);

    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(3);
    expect(log[0].address).toBe(0x02cc);
    expect(log[0].value).toBe(0x2b);
    expect(log[0].isOutput).toBeTruthy();
    expect(log[1].address).toBe(0x01cc);
    expect(log[1].value).toBe(0x2a);
    expect(log[1].isOutput).toBeTruthy();
    expect(log[2].address).toBe(0x00cc);
    expect(log[2].value).toBe(0x29);
    expect(log[2].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(58);
  });

  it("bc: lddrx #1", () => {
    testMachine.enableExtendedInstructions();
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
    testMachine.enableExtendedInstructions();
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

  it("bc: lddrx NN need extset", () => {
    let s = testMachine.initCode([0xed, 0xbc]);
    s = testMachine.run(s);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  for (let i = 0xbd; i <= 0xbf; i++) {
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
