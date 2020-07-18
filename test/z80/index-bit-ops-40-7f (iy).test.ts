import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { FlagsSetMask } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Indexed bit ops 40-7f (iy)", () => {
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
    for (let n = 0; n <= 7; n++) {
      const opCode = 0x40 + n * 8 + q;
      it(`${opCode.toString(16)}: bit ${n},(iy+D) #1`, () => {
        const OFFS = 0x32;
        let s = testMachine.initCode([0xfd, 0xcb, OFFS, opCode]);
        let m = testMachine.memory;
        s.iy = 0x1000;
        m[s.iy + OFFS] = ~(0x01 << n);
        s.f &= 0xfe;
  
        s = testMachine.run(s, m);
        m = testMachine.memory;
  
        expect(s.f & FlagsSetMask.S).toBeFalsy();
        expect(s.f & FlagsSetMask.Z).toBeTruthy();
        expect(s.f & FlagsSetMask.H).toBeTruthy();
        expect(s.f & FlagsSetMask.PV).toBeTruthy();
        expect(s.f & FlagsSetMask.N).toBeFalsy();
        expect(s.f & FlagsSetMask.C).toBeFalsy();

        testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0004);
        expect(s.tacts).toBe(20);
      });

      it(`${opCode.toString(16)}: bit ${n},(iy+D) #2`, () => {
        const OFFS = 0x32;
        let s = testMachine.initCode([0xfd, 0xcb, OFFS, opCode]);
        let m = testMachine.memory;
        s.iy = 0x1000;
        m[s.iy + OFFS] = 0x01 << n;
        s.f &= 0xfe;
  
        s = testMachine.run(s, m);
        m = testMachine.memory;
  
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

        expect(s.pc).toBe(0x0004);
        expect(s.tacts).toBe(20);
      });
    }
  }
});
