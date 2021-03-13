import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { TestCpuApi } from "../../src/renderer/machines/wa-api";
import { TestZ80Machine } from "../../src/renderer/machines/TestZ80Machine";
import { FlagsSetMask } from "../../src/shared/machines/z80-helpers";
import { importObject } from "../import-object";

const buffer = fs.readFileSync(path.join(__dirname, "../../build/tz80.wasm"));
let api: TestCpuApi;
let testMachine: TestZ80Machine;

describe("New: Extended ops 80-bf", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as TestCpuApi;
    testMachine = new TestZ80Machine(api);
  });

  beforeEach(() => {
    testMachine.reset();
  });

  for (let i = 0x80; i <= 0x9f; i++) {
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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
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

  for (let i = 0xa4; i <= 0xa7; i++) {
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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

    testMachine.shouldKeepRegisters("F, BC, HL");
    testMachine.shouldKeepMemory();

    expect(log.length).toBe(1);
    expect(log[0].address).toBe(0x00cc);
    expect(log[0].value).toBe(0x29);
    expect(log[0].isOutput).toBeTruthy();

    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(16);
  });

  for (let i = 0xac; i <= 0xaf; i++) {
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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
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

  for (let i = 0xb4; i <= 0xb7; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
    expect(s.f & FlagsSetMask.C).toBeTruthy();

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
    expect(s.f & FlagsSetMask.N).toBeFalsy();
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

  for (let i = 0xbc; i <= 0xbf; i++) {
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
