import { existsSync, readFileSync } from "node:fs";
import { buildSp48Wasm, testOutput, testExports } from "../../scripts/build-sp48-wasm.cjs";
import { describe, expect, it } from "vitest";

const word = {
  af: 0,
  bc: 1,
  pc: 12,
  sp: 13
};

const byte = {
  a: 0,
  f: 1,
  b: 2,
  c: 3
};

const control = {
  prefix: 0,
  halted: 1,
  interruptMode: 3,
  iff1: 4,
  iff2: 5,
  sigInt: 6,
  sigNmi: 7,
  sigRst: 8,
  eiBacklog: 9,
  afterLdAir: 10,
  interruptVector: 11
};
const counter = { tacts: 0 };
const stateOffset = {
  words: 0,
  counters: 28,
  controls: 44
} as const;

function wordAt (state: DataView, field: number): number {
  return state.getUint16(stateOffset.words + field * 2, true);
}

function writeWord (state: DataView, field: number, value: number): void {
  state.setUint16(stateOffset.words + field * 2, value, true);
}

function byteAt (state: DataView, field: number): number {
  const byteOffsets = [1, 0, 3, 2, 5, 4, 7, 6, 17, 16, 19, 18, 21, 20];
  return state.getUint8(byteOffsets[field]);
}

function writeByte (state: DataView, field: number, value: number): void {
  const byteOffsets = [1, 0, 3, 2, 5, 4, 7, 6, 17, 16, 19, 18, 21, 20];
  state.setUint8(byteOffsets[field], value);
}

function controlAt (state: DataView, field: number): number {
  return state.getUint8(stateOffset.controls + field);
}

function writeControl (state: DataView, field: number, value: number): void {
  state.setUint8(stateOffset.controls + field, value);
}

function counterAt (state: DataView, field: number): number {
  return state.getUint32(stateOffset.counters + field * 4, true);
}

