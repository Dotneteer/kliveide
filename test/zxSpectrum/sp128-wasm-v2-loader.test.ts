import { readFileSync } from "node:fs";

import { buildSp128Wasm, productionOutput } from "../../scripts/build-sp128-wasm.cjs";
import {
  loadSp128WasmV2,
  resetSp128WasmV2ModuleCache,
  SP128_WASM_V2_ARTIFACT_NAME,
  SP128_WASM_V2_KEYBOARD_LINE_COUNT,
  SP128_WASM_V2_MEMORY_SIZE,
  SP128_WASM_V2_RAM_SIZE,
  SP128_WASM_V2_ROM_SIZE,
  type Sp128WasmV2Exports,
  type Sp128WasmV2Instance
} from "@emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader";
import { afterEach, describe, expect, it } from "vitest";

describe("ZX Spectrum 128K WASM v2 loader", () => {
  afterEach(() => resetSp128WasmV2ModuleCache());

  it("loads the built v2 skeleton artifact and exposes direct typed views", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-built-sp128-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    expect(runtime.artifactName).toBe("test-built-sp128-v2.wasm");
    expect(runtime.exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(runtime.memory).toHaveLength(SP128_WASM_V2_MEMORY_SIZE);
    expect(runtime.ram).toHaveLength(SP128_WASM_V2_RAM_SIZE);
    expect(runtime.rom).toHaveLength(SP128_WASM_V2_ROM_SIZE);
    expect(runtime.keyboardLines).toHaveLength(SP128_WASM_V2_KEYBOARD_LINE_COUNT);

    runtime.exports.sp128HardReset();
    expect(runtime.exports.sp128GetFrames()).toBe(0);
    expect(runtime.exports.sp128GetTacts()).toBe(0);
    expect(runtime.exports.sp128GetSelectedRom()).toBe(0);
    expect(runtime.exports.sp128GetSelectedBank()).toBe(0);
    expect(runtime.exports.sp128GetPagingEnabled()).toBe(1);
    expect(runtime.exports.sp128GetUseShadowScreen()).toBe(0);
    expect(runtime.exports.sp128GetScreenBank()).toBe(5);
    expect(runtime.exports.sp128GetCurrentPartition(0)).toBe(-1);
    expect(runtime.exports.sp128GetCurrentPartition(1)).toBe(5);
    expect(runtime.exports.sp128GetCurrentPartition(2)).toBe(2);
    expect(runtime.exports.sp128GetCurrentPartition(3)).toBe(0);

    expect(runtime.exports.sp128ExecuteFrame()).toBe(0);
    expect(runtime.exports.sp128GetFrames()).toBe(1);
    expect(runtime.exports.sp128GetTacts()).toBe(runtime.exports.sp128GetTactsInFrame());

    const pixelWords = runtime.exports.sp128GetScreenWidth() * runtime.exports.sp128GetScreenHeight();
    expect(runtime.pixelBuffer).toHaveLength(pixelWords);
    expect(runtime.pixelBufferBytes).toHaveLength(pixelWords * 4);
    expect(runtime.audioSamples).toHaveLength(runtime.exports.sp128GetAudioSampleCapacity() * 2);
  });

  it("maps ROM and RAM banks through the 128K reset layout", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-memory-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128UploadRomByte(0, 0x0002, 0x12);
    runtime.exports.sp128UploadRomByte(1, 0x0002, 0x34);
    runtime.exports.sp128WriteRamBank(5, 0x0003, 0x55);
    runtime.exports.sp128WriteRamBank(2, 0x0004, 0x22);
    runtime.exports.sp128WriteRamBank(0, 0x0005, 0x99);

    expect(runtime.exports.sp128ReadMemory(0x0002)).toBe(0x12);
    expect(runtime.exports.sp128ReadMemory(0x4003)).toBe(0x55);
    expect(runtime.exports.sp128ReadMemory(0x8004)).toBe(0x22);
    expect(runtime.exports.sp128ReadMemory(0xc005)).toBe(0x99);
    expect(runtime.memory[0x0002]).toBe(0x12);
    expect(runtime.memory[0x4003]).toBe(0x55);
    expect(runtime.memory[0x8004]).toBe(0x22);
    expect(runtime.memory[0xc005]).toBe(0x99);

    runtime.exports.sp128WriteMemory(0x0002, 0xff);
    runtime.exports.sp128WriteMemory(0x4003, 0x66);
    runtime.exports.sp128WriteMemory(0xc005, 0xaa);

    expect(runtime.exports.sp128ReadRomBank(0, 0x0002)).toBe(0x12);
    expect(runtime.exports.sp128ReadMemory(0x0002)).toBe(0x12);
    expect(runtime.exports.sp128ReadRamBank(5, 0x0003)).toBe(0x66);
    expect(runtime.exports.sp128ReadRamBank(0, 0x0005)).toBe(0xaa);
  });

  it("switches memory through the 0x7ffd paging port", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-7ffd-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128UploadRomByte(0, 0x0010, 0x10);
    runtime.exports.sp128UploadRomByte(1, 0x0010, 0x11);
    runtime.exports.sp128WriteRamBank(3, 0x0020, 0x33);
    runtime.exports.sp128WriteRamBank(5, 0x0030, 0x55);
    runtime.exports.sp128WriteRamBank(7, 0x0030, 0x77);

    runtime.exports.sp128WritePort(0x7ffd, 0x1b);

    expect(runtime.exports.sp128GetSelectedBank()).toBe(3);
    expect(runtime.exports.sp128GetSelectedRom()).toBe(1);
    expect(runtime.exports.sp128GetUseShadowScreen()).toBe(1);
    expect(runtime.exports.sp128GetScreenBank()).toBe(7);
    expect(runtime.exports.sp128GetPagingEnabled()).toBe(1);
    expect(runtime.exports.sp128GetCurrentPartition(0)).toBe(-2);
    expect(runtime.exports.sp128GetCurrentPartition(3)).toBe(3);
    expect(runtime.exports.sp128ReadMemory(0x0010)).toBe(0x11);
    expect(runtime.exports.sp128ReadMemory(0xc020)).toBe(0x33);
    expect(runtime.exports.sp128ReadScreenMemoryOffset(0x0030)).toBe(0x77);
    expect(runtime.memory[0x0010]).toBe(0x11);
    expect(runtime.memory[0xc020]).toBe(0x33);

    runtime.exports.sp128WritePort(0x7ffd, 0x20);

    expect(runtime.exports.sp128GetPagingEnabled()).toBe(0);
    expect(runtime.exports.sp128GetSelectedBank()).toBe(0);
    expect(runtime.exports.sp128GetSelectedRom()).toBe(0);
    expect(runtime.exports.sp128GetUseShadowScreen()).toBe(0);
    expect(runtime.exports.sp128GetScreenBank()).toBe(5);
    expect(runtime.exports.sp128ReadMemory(0x0010)).toBe(0x10);
    expect(runtime.exports.sp128ReadScreenMemoryOffset(0x0030)).toBe(0x55);

    runtime.exports.sp128WritePort(0x7ffd, 0x1f);

    expect(runtime.exports.sp128GetPagingEnabled()).toBe(0);
    expect(runtime.exports.sp128GetSelectedBank()).toBe(0);
    expect(runtime.exports.sp128GetSelectedRom()).toBe(0);
    expect(runtime.exports.sp128GetUseShadowScreen()).toBe(0);
  });

  it("uses the v2 artifact name by default", async () => {
    const runtime = await loadSp128WasmV2({
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeV2Instance()
    });

    expect(runtime.artifactName).toBe(SP128_WASM_V2_ARTIFACT_NAME);
  });

  it("rejects artifacts missing required v2 exports", async () => {
    await expect(loadSp128WasmV2({
      artifactName: "bad-sp128-v2.wasm",
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeV2Instance({ sp128ExecuteFrame: undefined })
    })).rejects.toThrow("missing export 'sp128ExecuteFrame'");
  });

  it("rejects v2 views that point outside WASM memory", async () => {
    await expect(loadSp128WasmV2({
      artifactName: "bad-sp128-v2-layout.wasm",
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeV2Instance({
        sp128PixelBufferPtr: () => 0x10_0000
      })
    })).rejects.toThrow("pixelBuffer outside WASM memory");
  });

  it("reuses a compiled module for the same v2 artifact name", async () => {
    let compileCount = 0;
    let readCount = 0;
    const module = {} as WebAssembly.Module;
    const options = {
      artifactName: "cached-sp128-v2.wasm",
      readArtifact: async () => {
        readCount++;
        return new Uint8Array([0]);
      },
      compile: async () => {
        compileCount++;
        return module;
      },
      instantiate: async () => fakeV2Instance()
    };

    await loadSp128WasmV2(options);
    await loadSp128WasmV2(options);

    expect(readCount).toBe(1);
    expect(compileCount).toBe(1);
  });
});

