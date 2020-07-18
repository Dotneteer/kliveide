import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

// Helper class for DAA
class DaaSample {
  constructor(
    public a: number,
    public h: boolean,
    public n: boolean,
    public c: boolean,
    public af: number
  ) {}
}

describe("Indexed ops (ix) 00-3f", () => {
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

  it("00: nop", () => {
    let s = testMachine.initCode([0xdd, 0x00]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("01: ld bc,NN", () => {
    let s = testMachine.initCode([0xdd, 0x01, 0x12, 0xac]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0xac12);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(14);
  });

  it("02: ld (bc),a", () => {
    let s = testMachine.initCode([0xdd, 0x02]);

    s.a = 0xcc;
    s.bc = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0xcc);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(11);
  });

  it("03: inc bc #1", () => {
    let s = testMachine.initCode([0xdd, 0x03]);

    s.bc = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x1001);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("03: inc bc #2", () => {
    let s = testMachine.initCode([0xdd, 0x03]);

    s.bc = 0xffff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("04: inc b #1", () => {
    let s = testMachine.initCode([0xdd, 0x04]);

    s.b = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.b).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("04: inc b #2", () => {
    let s = testMachine.initCode([0xdd, 0x04]);

    s.b = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.b).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("04: inc b #3", () => {
    let s = testMachine.initCode([0xdd, 0x04]);

    s.b = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.b).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("04: inc b #4", () => {
    let s = testMachine.initCode([0xdd, 0x04]);

    s.b = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.b).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("05: dec b #1", () => {
    let s = testMachine.initCode([0xdd, 0x05]);

    s.b = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.b).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("05: dec b #2", () => {
    let s = testMachine.initCode([0xdd, 0x05]);

    s.b = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.b).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("05: dec b #3", () => {
    let s = testMachine.initCode([0xdd, 0x05]);

    s.b = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.b).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("05: dec b #4", () => {
    let s = testMachine.initCode([0xdd, 0x05]);

    s.b = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.b).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("06: ld b,N", () => {
    let s = testMachine.initCode([0xdd, 0x06, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("B");
    testMachine.shouldKeepMemory();
    expect(s.b).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("07: rlca #1", () => {
    let s = testMachine.initCode([0xdd, 0x07]);
    s.a = 0x71;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.a).toBe(0xe2);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("07: rlca #2", () => {
    let s = testMachine.initCode([0xdd, 0x07]);
    s.a = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.a).toBe(0x01);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("08: ex af,af'", () => {
    let s = testMachine.initCode([0xdd, 0x08]);
    s.af = 0x71aa;
    s._af_ = 0xe318;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF, AF'");
    testMachine.shouldKeepMemory();

    expect(s._af_).toBe(0x71aa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("09: add ix,bc #1", () => {
    let s = testMachine.initCode([0xdd, 0x09]);
    s.ix = 0x1234;
    s.bc = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x2336);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("09: add ix,bc #2", () => {
    let s = testMachine.initCode([0xdd, 0x09]);
    s.ix = 0xf234;
    s.bc = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x0336);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("0a: ld a,(bc)", () => {
    let s = testMachine.initCode([0xdd, 0x0a]);
    s.bc = 0x1000;
    const m = testMachine.memory;
    m[0x1000] = 0x4c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("A");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x4c);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(11);
  });

  it("0b: dec bc #1", () => {
    let s = testMachine.initCode([0xdd, 0x0b]);

    s.bc = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x0fff);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("0b: dec bc #2", () => {
    let s = testMachine.initCode([0xdd, 0x0b]);

    s.bc = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("0c: inc c #1", () => {
    let s = testMachine.initCode([0xdd, 0x0c]);

    s.c = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.c).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0c: inc c #2", () => {
    let s = testMachine.initCode([0xdd, 0x0c]);

    s.c = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.c).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0c: inc c #3", () => {
    let s = testMachine.initCode([0xdd, 0x0c]);

    s.c = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.c).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0c: inc c #4", () => {
    let s = testMachine.initCode([0xdd, 0x0c]);

    s.c = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.c).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0d: dec c #1", () => {
    let s = testMachine.initCode([0xdd, 0x0d]);

    s.c = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.c).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0d: dec c #2", () => {
    let s = testMachine.initCode([0xdd, 0x0d]);

    s.c = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.c).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0d: dec c #3", () => {
    let s = testMachine.initCode([0xdd, 0x0d]);

    s.c = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.c).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0d: dec c #4", () => {
    let s = testMachine.initCode([0xdd, 0x0d]);

    s.c = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.c).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0e: ld c,N", () => {
    let s = testMachine.initCode([0xdd, 0x0e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("C");
    testMachine.shouldKeepMemory();
    expect(s.c).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("0f: rrca #1", () => {
    let s = testMachine.initCode([0xdd, 0x0f]);
    s.a = 0x70;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    expect(s.a).toBe(0x38);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("0f: rrca #2", () => {
    let s = testMachine.initCode([0xdd, 0x0f]);
    s.a = 0x71;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    expect(s.a).toBe(0xb8);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("10: djnz #1", () => {
    let s = testMachine.initCode([0xdd, 0x10, 0x02]);
    s.b = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();

    expect(s.b).toBe(0x00);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(12);
  });

  it("10: djnz #2", () => {
    let s = testMachine.initCode([0xdd, 0x10, 0x02]);
    s.b = 0x02;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();

    expect(s.b).toBe(0x01);
    expect(s.pc).toBe(0x0005);
    expect(s.tacts).toBe(17);
  });

  it("11: ld de,NN", () => {
    let s = testMachine.initCode([0xdd, 0x11, 0x12, 0xac]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0xac12);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(14);
  });

  it("12: ld (de),a", () => {
    let s = testMachine.initCode([0xdd, 0x12]);

    s.a = 0xcc;
    s.de = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0xcc);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(11);
  });

  it("13: inc de #1", () => {
    let s = testMachine.initCode([0xdd, 0x13]);

    s.de = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x1001);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("13: inc de #2", () => {
    let s = testMachine.initCode([0xdd, 0x13]);

    s.de = 0xffff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("14: inc d #1", () => {
    let s = testMachine.initCode([0xdd, 0x14]);

    s.d = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.d).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("14: inc d #2", () => {
    let s = testMachine.initCode([0xdd, 0x14]);

    s.d = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.d).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("14: inc d #3", () => {
    let s = testMachine.initCode([0xdd, 0x14]);

    s.d = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.d).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("14: inc d #4", () => {
    let s = testMachine.initCode([0xdd, 0x14]);

    s.d = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.d).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("15: dec d #1", () => {
    let s = testMachine.initCode([0xdd, 0x15]);

    s.d = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.d).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("15: dec d #2", () => {
    let s = testMachine.initCode([0xdd, 0x15]);

    s.d = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.d).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("15: dec d #3", () => {
    let s = testMachine.initCode([0xdd, 0x15]);

    s.d = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.d).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("15: dec d #4", () => {
    let s = testMachine.initCode([0xdd, 0x15]);

    s.d = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.d).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("16: ld d,N", () => {
    let s = testMachine.initCode([0xdd, 0x16, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("D");
    testMachine.shouldKeepMemory();
    expect(s.d).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("17: rla #1", () => {
    let s = testMachine.initCode([0xdd, 0x17]);
    s.a = 0x81;
    s.f &= 0xfe;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    expect(s.a).toBe(0x02);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("17: rla #2", () => {
    let s = testMachine.initCode([0xdd, 0x17]);
    s.a = 0x20;
    s.f |= 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    expect(s.a).toBe(0x41);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("18: jr e ", () => {
    let s = testMachine.initCode([0xdd, 0x18, 0x20]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x00023);
    expect(s.tacts).toBe(16);
  });

  it("19: add ix,de #1", () => {
    let s = testMachine.initCode([0xdd, 0x19]);
    s.ix = 0x1234;
    s.de = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x2336);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("19: add ix,de #2", () => {
    let s = testMachine.initCode([0xdd, 0x19]);
    s.ix = 0xf234;
    s.de = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x0336);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });


  it("1a: ld a,(de)", () => {
    let s = testMachine.initCode([0xdd, 0x1a]);
    s.de = 0x1000;
    const m = testMachine.memory;
    m[0x1000] = 0x4c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("A");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x4c);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(11);
  });

  it("1b: dec de #1", () => {
    let s = testMachine.initCode([0xdd, 0x1b]);

    s.de = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x0fff);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("1b: dec de #2", () => {
    let s = testMachine.initCode([0xdd, 0x1b]);

    s.de = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("1c: inc e #1", () => {
    let s = testMachine.initCode([0xdd, 0x1c]);

    s.e = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.e).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1c: inc e #2", () => {
    let s = testMachine.initCode([0xdd, 0x1c]);

    s.e = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.e).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1c: inc e #3", () => {
    let s = testMachine.initCode([0xdd, 0x1c]);

    s.e = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.e).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1c: inc e #4", () => {
    let s = testMachine.initCode([0xdd, 0x1c]);

    s.e = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.e).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1d: dec e #1", () => {
    let s = testMachine.initCode([0xdd, 0x1d]);

    s.e = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.e).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1d: dec e #2", () => {
    let s = testMachine.initCode([0xdd, 0x1d]);

    s.e = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.e).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1d: dec e #3", () => {
    let s = testMachine.initCode([0xdd, 0x1d]);

    s.e = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.e).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1d: dec e #4", () => {
    let s = testMachine.initCode([0xdd, 0x1d]);

    s.e = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.e).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1e: ld e,N", () => {
    let s = testMachine.initCode([0xdd, 0x1e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("E");
    testMachine.shouldKeepMemory();
    expect(s.e).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("1f: rra #1", () => {
    let s = testMachine.initCode([0xdd, 0x1f]);
    s.a = 0x81;
    s.f &= 0xfe;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    expect(s.a).toBe(0x40);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("1f: rra #2", () => {
    let s = testMachine.initCode([0xdd, 0x1f]);
    s.a = 0x20;
    s.f |= 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.H).toBeFalsy();
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();

    expect(s.a).toBe(0x90);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("20: jr nz #1", () => {
    let s = testMachine.initCode([0xdd, 0x20, 0x04]);
    s.f |= FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("20: jr nz #2", () => {
    let s = testMachine.initCode([0xdd,0x20, 0x04]);
    s.f &= ~FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0007);
    expect(s.tacts).toBe(16);
  });

  it("21: ld ix,NN", () => {
    let s = testMachine.initCode([0xdd, 0x21, 0x12, 0xac]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.ix).toBe(0xac12);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(14);
  });

  it("22: ld (NN),ix", () => {
    let s = testMachine.initCode([0xdd, 0x22, 0x00, 0x10]);
    s.ix = 0xa926;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory("1000-1001");
    expect(s.ix).toBe(0xa926);
    expect(m[0x1000]).toBe(0x26);
    expect(m[0x1001]).toBe(0xa9);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("23: inc ix #1", () => {
    let s = testMachine.initCode([0xdd, 0x23]);

    s.ix = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.ix).toBe(0x1001);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("23: inc ix #2", () => {
    let s = testMachine.initCode([0xdd, 0x23]);

    s.ix = 0xffff;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.ix).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("24: inc xh #1", () => {
    let s = testMachine.initCode([0xdd, 0x24]);

    s.xh = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.xh).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("24: inc xh #2", () => {
    let s = testMachine.initCode([0xdd, 0x24]);

    s.xh = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.xh).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("24: inc xh #3", () => {
    let s = testMachine.initCode([0xdd, 0x24]);

    s.xh = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.xh).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("24: inc xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x24]);

    s.xh = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.xh).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("25: dec xh #1", () => {
    let s = testMachine.initCode([0xdd, 0x25]);

    s.xh = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.xh).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("25: dec xh #2", () => {
    let s = testMachine.initCode([0xdd, 0x25]);

    s.xh = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.xh).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("25: dec xh #3", () => {
    let s = testMachine.initCode([0xdd, 0x25]);

    s.xh = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.xh).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("25: dec xh #4", () => {
    let s = testMachine.initCode([0xdd, 0x25]);

    s.xh = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.xh).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("26: ld xh,N", () => {
    let s = testMachine.initCode([0xdd, 0x26, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.xh).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  const daaSamples = [
    new DaaSample(0x99, false, false, false, 0x998c),
    new DaaSample(0x99, true, false, false, 0x9f8c),
    new DaaSample(0x7a, false, false, false, 0x8090),
    new DaaSample(0x7a, true, false, false, 0x8090),
    new DaaSample(0xa9, false, false, false, 0x090d),
    new DaaSample(0x87, false, false, true, 0xe7a5),
    new DaaSample(0x87, true, false, true, 0xedad),
    new DaaSample(0x1b, false, false, true, 0x8195),
    new DaaSample(0x1b, true, false, true, 0x8195),
    new DaaSample(0xaa, false, false, false, 0x1011),
    new DaaSample(0xaa, true, false, false, 0x1011),
    new DaaSample(0xc6, true, false, false, 0x2c29)
  ];
  daaSamples.forEach((sm, index) => {
    it(`27: daa #${index + 1}`, () => {
      let s = testMachine.initCode([0xdd, 0x27]);
      s.a = sm.a;
      s.f =
        (sm.h ? FlagsSetMask.H : 0) |
        (sm.n ? FlagsSetMask.N : 0) |
        (sm.c ? FlagsSetMask.C : 0);
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.af).toBe(sm.af);
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  });

  it("28: jr z #1", () => {
    let s = testMachine.initCode([0xdd, 0x28, 0x04]);
    s.f &= ~FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("28: jr z #2", () => {
    let s = testMachine.initCode([0xdd, 0x28, 0x04]);
    s.f |= FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0007);
    expect(s.tacts).toBe(16);
  });

  it("29: add ix,ix #1", () => {
    let s = testMachine.initCode([0xdd, 0x29]);
    s.ix = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x2000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("29: add ix,ix #2", () => {
    let s = testMachine.initCode([0xdd, 0x29]);
    s.ix = 0x8234;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x0468);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("2a: ld ix,(NN)", () => {
    let s = testMachine.initCode([0xdd, 0x2a, 0x00, 0x10]);
    const m = testMachine.memory;
    m[0x1000] = 0x34;
    m[0x1001] = 0x12;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.ix).toBe(0x1234);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(20);
  });

  it("2b: dec ix #1", () => {
    let s = testMachine.initCode([0xdd, 0x2b]);

    s.ix = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.ix).toBe(0x0fff);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("2b: dec ix #2", () => {
    let s = testMachine.initCode([0xdd, 0x2b]);

    s.ix = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.ix).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("2c: inc xl #1", () => {
    let s = testMachine.initCode([0xdd, 0x2c]);

    s.xl = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.xl).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: inc xl #2", () => {
    let s = testMachine.initCode([0xdd, 0x2c]);

    s.xl = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.xl).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: inc xl #3", () => {
    let s = testMachine.initCode([0xdd, 0x2c]);

    s.xl = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.xl).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2c: inc xl #4", () => {
    let s = testMachine.initCode([0xdd, 0x2c]);

    s.xl = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.xl).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2d: dec xl #1", () => {
    let s = testMachine.initCode([0xdd, 0x2d]);

    s.xl = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.xl).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2d: dec xl #2", () => {
    let s = testMachine.initCode([0xdd, 0x2d]);

    s.xl = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.xl).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2d: dec xl #3", () => {
    let s = testMachine.initCode([0xdd, 0x2d]);

    s.xl = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.xl).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2d: dec xl #4", () => {
    let s = testMachine.initCode([0xdd, 0x2d]);

    s.xl = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("IX, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.xl).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("2e: ld xl,N", () => {
    let s = testMachine.initCode([0xdd, 0x2e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("IX");
    testMachine.shouldKeepMemory();
    expect(s.xl).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("2f: cpl", () => {
    let s = testMachine.initCode([0xdd, 0x2f]);
    s.a = 0x81;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();
    testMachine.shouldKeepCFlag();

    expect(s.a).toBe(0x7e);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("30: jr nc #1", () => {
    let s = testMachine.initCode([0xdd, 0x30, 0x04]);
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("30: jr nc #2", () => {
    let s = testMachine.initCode([0xdd, 0x30, 0x04]);
    s.f &= ~FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0007);
    expect(s.tacts).toBe(16);
  });

  it("31: ld sp,NN", () => {
    let s = testMachine.initCode([0xdd, 0x31, 0x12, 0xac]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0xac12);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(14);
  });

  it("32: ld (NN),a", () => {
    let s = testMachine.initCode([0xdd, 0x32, 0x00, 0x10]);
    s.a = 0x4c;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0x4c);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(17);
  });

  it("33: inc sp #1", () => {
    let s = testMachine.initCode([0xdd, 0x33]);

    s.sp = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x1001);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("33: inc sp #2", () => {
    let s = testMachine.initCode([0xdd, 0x33]);

    s.sp = 0xffff;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("34: inc (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0x34, 0x52]);
    let m = testMachine.memory;
    s.ix = 0x1000;
    m[s.ix + 0x52] = 0x23;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1052");
    expect(m[0x1052]).toBe(0x24);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(23);
  });

  it("34: inc (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0x34, 0xfe]);
    let m = testMachine.memory;
    s.ix = 0x1000;
    m[s.ix - 2] = 0x23;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("0ffe");
    expect(m[0x0ffe]).toBe(0x24);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(23);
  });

  it("35: dec (ix+D) #1", () => {
    let s = testMachine.initCode([0xdd, 0x35, 0x52]);
    let m = testMachine.memory;
    s.ix = 0x1000;
    m[s.ix + 0x52] = 0x23;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1052");
    expect(m[0x1052]).toBe(0x22);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(23);
  });

  it("35: dec (ix+D) #2", () => {
    let s = testMachine.initCode([0xdd, 0x35, 0xfe]);
    let m = testMachine.memory;
    s.ix = 0x1000;
    m[s.ix - 2] = 0x23;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("0ffe");
    expect(m[0x0ffe]).toBe(0x22);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(23);
  });

  it("36: ld (ix+D),N #1", () => {
    let s = testMachine.initCode([0xdd, 0x36, 0x52, 0x23]);
    s.ix = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1052");
    expect(m[0x1052]).toBe(0x23);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(19);
  });

  it("36: ld (ix+D),N #2", () => {
    let s = testMachine.initCode([0xdd, 0x36, 0xfe, 0x23]);
    s.ix = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("0ffe");
    expect(m[0x0ffe]).toBe(0x23);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(19);
  });

  it("37: scf", () => {
    let s = testMachine.initCode([0xdd, 0x37]);
    s.f &= 0xfe;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("38: jr c #1", () => {
    let s = testMachine.initCode([0xdd, 0x38, 0x04]);
    s.f &= ~FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("38: jr c #2", () => {
    let s = testMachine.initCode([0xdd, 0x38, 0x04]);
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0007);
    expect(s.tacts).toBe(16);
  });

  it("39: add ix,sp #1", () => {
    let s = testMachine.initCode([0xdd, 0x39]);
    s.ix = 0x1234;
    s.sp = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x2336);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("39: add ix,sp #2", () => {
    let s = testMachine.initCode([0xdd, 0x39]);
    s.ix = 0xf234;
    s.sp = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, IX");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.ix).toBe(0x0336);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(15);
  });

  it("3a: ld a,(NN)", () => {
    let s = testMachine.initCode([0xdd, 0x3a, 0x00, 0x10]);
    let m = testMachine.memory;
    m[0x1000] = 0x4c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x4c);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(17);
  });


  it("3b: dec sp #1", () => {
    let s = testMachine.initCode([0xdd, 0x3b]);

    s.sp = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x0fff);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("3b: dec sp #2", () => {
    let s = testMachine.initCode([0xdd, 0x3b]);

    s.sp = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x0000);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("3c: inc a #1", () => {
    let s = testMachine.initCode([0xdd, 0x3c]);

    s.a = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.a).toBe(0x44);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3c: inc a #2", () => {
    let s = testMachine.initCode([0xdd, 0x3c]);

    s.a = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.a).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3c: inc a #3", () => {
    let s = testMachine.initCode([0xdd, 0x3c]);

    s.a = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.a).toBe(0x80);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3c: inc a #4", () => {
    let s = testMachine.initCode([0xdd, 0x3c]);

    s.a = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.a).toBe(0x30);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3d: dec a #1", () => {
    let s = testMachine.initCode([0xdd, 0x3d]);

    s.a = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.a).toBe(0x42);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3d: dec a #2", () => {
    let s = testMachine.initCode([0xdd, 0x3d]);

    s.a = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.a).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3d: dec a #3", () => {
    let s = testMachine.initCode([0xdd, 0x3d]);

    s.a = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.a).toBe(0x7f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3d: dec a #4", () => {
    let s = testMachine.initCode([0xdd, 0x3d]);

    s.a = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.a).toBe(0x1f);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3e: ld a,N", () => {
    let s = testMachine.initCode([0xdd, 0x3e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("A");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x26);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(11);
  });

  it("3f: ccf #1", () => {
    let s = testMachine.initCode([0xdd, 0x3f]);
    s.f &= 0xfe;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("3f: ccf #2", () => {
    let s = testMachine.initCode([0xdd, 0x3f]);
    s.f |= 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

});
