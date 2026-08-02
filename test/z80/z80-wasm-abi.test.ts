import { existsSync, readFileSync } from "node:fs";
import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";
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

const control = { prefix: 0, halted: 1 };
const counter = { tacts: 0 };

describe("Z80 WASM ABI", () => {
  it("compiles and exposes the resettable CPU state and test bus", async () => {
    buildSp48Wasm();
    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const wasm = instance.exports as Record<string, CallableFunction>;

    expect(existsSync(output)).toBe(true);
    expect(wasm.z80_abi_version()).toBe(1);
    expect(wasm.z80_state_size()).toBeGreaterThan(0);
    expect(wasm.z80_register_layout_probe()).toBe(0x1234);

    wasm.z80_state_write_word(word.af, 0x1c3d);
    wasm.z80_state_write_byte(byte.a, 0x2f);
    wasm.z80_state_write_byte(byte.c, 0x1234);
    expect(wasm.z80_state_read_word(word.af)).toBe(0x2f3d);
    expect(wasm.z80_state_read_byte(byte.f)).toBe(0x3d);
    expect(wasm.z80_state_read_byte(byte.c)).toBe(0x34);

    wasm.z80_reset();
    expect(wasm.z80_state_read_word(word.af)).toBe(0xffff);
    expect(wasm.z80_state_read_word(word.pc)).toBe(0);
    expect(wasm.z80_state_read_word(word.sp)).toBe(0xffff);
    expect(wasm.z80_test_memory_size()).toBe(0x10000);
    expect(wasm.z80_test_memory_log_capacity()).toBeGreaterThan(0);
    expect(wasm.z80_test_io_log_capacity()).toBeGreaterThan(0);
    expect(wasm.z80_test_tbblue_log_capacity()).toBeGreaterThan(0);
    expect(wasm.z80_execute_instruction()).toBe(0);
  });

  it("executes the fetch shell, prefix state, and HALT timing", async () => {
    buildSp48Wasm();
    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const wasm = instance.exports as Record<string, WebAssembly.ExportValue>;
    const call = (name: string, ...args: number[]) => (wasm[name] as CallableFunction)(...args) as number;
    const memory = new Uint8Array((wasm.memory as WebAssembly.Memory).buffer);
    const memoryStart = call("z80_test_memory_ptr");

    call("z80_reset");
    call("z80_test_bus_reset");
    memory[memoryStart] = 0x00;
    expect(call("z80_execute_instruction")).toBe(0);
    expect(call("z80_state_read_word", word.pc)).toBe(1);
    expect(call("z80_state_read_byte", 13)).toBe(1);
    expect(call("z80_state_read_counter", counter.tacts)).toBe(4);
    expect(call("z80_test_memory_log_count")).toBe(1);

    call("z80_reset");
    memory[memoryStart] = 0xff;
    expect(call("z80_execute_instruction")).toBe(1);

    call("z80_reset");
    memory[memoryStart] = 0xdd;
    memory[memoryStart + 1] = 0xfd;
    expect(call("z80_execute_instruction")).toBe(2);
    expect(call("z80_state_read_control", control.prefix)).toBe(3);
    expect(call("z80_execute_instruction")).toBe(2);
    expect(call("z80_state_read_control", control.prefix)).toBe(4);
    expect(call("z80_state_read_byte", 13)).toBe(1);

    call("z80_state_write_control", control.halted, 1);
    expect(call("z80_execute_instruction")).toBe(0);
    expect(call("z80_state_read_word", word.pc)).toBe(2);
    expect(call("z80_state_read_counter", counter.tacts)).toBe(11);
    expect(call("z80_test_memory_log_count")).toBe(1);
  });
});
