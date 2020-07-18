import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask, Z80CpuState } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Indexed bit ops 00-3f (ix)", () => {
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
  for (let q = 0; q <= 7; q++) {
    const opCode = 0x00 + q;
    it(`0${q.toString(16)}: rlc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rlc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rlc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x84;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x09);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rlc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #4`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x00;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rlc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #5`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0xc0;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x81);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x08 + q;
    it(`0${q.toString(16)}: rrc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x04);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rrc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x85;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0xc2);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rrc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x00;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rrc (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #4`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x41;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0xa0);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x10 + q;
    it(`${q.toString(16)}: rl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x84;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x08);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x00;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #4`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0xc0;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x80);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x18 + q;
    it(`${q.toString(16)}: rr (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x04);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rr (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x85;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x42);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rr (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x00;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: rr (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #4`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0xc0;
      s.f |= FlagsSetMask.C;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0xe0);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x20 + q;
    it(`${q.toString(16)}: sla (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sla (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x88;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sla (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x48;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x90);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sla (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #4`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x80;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x28 + q;
    it(`${q.toString(16)}: sra (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x10;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x08);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sra (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x21;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sra (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x01;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x30 + q;
    it(`${q.toString(16)}: sll (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x11);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sll (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x88;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x11);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sll (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x48;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x91);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: sll (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #4`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x08;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x11);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }

  for (let q = 0; q <= 7; q++) {
    const opCode = 0x38 + q;
    it(`${q.toString(16)}: srl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #1`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x10;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x08);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: srl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #2`, () => {
      const OFFS = 0xfe;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix - 256 + OFFS] = 0x21;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix - 256 + OFFS]).toBe(0x10);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix - 256 + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("0ffe");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });

    it(`0${q.toString(16)}: srl (ix+D)${
      q === 6 ? "" : "," + reg8[q]
    } #3`, () => {
      const OFFS = 0x32;
      let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
      let m = testMachine.memory;
      s.ix = 0x1000;
      m[s.ix + OFFS] = 0x01;
      s.f &= 0xfe;

      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[s.ix + OFFS]).toBe(0x00);
      if (q !== 6) {
        expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
      }
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory("1032");

      expect(s.pc).toBe(0x0004);
      expect(s.tacts).toBe(23);
    });
  }
});

function getReg8(s: Z80CpuState, q: number): number {
  switch (q) {
    case 0:
      return s.b;
    case 1:
      return s.c;
    case 2:
      return s.d;
    case 3:
      return s.e;
    case 4:
      return s.h;
    case 5:
      return s.l;
    case 7:
      return s.a;
  }
  return 0;
}
