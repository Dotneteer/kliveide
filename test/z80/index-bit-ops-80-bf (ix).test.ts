import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { Z80CpuState } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Indexed bit ops 80-bf (ix)", () => {
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
      const opCode = 0x80 + n * 8 + q;
      it(`${opCode.toString(16)}: res ${n},(ix+D) #1`, () => {
        const OFFS = 0x32;
        let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
        let m = testMachine.memory;
        s.ix = 0x1000;
        m[s.ix + OFFS] = 0xff;
        s.f &= 0xfe;
  
        s = testMachine.run(s, m);
        m = testMachine.memory;
  
        expect(m[s.ix + OFFS]).toBe(0xff & ~(1 << n));
        if (q !== 6) {
          expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
        }
        testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
        testMachine.shouldKeepMemory("1032");

        expect(s.pc).toBe(0x0004);
        expect(s.tacts).toBe(23);
      });

      it(`${opCode.toString(16)}: res ${n},(ix+D) #2`, () => {
        const OFFS = 0x32;
        let s = testMachine.initCode([0xdd, 0xcb, OFFS, opCode]);
        let m = testMachine.memory;
        s.ix = 0x1000;
        m[s.ix + OFFS] = 0xaa;
        s.f &= 0xfe;
  
        s = testMachine.run(s, m);
        m = testMachine.memory;
  
        expect(m[s.ix + OFFS]).toBe(0xaa & ~(1 << n));
        if (q !== 6) {
          expect(getReg8(s, q)).toBe(m[s.ix + OFFS]);
        }
        testMachine.shouldKeepRegisters(`F, ${reg8[q]}`);
        testMachine.shouldKeepMemory("1032");

        expect(s.pc).toBe(0x0004);
        expect(s.tacts).toBe(23);
      });
    }
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
