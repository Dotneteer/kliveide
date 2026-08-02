import { describe, expect, it } from "vitest";
import { RunMode as TypeScriptRunMode, Z80TestMachine as TypeScriptMachine } from "./test-z80";
import { RunMode as WasmRunMode, Z80TestMachine as WasmMachine } from "./wasm-test-z80";

function nextRandom (seed: { value: number }): number {
  seed.value = (seed.value * 1664525 + 1013904223) >>> 0;
  return seed.value;
}

function setState (machine: TypeScriptMachine | WasmMachine, seedValue: number): void {
  const seed = { value: seedValue };
  const { cpu } = machine;

  cpu.af = nextRandom(seed) & 0xffff;
  cpu.bc = nextRandom(seed) & 0xffff;
  cpu.de = nextRandom(seed) & 0xffff;
  cpu.hl = nextRandom(seed) & 0xffff;
  cpu.af_ = nextRandom(seed) & 0xffff;
  cpu.bc_ = nextRandom(seed) & 0xffff;
  cpu.de_ = nextRandom(seed) & 0xffff;
  cpu.hl_ = nextRandom(seed) & 0xffff;
  cpu.ix = nextRandom(seed) & 0xffff;
  cpu.iy = nextRandom(seed) & 0xffff;
  cpu.ir = nextRandom(seed) & 0xffff;
  cpu.sp = 0xf100 | (nextRandom(seed) & 0xff);
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
    value: entry.value & 0xff,
    isWrite: entry.isWrite
  }));
}

function ioLog (machine: TypeScriptMachine | WasmMachine) {
  return machine.ioAccessLog.map(entry => ({
    address: entry.address,
    value: entry.value & 0xff,
    isOutput: entry.isOutput
  }));
}

function expectMachinesToMatch (ts: TypeScriptMachine, wasm: WasmMachine, label: string, compareLogs = true): void {
  expect(snapshot(wasm), `${label} state`).toEqual(snapshot(ts));
  expect(Array.from(wasm.memory), `${label} memory`).toEqual(Array.from(ts.memory));
  if (compareLogs) {
    expect(memoryLog(wasm), `${label} memory log`).toEqual(memoryLog(ts));
    expect(ioLog(wasm), `${label} io log`).toEqual(ioLog(ts));
  }
}

function indexedOperandCount (opcode: number): number {
  if ([0x01, 0x11, 0x21, 0x22, 0x2a, 0x31, 0x32, 0x3a, 0xc2, 0xc3, 0xc4, 0xca, 0xcc, 0xcd, 0xd2, 0xd4, 0xda, 0xdc, 0xe2, 0xe4, 0xea, 0xec, 0xf2, 0xf4, 0xfa, 0xfc].includes(opcode)) {
    return 2;
  }
  if ([0x06, 0x0e, 0x16, 0x1e, 0x20, 0x26, 0x28, 0x2e, 0x30, 0x36, 0x38, 0x3e, 0xc6, 0xce, 0xd3, 0xd6, 0xdb, 0xde, 0xe6, 0xee, 0xf6, 0xfe].includes(opcode)) {
    return 1;
  }
  return 0;
}