function fakeV2Instance(overrides: Partial<Sp128WasmV2Exports> = {}): Promise<Sp128WasmV2Instance> {
  return Promise.resolve({
    exports: {
      memory: new WebAssembly.Memory({ initial: 16 }),
      sp128MemoryPtr: () => 0x00000,
      sp128RamPtr: () => 0x10000,
      sp128RomPtr: () => 0x30000,
      sp128PixelBufferPtr: () => 0x38000,
      sp128AudioSamplesPtr: () => 0xb0000,
      sp128KeyboardLinesPtr: () => 0xb4000,
      sp128Reset: () => 0,
      sp128HardReset: () => 0,
      sp128ExecuteFrame: () => 0,
      sp128ExecuteInstruction: () => 0,
      sp128RenderInstantScreen: () => 0,
      sp128UploadRomByte: () => 0,
      sp128ReadMemory: () => 0,
      sp128WriteMemory: () => 0,
      sp128ReadRamBank: () => 0,
      sp128WriteRamBank: () => 0,
      sp128ReadRomBank: () => 0,
      sp128ReadScreenMemoryOffset: () => 0,
      sp128ReadPort: () => 0xff,
      sp128WritePort: () => 0,
      sp128GetMemorySize: () => SP128_WASM_V2_MEMORY_SIZE,
      sp128GetRamSize: () => SP128_WASM_V2_RAM_SIZE,
      sp128GetRomSize: () => SP128_WASM_V2_ROM_SIZE,
      sp128GetScreenWidth: () => 352,
      sp128GetScreenHeight: () => 296,
      sp128GetPixelBufferStartOffset: () => 0,
      sp128GetAudioSampleCount: () => 0,
      sp128GetAudioSampleCapacity: () => 2048,
      sp128GetTactsInFrame: () => 70908,
      sp128GetFrames: () => 0,
      sp128GetTacts: () => 0,
      sp128GetSelectedRom: () => 0,
      sp128GetSelectedBank: () => 0,
      sp128GetPagingEnabled: () => 1,
      sp128GetUseShadowScreen: () => 0,
      sp128GetScreenBank: () => 5,
      sp128GetCurrentPartition: () => 0,
      sp128GetDiagnosticFlags: () => 0,
      ...overrides
    } as Sp128WasmV2Exports
  });
}
