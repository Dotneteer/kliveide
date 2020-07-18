import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Indexed ops (ix) 80-bf", () => {
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

  const reg8 = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x12;
      const l = 0x24;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q === 7) {
        expect(s.a).toBe(0x48);
      } else {
        expect(s.a).toBe(0x36);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0xf0;
      const l = 0xf0;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.a).toBe(0xe0);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x82;
      const l = 0x7e;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.a).toBe(0xfc);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x44;
      const l = 0x42;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();

      if (q !== 7) {
        expect(s.a).toBe(0x86);
      } else {
        expect(s.a).toBe(0x84);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("84: add a,xh #1", () => {
    let s = testMachine.initCode([0xdd, 0x84]);
    s.a = 0x12;
    s.xh = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x36);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("84: add a,xh #2", () => {
    let s = testMachine.initCode([0xdd, 0x84]);
    s.a = 0xf0;
    s.xh = 0xf0;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe0);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("84: add a,xh #3", () => {
    let s = testMachine.initCode([0xdd, 0x84]);
    s.a = 0x82;
    s.xh = 0x7e;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("84: add a,xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x84]);
    s.a = 0x44;
    s.xh = 0x42;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x86);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("85: add a,xl #1", () => {
    let s = testMachine.initCode([0xdd, 0x85]);
    s.a = 0x12;
    s.xl = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x36);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("85: add a,xl #2", () => {
    let s = testMachine.initCode([0xdd, 0x85]);
    s.a = 0xf0;
    s.xl = 0xf0;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe0);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("85: add a,xl #3", () => {
    let s = testMachine.initCode([0xdd, 0x85]);
    s.a = 0x82;
    s.xl = 0x7e;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("85: add a,xl #4", () => {
    let s = testMachine.initCode([0xdd, 0x85]);
    s.a = 0x44;
    s.xl = 0x42;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x86);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("86: add a,(ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0x86, 0x52]);
    s.a = 0x12;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x24;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x36);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("86: add a,(ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0x86, 0xfe]);
    s.a = 0xf0;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0xf0;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe0);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("86: add a,(ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0x86, 0x52]);
    s.a = 0x82;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x7e;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("86: add a,(ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0x86, 0xfe]);
    s.a = 0x44;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x42;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x86);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x12;
      s.f |= 0x80;
      const l = 0x24;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q === 7) {
        expect(s.a).toBe(0x49);
      } else {
        expect(s.a).toBe(0x37);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0xf0;
      s.f |= 0x80;
      const l = 0xf0;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.a).toBe(0xe1);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x82;
      s.f |= 0x80;
      const l = 0x7d;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.a).toBe(0xfb);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x44;
      s.f |= 0x80;
      const l = 0x42;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x87);
      } else {
        expect(s.a).toBe(0x85);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("8c: adc a,xh #1", () => {
    let s = testMachine.initCode([0xdd, 0x8c]);
    s.a = 0x12;
    s.f != FlagsSetMask.C;
    s.xh = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x37);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8c: adc a,xh #2", () => {
    let s = testMachine.initCode([0xdd, 0x8c]);
    s.a = 0xf0;
    s.f != FlagsSetMask.C;
    s.xh = 0xf0;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe1);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8c: adc a,xh #3", () => {
    let s = testMachine.initCode([0xdd, 0x8c]);
    s.a = 0x82;
    s.f != FlagsSetMask.C;
    s.xh = 0x7d;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8c: adc a,xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x8c]);
    s.a = 0x44;
    s.f != FlagsSetMask.C;
    s.xh = 0x42;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x87);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8d: adc a,xl #1", () => {
    let s = testMachine.initCode([0xdd, 0x8d]);
    s.a = 0x12;
    s.f != FlagsSetMask.C;
    s.xl = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x37);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8d: adc a,xl #2", () => {
    let s = testMachine.initCode([0xdd, 0x8d]);
    s.a = 0xf0;
    s.f != FlagsSetMask.C;
    s.xl = 0xf0;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe1);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8d: adc a,xl #3", () => {
    let s = testMachine.initCode([0xdd, 0x8d]);
    s.a = 0x82;
    s.f != FlagsSetMask.C;
    s.xl = 0x7d;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8d: adc a,xl #4", () => {
    let s = testMachine.initCode([0xdd, 0x8d]);
    s.a = 0x44;
    s.f != FlagsSetMask.C;
    s.xl = 0x42;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x87);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("8e: adc a,(ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0x8e, 0x52]);
    s.a = 0x12;
    s.f |= 0x80;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x24;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x37);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("8e: adc a,(ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0x8e, 0xfe]);
    s.a = 0xf0;
    s.f |= 0x80;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0xf0;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe1);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("8e: adc a,(ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0x8e, 0x52]);
    s.a = 0x82;
    s.f |= 0x80;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x7d;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("8e: adc a,(ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0x8e, 0xfe]);
    s.a = 0x44;
    s.f |= 0x80;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x42;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x87);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x36;
      s.f |= 0x80;
      const l = 0x24;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x12);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x40;
      s.f |= 0x80;
      const l = 0x60;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xe0);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x40;
      s.f |= 0x80;
      const l = 0x40;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.a).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x41;
      s.f |= 0x80;
      const l = 0x43;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xfe);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #5`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x61;
      s.f |= 0x80;
      const l = 0xb3;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xae);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("94: sub xh #1", () => {
    let s = testMachine.initCode([0xdd, 0x94]);
    s.a = 0x36;
    s.f |= 0x80;
    s.xh = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x12);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("94: sub xh #2", () => {
    let s = testMachine.initCode([0xdd, 0x94]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xh = 0x60;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe0);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("94: sub xh #3", () => {
    let s = testMachine.initCode([0xdd, 0x94]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xh = 0x40;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("94: sub xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x94]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.xh = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xfe);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("94: sub xh #5", () => {
    let s = testMachine.initCode([0xdd, 0x94]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.xh = 0xb3;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xae);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("95: sub xl #1", () => {
    let s = testMachine.initCode([0xdd, 0x95]);
    s.a = 0x36;
    s.f |= 0x80;
    s.xl = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x12);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("95: sub xl #2", () => {
    let s = testMachine.initCode([0xdd, 0x95]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xl = 0x60;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe0);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("95: sub xl #3", () => {
    let s = testMachine.initCode([0xdd, 0x95]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xl = 0x40;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("95: sub xl #4", () => {
    let s = testMachine.initCode([0xdd, 0x95]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.xl = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xfe);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("95: sub xl #5", () => {
    let s = testMachine.initCode([0xdd, 0x95]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.xl = 0xb3;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xae);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("96: sub (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0x96, 0x52]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x24;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x12);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("96: sub (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0x96, 0xfe]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x60;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xe0);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("96: sub (ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0x96, 0x52]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x40;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("96: sub (ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0x96, 0xfe]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x43;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xfe);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("96: sub (ix+D) #5", () => {
    let s = testMachine.initCode([0xdd, 0x96, 0x52]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0xb3;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xae);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x36;
      s.f |= 0x80;
      const l = 0x24;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x11);
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.H).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      } else {
        expect(s.a).toBe(0xff);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x40;
      s.f |= 0x80;
      const l = 0x60;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xdf);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.a).toBe(0xff);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x40;
      s.f |= 0x80;
      const l = 0x3f;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      } else {
        expect(s.a).toBe(0xff);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      }

      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x41;
      s.f |= 0x80;
      const l = 0x43;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xfd);
      } else {
        expect(s.a).toBe(0xff);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #5`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x61;
      s.f |= 0x80;
      const l = 0xb3;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xad);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
      } else {
        expect(s.a).toBe(0xff);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("9c: sbc xh #1", () => {
    let s = testMachine.initCode([0xdd, 0x9c]);
    s.a = 0x36;
    s.f |= 0x80;
    s.xh = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x11);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9c: sbc xh #2", () => {
    let s = testMachine.initCode([0xdd, 0x9c]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xh = 0x60;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xdf);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9c: sbc xh #3", () => {
    let s = testMachine.initCode([0xdd, 0x9c]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xh = 0x3f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9c: sbc xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x9c]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.xh = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xfd);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9c: sbc xh #5", () => {
    let s = testMachine.initCode([0xdd, 0x9c]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.xh = 0xb3;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xad);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9d: sbc xl #1", () => {
    let s = testMachine.initCode([0xdd, 0x9d]);
    s.a = 0x36;
    s.f |= 0x80;
    s.xl = 0x24;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x11);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9d: sbc xl #2", () => {
    let s = testMachine.initCode([0xdd, 0x9d]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xl = 0x60;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xdf);
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9d: sbc xl #3", () => {
    let s = testMachine.initCode([0xdd, 0x9d]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.xl = 0x3f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9d: sbc xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x9d]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.xl = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xfd);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9d: sbc xl #5", () => {
    let s = testMachine.initCode([0xdd, 0x9d]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.xl = 0xb3;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xad);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("9e: sbc a,(ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0x9e, 0x52]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x24;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x11);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("9e: sbc a,(ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0x9e, 0xfe]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x60;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xdf);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("9e: sbc a,(ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0x9e, 0x52]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x3f;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("9e: sbc a,(ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0x9e, 0xfe]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x43;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xfd);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("9e: sbc a,(ix+D) #5", () => {
    let s = testMachine.initCode([0xdd, 0x9e, 0x52]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0xb3;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xad);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x12;
      s.f |= 0x80;
      const l = 0x23;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x02);
      } else {
        expect(s.a).toBe(0x23);
        expect(s.f & FlagsSetMask.H).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0xf2;
      s.f |= 0x80;
      const l = 0xf3;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xf2);
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
      } else {
        expect(s.a).toBe(0xf3);
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0xc3;
      s.f |= 0x80;
      const l = 0x3c;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
      } else {
        expect(s.a).toBe(0x3c);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x33;
      s.f |= 0x80;
      const l = 0x22;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x22);
      } else {
        expect(s.a).toBe(0x22);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("a4: and xh #1", () => {
    let s = testMachine.initCode([0xdd, 0xa4]);
    s.a = 0x12;
    s.xh = 0x23;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x02);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a4: and xh #2", () => {
    let s = testMachine.initCode([0xdd, 0xa4]);
    s.a = 0xf2;
    s.xh = 0xf3;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xf2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a4: and xh #3", () => {
    let s = testMachine.initCode([0xdd, 0xa4]);
    s.a = 0xc3;
    s.xh = 0x3c;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a4: and xh #4", () => {
    let s = testMachine.initCode([0xdd, 0xa4]);
    s.a = 0x33;
    s.xh = 0x22;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x22);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a5: and xl #1", () => {
    let s = testMachine.initCode([0xdd, 0xa5]);
    s.a = 0x12;
    s.xl = 0x23;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x02);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a5: and xl #2", () => {
    let s = testMachine.initCode([0xdd, 0xa5]);
    s.a = 0xf2;
    s.xl = 0xf3;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xf2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a5: and xl #3", () => {
    let s = testMachine.initCode([0xdd, 0xa5]);
    s.a = 0xc3;
    s.xl = 0x3c;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a5: and xl #4", () => {
    let s = testMachine.initCode([0xdd, 0xa5]);
    s.a = 0x33;
    s.xl = 0x22;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x22);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("a6: and (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0xa6, 0x52]);
    s.a = 0x12;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x23;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x02);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("a6: and (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0xa6, 0xfe]);
    s.a = 0xf2;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0xf3;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xf2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("a6: and (ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0xa6, 0x52]);
    s.a = 0xc3;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x3c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("a6: and (ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0xa6, 0xfe]);
    s.a = 0x33;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x22;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x22);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x12;
      s.f |= 0x80;
      const l = 0x23;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x31);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0xf2;
      s.f |= 0x80;
      const l = 0x03;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xf1);
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.S).toBeTruthy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.S).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x43;
      s.f |= 0x80;
      const l = 0x43;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.a).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x12;
      s.f |= 0x80;
      const l = 0x23;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x31);
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
      } else {
        expect(s.a).toBe(0x00);
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("ac: xor xh #1", () => {
    let s = testMachine.initCode([0xdd, 0xac]);
    s.a = 0x12;
    s.xh = 0x23;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x31);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ac: xor xh #2", () => {
    let s = testMachine.initCode([0xdd, 0xac]);
    s.a = 0xf2;
    s.xh = 0x03;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xf1);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ac: xor xh #3", () => {
    let s = testMachine.initCode([0xdd, 0xac]);
    s.a = 0x43;
    s.xh = 0x43;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ac: and xh #4", () => {
    let s = testMachine.initCode([0xdd, 0xac]);
    s.a = 0x33;
    s.xh = 0x22;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x11);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ad: xor xl #1", () => {
    let s = testMachine.initCode([0xdd, 0xad]);
    s.a = 0x12;
    s.xl = 0x23;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x31);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ad: xor xl #2", () => {
    let s = testMachine.initCode([0xdd, 0xad]);
    s.a = 0xf2;
    s.xl = 0x03;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xf1);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ad: xor xl #3", () => {
    let s = testMachine.initCode([0xdd, 0xad]);
    s.a = 0x43;
    s.xl = 0x43;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ad: and xl #4", () => {
    let s = testMachine.initCode([0xdd, 0xad]);
    s.a = 0x33;
    s.xl = 0x22;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x11);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("ae: xor (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0xae, 0x52]);
    s.a = 0x12;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x23;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x31);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("ae: and (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0xae, 0xfe]);
    s.a = 0xf2;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x03;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xf1);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("ae: and (ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0xae, 0x52]);
    s.a = 0x43;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x43;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("ae: and (ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0xae, 0xfe]);
    s.a = 0x33;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x22;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x11);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x52;
      s.f |= 0x80;
      const l = 0x23;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x73);
      } else {
        expect(s.a).toBe(0x23);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x82;
      s.f |= 0x80;
      const l = 0x22;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0xa2);
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
      } else {
        expect(s.a).toBe(0x22);
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.S).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x00;
      s.f |= 0x80;
      const l = 0x00;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.a).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x32;
      s.f |= 0x80;
      const l = 0x11;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.a).toBe(0x33);
      } else {
        expect(s.a).toBe(0x11);
      }
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("b4: or xh #1", () => {
    let s = testMachine.initCode([0xdd, 0xb4]);
    s.a = 0x52;
    s.xh = 0x23;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x73);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b4: or xh #2", () => {
    let s = testMachine.initCode([0xdd, 0xb4]);
    s.a = 0x82;
    s.xh = 0x22;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xa2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b4: and xh #3", () => {
    let s = testMachine.initCode([0xdd, 0xb4]);
    s.a = 0x00;
    s.xh = 0x00;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b4: and xh #4", () => {
    let s = testMachine.initCode([0xdd, 0xb4]);
    s.a = 0x32;
    s.xh = 0x11;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x33);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b5: or xl #1", () => {
    let s = testMachine.initCode([0xdd, 0xb5]);
    s.a = 0x52;
    s.xl = 0x23;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x73);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b5: or xl #2", () => {
    let s = testMachine.initCode([0xdd, 0xb5]);
    s.a = 0x82;
    s.xl = 0x22;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xa2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b5: and xl #3", () => {
    let s = testMachine.initCode([0xdd, 0xb5]);
    s.a = 0x00;
    s.xl = 0x00;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b5: and xl #4", () => {
    let s = testMachine.initCode([0xdd, 0xb5]);
    s.a = 0x32;
    s.xl = 0x11;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x33);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("b6: or (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0xb6, 0x52]);
    s.a = 0x52;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x23;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x73);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("b6: or (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0xb6, 0xfe]);
    s.a = 0x82;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x22;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0xa2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("b6: and (ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0xb6, 0x52]);
    s.a = 0x00;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x00;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("b6: and (ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0xb6, 0xfe]);
    s.a = 0x32;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x11;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x33);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xdd,opCode]);
      s.a = 0x36;
      s.f |= 0x80;
      const l = 0x24;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
      } else {
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x40;
      s.f |= 0x80;
      const l = 0x60;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x40;
      s.f |= 0x80;
      const l = 0x40;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x41;
      s.f |= 0x80;
      const l = 0x43;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #5`, () => {
      let s = testMachine.initCode([0xdd, opCode]);
      s.a = 0x61;
      s.f |= 0x80;
      const l = 0xb3;
      switch (q) {
        case 0:
          s.b = l;
          break;
        case 1:
          s.c = l;
          break;
        case 2:
          s.d = l;
          break;
        case 3:
          s.e = l;
          break;
        case 4:
          s.h = l;
          break;
        case 5:
          s.l = l;
          break;
        case 7:
          s.a = l;
          break;
      }
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      if (q !== 7) {
        expect(s.f & FlagsSetMask.S).toBeTruthy();
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.C).toBeTruthy();
      } else {
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeFalsy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.N).toBeTruthy();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("bc: cp xh #1", () => {
    let s = testMachine.initCode([0xdd, 0xbc]);
    s.a = 0x36;
    s.xh = 0x24;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bc: cp xh #2", () => {
    let s = testMachine.initCode([0xdd, 0xbc]);
    s.a = 0x40;
    s.xh = 0x60;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bc: cp xh #3", () => {
    let s = testMachine.initCode([0xdd, 0xbc]);
    s.a = 0x40;
    s.xh = 0x40;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bc: cp xh #4", () => {
    let s = testMachine.initCode([0xdd, 0xbc]);
    s.a = 0x41;
    s.xh = 0x43;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bc: cp xh #5", () => {
    let s = testMachine.initCode([0xdd, 0xbc]);
    s.a = 0x61;
    s.xh = 0xb3;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bd: cp xl #1", () => {
    let s = testMachine.initCode([0xdd, 0xbd]);
    s.a = 0x36;
    s.xl = 0x24;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bd: cp xl #2", () => {
    let s = testMachine.initCode([0xdd, 0xbd]);
    s.a = 0x40;
    s.xl = 0x60;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bd: cp xl #3", () => {
    let s = testMachine.initCode([0xdd, 0xbd]);
    s.a = 0x40;
    s.xl = 0x40;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bd: cp xl #4", () => {
    let s = testMachine.initCode([0xdd, 0xbd]);
    s.a = 0x41;
    s.xl = 0x43;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("bd: cp xl #5", () => {
    let s = testMachine.initCode([0xdd, 0xbd]);
    s.a = 0x61;
    s.xl = 0xb3;
    const m = testMachine.memory;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("be: cp (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0xbe, 0x52]);
    s.a = 0x36;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x24;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("be: cp (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0xbe, 0xfe]);
    s.a = 0x40;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x60;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("be: cp (ix+D) #3", () => {
    let s = testMachine.initCode([0xdd, 0xbe, 0x52]);
    s.a = 0x40;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0x40;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("be: cp (ix+D) #4", () => {
    let s = testMachine.initCode([0xdd, 0xbe, 0xfe]);
    s.a = 0x41;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix - 2] = 0x43;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });

  it("be: cp (ix+D) #5", () => {
    let s = testMachine.initCode([0xdd, 0xbe, 0x52]);
    s.a = 0x61;
    s.ix = 0x1000;
    const m = testMachine.memory;
    m[s.ix + 0x52] = 0xb3;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(19);
  });
});
