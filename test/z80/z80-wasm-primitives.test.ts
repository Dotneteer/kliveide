import { readFileSync } from "node:fs";
import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";
import { describe, expect, it } from "vitest";

const word = { af: 0, pc: 12, sp: 13 };
const byte = { a: 0, f: 1 };

function createWasm() {
  buildSp48Wasm();
  return WebAssembly.instantiate(readFileSync(output)).then(({ instance }) => {
    const exports = instance.exports as Record<string, WebAssembly.ExportValue>;
    const call = (name: string, ...args: number[]) => (exports[name] as CallableFunction)(...args) as number;
    return {
      call,
      memory: new Uint8Array((exports.memory as WebAssembly.Memory).buffer)
    };
  });
}

describe("Z80 WASM primitives", () => {
  it("fetches bytes and words with wrapped PC and observable memory reads", async () => {
    const { call, memory } = await createWasm();
    call("z80_reset");
    call("z80_test_bus_reset");
    const start = call("z80_test_memory_ptr");
    memory[start + 0xffff] = 0x55;
    memory[start] = 0x66;
    call("z80_state_write_word", word.pc, 0xffff);

    expect(call("z80_test_fetch_word")).toBe(0x6655);
    expect(call("z80_state_read_word", word.pc)).toBe(1);
    expect(call("z80_state_read_counter", 0)).toBe(6);
    expect(call("z80_test_memory_log_count")).toBe(2);
    const log = new DataView(memory.buffer, call("z80_test_memory_log_ptr"));
    expect(log.getUint16(0, true)).toBe(0xffff);
    expect(log.getUint16(4, true)).toBe(0);
  });

  it("uses stack, I/O, condition, displacement, and parity helpers deterministically", async () => {
    const { call, memory } = await createWasm();
    call("z80_reset");
    call("z80_test_bus_reset");
    const start = call("z80_test_memory_ptr");
    call("z80_state_write_word", word.sp, 0x0100);
    call("z80_test_push_word", 0x1234);
    expect(memory[start + 0x00ff]).toBe(0x12);
    expect(memory[start + 0x00fe]).toBe(0x34);
    expect(call("z80_test_pop_word")).toBe(0x1234);
    expect(call("z80_state_read_word", word.sp)).toBe(0x0100);

    const ioInput = call("z80_test_io_input_ptr");
    memory[ioInput] = 0xaa;
    call("z80_test_io_input_count_set", 1);
    expect(call("z80_test_port_read", 0x1234)).toBe(0xaa);
    call("z80_test_port_write", 0xabcd, 0x55);
    expect(call("z80_test_io_log_count")).toBe(2);
    const ioLog = new DataView(memory.buffer, call("z80_test_io_log_ptr"));
    expect(ioLog.getUint16(0, true)).toBe(0x1234);
    expect(ioLog.getUint8(3)).toBe(0);
    expect(ioLog.getUint16(4, true)).toBe(0xabcd);
    expect(ioLog.getUint8(7)).toBe(1);

    call("z80_state_write_word", word.af, 0x0000);
    expect(call("z80_test_condition", 0)).toBe(1);
    expect(call("z80_test_condition", 1)).toBe(0);
    call("z80_state_write_byte", byte.f, 0xc5);
    expect(call("z80_test_condition", 1)).toBe(1);
    expect(call("z80_test_condition", 3)).toBe(1);
    expect(call("z80_test_condition", 5)).toBe(1);
    expect(call("z80_test_condition", 7)).toBe(1);
    expect(call("z80_test_sign_extend", 0x80) >>> 0).toBe(0xffffff80);
    expect(call("z80_test_parity", 0x00)).toBe(0x04);
    expect(call("z80_test_parity", 0x01)).toBe(0);
  });

  it("computes add and subtract flags with carry", async () => {
    const { call } = await createWasm();
    call("z80_reset");
    call("z80_state_write_word", word.af, 0x7f00);
    expect(call("z80_test_add8", 1, 0)).toBe(0x80);
    expect(call("z80_state_read_byte", byte.f)).toBe(0x94);

    call("z80_state_write_word", word.af, 0xff01);
    expect(call("z80_test_add8", 0, 1)).toBe(0);
    expect(call("z80_state_read_byte", byte.f)).toBe(0x51);

    call("z80_state_write_word", word.af, 0x8000);
    expect(call("z80_test_sub8", 1, 0)).toBe(0x7f);
    expect(call("z80_state_read_byte", byte.f)).toBe(0x3e);

    call("z80_state_write_word", word.af, 0x0000);
    expect(call("z80_test_sub8", 1, 0)).toBe(0xff);
    expect(call("z80_state_read_byte", byte.f)).toBe(0xbb);
  });
});
