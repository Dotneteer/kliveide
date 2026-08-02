import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSp48Wasm, output, productionExports, testExports } from "../../scripts/build-sp48-wasm.cjs";
import { SP48_WASM_ABI_VERSION, SP48_WASM_LAYOUT, SP48_WASM_LAYOUT_VALUE_ID } from "@emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum 48K WASM ABI manifest", () => {
  it("exposes the approved test ABI and contains the production ABI subset", async () => {
    buildSp48Wasm();
    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const actualExports = Object.keys(instance.exports).sort();

    expect(actualExports).toEqual([...testExports].sort());
    expect(actualExports).toEqual(expect.arrayContaining(productionExports));
  });

  it("declares every production export in the TypeScript loader contract", () => {
    const loaderSource = readFileSync(
      resolve(process.cwd(), "src/emu/machines/zxSpectrum48/wasm/Sp48WasmLoader.ts"),
      "utf8"
    );

    for (const exportName of productionExports) {
      expect(loaderSource, exportName).toContain(`${exportName}:`);
    }
  });

  it("matches generated TypeScript layout constants", async () => {
    buildSp48Wasm();
    const { instance } = await WebAssembly.instantiate(readFileSync(output));
    const wasm = instance.exports as Record<string, CallableFunction>;

    expect(wasm.sp48_abi_version()).toBe(SP48_WASM_ABI_VERSION);
    for (const [key, id] of Object.entries(SP48_WASM_LAYOUT_VALUE_ID)) {
      expect(wasm.sp48_layout_value(id), key).toBe(SP48_WASM_LAYOUT[key as keyof typeof SP48_WASM_LAYOUT]);
    }

    const memory = instance.exports.memory as WebAssembly.Memory;
    const memorySize = memory.buffer.byteLength;
    expect(wasm.sp48_machine_state_block_ptr() + SP48_WASM_LAYOUT.machineStateBlockSize).toBeLessThanOrEqual(memorySize);
    expect(wasm.sp48_input_block_ptr() + SP48_WASM_LAYOUT.inputBlockSize).toBeLessThanOrEqual(memorySize);
    expect(wasm.sp48_result_block_ptr() + SP48_WASM_LAYOUT.resultBlockSize).toBeLessThanOrEqual(memorySize);
    expect(wasm.sp48_event_buffer_ptr() + SP48_WASM_LAYOUT.eventBufferSize).toBeLessThanOrEqual(memorySize);
  });
});
