import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { Z80StateFlags } from "../../src/native/cpu-helpers";
import { RunMode } from "../../src/native/RunMode";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Indexed ops (iy) 40-7f", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, {
      imports: { trace: (arg: number) => console.log(arg) },
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
    for (let w = 0; w < 8; w++) {
      if (w >= 4 && w <= 6) continue;

      const opCode = 0x40 + 8 * q + w;
      it(`${opCode.toString(16)}: ld ${reg8[q]},${reg8[w]}`, () => {
        let s = testMachine.initCode([0xfd, opCode]);
        switch (w) {
          case 0:
            s.b = 0x46;
            break;
          case 1:
            s.c = 0x46;
            break;
          case 2:
            s.d = 0x46;
            break;
          case 3:
            s.e = 0x46;
            break;
          case 4:
            s.h = 0x46;
            break;
          case 5:
            s.l = 0x46;
            break;
          case 7:
            s.a = 0x46;
            break;
        }
        s = testMachine.run(s);
        let l: number = 0xff;
        switch (q) {
          case 0:
            l = s.b;
            break;
          case 1:
            l = s.c;
            break;
          case 2:
            l = s.d;
            break;
          case 3:
            l = s.e;
            break;
          case 4:
            l = s.h;
            break;
          case 5:
            l = s.l;
            break;
          case 7:
            l = s.a;
            break;
        }
        testMachine.shouldKeepRegisters(`${reg8[q]},${reg8[w]}`);
        testMachine.shouldKeepMemory();
        expect(l).toBe(0x46);
        expect(s.pc).toBe(0x0002);
        expect(s.tacts).toBe(8);
      });
    }
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x44 + 8 * q;

    it(`${opCode.toString(16)}: ld ${reg8[q]},yh`, () => {
      let s = testMachine.initCode([0xfd, opCode]);
      s.yh = 0x46;
      s = testMachine.run(s);
      let l: number = 0xff;
      switch (q) {
        case 0:
          l = s.b;
          break;
        case 1:
          l = s.c;
          break;
        case 2:
          l = s.d;
          break;
        case 3:
          l = s.e;
          break;
        case 4:
          l = s.h;
          break;
        case 5:
          l = s.l;
          break;
        case 7:
          l = s.a;
          break;
      }
      testMachine.shouldKeepRegisters(`${reg8[q]}`);
      testMachine.shouldKeepMemory();
      expect(l).toBe(0x46);
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q >= 4 && q <= 6) continue;
    const opCode = 0x45 + 8 * q;
    it(`${opCode.toString(16)}: ld ${reg8[q]},yl`, () => {
      let s = testMachine.initCode([0xfd, opCode]);
      s.yl = 0x46;
      s = testMachine.run(s);
      let l: number = 0xff;
      switch (q) {
        case 0:
          l = s.b;
          break;
        case 1:
          l = s.c;
          break;
        case 2:
          l = s.d;
          break;
        case 3:
          l = s.e;
          break;
        case 4:
          l = s.h;
          break;
        case 5:
          l = s.l;
          break;
        case 7:
          l = s.a;
          break;
      }
      testMachine.shouldKeepRegisters(`${reg8[q]}`);
      testMachine.shouldKeepMemory();
      expect(l).toBe(0x46);
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x46 + 8 * q;
    it(`${opCode.toString(16)}: ld ${reg8[q]},(iy+D) #1`, () => {
      let s = testMachine.initCode([0xfd, opCode, 0x52]);
      s.iy = 0x1000;
      const m = testMachine.memory;
      m[s.iy + 0x52] = 0x46;
      s = testMachine.run(s, m);
      let l: number = 0xff;
      switch (q) {
        case 0:
          l = s.b;
          break;
        case 1:
          l = s.c;
          break;
        case 2:
          l = s.d;
          break;
        case 3:
          l = s.e;
          break;
        case 4:
          l = s.h;
          break;
        case 5:
          l = s.l;
          break;
        case 7:
          l = s.a;
          break;
      }

      testMachine.shouldKeepRegisters(`${reg8[q]}`);
      testMachine.shouldKeepMemory();
      expect(l).toBe(0x46);
      expect(s.pc).toBe(0x0003);
      expect(s.tacts).toBe(19);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x46 + 8 * q;
    it(`${opCode.toString(16)}: ld ${reg8[q]},(iy+D) #2`, () => {
      let s = testMachine.initCode([0xfd, opCode, 0xfe]);
      s.iy = 0x1000;
      const m = testMachine.memory;
      m[s.iy - 2] = 0x46;
      s = testMachine.run(s, m);
      let l: number = 0xff;
      switch (q) {
        case 0:
          l = s.b;
          break;
        case 1:
          l = s.c;
          break;
        case 2:
          l = s.d;
          break;
        case 3:
          l = s.e;
          break;
        case 4:
          l = s.h;
          break;
        case 5:
          l = s.l;
          break;
        case 7:
          l = s.a;
          break;
      }

      testMachine.shouldKeepRegisters(`${reg8[q]}`);
      testMachine.shouldKeepMemory();
      expect(l).toBe(0x46);
      expect(s.pc).toBe(0x0003);
      expect(s.tacts).toBe(19);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x70 + q;
    it(`${opCode.toString(16)}: ld (iy+D),${reg8[q]} #1`, () => {
      let s = testMachine.initCode([0xfd, opCode, 0x52]);
      s.iy = 0x1000;
      switch (q) {
        case 0:
          s.b = 0x46;
          break;
        case 1:
          s.c = 0x46;
          break;
        case 2:
          s.d = 0x46;
          break;
        case 3:
          s.e = 0x46;
          break;
        case 4:
          s.h = 0x46;
          break;
        case 5:
          s.l = 0x46;
          break;
        case 7:
          s.a = 0x46;
          break;
      }
      s = testMachine.run(s);
      const m = testMachine.memory;

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory("1052");
      expect(m[0x1052]).toBe(0x46);
      expect(s.pc).toBe(0x0003);
      expect(s.tacts).toBe(19);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x70 + q;
    it(`${opCode.toString(16)}: ld (iy+D),${reg8[q]} #2`, () => {
      let s = testMachine.initCode([0xfd, opCode, 0xfe]);
      s.iy = 0x1000;
      switch (q) {
        case 0:
          s.b = 0x46;
          break;
        case 1:
          s.c = 0x46;
          break;
        case 2:
          s.d = 0x46;
          break;
        case 3:
          s.e = 0x46;
          break;
        case 4:
          s.h = 0x46;
          break;
        case 5:
          s.l = 0x46;
          break;
        case 7:
          s.a = 0x46;
          break;
      }
      s = testMachine.run(s);
      const m = testMachine.memory;

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory("0ffe");
      expect(m[0x0ffe]).toBe(0x46);
      expect(s.pc).toBe(0x0003);
      expect(s.tacts).toBe(19);
    });
  }

  it("76: halt", () => {
    let s = testMachine.initCode([0xfd, 0x76], RunMode.UntilHalt);
    s = testMachine.run();

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.stateFlags & Z80StateFlags.Halted).toBeTruthy();
    expect(s.pc).toBe(0x0001);
    expect(s.tacts).toBe(8);
  });

  it("60: ld yh,b", () => {
    let s = testMachine.initCode([0xfd, 0x60]);
    s.iy = 0xaaaa;
    s.b = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0x55aa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("61: ld yh,c", () => {
    let s = testMachine.initCode([0xfd, 0x61]);
    s.iy = 0xaaaa;
    s.c = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0x55aa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("62: ld yh,d", () => {
    let s = testMachine.initCode([0xfd, 0x62]);
    s.iy = 0xaaaa;
    s.d = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0x55aa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("63: ld yh,e", () => {
    let s = testMachine.initCode([0xfd, 0x63]);
    s.iy = 0xaaaa;
    s.e = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0x55aa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("64: ld yh,yh", () => {
    let s = testMachine.initCode([0xfd, 0x64]);
    s.iy = 0xaabb;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("65: ld yh,yl", () => {
    let s = testMachine.initCode([0xfd, 0x65]);
    s.iy = 0xaabb;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xbbbb);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("67: ld yh,a", () => {
    let s = testMachine.initCode([0xfd, 0x67]);
    s.iy = 0xaaaa;
    s.a = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0x55aa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("68: ld yl,b", () => {
    let s = testMachine.initCode([0xfd, 0x68]);
    s.iy = 0xaaaa;
    s.b = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xaa55);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("69: ld yl,c", () => {
    let s = testMachine.initCode([0xfd, 0x69]);
    s.iy = 0xaaaa;
    s.c = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xaa55);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("6a: ld yl,d", () => {
    let s = testMachine.initCode([0xfd, 0x6a]);
    s.iy = 0xaaaa;
    s.d = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xaa55);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("6b: ld yl,e", () => {
    let s = testMachine.initCode([0xfd, 0x6b]);
    s.iy = 0xaaaa;
    s.e = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xaa55);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("6c: ld yl,yh", () => {
    let s = testMachine.initCode([0xfd, 0x6c]);
    s.iy = 0xaabb;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xaaaa);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("6d: ld yl,yl", () => {
    let s = testMachine.initCode([0xfd, 0x6d]);
    s.iy = 0xaabb;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });

  it("6f: ld yl,a", () => {
    let s = testMachine.initCode([0xfd, 0x6f]);
    s.iy = 0xaaaa;
    s.a = 0x55;
    s = testMachine.run(s);

    testMachine.shouldKeepRegisters("iy");
    testMachine.shouldKeepMemory();
    expect(s.iy).toBe(0xaa55);
    expect(s.pc).toBe(0x0002);
    expect(s.tacts).toBe(8);
  });
});
