import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Indexed ops (iy) 80-bf", () => {
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("84: add a,yh #1", () => {
    let s = testMachine.initCode([0xfd, 0x84]);
    s.a = 0x12;
    s.yh = 0x24;
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

  it("84: add a,yh #2", () => {
    let s = testMachine.initCode([0xfd, 0x84]);
    s.a = 0xf0;
    s.yh = 0xf0;
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

  it("84: add a,yh #3", () => {
    let s = testMachine.initCode([0xfd, 0x84]);
    s.a = 0x82;
    s.yh = 0x7e;
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

  it("84: add a,yh #4", () => {
    let s = testMachine.initCode([0xfd, 0x84]);
    s.a = 0x44;
    s.yh = 0x42;
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

  it("85: add a,yl #1", () => {
    let s = testMachine.initCode([0xfd, 0x85]);
    s.a = 0x12;
    s.yl = 0x24;
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

  it("85: add a,yl #2", () => {
    let s = testMachine.initCode([0xfd, 0x85]);
    s.a = 0xf0;
    s.yl = 0xf0;
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

  it("85: add a,yl #3", () => {
    let s = testMachine.initCode([0xfd, 0x85]);
    s.a = 0x82;
    s.yl = 0x7e;
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

  it("85: add a,yl #4", () => {
    let s = testMachine.initCode([0xfd, 0x85]);
    s.a = 0x44;
    s.yl = 0x42;
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

  it("86: add a,(iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0x86, 0x52]);
    s.a = 0x12;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x24;
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

  it("86: add a,(iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0x86, 0xfe]);
    s.a = 0xf0;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0xf0;
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

  it("86: add a,(iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0x86, 0x52]);
    s.a = 0x82;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x7e;
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

  it("86: add a,(iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0x86, 0xfe]);
    s.a = 0x44;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x42;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("8c: adc a,yh #1", () => {
    let s = testMachine.initCode([0xfd, 0x8c]);
    s.a = 0x12;
    s.f != FlagsSetMask.C;
    s.yh = 0x24;
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

  it("8c: adc a,yh #2", () => {
    let s = testMachine.initCode([0xfd, 0x8c]);
    s.a = 0xf0;
    s.f != FlagsSetMask.C;
    s.yh = 0xf0;
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

  it("8c: adc a,yh #3", () => {
    let s = testMachine.initCode([0xfd, 0x8c]);
    s.a = 0x82;
    s.f != FlagsSetMask.C;
    s.yh = 0x7d;
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

  it("8c: adc a,yh #4", () => {
    let s = testMachine.initCode([0xfd, 0x8c]);
    s.a = 0x44;
    s.f != FlagsSetMask.C;
    s.yh = 0x42;
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

  it("8d: adc a,yl #1", () => {
    let s = testMachine.initCode([0xfd, 0x8d]);
    s.a = 0x12;
    s.f != FlagsSetMask.C;
    s.yl = 0x24;
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

  it("8d: adc a,yl #2", () => {
    let s = testMachine.initCode([0xfd, 0x8d]);
    s.a = 0xf0;
    s.f != FlagsSetMask.C;
    s.yl = 0xf0;
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

  it("8d: adc a,yl #3", () => {
    let s = testMachine.initCode([0xfd, 0x8d]);
    s.a = 0x82;
    s.f != FlagsSetMask.C;
    s.yl = 0x7d;
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

  it("8d: adc a,yl #4", () => {
    let s = testMachine.initCode([0xfd, 0x8d]);
    s.a = 0x44;
    s.f != FlagsSetMask.C;
    s.yl = 0x42;
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

  it("8e: adc a,(iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0x8e, 0x52]);
    s.a = 0x12;
    s.f |= 0x80;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x24;
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

  it("8e: adc a,(iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0x8e, 0xfe]);
    s.a = 0xf0;
    s.f |= 0x80;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0xf0;
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

  it("8e: adc a,(iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0x8e, 0x52]);
    s.a = 0x82;
    s.f |= 0x80;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x7d;
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

  it("8e: adc a,(iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0x8e, 0xfe]);
    s.a = 0x44;
    s.f |= 0x80;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x42;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("94: sub yh #1", () => {
    let s = testMachine.initCode([0xfd, 0x94]);
    s.a = 0x36;
    s.f |= 0x80;
    s.yh = 0x24;
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

  it("94: sub yh #2", () => {
    let s = testMachine.initCode([0xfd, 0x94]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yh = 0x60;
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

  it("94: sub yh #3", () => {
    let s = testMachine.initCode([0xfd, 0x94]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yh = 0x40;
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

  it("94: sub yh #4", () => {
    let s = testMachine.initCode([0xfd, 0x94]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.yh = 0x43;
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

  it("94: sub yh #5", () => {
    let s = testMachine.initCode([0xfd, 0x94]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.yh = 0xb3;
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

  it("95: sub yl #1", () => {
    let s = testMachine.initCode([0xfd, 0x95]);
    s.a = 0x36;
    s.f |= 0x80;
    s.yl = 0x24;
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

  it("95: sub yl #2", () => {
    let s = testMachine.initCode([0xfd, 0x95]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yl = 0x60;
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

  it("95: sub yl #3", () => {
    let s = testMachine.initCode([0xfd, 0x95]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yl = 0x40;
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

  it("95: sub yl #4", () => {
    let s = testMachine.initCode([0xfd, 0x95]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.yl = 0x43;
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

  it("95: sub yl #5", () => {
    let s = testMachine.initCode([0xfd, 0x95]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.yl = 0xb3;
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

  it("96: sub (iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0x96, 0x52]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x24;
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

  it("96: sub (iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0x96, 0xfe]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x60;
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

  it("96: sub (iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0x96, 0x52]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x40;
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

  it("96: sub (iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0x96, 0xfe]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x43;
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

  it("96: sub (iy+D) #5", () => {
    let s = testMachine.initCode([0xfd, 0x96, 0x52]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0xb3;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("9c: sbc yh #1", () => {
    let s = testMachine.initCode([0xfd, 0x9c]);
    s.a = 0x36;
    s.f |= 0x80;
    s.yh = 0x24;
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

  it("9c: sbc yh #2", () => {
    let s = testMachine.initCode([0xfd, 0x9c]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yh = 0x60;
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

  it("9c: sbc yh #3", () => {
    let s = testMachine.initCode([0xfd, 0x9c]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yh = 0x3f;
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

  it("9c: sbc yh #4", () => {
    let s = testMachine.initCode([0xfd, 0x9c]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.yh = 0x43;
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

  it("9c: sbc yh #5", () => {
    let s = testMachine.initCode([0xfd, 0x9c]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.yh = 0xb3;
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

  it("9d: sbc yl #1", () => {
    let s = testMachine.initCode([0xfd, 0x9d]);
    s.a = 0x36;
    s.f |= 0x80;
    s.yl = 0x24;
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

  it("9d: sbc yl #2", () => {
    let s = testMachine.initCode([0xfd, 0x9d]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yl = 0x60;
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

  it("9d: sbc yl #3", () => {
    let s = testMachine.initCode([0xfd, 0x9d]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.yl = 0x3f;
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

  it("9d: sbc yh #4", () => {
    let s = testMachine.initCode([0xfd, 0x9d]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.yl = 0x43;
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

  it("9d: sbc yl #5", () => {
    let s = testMachine.initCode([0xfd, 0x9d]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.yl = 0xb3;
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

  it("9e: sbc a,(iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0x9e, 0x52]);
    s.a = 0x36;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x24;
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

  it("9e: sbc a,(iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0x9e, 0xfe]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x60;
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

  it("9e: sbc a,(iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0x9e, 0x52]);
    s.a = 0x40;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x3f;
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

  it("9e: sbc a,(iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0x9e, 0xfe]);
    s.a = 0x41;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x43;
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

  it("9e: sbc a,(iy+D) #5", () => {
    let s = testMachine.initCode([0xfd, 0x9e, 0x52]);
    s.a = 0x61;
    s.f |= FlagsSetMask.C;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0xb3;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("a4: and yh #1", () => {
    let s = testMachine.initCode([0xfd, 0xa4]);
    s.a = 0x12;
    s.yh = 0x23;
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

  it("a4: and yh #2", () => {
    let s = testMachine.initCode([0xfd, 0xa4]);
    s.a = 0xf2;
    s.yh = 0xf3;
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

  it("a4: and yh #3", () => {
    let s = testMachine.initCode([0xfd, 0xa4]);
    s.a = 0xc3;
    s.yh = 0x3c;
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

  it("a4: and yh #4", () => {
    let s = testMachine.initCode([0xfd, 0xa4]);
    s.a = 0x33;
    s.yh = 0x22;
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

  it("a5: and yl #1", () => {
    let s = testMachine.initCode([0xfd, 0xa5]);
    s.a = 0x12;
    s.yl = 0x23;
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

  it("a5: and yl #2", () => {
    let s = testMachine.initCode([0xfd, 0xa5]);
    s.a = 0xf2;
    s.yl = 0xf3;
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

  it("a5: and yl #3", () => {
    let s = testMachine.initCode([0xfd, 0xa5]);
    s.a = 0xc3;
    s.yl = 0x3c;
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

  it("a5: and yl #4", () => {
    let s = testMachine.initCode([0xfd, 0xa5]);
    s.a = 0x33;
    s.yl = 0x22;
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

  it("a6: and (iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0xa6, 0x52]);
    s.a = 0x12;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x23;
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

  it("a6: and (iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0xa6, 0xfe]);
    s.a = 0xf2;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0xf3;
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

  it("a6: and (iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0xa6, 0x52]);
    s.a = 0xc3;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x3c;
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

  it("a6: and (iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0xa6, 0xfe]);
    s.a = 0x33;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x22;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("ac: xor yh #1", () => {
    let s = testMachine.initCode([0xfd, 0xac]);
    s.a = 0x12;
    s.yh = 0x23;
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

  it("ac: xor yh #2", () => {
    let s = testMachine.initCode([0xfd, 0xac]);
    s.a = 0xf2;
    s.yh = 0x03;
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

  it("ac: xor yh #3", () => {
    let s = testMachine.initCode([0xfd, 0xac]);
    s.a = 0x43;
    s.yh = 0x43;
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

  it("ac: and yh #4", () => {
    let s = testMachine.initCode([0xfd, 0xac]);
    s.a = 0x33;
    s.yh = 0x22;
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

  it("ad: xor yl #1", () => {
    let s = testMachine.initCode([0xfd, 0xad]);
    s.a = 0x12;
    s.yl = 0x23;
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

  it("ad: xor yl #2", () => {
    let s = testMachine.initCode([0xfd, 0xad]);
    s.a = 0xf2;
    s.yl = 0x03;
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

  it("ad: xor yl #3", () => {
    let s = testMachine.initCode([0xfd, 0xad]);
    s.a = 0x43;
    s.yl = 0x43;
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

  it("ad: and yl #4", () => {
    let s = testMachine.initCode([0xfd, 0xad]);
    s.a = 0x33;
    s.yl = 0x22;
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

  it("ae: xor (iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0xae, 0x52]);
    s.a = 0x12;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x23;
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

  it("ae: and (iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0xae, 0xfe]);
    s.a = 0xf2;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x03;
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

  it("ae: and (iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0xae, 0x52]);
    s.a = 0x43;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x43;
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

  it("ae: and (iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0xae, 0xfe]);
    s.a = 0x33;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x22;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("b4: or yh #1", () => {
    let s = testMachine.initCode([0xfd, 0xb4]);
    s.a = 0x52;
    s.yh = 0x23;
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

  it("b4: or yh #2", () => {
    let s = testMachine.initCode([0xfd, 0xb4]);
    s.a = 0x82;
    s.yh = 0x22;
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

  it("b4: and yh #3", () => {
    let s = testMachine.initCode([0xfd, 0xb4]);
    s.a = 0x00;
    s.yh = 0x00;
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

  it("b4: and yh #4", () => {
    let s = testMachine.initCode([0xfd, 0xb4]);
    s.a = 0x32;
    s.yh = 0x11;
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

  it("b5: or yl #1", () => {
    let s = testMachine.initCode([0xfd, 0xb5]);
    s.a = 0x52;
    s.yl = 0x23;
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

  it("b5: or yl #2", () => {
    let s = testMachine.initCode([0xfd, 0xb5]);
    s.a = 0x82;
    s.yl = 0x22;
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

  it("b5: and yl #3", () => {
    let s = testMachine.initCode([0xfd, 0xb5]);
    s.a = 0x00;
    s.yl = 0x00;
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

  it("b5: and yl #4", () => {
    let s = testMachine.initCode([0xfd, 0xb5]);
    s.a = 0x32;
    s.yl = 0x11;
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

  it("b6: or (iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0xb6, 0x52]);
    s.a = 0x52;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x23;
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

  it("b6: or (iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0xb6, 0xfe]);
    s.a = 0x82;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x22;
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

  it("b6: and (iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0xb6, 0x52]);
    s.a = 0x00;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x00;
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

  it("b6: and (iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0xb6, 0xfe]);
    s.a = 0x32;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x11;
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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
      let s = testMachine.initCode([0xfd, opCode]);
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

  it("bc: cp yh #1", () => {
    let s = testMachine.initCode([0xfd, 0xbc]);
    s.a = 0x36;
    s.yh = 0x24;
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

  it("bc: cp yh #2", () => {
    let s = testMachine.initCode([0xfd, 0xbc]);
    s.a = 0x40;
    s.yh = 0x60;
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

  it("bc: cp yh #3", () => {
    let s = testMachine.initCode([0xfd, 0xbc]);
    s.a = 0x40;
    s.yh = 0x40;
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

  it("bc: cp yh #4", () => {
    let s = testMachine.initCode([0xfd, 0xbc]);
    s.a = 0x41;
    s.yh = 0x43;
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

  it("bc: cp yh #5", () => {
    let s = testMachine.initCode([0xfd, 0xbc]);
    s.a = 0x61;
    s.yh = 0xb3;
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

  it("bd: cp yl #1", () => {
    let s = testMachine.initCode([0xfd, 0xbd]);
    s.a = 0x36;
    s.yl = 0x24;
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

  it("bd: cp yl #2", () => {
    let s = testMachine.initCode([0xfd, 0xbd]);
    s.a = 0x40;
    s.yl = 0x60;
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

  it("bd: cp yl #3", () => {
    let s = testMachine.initCode([0xfd, 0xbd]);
    s.a = 0x40;
    s.yl = 0x40;
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

  it("bd: cp yl #4", () => {
    let s = testMachine.initCode([0xfd, 0xbd]);
    s.a = 0x41;
    s.yl = 0x43;
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

  it("bd: cp yl #5", () => {
    let s = testMachine.initCode([0xfd, 0xbd]);
    s.a = 0x61;
    s.yl = 0xb3;
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

  it("be: cp (iy+D) #1", () => {
    let s = testMachine.initCode([0xfd, 0xbe, 0x52]);
    s.a = 0x36;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x24;
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

  it("be: cp (iy+D) #2", () => {
    let s = testMachine.initCode([0xfd, 0xbe, 0xfe]);
    s.a = 0x40;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x60;
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

  it("be: cp (iy+D) #3", () => {
    let s = testMachine.initCode([0xfd, 0xbe, 0x52]);
    s.a = 0x40;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0x40;
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

  it("be: cp (iy+D) #4", () => {
    let s = testMachine.initCode([0xfd, 0xbe, 0xfe]);
    s.a = 0x41;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy - 2] = 0x43;
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

  it("be: cp (iy+D) #5", () => {
    let s = testMachine.initCode([0xfd, 0xbe, 0x52]);
    s.a = 0x61;
    s.iy = 0x1000;
    const m = testMachine.memory;
    m[s.iy + 0x52] = 0xb3;
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
