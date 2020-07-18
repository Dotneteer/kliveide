import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Standard ops 80-bf", () => {
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
    if (q === 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q == 6) continue;
    const opCode = 0x80 + q;
    it(`${opCode.toString(16)}: add a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("86: add a,(hl) #1", () => {
    let s = testMachine.initCode([0x86]);
    s.a = 0x12;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x24;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("86: add a,(hl) #2", () => {
    let s = testMachine.initCode([0x86]);
    s.a = 0xf0;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0xf0;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("86: add a,(hl) #3", () => {
    let s = testMachine.initCode([0x86]);
    s.a = 0x82;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x7e;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("86: add a,(hl) #4", () => {
    let s = testMachine.initCode([0x86]);
    s.a = 0x44;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x42;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
      s.a = 0x12;
      s.f |= 0x01;
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x88 + q;
    it(`${opCode.toString(16)}: adc a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("8e: adc a,(hl) #1", () => {
    let s = testMachine.initCode([0x8e]);
    s.a = 0x12;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x24;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("8e: adc a,(hl) #2", () => {
    let s = testMachine.initCode([0x8e]);
    s.a = 0xf0;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0xf0;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("8e: adc a,(hl) #3", () => {
    let s = testMachine.initCode([0x8e]);
    s.a = 0x82;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x7d;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("8e: adc a,(hl) #4", () => {
    let s = testMachine.initCode([0x8e]);
    s.a = 0x44;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x42;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x90 + q;
    it(`${opCode.toString(16)}: sub a,${reg8[q]} #5`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("96: sub (hl) #1", () => {
    let s = testMachine.initCode([0x96]);
    s.a = 0x36;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x24;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("96: sub (hl) #2", () => {
    let s = testMachine.initCode([0x96]);
    s.a = 0x40;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x60;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("96: sub (hl) #3", () => {
    let s = testMachine.initCode([0x96]);
    s.a = 0x40;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x40;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("96: sub (hl) #4", () => {
    let s = testMachine.initCode([0x96]);
    s.a = 0x41;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x43;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("96: sub (hl) #5", () => {
    let s = testMachine.initCode([0x96]);
    s.a = 0x61;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0xb3;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x98 + q;
    it(`${opCode.toString(16)}: sbc a,${reg8[q]} #5`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("9e: sbc a,(hl) #1", () => {
    let s = testMachine.initCode([0x9e]);
    s.a = 0x36;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x24;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("9e: sbc a,(hl) #2", () => {
    let s = testMachine.initCode([0x9e]);
    s.a = 0x40;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x60;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("9e: sbc a,(hl) #3", () => {
    let s = testMachine.initCode([0x9e]);
    s.a = 0x40;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x3f;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("9e: sbc a,(hl) #4", () => {
    let s = testMachine.initCode([0x9e]);
    s.a = 0x41;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x43;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("9e: sbc a,(hl) #5", () => {
    let s = testMachine.initCode([0x9e]);
    s.a = 0x61;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0xb3;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa0 + q;
    it(`${opCode.toString(16)}: and ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("a6: and (hl) #1", () => {
    let s = testMachine.initCode([0xa6]);
    s.a = 0x12;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x23;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("a6: and (hl) #2", () => {
    let s = testMachine.initCode([0xa6]);
    s.a = 0xf2;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0xf3;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("a6: and (hl) #3", () => {
    let s = testMachine.initCode([0xa6]);
    s.a = 0xc3;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x3c;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("a6: and (hl) #4", () => {
    let s = testMachine.initCode([0xa6]);
    s.a = 0x33;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x22;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q == 6) continue;
    const opCode = 0xa8 + q;
    it(`${opCode.toString(16)}: xor ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("ae: xor (hl) #1", () => {
    let s = testMachine.initCode([0xae]);
    s.a = 0x12;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x23;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("ae: and (hl) #2", () => {
    let s = testMachine.initCode([0xae]);
    s.a = 0xf2;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x03;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("ae: and (hl) #3", () => {
    let s = testMachine.initCode([0xae]);
    s.a = 0x43;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x43;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("ae: and (hl) #4", () => {
    let s = testMachine.initCode([0xae]);
    s.a = 0x33;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x22;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q == 6) continue;
    const opCode = 0xb0 + q;
    it(`${opCode.toString(16)}: or ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("b6: or (hl) #1", () => {
    let s = testMachine.initCode([0xb6]);
    s.a = 0x52;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x23;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("b6: or (hl) #2", () => {
    let s = testMachine.initCode([0xb6]);
    s.a = 0x82;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x22;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("b6: and (hl) #3", () => {
    let s = testMachine.initCode([0xb6]);
    s.a = 0x00;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x00;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("b6: and (hl) #4", () => {
    let s = testMachine.initCode([0xb6]);
    s.a = 0x32;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x11;
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

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0xb8 + q;
    it(`${opCode.toString(16)}: cp ${reg8[q]} #5`, () => {
      let s = testMachine.initCode([opCode]);
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

      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  }

  it("be: cp (hl) #1", () => {
    let s = testMachine.initCode([0xbe]);
    s.a = 0x36;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x24;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("be: cp (hl) #2", () => {
    let s = testMachine.initCode([0xbe]);
    s.a = 0x40;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x60;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("be: cp (hl) #3", () => {
    let s = testMachine.initCode([0xbe]);
    s.a = 0x40;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x40;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("be: cp (hl) #4", () => {
    let s = testMachine.initCode([0xbe]);
    s.a = 0x41;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0x43;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("be: cp (hl) #5", () => {
    let s = testMachine.initCode([0xbe]);
    s.a = 0x61;
    s.f |= 0x80;
    s.hl = 0x1000;
    const m = testMachine.memory;
    m[s.hl] = 0xb3;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });
});
