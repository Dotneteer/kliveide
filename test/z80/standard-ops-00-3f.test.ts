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

describe("Standard ops 00-3f", () => {
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
    let s = testMachine.initCode([0x00]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("01: ld bc,NN", () => {
    let s = testMachine.initCode([0x01, 0x12, 0xac]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0xac12);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(10);
  });

  it("02: ld (bc),a", () => {
    let s = testMachine.initCode([0x02]);

    s.a = 0xcc;
    s.bc = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0xcc);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("03: inc bc #1", () => {
    let s = testMachine.initCode([0x03]);

    s.bc = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x1001);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("03: inc bc #2", () => {
    let s = testMachine.initCode([0x03]);

    s.bc = 0xffff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("04: inc b #1", () => {
    let s = testMachine.initCode([0x04]);

    s.b = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.b).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("04: inc b #2", () => {
    let s = testMachine.initCode([0x04]);

    s.b = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.b).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("04: inc b #3", () => {
    let s = testMachine.initCode([0x04]);

    s.b = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.b).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("04: inc b #4", () => {
    let s = testMachine.initCode([0x04]);

    s.b = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.b).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("05: dec b #1", () => {
    let s = testMachine.initCode([0x05]);

    s.b = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.b).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("05: dec b #2", () => {
    let s = testMachine.initCode([0x05]);

    s.b = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.b).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("05: dec b #3", () => {
    let s = testMachine.initCode([0x05]);

    s.b = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.b).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("05: dec b #4", () => {
    let s = testMachine.initCode([0x05]);

    s.b = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.b).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("06: ld b,N", () => {
    let s = testMachine.initCode([0x06, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("B");
    testMachine.shouldKeepMemory();
    expect(s.b).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("07: rlca #1", () => {
    let s = testMachine.initCode([0x07]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("07: rlca #2", () => {
    let s = testMachine.initCode([0x07]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("08: ex af,af'", () => {
    let s = testMachine.initCode([0x08]);
    s.af = 0x71aa;
    s._af_ = 0xe318;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF, AF'");
    testMachine.shouldKeepMemory();

    expect(s._af_).toBe(0x71aa);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("09: add hl,bc #1", () => {
    let s = testMachine.initCode([0x09]);
    s.hl = 0x1234;
    s.bc = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    // expect(s.f & FlagsSetMask.N).toBeFalsy();
    // expect(s.f & FlagsSetMask.C).toBeFalsy();
    // expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x2336);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("09: add hl,bc #2", () => {
    let s = testMachine.initCode([0x09]);
    s.hl = 0xf234;
    s.bc = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x0336);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("0a: ld a,(bc)", () => {
    let s = testMachine.initCode([0x0a]);
    s.bc = 0x1000;
    const m = testMachine.memory;
    m[0x1000] = 0x4c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("A");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x4c);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("0b: dec bc #1", () => {
    let s = testMachine.initCode([0x0b]);

    s.bc = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x0fff);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("0b: dec bc #2", () => {
    let s = testMachine.initCode([0x0b]);

    s.bc = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("BC");
    testMachine.shouldKeepMemory();
    expect(s.bc).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("0c: inc c #1", () => {
    let s = testMachine.initCode([0x0c]);

    s.c = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.c).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0c: inc c #2", () => {
    let s = testMachine.initCode([0x0c]);

    s.c = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.c).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0c: inc c #3", () => {
    let s = testMachine.initCode([0x0c]);

    s.c = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.c).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0c: inc c #4", () => {
    let s = testMachine.initCode([0x0c]);

    s.c = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.c).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0d: dec c #1", () => {
    let s = testMachine.initCode([0x0d]);

    s.c = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.c).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0d: dec c #2", () => {
    let s = testMachine.initCode([0x0d]);

    s.c = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.c).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0d: dec c #3", () => {
    let s = testMachine.initCode([0x0d]);

    s.c = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.c).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0d: dec c #4", () => {
    let s = testMachine.initCode([0x0d]);

    s.c = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("C, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.c).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0e: ld c,N", () => {
    let s = testMachine.initCode([0x0e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("C");
    testMachine.shouldKeepMemory();
    expect(s.c).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("0f: rrca #1", () => {
    let s = testMachine.initCode([0x0f]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("0f: rrca #2", () => {
    let s = testMachine.initCode([0x0f]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("10: djnz #1", () => {
    let s = testMachine.initCode([0x10, 0x02]);
    s.b = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();

    expect(s.b).toBe(0x00);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("10: djnz #2", () => {
    let s = testMachine.initCode([0x10, 0x02]);
    s.b = 0x02;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("B, F");
    testMachine.shouldKeepMemory();

    expect(s.b).toBe(0x01);
    expect(s.pc).toBe(0x0004);
    expect(s.tacts).toBe(13);
  });

  it("11: ld de,NN", () => {
    let s = testMachine.initCode([0x11, 0x12, 0xac]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0xac12);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(10);
  });

  it("12: ld (de),a", () => {
    let s = testMachine.initCode([0x12]);

    s.a = 0xcc;
    s.de = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0xcc);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("13: inc de #1", () => {
    let s = testMachine.initCode([0x13]);

    s.de = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x1001);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("13: inc de #2", () => {
    let s = testMachine.initCode([0x13]);

    s.de = 0xffff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("14: inc d #1", () => {
    let s = testMachine.initCode([0x14]);

    s.d = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.d).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("14: inc d #2", () => {
    let s = testMachine.initCode([0x14]);

    s.d = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.d).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("14: inc d #3", () => {
    let s = testMachine.initCode([0x14]);

    s.d = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.d).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("14: inc d #4", () => {
    let s = testMachine.initCode([0x14]);

    s.d = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.d).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("15: dec d #1", () => {
    let s = testMachine.initCode([0x15]);

    s.d = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.d).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("15: dec d #2", () => {
    let s = testMachine.initCode([0x15]);

    s.d = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.d).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("15: dec d #3", () => {
    let s = testMachine.initCode([0x15]);

    s.d = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.d).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("15: dec d #4", () => {
    let s = testMachine.initCode([0x15]);

    s.d = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("D, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.d).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("16: ld d,N", () => {
    let s = testMachine.initCode([0x16, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("D");
    testMachine.shouldKeepMemory();
    expect(s.d).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("17: rla #1", () => {
    let s = testMachine.initCode([0x17]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("17: rla #2", () => {
    let s = testMachine.initCode([0x17]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("18: jr e ", () => {
    let s = testMachine.initCode([0x18, 0x20]);
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();

    expect(s.pc).toBe(0x00022);
    expect(s.tacts).toBe(12);
  });

  it("19: add hl,de #1", () => {
    let s = testMachine.initCode([0x19]);
    s.hl = 0x1234;
    s.de = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x2336);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("19: add hl,de #2", () => {
    let s = testMachine.initCode([0x19]);
    s.hl = 0xf234;
    s.de = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x0336);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("1a: ld a,(de)", () => {
    let s = testMachine.initCode([0x1a]);
    s.de = 0x1000;
    const m = testMachine.memory;
    m[0x1000] = 0x4c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("A");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x4c);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(7);
  });

  it("1b: dec de #1", () => {
    let s = testMachine.initCode([0x1b]);

    s.de = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x0fff);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("1b: dec de #2", () => {
    let s = testMachine.initCode([0x1b]);

    s.de = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("DE");
    testMachine.shouldKeepMemory();
    expect(s.de).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("1c: inc e #1", () => {
    let s = testMachine.initCode([0x1c]);

    s.e = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.e).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1c: inc e #2", () => {
    let s = testMachine.initCode([0x1c]);

    s.e = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.e).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1c: inc e #3", () => {
    let s = testMachine.initCode([0x1c]);

    s.e = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.e).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1c: inc e #4", () => {
    let s = testMachine.initCode([0x1c]);

    s.e = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.e).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1d: dec e #1", () => {
    let s = testMachine.initCode([0x1d]);

    s.e = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.e).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1d: dec e #2", () => {
    let s = testMachine.initCode([0x1d]);

    s.e = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.e).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1d: dec e #3", () => {
    let s = testMachine.initCode([0x1d]);

    s.e = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.e).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1d: dec e #4", () => {
    let s = testMachine.initCode([0x1d]);

    s.e = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("E, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.e).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1e: ld e,N", () => {
    let s = testMachine.initCode([0x1e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("E");
    testMachine.shouldKeepMemory();
    expect(s.e).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("1f: rra #1", () => {
    let s = testMachine.initCode([0x1f]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("1f: rra #2", () => {
    let s = testMachine.initCode([0x1f]);
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
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("20: jr nz #1", () => {
    let s = testMachine.initCode([0x20, 0x04]);
    s.f |= FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("20: jr nz #2", () => {
    let s = testMachine.initCode([0x20, 0x04]);
    s.f &= ~FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(12);
  });

  it("21: ld hl,NN", () => {
    let s = testMachine.initCode([0x21, 0x12, 0xac]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.hl).toBe(0xac12);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(10);
  });

  it("22: ld (NN),hl", () => {
    let s = testMachine.initCode([0x22, 0x00, 0x10]);
    s.hl = 0xa926;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory("1000-1001");
    expect(s.hl).toBe(0xa926);
    expect(m[0x1000]).toBe(0x26);
    expect(m[0x1001]).toBe(0xa9);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(16);
  });

  it("23: inc hl #1", () => {
    let s = testMachine.initCode([0x23]);

    s.hl = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.hl).toBe(0x1001);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("23: inc hl #2", () => {
    let s = testMachine.initCode([0x23]);

    s.hl = 0xffff;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.hl).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("24: inc h #1", () => {
    let s = testMachine.initCode([0x24]);

    s.h = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.h).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("24: inc h #2", () => {
    let s = testMachine.initCode([0x24]);

    s.h = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.h).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("24: inc h #3", () => {
    let s = testMachine.initCode([0x24]);

    s.h = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.h).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("24: inc h #4", () => {
    let s = testMachine.initCode([0x24]);

    s.h = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.h).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("25: dec h #1", () => {
    let s = testMachine.initCode([0x25]);

    s.h = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.h).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("25: dec h #2", () => {
    let s = testMachine.initCode([0x25]);

    s.h = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.h).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("25: dec h #3", () => {
    let s = testMachine.initCode([0x25]);

    s.h = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.h).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("25: dec h #4", () => {
    let s = testMachine.initCode([0x25]);

    s.h = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("H, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.h).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("26: ld h,N", () => {
    let s = testMachine.initCode([0x26, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("H");
    testMachine.shouldKeepMemory();
    expect(s.h).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
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
      let s = testMachine.initCode([0x27]);
      s.a = sm.a;
      s.f =
        (sm.h ? FlagsSetMask.H : 0) |
        (sm.n ? FlagsSetMask.N : 0) |
        (sm.c ? FlagsSetMask.C : 0);
      s = testMachine.run(s);

      testMachine.shouldKeepRegisters("AF");
      testMachine.shouldKeepMemory();
      expect(s.af).toBe(sm.af);
      expect(s.pc).toBe(0x0001);
      expect(s.tacts).toBe(4);
    });
  });

  it("28: jr z #1", () => {
    let s = testMachine.initCode([0x28, 0x04]);
    s.f &= ~FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("28: jr z #2", () => {
    let s = testMachine.initCode([0x28, 0x04]);
    s.f |= FlagsSetMask.Z;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(12);
  });

  it("29: add hl,hl #1", () => {
    let s = testMachine.initCode([0x29]);
    s.hl = 0x1234;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x2468);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("29: add hl,hl #2", () => {
    let s = testMachine.initCode([0x29]);
    s.hl = 0x8234;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x0468);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("2a: ld hl,(NN)", () => {
    let s = testMachine.initCode([0x2a, 0x00, 0x10]);
    const m = testMachine.memory;
    m[0x1000] = 0x34;
    m[0x1001] = 0x12;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.hl).toBe(0x1234);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(16);
  });

  it("2b: dec hl #1", () => {
    let s = testMachine.initCode([0x2b]);

    s.hl = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.hl).toBe(0x0fff);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("2b: dec hl #2", () => {
    let s = testMachine.initCode([0x2b]);

    s.hl = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("HL");
    testMachine.shouldKeepMemory();
    expect(s.hl).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });
  it("2c: inc l #1", () => {
    let s = testMachine.initCode([0x2c]);

    s.l = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.l).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2c: inc l #2", () => {
    let s = testMachine.initCode([0x2c]);

    s.l = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.l).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2c: inc l #3", () => {
    let s = testMachine.initCode([0x2c]);

    s.l = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.l).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2c: inc l #4", () => {
    let s = testMachine.initCode([0x2c]);

    s.l = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.l).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2d: dec l #1", () => {
    let s = testMachine.initCode([0x2d]);

    s.l = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.l).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2d: dec l #2", () => {
    let s = testMachine.initCode([0x2d]);

    s.l = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.l).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2d: dec l #3", () => {
    let s = testMachine.initCode([0x2d]);

    s.l = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.l).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2d: dec l #4", () => {
    let s = testMachine.initCode([0x2d]);

    s.l = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("L, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.l).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("2e: ld l,N", () => {
    let s = testMachine.initCode([0x2e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("L");
    testMachine.shouldKeepMemory();
    expect(s.l).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("2f: cpl", () => {
    let s = testMachine.initCode([0x2f]);
    s.a = 0x81;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();
    testMachine.shouldKeepCFlag();

    expect(s.a).toBe(0x7e);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("30: jr nc #1", () => {
    let s = testMachine.initCode([0x30, 0x04]);
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("30: jr nc #2", () => {
    let s = testMachine.initCode([0x30, 0x04]);
    s.f &= ~FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(12);
  });

  it("31: ld sp,NN", () => {
    let s = testMachine.initCode([0x31, 0x12, 0xac]);

    s = testMachine.run();

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0xac12);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(10);
  });

  it("32: ld (NN),a", () => {
    let s = testMachine.initCode([0x32, 0x00, 0x10]);
    s.a = 0x4c;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0x4c);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(13);
  });

  it("33: inc sp #1", () => {
    let s = testMachine.initCode([0x33]);

    s.sp = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x1001);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("33: inc sp #2", () => {
    let s = testMachine.initCode([0x33]);

    s.sp = 0xffff;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("34: inc (hl)", () => {
    let s = testMachine.initCode([0x34]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    m[s.hl] = 0x23;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0x24);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("35: dec (hl)", () => {
    let s = testMachine.initCode([0x35]);
    let m = testMachine.memory;
    s.hl = 0x1000;
    m[s.hl] = 0x23;
    s = testMachine.run(s, m);
    m = testMachine.memory;

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0x22);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("36: ld (hl),N", () => {
    let s = testMachine.initCode([0x36, 0x23]);
    s.hl = 0x1000;
    s = testMachine.run(s);
    const m = testMachine.memory;

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory("1000");
    expect(m[0x1000]).toBe(0x23);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(10);
  });

  it("37: scf", () => {
    let s = testMachine.initCode([0x37]);
    s.f &= 0xfe;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.tacts).toBe(4);
  });

  it("38: jr c #1", () => {
    let s = testMachine.initCode([0x38, 0x04]);
    s.f &= ~FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("38: jr c #2", () => {
    let s = testMachine.initCode([0x38, 0x04]);
    s.f |= FlagsSetMask.C;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0006);
    expect(s.tacts).toBe(12);
  });

  it("39: add hl,sp #1", () => {
    let s = testMachine.initCode([0x39]);
    s.hl = 0x1234;
    s.sp = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x2336);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("39: add hl,sp #2", () => {
    let s = testMachine.initCode([0x39]);
    s.hl = 0xf234;
    s.sp = 0x1102;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F, HL");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepSFlag();
    testMachine.shouldKeepZFlag();
    testMachine.shouldKeepPVFlag();

    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.f & FlagsSetMask.H).toBeFalsy();

    expect(s.hl).toBe(0x0336);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(11);
  });

  it("3a: ld a,(NN)", () => {
    let s = testMachine.initCode([0x3a, 0x00, 0x10]);
    let m = testMachine.memory;
    m[0x1000] = 0x4c;
    s = testMachine.run(s, m);

    testMachine.shouldKeepRegisters("AF");
    testMachine.shouldKeepMemory();

    expect(s.a).toBe(0x4c);
    expect(s.pc).toBe(0x0003);
    expect(s.tacts).toBe(13);
  });


  it("3b: dec sp #1", () => {
    let s = testMachine.initCode([0x3b]);

    s.sp = 0x1000;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x0fff);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("3b: dec sp #2", () => {
    let s = testMachine.initCode([0x3b]);

    s.sp = 0x0001;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("SP");
    testMachine.shouldKeepMemory();
    expect(s.sp).toBe(0x0000);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(6);
  });

  it("3c: inc a #1", () => {
    let s = testMachine.initCode([0x3c]);

    s.a = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);

    expect(s.a).toBe(0x44);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3c: inc a #2", () => {
    let s = testMachine.initCode([0x3c]);

    s.a = 0xff;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);
    expect(s.a).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3c: inc a #3", () => {
    let s = testMachine.initCode([0x3c]);

    s.a = 0x7f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.S).not.toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);
    expect(s.a).toBe(0x80);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3c: inc a #4", () => {
    let s = testMachine.initCode([0x3c]);

    s.a = 0x2f;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);
    expect(s.a).toBe(0x30);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3d: dec a #1", () => {
    let s = testMachine.initCode([0x3d]);

    s.a = 0x43;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.a).toBe(0x42);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3d: dec a #2", () => {
    let s = testMachine.initCode([0x3d]);

    s.a = 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.Z).not.toBe(0);

    expect(s.a).toBe(0x00);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3d: dec a #3", () => {
    let s = testMachine.initCode([0x3d]);

    s.a = 0x80;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);

    expect(s.f & FlagsSetMask.S).toBe(0);
    expect(s.f & FlagsSetMask.PV).not.toBe(0);

    expect(s.a).toBe(0x7f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3d: dec a #4", () => {
    let s = testMachine.initCode([0x3d]);

    s.a = 0x20;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("A, F");
    testMachine.shouldKeepMemory();
    testMachine.shouldKeepCFlag();
    expect(s.f & FlagsSetMask.N).not.toBe(0);
    expect(s.f & FlagsSetMask.H).not.toBe(0);

    expect(s.a).toBe(0x1f);
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(4);
  });

  it("3e: ld a,N", () => {
    let s = testMachine.initCode([0x3e, 0x26]);
    s = testMachine.run();

    testMachine.shouldKeepRegisters("A");
    testMachine.shouldKeepMemory();
    expect(s.a).toBe(0x26);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(7);
  });

  it("3f: ccf #1", () => {
    let s = testMachine.initCode([0x3f]);
    s.f &= 0xfe;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.C).toBeTruthy();
    expect(s.tacts).toBe(4);
  });

  it("3f: ccf #2", () => {
    let s = testMachine.initCode([0x3f]);
    s.f |= 0x01;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("F");
    testMachine.shouldKeepMemory();
    expect(s.f & FlagsSetMask.C).toBeFalsy();
    expect(s.tacts).toBe(4);
  });

});

