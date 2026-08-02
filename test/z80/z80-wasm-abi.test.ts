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
    expect(wasm.z80_execute_instruction()).toBe(1);
  });
});
