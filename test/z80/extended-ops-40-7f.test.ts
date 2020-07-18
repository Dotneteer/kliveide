import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";
import { RunMode } from "../../src/native/RunMode";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Extended ops 40-7f", () => {
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

  it("40: in b,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x40]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, F");
    expect(s.b).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("41: out (c), b", () => {
    let s = testMachine.initCode([0xed, 0x41]);
    s.bc = 0x10fd;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0x10);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("42: sbc hl,bc #1", () => {
    let s = testMachine.initCode([0xed, 0x42]);
    s.f &= 0xfe;
    s.hl = 0x3456;
    s.bc = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2222);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("42: sbc hl,bc #2", () => {
    let s = testMachine.initCode([0xed, 0x42]);
    s.f &= 0xfe;
    s.hl = 0x1234;
    s.bc = 0x3456;
    s = testMachine.run(s);

    expect(s.hl).toBe(0xddde);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("42: sbc hl,bc #3", () => {
    let s = testMachine.initCode([0xed, 0x42]);
    s.f &= 0xfe;
    s.hl = 0x1234;
    s.bc = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("42: sbc hl,bc #4", () => {
    let s = testMachine.initCode([0xed, 0x42]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x3456;
    s.bc = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2221);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("43: ld (NN),bc", () => {
    let s = testMachine.initCode([0xed, 0x43, 0x00, 0x10]);
    s.bc = 0x1234;
    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x34);
    expect(m[0x1001]).toBe(0x12);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000-1001");
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  for (let i = 0x44; i < 0x7f; i += 8) {
    it(`${i.toString(16)}: neg #1`, () => {
      let s = testMachine.initCode([0xed, i]);
      s.a = 0x03;
      s = testMachine.run(s);

      expect(s.a).toBe(0xfd);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();
      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${i.toString(16)}: neg #2`, () => {
      let s = testMachine.initCode([0xed, i]);
      s.a = 0x00;
      s = testMachine.run(s);

      expect(s.a).toBe(0x00);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();
      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${i.toString(16)}: neg #3`, () => {
      let s = testMachine.initCode([0xed, i]);
      s.a = 0x80;
      s = testMachine.run(s);

      expect(s.a).toBe(0x80);
      expect(s.f & FlagsSetMask.S).toBeTruthy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();
      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });

    it(`${i.toString(16)}: neg #4`, () => {
      let s = testMachine.initCode([0xed, i]);
      s.a = 0xd0;
      s = testMachine.run(s);

      expect(s.a).toBe(0x30);
      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeFalsy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeTruthy();
      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let i = 0x45; i < 0x7f; i += 8) {
    it(`${i.toString(16)}: retn #1`, () => {
      let s = testMachine.initCode(
        [
          0x3e,
          0x16, // LD A,#16
          0xcd,
          0x06,
          0x00, // CALL #0006
          0x76, // HALT
          0xed,
          i, // RETN
        ],
        RunMode.UntilHalt
      );
      s.sp = 0x00;
      s.iff1 = false;
      s = testMachine.run(s);

      expect(s.iff1).toBe(s.iff2);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory("fffe-ffff");
      expect(s.pc).toBe(0x0005);
      expect(s.tacts).toBe(42);
    });

    it(`${i.toString(16)}: retn #2`, () => {
      let s = testMachine.initCode(
        [
          0x3e,
          0x16, // LD A,#16
          0xcd,
          0x06,
          0x00, // CALL #0006
          0x76, // HALT
          0xed,
          i, // RETN
        ],
        RunMode.UntilHalt
      );
      s.sp = 0x00;
      s.iff1 = true;
      s = testMachine.run(s);

      expect(s.iff1).toBe(s.iff2);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory("fffe-ffff");
      expect(s.pc).toBe(0x0005);
      expect(s.tacts).toBe(42);
    });
  }

  it("46: im 0", () => {
    let s = testMachine.initCode([0xed, 0x46]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x0);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("47: ld i,a", () => {
    let s = testMachine.initCode([0xed, 0x47]);
    s.a = 0xd5;
    s = testMachine.run(s);

    expect(s.i).toBe(0xd5);
    testMachine.shouldKeepRegisters("I");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("48: in c,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x48]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, F");
    expect(s.c).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("49: out (c),c", () => {
    let s = testMachine.initCode([0xed, 0x49]);
    s.bc = 0x10fd;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0xfd);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("4a: adc hl,bc #1", () => {
    let s = testMachine.initCode([0xed, 0x4a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.bc = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2346);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("4a: adc hl,bc #2", () => {
    let s = testMachine.initCode([0xed, 0x4a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.bc = 0xf234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0346);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("4a: adc hl,bc #3", () => {
    let s = testMachine.initCode([0xed, 0x4a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.bc = 0x7234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x8346);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("4a: adc hl,bc #4", () => {
    let s = testMachine.initCode([0xed, 0x4a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x0001;
    s.bc = 0xfffe;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("4b: ld bc,(NN)", () => {
    let s = testMachine.initCode([0xed, 0x4b, 0x00, 0x10]);
    const m = testMachine.memory;
    m[0x1000] = 0x34;
    m[0x1001] = 0x12;
    s = testMachine.run(s, m);

    expect(s.bc).toBe(0x1234);
    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("4e: im 0/1", () => {
    let s = testMachine.initCode([0xed, 0x4e]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x0);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("4f: ld r,a", () => {
    let s = testMachine.initCode([0xed, 0x4f]);
    s.a = 0xd5;
    s = testMachine.run(s);

    expect(s.r).toBe(0xd5);
    testMachine.shouldKeepRegisters("R");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("50: in d,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x50]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, D, F");
    expect(s.d).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("51: out (c),d", () => {
    let s = testMachine.initCode([0xed, 0x51]);
    s.bc = 0x10fd;
    s.d = 0xc3;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0xc3);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("52: sbc hl,de #1", () => {
    let s = testMachine.initCode([0xed, 0x52]);
    s.f &= 0xfe;
    s.hl = 0x3456;
    s.de = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2222);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("52: sbc hl,de #2", () => {
    let s = testMachine.initCode([0xed, 0x52]);
    s.f &= 0xfe;
    s.hl = 0x1234;
    s.de = 0x3456;
    s = testMachine.run(s);

    expect(s.hl).toBe(0xddde);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("52: sbc hl,de #3", () => {
    let s = testMachine.initCode([0xed, 0x52]);
    s.f &= 0xfe;
    s.hl = 0x1234;
    s.de = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("52: sbc hl,de #4", () => {
    let s = testMachine.initCode([0xed, 0x52]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x3456;
    s.de = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2221);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("53: ld (NN),de", () => {
    let s = testMachine.initCode([0xed, 0x53, 0x00, 0x10]);
    s.de = 0x1234;
    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x34);
    expect(m[0x1001]).toBe(0x12);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000-1001");
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("56: im 1", () => {
    let s = testMachine.initCode([0xed, 0x56]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x01);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("57: ld a,i #1", () => {
    let s = testMachine.initCode([0xed, 0x57]);
    s.i = 0xd5;
    s = testMachine.run(s);

    expect(s.a).toBe(0xd5);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("57: ld a,i #2", () => {
    let s = testMachine.initCode([0xed, 0x57]);
    s.i = 0x25;
    s.f &= 0xfe;
    s = testMachine.run(s);

    expect(s.a).toBe(0x25);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("57: ld a,i #3", () => {
    let s = testMachine.initCode([0xed, 0x57]);
    s.i = 0x00;
    s.f &= 0xfe;
    s = testMachine.run(s);

    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("57: ld a,i #4", () => {
    let s = testMachine.initCode([0xed, 0x57]);
    s.i = 0x25;
    s.iff2 = false;
    s = testMachine.run(s);

    expect(s.a).toBe(0x25);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("57: ld a,i #5", () => {
    let s = testMachine.initCode([0xed, 0x57]);
    s.i = 0x25;
    s.iff2 = true;
    s = testMachine.run(s);

    expect(s.a).toBe(0x25);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("58: in e,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x58]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, E, F");
    expect(s.e).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("59: out (c),e", () => {
    let s = testMachine.initCode([0xed, 0x59]);
    s.bc = 0x10fd;
    s.e = 0xc3;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0xc3);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("5a: adc hl,de #1", () => {
    let s = testMachine.initCode([0xed, 0x5a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.de = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2346);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("5a: adc hl,de #2", () => {
    let s = testMachine.initCode([0xed, 0x5a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.de = 0xf234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0346);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("5a: adc hl,de #3", () => {
    let s = testMachine.initCode([0xed, 0x5a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.de = 0x7234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x8346);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("5a: adc hl,de #4", () => {
    let s = testMachine.initCode([0xed, 0x5a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x0001;
    s.de = 0xfffe;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("5b: ld de,(NN)", () => {
    let s = testMachine.initCode([0xed, 0x5b, 0x00, 0x10]);
    const m = testMachine.memory;
    m[0x1000] = 0x34;
    m[0x1001] = 0x12;
    s = testMachine.run(s, m);

    expect(s.de).toBe(0x1234);
    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("5e: im 1", () => {
    let s = testMachine.initCode([0xed, 0x5e]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x02);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("5f: ld a,r #1", () => {
    let s = testMachine.initCode([0xed, 0x5f]);
    s.r = 0xd5;
    s = testMachine.run(s);

    expect(s.a).toBe(0xd7);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("5f: ld a,r #2", () => {
    let s = testMachine.initCode([0xed, 0x5f]);
    s.r = 0x25;
    s.f &= 0xfe;
    s = testMachine.run(s);

    expect(s.a).toBe(0x27);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("5f: ld a,r #3", () => {
    let s = testMachine.initCode([0xed, 0x5f]);
    s.r = 0x7e;
    s.f &= 0xfe;
    s = testMachine.run(s);

    expect(s.a).toBe(0x00);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("5f: ld a,r #4", () => {
    let s = testMachine.initCode([0xed, 0x5f]);
    s.r = 0x25;
    s.iff2 = false;
    s = testMachine.run(s);

    expect(s.a).toBe(0x27);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("5f: ld a,i #5", () => {
    let s = testMachine.initCode([0xed, 0x5f]);
    s.r = 0x25;
    s.iff2 = true;
    s = testMachine.run(s);

    expect(s.a).toBe(0x27);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(9);
  });

  it("60: in h,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x60]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, H, F");
    expect(s.h).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("61: out (c),h", () => {
    let s = testMachine.initCode([0xed, 0x61]);
    s.bc = 0x10fd;
    s.h = 0xc3;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0xc3);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("62: sbc hl,sp #1", () => {
    let s = testMachine.initCode([0xed, 0x62]);
    s.f &= 0xfe;
    s.hl = 0x3456;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("62: sbc hl,sp #2", () => {
    let s = testMachine.initCode([0xed, 0x62]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x3456;
    s = testMachine.run(s);

    expect(s.hl).toBe(0xffff);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("63: ld (NN),hl", () => {
    let s = testMachine.initCode([0xed, 0x63, 0x00, 0x10]);
    s.hl = 0x1234;
    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x34);
    expect(m[0x1001]).toBe(0x12);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000-1001");
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("66: im 0", () => {
    let s = testMachine.initCode([0xed, 0x66]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("67: rrd #1", () => {
    let s = testMachine.initCode([0xed, 0x67]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x56;
    s.a = 0x34;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0x36);
    expect(m[0x1000]).toBe(0x45);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("67: rrd #2", () => {
    let s = testMachine.initCode([0xed, 0x67]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x56;
    s.a = 0xa4;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0xa6);
    expect(m[0x1000]).toBe(0x45);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("67: rrd #3", () => {
    let s = testMachine.initCode([0xed, 0x67]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x50;
    s.a = 0x04;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0x00);
    expect(m[0x1000]).toBe(0x45);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("67: rrd #4", () => {
    let s = testMachine.initCode([0xed, 0x67]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x50;
    s.a = 0x14;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0x10);
    expect(m[0x1000]).toBe(0x45);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("68: in l,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x68]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, L, F");
    expect(s.l).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("69: out (c),l", () => {
    let s = testMachine.initCode([0xed, 0x69]);
    s.bc = 0x10fd;
    s.l = 0xc3;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0xc3);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("6a: adc hl,hl", () => {
    let s = testMachine.initCode([0xed, 0x6a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2223);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("6b: ld hl,(NN)", () => {
    let s = testMachine.initCode([0xed, 0x6b, 0x00, 0x10]);
    const m = testMachine.memory;
    m[0x1000] = 0x34;
    m[0x1001] = 0x12;
    s = testMachine.run(s, m);

    expect(s.hl).toBe(0x1234);
    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("6e: im 0/1", () => {
    let s = testMachine.initCode([0xed, 0x6e]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("6f: rld #1", () => {
    let s = testMachine.initCode([0xed, 0x6f]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x56;
    s.a = 0x34;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0x35);
    expect(m[0x1000]).toBe(0x64);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("6f: rld #2", () => {
    let s = testMachine.initCode([0xed, 0x6f]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x56;
    s.a = 0xa4;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0xa5);
    expect(m[0x1000]).toBe(0x64);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("6f: rld #3", () => {
    let s = testMachine.initCode([0xed, 0x6f]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x06;
    s.a = 0x04;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0x00);
    expect(m[0x1000]).toBe(0x64);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("6f: rld #4", () => {
    let s = testMachine.initCode([0xed, 0x6f]);
    s.hl = 0x1000;
    let m = testMachine.memory;
    m[0x1000] = 0x06;
    s.a = 0x14;
    s.f &= 0xfe;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    expect(s.a).toBe(0x10);
    expect(m[0x1000]).toBe(0x64);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory("1000");
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(18);
  });

  it("70: in (c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x70]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("71: out (c),0", () => {
    let s = testMachine.initCode([0xed, 0x71]);
    s.bc = 0x10fd;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0x00);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("72: sbc hl,sp #1", () => {
    let s = testMachine.initCode([0xed, 0x72]);
    s.f &= 0xfe;
    s.hl = 0x3456;
    s.sp = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2222);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("72: sbc hl,sp #2", () => {
    let s = testMachine.initCode([0xed, 0x72]);
    s.f &= 0xfe;
    s.hl = 0x1234;
    s.sp = 0x3456;
    s = testMachine.run(s);

    expect(s.hl).toBe(0xddde);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("72: sbc hl,sp #3", () => {
    let s = testMachine.initCode([0xed, 0x72]);
    s.f &= 0xfe;
    s.hl = 0x1234;
    s.sp = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("72: sbc hl,sp #4", () => {
    let s = testMachine.initCode([0xed, 0x72]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x3456;
    s.sp = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2221);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeTruthy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("73: ld (NN),sp", () => {
    let s = testMachine.initCode([0xed, 0x73, 0x00, 0x10]);
    s.sp = 0x1234;
    s = testMachine.run(s);
    const m = testMachine.memory;

    expect(m[0x1000]).toBe(0x34);
    expect(m[0x1001]).toBe(0x12);
    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000-1001");
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("76: im 1", () => {
    let s = testMachine.initCode([0xed, 0x76]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x01);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("77: nop", () => {
    let s = testMachine.initCode([0xed, 0x77]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("78: in a,(c)", () => {
    testMachine.initInput([0xd5]);
    let s = testMachine.initCode([0xed, 0x78]);
    s.bc = 0x10fd;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC, AF");
    expect(s.a).toBe(0xd5);
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("79: out (c),a", () => {
    let s = testMachine.initCode([0xed, 0x79]);
    s.bc = 0x10fd;
    s.a = 0xc3;
    s = testMachine.run(s);
    const log = testMachine.ioAccessLog;

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x10fd);
    expect(log[0].value).toBe(0xc3);
    expect(log[0].isOutput).toBe(true);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(12);
  });

  it("7a: adc hl,sp #1", () => {
    let s = testMachine.initCode([0xed, 0x7a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.sp = 0x1234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x2346);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("7a: adc hl,sp #2", () => {
    let s = testMachine.initCode([0xed, 0x7a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.sp = 0xf234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0346);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("7a: adc hl,sp #3", () => {
    let s = testMachine.initCode([0xed, 0x7a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x1111;
    s.sp = 0x7234;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x8346);
    expect(s.f & FlagsSetMask.S).toBeTruthy();
    expect(s.f & FlagsSetMask.Z).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.PV).toBeTruthy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("7a: adc hl,sp #4", () => {
    let s = testMachine.initCode([0xed, 0x7a]);
    s.f |= FlagsSetMask.C;
    s.hl = 0x0001;
    s.sp = 0xfffe;
    s = testMachine.run(s);

    expect(s.hl).toBe(0x0000);
    expect(s.f & FlagsSetMask.S).toBeFalsy();
    expect(s.f & FlagsSetMask.Z).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeTruthy();
    expect(s.f & FlagsSetMask.PV).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();

    testMachine.shouldKeepRegisters("HL, F");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("7b: ld sp,(NN)", () => {
    let s = testMachine.initCode([0xed, 0x7b, 0x00, 0x10]);
    const m = testMachine.memory;
    m[0x1000] = 0x34;
    m[0x1001] = 0x12;
    s = testMachine.run(s, m);

    expect(s.sp).toBe(0x1234);
    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("7e: im 2", () => {
    let s = testMachine.initCode([0xed, 0x7e]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.interruptMode).toBe(0x02);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("7f: nop", () => {
    let s = testMachine.initCode([0xed, 0x7f]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

});
