import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask, Z80CpuState } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Bit ops 00-3f", () => {
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
    if (q === 6) continue;
    const opCode = 0x00 + q;
    it(`0${q}: rlc ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x08);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x10);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`0${q}: rlc ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x84);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x09);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`0${q}: rlc ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x00);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`0${q}: rlc ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0xc0);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x81);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("06: rlc (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x06]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x08
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x10);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("06: rlc (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x06]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x84
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x09);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("06: rlc (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x06]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x00;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("06: rlc (hl) #4", () => {
    let s = testMachine.initCode([0xcb, 0x06]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0xc0;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x81);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x08 + q;
    it(`0${q.toString(16)}: rrc ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x08);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x04);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`0${q.toString(16)}: rrc ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x85);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0xc2);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`0${q}: rrc ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x00);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`0${q}: rrc ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x41);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0xa0);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("0e: rrc (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x0e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x08
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x04);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("0e: rrc (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x0e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x85
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0xc2);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("0e: rrc (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x0e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x00;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("0e: rlc (hl) #4", () => {
    let s = testMachine.initCode([0xcb, 0x0e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x41;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0xa0);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x10 + q;
    it(`${q.toString(16)}: rl ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x08);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x10);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: rl ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x84);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x08);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q}: rl ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x00);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q}: rl ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0xc0);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x80);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("16: rl (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x16]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x08
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x10);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("16: rl (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x16]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x84
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x08);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("16: rl (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x16]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x00;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("16: rl (hl) #4", () => {
    let s = testMachine.initCode([0xcb, 0x16]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0xc0;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x80);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x18 + q;
    it(`${q.toString(16)}: rr ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x08);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x04);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: rr ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x85);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x42);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q}: rr ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x00);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q}: rr ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0xc0);
      s.f |= FlagsSetMask.C;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0xe0);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("1e: rr (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x1e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x08
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x04);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("1e: rr (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x1e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x85
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x42);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("1e: rr (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x1e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x00;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("1e: rlc (hl) #4", () => {
    let s = testMachine.initCode([0xcb, 0x1e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f |= FlagsSetMask.C;
    m[s.hl] = 0xc0;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0xe0);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x20 + q;
    it(`${q.toString(16)}: sla ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x08);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x10);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: sla ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x88);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x10);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: sla ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x48);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x90);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: sla ${reg8[q]} #4`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x80);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("26: sla (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x26]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x08
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x10);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("26: sla (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x26]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x88
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x10);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("26: sla (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x26]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x48;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x90);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("26: sla (hl) #4", () => {
    let s = testMachine.initCode([0xcb, 0x26]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x80;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x28 + q;
    it(`${q.toString(16)}: sra ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x10);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x08);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: sra ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x21);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x10);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString()}: sra ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x01);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("2e: sra (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x2e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x10
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x08);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("2e: sra (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x2e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x21
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x10);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("2e: sra (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x2e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x01;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x30 + q;
    it(`${q.toString(16)}: sll ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x08);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x11);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: sll ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x88);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x11);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString()}: sll ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x48);
      s.f &= 0xfe;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x91);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("36: sll (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x36]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x08
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x11);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("36: sll (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x36]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x88
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x11);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("36: sra (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x36]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f &= 0xfe;
    m[s.hl] = 0x48;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x91);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    const opCode = 0x38 + q;
    it(`${q.toString(16)}: srl ${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x10);
      s.f |= FlagsSetMask.C;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x08);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString(16)}: srl ${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x21);
      s.f |= FlagsSetMask.C;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x10);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${q.toString()}: srl ${reg8[q]} #3`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      setReg8(s, q, 0x01);
      s.f |= FlagsSetMask.C;
      s = testMachine.run(s);

      expect(getReg8(s, q)).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();

      testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  it("3e: srl (hl) #1", () => {
    let s = testMachine.initCode([0xcb, 0x3e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f |= FlagsSetMask.C;
    m[s.hl] = 0x10
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x08);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("3e: srl (hl) #2", () => {
    let s = testMachine.initCode([0xcb, 0x3e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f |= FlagsSetMask.C;
    m[s.hl] = 0x21
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x10);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("3e: srl (hl) #3", () => {
    let s = testMachine.initCode([0xcb, 0x3e]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    s.f |= FlagsSetMask.C;
    m[s.hl] = 0x01;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(m[0x1000]).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });



});

function setReg8(s: Z80CpuState, q: number, val: number): void {
  switch (q) {
    case 0:
      s.b = val;
      break;
    case 1:
      s.c = val;
      break;
    case 2:
      s.d = val;
      break;
    case 3:
      s.e = val;
      break;
    case 4:
      s.h = val;
      break;
    case 5:
      s.l = val;
      break;
    case 7:
      s.a = val;
      break;
  }
}

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
