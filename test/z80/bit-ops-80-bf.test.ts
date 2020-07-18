import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";
import { TestZ80Machine } from "../../src/native/TestZ80Machine";
import { Z80CpuState } from "../../src/native/cpu-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;
let testMachine: TestZ80Machine;


describe("Bit ops 80-bf", () => {
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
      const opCode = 0x80 + n * 8 + q;
      it(`${opCode.toString(16)}: res ${n},${reg8[q]} #1`, () => {
        let s = testMachine.initCode([0xcb, opCode]);
        setReg8(s, q, 0xff);
        s.f &= 0xfe;
        s = testMachine.run(s);

        expect(getReg8(s, q)).toBe(0xff & ~(1 << n));
        testMachine.shouldKeepRegisters(`${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0002);
        expect(s.tacts).toBe(8);
      });

      it(`${opCode.toString(16)}: res ${n},${reg8[q]} #2`, () => {
        let s = testMachine.initCode([0xcb, opCode]);
        setReg8(s, q, 0xaa);
        s.f &= 0xfe;
        s = testMachine.run(s);

        expect(getReg8(s, q)).toBe(0xaa & ~(1 << n));

        testMachine.shouldKeepRegisters(`${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0002);
        expect(s.tacts).toBe(8);
      });
    }
  }

  for (let n = 0; n <= 7; n++) {
    const opCode = 0x86 + n * 8;
    it(`${opCode.toString(16)}: res ${n},(hl) #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      let m = testMachine.memory;
      s.hl = 0x1000;
      m[s.hl] = 0xff;
      s.f &= 0xfe;
      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[0x1000]).toBe(0xff & ~(1 << n));

      testMachine.shouldKeepRegisters("F");
      testMachine.shouldKeepMemory("1000");

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(15);
    });

    it(`${opCode.toString(16)}: res ${n},(hl) #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      let m = testMachine.memory;
      s.hl = 0x1000;
      m[s.hl] = 0xaa;
      s.f &= 0xfe;
      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[0x1000]).toBe(0xaa & ~(1 << n));

      testMachine.shouldKeepRegisters("F");
      testMachine.shouldKeepMemory("1000");

      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(15);
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
