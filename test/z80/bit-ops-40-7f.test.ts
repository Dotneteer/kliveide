import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask, Z80StateFlags, Z80CpuState } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Bit ops 40-7f", () => {
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
    for (let n = 0; n <= 7; n++) {
      const opCode = 0x40 + n * 8 + q;
      it(`${opCode.toString(16)}: bit ${n},${reg8[q]} #1`, () => {
        let s = testMachine.initCode([0xcb, opCode]);
        setReg8(s, q, ~(0x01 << n));
        s.f &= 0xfe;
        s = testMachine.run(s);

        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.N).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();

        testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0002);
        expect(s.tacts).toBe(8);
      });

      it(`${opCode.toString(16)}: bit ${n},${reg8[q]} #2`, () => {
        let s = testMachine.initCode([0xcb, opCode]);
        setReg8(s, q, 0x01 << n);
        s.f &= 0xfe;
        s = testMachine.run(s);

        if (n === 7) {
          expect(s.f & FlagsSetMask.S).toBeTruthy();
        } else {
          expect(s.f & FlagsSetMask.S).toBeFalsy();
        }
        expect(s.f & FlagsSetMask.Z).toBeFalsy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeFalsy();
        expect(s.f & FlagsSetMask.N).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();

        testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0002);
        expect(s.tacts).toBe(8);
      });
    }
  }

  for (let n = 0; n <= 7; n++) {
    const opCode = 0x46 + n * 8;
    it(`${opCode.toString(16)}: bit ${n},(hl) #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      let m = testMachine.memory;
      s.hl = 0x1000;
      m[s.hl] =  ~(0x01 << n);
      s.f &= 0xfe;
      s = testMachine.run(s, m);
      m = testMachine.memory

      expect(s.f & FlagsSetMask.S).toBeFalsy();
      expect(s.f & FlagsSetMask.Z).toBeTruthy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeTruthy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters("F");
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(12);
    });

    it(`${opCode.toString(16)}: bit ${n},(hl) #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      let m = testMachine.memory;
      s.hl = 0x1000;
      m[s.hl] = 0x01 << n;
      s.f &= 0xfe;
      s = testMachine.run(s, m);

      if (n === 7) {
        expect(s.f & FlagsSetMask.S).toBeTruthy();
      } else {
        expect(s.f & FlagsSetMask.S).toBeFalsy();
      }
      expect(s.f & FlagsSetMask.Z).toBeFalsy();
      expect(s.f & FlagsSetMask.H).toBeTruthy();
      expect(s.f & FlagsSetMask.PV).toBeFalsy();
      expect(s.f & FlagsSetMask.N).toBeFalsy();
      expect(s.f & FlagsSetMask.C).toBeFalsy();

      testMachine.shouldKeepRegisters("F");
      testMachine.shouldKeepMemory();

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(12);
    });
  }
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
