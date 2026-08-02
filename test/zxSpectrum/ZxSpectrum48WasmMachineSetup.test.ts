import type { Sp48WasmExports, Sp48WasmInstance, Sp48WasmLoaderOptions } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";

import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";
import { SP48_WASM_ABI_VERSION, SP48_WASM_LAYOUT, SP48_WASM_LAYOUT_VALUE_ID } from "@emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated";
import { describe, expect, it } from "vitest";

class TestWasmMachine extends ZxSpectrum48WasmMachine {
  romLoads = 0;

  constructor(loaderOptions: Sp48WasmLoaderOptions) {
    super(undefined, undefined, loaderOptions);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    this.romLoads++;
    return new Uint8Array(0x4000);
  }
}

describe("ZX Spectrum 48K WASM machine setup", () => {
  it("loads and validates the WASM artifact before TypeScript ROM setup", async () => {
    const machine = new TestWasmMachine(fakeLoaderOptions());

    await machine.setup();

    expect(machine.wasmRuntime?.exports.sp48_abi_version()).toBe(SP48_WASM_ABI_VERSION);
    expect(machine.romLoads).toBe(1);
  });

  it("reports an incompatible WASM artifact instead of silently falling back", async () => {
    const machine = new TestWasmMachine(fakeLoaderOptions({
      sp48_abi_version: () => 99
    }));

    await expect(machine.setup()).rejects.toThrow("ABI version 99");
    expect(machine.romLoads).toBe(0);
  });
});

function fakeLoaderOptions(overrides: Partial<Sp48WasmExports> = {}): Sp48WasmLoaderOptions {
  return {
    artifactName: "setup-test.wasm",
    readArtifact: async () => new Uint8Array([0]),
    compile: async () => ({} as WebAssembly.Module),
    instantiate: async () => fakeInstance(overrides)
  };
}

function fakeInstance(overrides: Partial<Sp48WasmExports>): Promise<Sp48WasmInstance> {
  return Promise.resolve({
    exports: {
      memory: new WebAssembly.Memory({ initial: 8 }),
      sp48_abi_version: () => SP48_WASM_ABI_VERSION,
      sp48_layout_value: layoutValue,
      sp48_machine_state_block_ptr: () => 0x0000,
      sp48_input_block_ptr: () => 0x0100,
      sp48_result_block_ptr: () => 0x0200,
      sp48_event_buffer_ptr: () => 0x0300,
      sp48_memory_ptr: () => 0x2000,
      sp48_memory_size: () => SP48_WASM_LAYOUT.memorySize,
      sp48_dirty_ranges_ptr: () => 0x1000,
      sp48_contention_table_ptr: () => 0x12000,
      sp48_floating_bus_table_ptr: () => 0x24000,
      sp48_tape_ear_table_ptr: () => 0x46000,
      sp48_timing_table_capacity: () => SP48_WASM_LAYOUT.timingTableCapacity,
      sp48_dirty_range_count: () => 0,
      sp48_clear_dirty_ranges: () => 0,
      sp48_border_trace_count: () => 0,
      sp48_clear_border_trace: () => 0,
      sp48_audio_trace_count: () => 0,
      sp48_clear_audio_trace: () => 0,
      sp48_event_status: () => 0,
      sp48_tape_save_trace_count: () => 0,
      sp48_clear_tape_save_trace: () => 0,
      sp48_debug_memory_log_count: () => 0,
      sp48_debug_memory_log_ptr: () => 0x59000,
      sp48_debug_io_log_count: () => 0,
      sp48_debug_io_log_ptr: () => 0x5a000,
      sp48_set_16k_model: () => 0,
      sp48_import_state: () => 0,
      sp48_export_state: () => 0,
      sp48_import_snapshot: () => 0,
      sp48_export_snapshot: () => 0,
      sp48_execute_instructions: () => 0,
      sp48_reset: () => 0,
      sp48_load_rom_byte: () => 0,
      sp48_read_memory: () => 0,
      sp48_write_memory: () => 0,
      sp48_patch_memory: () => 0,
      sp48_read_port: () => 0,
      sp48_write_port: () => 0,
      sp48_execute_frame: () => 0,
      ...overrides
    } as Sp48WasmExports
  });
}

function layoutValue(id: number): number {
  const key = (Object.keys(SP48_WASM_LAYOUT_VALUE_ID) as Array<keyof typeof SP48_WASM_LAYOUT_VALUE_ID>)
    .find(candidate => SP48_WASM_LAYOUT_VALUE_ID[candidate] === id);
  return key == null ? 0 : SP48_WASM_LAYOUT[key];
}