describe("Z80 WASM ABI", () => {
  it("compiles and exposes the resettable CPU state and test bus", async () => {
    buildSp48Wasm({ mode: "test" });
    const { instance } = await WebAssembly.instantiate(readFileSync(testOutput));
    const wasm = instance.exports as Record<string, CallableFunction>;
    const memory = new Uint8Array((instance.exports.memory as WebAssembly.Memory).buffer);
    const state = new DataView(memory.buffer, wasm.z80_state_block_ptr(), wasm.z80_state_block_size());

    expect(existsSync(testOutput)).toBe(true);
    expect(Object.keys(instance.exports).sort()).toEqual([...testExports].sort());
    expect(wasm.z80_abi_version()).toBe(1);
    expect(wasm.z80_state_block_size()).toBe(64);

    writeWord(state, word.af, 0x1c3d);
    writeByte(state, byte.a, 0x2f);
    writeByte(state, byte.c, 0x1234);
    wasm.z80_state_import();
    wasm.z80_state_export();
    expect(wordAt(state, word.af)).toBe(0x2f3d);
    expect(byteAt(state, byte.f)).toBe(0x3d);
    expect(byteAt(state, byte.c)).toBe(0x34);

    wasm.z80_reset();
    expect(wordAt(state, word.af)).toBe(0xffff);
    expect(wordAt(state, word.pc)).toBe(0);
    expect(wordAt(state, word.sp)).toBe(0xffff);
    expect(wasm.z80_test_memory_size()).toBe(0x10000);
    expect(wasm.z80_test_memory_log_capacity()).toBeGreaterThan(0);
    expect(wasm.z80_test_io_log_capacity()).toBeGreaterThan(0);
    expect(wasm.z80_test_tbblue_log_capacity()).toBeGreaterThan(0);
    expect(wasm.z80_execute_instruction()).toBe(0);
  });

  it("executes the fetch shell, prefix state, and HALT timing", async () => {
    buildSp48Wasm({ mode: "test" });
    const { instance } = await WebAssembly.instantiate(readFileSync(testOutput));
    const wasm = instance.exports as Record<string, WebAssembly.ExportValue>;
    const call = (name: string, ...args: number[]) => (wasm[name] as CallableFunction)(...args) as number;
    const memory = new Uint8Array((wasm.memory as WebAssembly.Memory).buffer);
    const memoryStart = call("z80_test_memory_ptr");
    const state = new DataView(memory.buffer, call("z80_state_block_ptr"), call("z80_state_block_size"));

    call("z80_reset");
    call("z80_test_bus_reset");
    memory[memoryStart] = 0x00;
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(1);
    expect(byteAt(state, 13)).toBe(1);
    expect(counterAt(state, counter.tacts)).toBe(4);
    expect(call("z80_test_memory_log_count")).toBe(1);

    call("z80_reset");
    memory[memoryStart] = 0xff;
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(0x0038);

    call("z80_reset");
    memory[memoryStart] = 0xdd;
    memory[memoryStart + 1] = 0xfd;
    expect(call("z80_execute_instruction")).toBe(2);
    expect(controlAt(state, control.prefix)).toBe(3);
    expect(call("z80_execute_instruction")).toBe(2);
    expect(controlAt(state, control.prefix)).toBe(4);
    expect(byteAt(state, 13)).toBe(1);

    writeControl(state, control.halted, 1);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(2);
    expect(counterAt(state, counter.tacts)).toBe(11);
    expect(call("z80_test_memory_log_count")).toBe(2);
  });

  it("handles RESET, NMI, and interrupt modes without host callbacks", async () => {
    buildSp48Wasm({ mode: "test" });
    const { instance } = await WebAssembly.instantiate(readFileSync(testOutput));
    const wasm = instance.exports as Record<string, WebAssembly.ExportValue>;
    const call = (name: string, ...args: number[]) => (wasm[name] as CallableFunction)(...args) as number;
    const memory = new Uint8Array((wasm.memory as WebAssembly.Memory).buffer);
    const memoryStart = call("z80_test_memory_ptr");
    const state = new DataView(memory.buffer, call("z80_state_block_ptr"), call("z80_state_block_size"));

    call("z80_reset");
    call("z80_test_bus_reset");
    writeWord(state, word.pc, 0x1234);
    writeWord(state, word.sp, 0x8000);
    writeWord(state, word.af, 0x0004);
    writeControl(state, control.iff1, 1);
    writeControl(state, control.afterLdAir, 1);
    writeControl(state, control.sigNmi, 1);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(0x0066);
    expect(wordAt(state, 11)).toBe(0x0066);
    expect(wordAt(state, word.sp)).toBe(0x7ffe);
    expect(memory[memoryStart + 0x7fff]).toBe(0x12);
    expect(memory[memoryStart + 0x7ffe]).toBe(0x34);
    expect(controlAt(state, control.iff1)).toBe(0);
    expect(controlAt(state, control.iff2)).toBe(1);
    expect(byteAt(state, byte.f)).toBe(0);
    expect(counterAt(state, counter.tacts)).toBe(11);

    call("z80_reset");
    writeWord(state, word.pc, 0x2000);
    writeWord(state, word.sp, 0x8000);
    writeControl(state, control.interruptMode, 1);
    writeControl(state, control.iff1, 1);
    writeControl(state, control.sigInt, 1);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(0x0038);
    expect(wordAt(state, word.sp)).toBe(0x7ffe);
    expect(counterAt(state, counter.tacts)).toBe(13);

    call("z80_reset");
    call("z80_test_bus_reset");
    memory[memoryStart + 0x8010] = 0x34;
    memory[memoryStart + 0x8011] = 0x12;
    writeWord(state, word.pc, 0x1000);
    writeWord(state, word.sp, 0x9000);
    writeByte(state, 12, 0x80);
    writeControl(state, control.interruptMode, 2);
    writeControl(state, control.interruptVector, 0x10);
    writeControl(state, control.iff1, 1);
    writeControl(state, control.sigInt, 1);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(0x1234);
    expect(counterAt(state, counter.tacts)).toBe(19);

    call("z80_reset");
    writeWord(state, word.pc, 0x4000);
    writeControl(state, control.sigRst, 1);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(wordAt(state, word.pc)).toBe(0);
    expect(controlAt(state, control.sigRst)).toBe(0);

    call("z80_test_bus_reset");
    memory[memoryStart] = 0x00;
    writeControl(state, control.iff1, 1);
    writeControl(state, control.sigInt, 1);
    writeControl(state, control.eiBacklog, 2);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(controlAt(state, control.eiBacklog)).toBe(1);
    expect(wordAt(state, word.pc)).toBe(1);
  });
});
