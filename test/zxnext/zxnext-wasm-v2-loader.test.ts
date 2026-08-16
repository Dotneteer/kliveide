import { readFileSync } from "node:fs";

import { buildZxNextWasm, productionOutput } from "../../scripts/build-zxnext-wasm.cjs";
import {
  createZxNextWasmV2Views,
  loadZxNextWasmV2,
  resetZxNextWasmV2ModuleCache,
  validateZxNextWasmV2Exports,
  ZXNEXT_WASM_V2_ARTIFACT_NAME,
  ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE,
  ZXNEXT_WASM_V2_KEYBOARD_ROW_COUNT,
  ZXNEXT_WASM_V2_NEXTREG_COUNT,
  ZXNEXT_WASM_V2_ROM_SIZE,
  ZXNEXT_WASM_V2_SRAM_CAPACITY,
  type ZxNextWasmV2Exports
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { afterEach, describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM v2 loader", () => {
  afterEach(() => resetZxNextWasmV2ModuleCache());

  it("loads the built artifact and exposes direct typed views", async () => {
    buildZxNextWasm();
    const runtime = await loadZxNextWasmV2({
      artifactName: "test-built-zxnext-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    expect(runtime.artifactName).toBe("test-built-zxnext-v2.wasm");
    expect(runtime.exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(runtime.memory).toHaveLength(ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE);
    expect(runtime.sram).toHaveLength(ZXNEXT_WASM_V2_SRAM_CAPACITY);
    expect(runtime.rom).toHaveLength(ZXNEXT_WASM_V2_ROM_SIZE);
    expect(runtime.keyboardRows).toHaveLength(ZXNEXT_WASM_V2_KEYBOARD_ROW_COUNT);
    expect(runtime.nextRegs).toHaveLength(ZXNEXT_WASM_V2_NEXTREG_COUNT);
    expect(runtime.pixelBuffer).toHaveLength(
      runtime.exports.zxnextGetScreenWidth() * runtime.exports.zxnextGetScreenHeight()
    );
    expect(runtime.pixelBufferBytes).toHaveLength(runtime.pixelBuffer.length * 4);
    expect(runtime.audioSamples).toHaveLength(runtime.exports.zxnextGetAudioSampleCapacity() * 2);
    expect(runtime.sdCommandBuffer).toHaveLength(runtime.exports.zxnextGetSdCommandBufferSize());
    expect(runtime.sdResponseBuffer).toHaveLength(runtime.exports.zxnextGetSdResponseBufferSize());
    expect(runtime.diagnosticBuffer).toHaveLength(runtime.exports.zxnextGetDiagnosticBufferSize());
  });

  it("initializes reset state and accepts ROM byte uploads", async () => {
    buildZxNextWasm();
    const runtime = await loadZxNextWasmV2({
      artifactName: "test-zxnext-reset-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.zxnextHardReset();
    expect(runtime.exports.zxnextGetFrames()).toBe(0);
    expect(runtime.exports.zxnextGetTacts()).toBe(0);
    expect(runtime.exports.zxnextGetCpuPc()).toBe(0);
    expect(runtime.exports.zxnextGetCpuSp()).toBe(0xffff);
    expect(runtime.exports.zxnextUploadRomByte(0, 0, 0x12)).toBe(1);
    expect(runtime.exports.zxnextUploadRomByte(1, 0, 0x34)).toBe(1);
    expect(runtime.exports.zxnextUploadRomByte(2, 0, 0x56)).toBe(1);
    expect(runtime.exports.zxnextUploadRomByte(3, 0, 0x78)).toBe(1);
    expect(runtime.exports.zxnextReadRomByte(0, 0)).toBe(0x12);
    expect(runtime.exports.zxnextReadRomByte(1, 0)).toBe(0x34);
    expect(runtime.exports.zxnextReadRomByte(2, 0)).toBe(0x56);
    expect(runtime.exports.zxnextReadRomByte(3, 0)).toBe(0x78);
    expect(runtime.exports.zxnextGetUploadedRomMask()).toBe(0x0f);
  });

  it("reports missing exports with the artifact name", () => {
    expect(() =>
      validateZxNextWasmV2Exports({ memory: new WebAssembly.Memory({ initial: 1 }) }, "broken-next.wasm")
    ).toThrow("broken-next.wasm");
  });

  it("reports out-of-range typed views with the artifact name", async () => {
    buildZxNextWasm();
    const runtime = await loadZxNextWasmV2({
      artifactName: "range-zxnext-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const brokenExports = {
      ...runtime.exports,
      zxnextPixelBufferPtr: () => runtime.memoryBuffer.byteLength - 1
    } as ZxNextWasmV2Exports;

    expect(() => createZxNextWasmV2Views(brokenExports, "range-zxnext-v2.wasm")).toThrow(
      "range-zxnext-v2.wasm"
    );
  });

  it("can reset the module cache without affecting subsequent loads", async () => {
    buildZxNextWasm();
    resetZxNextWasmV2ModuleCache();

    const runtime = await loadZxNextWasmV2({
      readArtifact: async () => readFileSync(productionOutput)
    });

    expect(runtime.artifactName).toBe(ZXNEXT_WASM_V2_ARTIFACT_NAME);
  });
});
