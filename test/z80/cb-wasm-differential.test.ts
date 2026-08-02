import { describe, expect, it } from "vitest";
import { RunMode as TypeScriptRunMode, Z80TestMachine as TypeScriptMachine } from "./test-z80";
import { RunMode as WasmRunMode, Z80TestMachine as WasmMachine } from "./wasm-test-z80";

function nextRandom (seed: { value: number }): number {
  seed.value = (seed.value * 1664525 + 1013904223) >>> 0;
  return seed.value;
}

function setState (machine: TypeScriptMachine | WasmMachine, seed: { value: number }): void {
  const cpu = machine.cpu;
  cpu.af = nextRandom(seed) & 0xffff;
  cpu.bc = nextRandom(seed) & 0xffff;
  cpu.de = nextRandom(seed) & 0xffff;
  cpu.hl = nextRandom(seed) & 0xffff;
  cpu.af_ = nextRandom(seed) & 0xffff;
  cpu.bc_ = nextRandom(seed) & 0xffff;
  cpu.de_ = nextRandom(seed) & 0xffff;
  cpu.hl_ = nextRandom(seed) & 0xffff;
  cpu.sp = nextRandom(seed) & 0xffff;
}

function snapshot (machine: TypeScriptMachine | WasmMachine) {
  const { cpu } = machine;
  return {
    af: cpu.af, bc: cpu.bc, de: cpu.de, hl: cpu.hl,
    afAlt: cpu.af_, bcAlt: cpu.bc_, deAlt: cpu.de_, hlAlt: cpu.hl_,
    ix: cpu.ix, iy: cpu.iy, ir: cpu.ir, wz: cpu.wz,
    pc: cpu.pc, sp: cpu.sp, tacts: cpu.tacts, prefix: cpu.prefix, halted: cpu.halted
  };
}

function memoryLog (machine: TypeScriptMachine | WasmMachine) {
  return machine.memoryAccessLog.map(entry => ({
    address: entry.address,
    value: entry.value,
    isWrite: entry.isWrite
  }));
}

function expectTouchedMemoryToMatch (ts: TypeScriptMachine, wasm: WasmMachine, label: string): void {
  const touchedAddresses = new Set<number>();
  for (const entry of ts.memoryAccessLog) touchedAddresses.add(entry.address);
  for (const entry of wasm.memoryAccessLog) touchedAddresses.add(entry.address);

  for (const address of touchedAddresses) {
    expect(wasm.memory[address], `${label} memory ${address.toString(16)}`).toBe(ts.memory[address]);
  }
}

describe("CB WASM differential", () => {
  it("matches TypeScript across deterministic edge vectors and seeded states", () => {
    const edgeValues = [0x00, 0x01, 0x7f, 0x80, 0xff];
    const opcodes = Array.from({ length: 0x100 }, (_, opcode) => opcode);
    const seed = { value: 0xc0de4830 };

    for (const opcode of opcodes) {
      const vectors = [...edgeValues, nextRandom(seed) & 0xff, nextRandom(seed) & 0xff];
      for (const value of vectors) {
        const ts = new TypeScriptMachine(TypeScriptRunMode.OneInstruction);
        const wasm = new WasmMachine(WasmRunMode.OneInstruction);
        const address = ((nextRandom(seed) & 0xff00) | 0x00fd) & 0xffff;
        const stateSeed = nextRandom(seed);

        ts.initCode([0xcb, opcode], address, address);
        wasm.initCode([0xcb, opcode], address, address);
        setState(ts, { value: stateSeed });
        setState(wasm, { value: stateSeed });
        ts.cpu.hl = wasm.cpu.hl = ((address + 0x0101) & 0xffff);
        ts.memory[ts.cpu.hl] = value;
        wasm.memory[wasm.cpu.hl] = value;

        ts.run();
        wasm.run();

        expect(snapshot(wasm), `CB ${opcode.toString(16)} state`).toEqual(snapshot(ts));
        expect(memoryLog(wasm), `CB ${opcode.toString(16)} memory log`).toEqual(memoryLog(ts));
        expectTouchedMemoryToMatch(ts, wasm, `CB ${opcode.toString(16)}`);
        expect(wasm.ioAccessLog).toEqual(ts.ioAccessLog.map(entry => ({
          address: entry.address, value: entry.value, isOutput: entry.isOutput
        })));
      }
    }
  });
});