describe("ED and indexed WASM differential", () => {
  it("matches TypeScript for ED block op edge vectors", () => {
    const opcodes = [0xa0, 0xa1, 0xa2, 0xa3, 0xa8, 0xa9, 0xaa, 0xab, 0xb0, 0xb1, 0xb2, 0xb3, 0xb8, 0xb9, 0xba, 0xbb];
    const seed = { value: 0xedb10c48 };

    for (const opcode of opcodes) {
      for (const bc of [0x0001, 0x0002, 0x0201]) {
        const ts = new TypeScriptMachine(TypeScriptRunMode.OneInstruction);
        const wasm = new WasmMachine(WasmRunMode.OneInstruction);
        const start = 0x0200 | (nextRandom(seed) & 0x7f);
        const stateSeed = nextRandom(seed);
        const hl = 0x3000 | (nextRandom(seed) & 0xff);
        const de = 0x4000 | (nextRandom(seed) & 0xff);
        const value = nextRandom(seed) & 0xff;

        ts.initCode([0xed, opcode], start, start);
        wasm.initCode([0xed, opcode], start, start);
        setState(ts, stateSeed);
        setState(wasm, stateSeed);
        ts.cpu.bc = wasm.cpu.bc = bc;
        ts.cpu.hl = wasm.cpu.hl = hl;
        ts.cpu.de = wasm.cpu.de = de;
        ts.memory[hl] = wasm.memory[hl] = value;
        ts.memory[de] = wasm.memory[de] = nextRandom(seed) & 0xff;
        ts.ioInputSequence.push(value, nextRandom(seed) & 0xff, nextRandom(seed) & 0xff);
        wasm.ioInputSequence.push(...ts.ioInputSequence);

        ts.run();
        wasm.run();

        expectMachinesToMatch(ts, wasm, `ED ${opcode.toString(16)} BC=${bc.toString(16)}`);
      }
    }
  });

  it("matches TypeScript for DD/FD indexed op edge vectors", () => {
    const opcodes = [
      ...Array.from({ length: 0x40 }, (_, opcode) => opcode),
      ...Array.from({ length: 0xc0 }, (_, index) => 0x40 + index)
    ];
    const seed = { value: 0x1d00bf48 };

    for (const prefix of [0xdd, 0xfd]) {
      for (const opcode of opcodes) {
        if (opcode === 0xcb || opcode === 0xdd || opcode === 0xfd) continue;
        const needsDisplacement = [0x34, 0x35, 0x36].includes(opcode) || ((opcode & 7) === 6 && opcode >= 0x40 && opcode <= 0xbf);
        const operandCount = indexedOperandCount(opcode);
        const suffix = Array.from({ length: operandCount }, () => nextRandom(seed) & 0xff);
        const displacement = needsDisplacement ? [0x10, 0xf1][nextRandom(seed) & 1] : undefined;
        const program = displacement == null ? [prefix, opcode, ...suffix] : [prefix, opcode, displacement, ...suffix];
        const ts = new TypeScriptMachine(TypeScriptRunMode.OneInstruction);
        const wasm = new WasmMachine(WasmRunMode.OneInstruction);
        const start = 0x0400 | (nextRandom(seed) & 0x7f);
        const stateSeed = nextRandom(seed);
        const indexBase = 0x5000 | (nextRandom(seed) & 0xff);
        const dataAddress = (indexBase + (displacement == null ? 0 : (displacement << 24) >> 24)) & 0xffff;

        ts.initCode(program, start, start);
        wasm.initCode(program, start, start);
        setState(ts, stateSeed);
        setState(wasm, stateSeed);
        if (prefix === 0xdd) ts.cpu.ix = wasm.cpu.ix = indexBase;
        else ts.cpu.iy = wasm.cpu.iy = indexBase;
        ts.memory[dataAddress] = wasm.memory[dataAddress] = nextRandom(seed) & 0xff;
        ts.memory[ts.cpu.sp] = wasm.memory[wasm.cpu.sp] = nextRandom(seed) & 0xff;
        ts.memory[(ts.cpu.sp + 1) & 0xffff] = wasm.memory[(wasm.cpu.sp + 1) & 0xffff] = nextRandom(seed) & 0xff;
        ts.ioInputSequence.push(nextRandom(seed) & 0xff);
        wasm.ioInputSequence.push(...ts.ioInputSequence);

        ts.run();
        wasm.run();

        expectMachinesToMatch(ts, wasm, `${prefix.toString(16)} ${opcode.toString(16)}`, opcode < 0xc0);
      }
    }
  });

  it("matches TypeScript for DDCB/FDCB indexed bit op edge vectors", () => {
    const seed = { value: 0xddcbfdcb };

    for (const prefix of [0xdd, 0xfd]) {
      for (const opcode of Array.from({ length: 0x100 }, (_, value) => value)) {
        for (const value of [0x00, 0x01, 0x7f, 0x80, 0xff, nextRandom(seed) & 0xff]) {
          const displacement = [0x10, 0xf1][nextRandom(seed) & 1];
          const program = [prefix, 0xcb, displacement, opcode];
          const ts = new TypeScriptMachine(TypeScriptRunMode.OneInstruction);
          const wasm = new WasmMachine(WasmRunMode.OneInstruction);
          const start = 0x0600 | (nextRandom(seed) & 0x7f);
          const stateSeed = nextRandom(seed);
          const indexBase = 0x7000 | (nextRandom(seed) & 0xff);
          const dataAddress = (indexBase + ((displacement << 24) >> 24)) & 0xffff;

          ts.initCode(program, start, start);
          wasm.initCode(program, start, start);
          setState(ts, stateSeed);
          setState(wasm, stateSeed);
          if (prefix === 0xdd) ts.cpu.ix = wasm.cpu.ix = indexBase;
          else ts.cpu.iy = wasm.cpu.iy = indexBase;
          ts.memory[dataAddress] = wasm.memory[dataAddress] = value;

          ts.run();
          wasm.run();

          expectMachinesToMatch(ts, wasm, `${prefix.toString(16)} cb ${opcode.toString(16)} value=${value.toString(16)}`);
        }
      }
    }
  }, 60_000);
});
