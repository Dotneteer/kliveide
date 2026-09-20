import { afterEach, describe, expect, it } from "vitest";

import {
  createZ88WasmV2Views,
  loadZ88WasmV2,
  resetZ88WasmV2ModuleCache,
  validateZ88WasmV2Exports,
  Z88_WASM_V2_ARTIFACT_NAME,
  Z88_WASM_V2_KEYBOARD_LINE_COUNT,
  Z88_WASM_V2_MEMORY_SIZE,
  Z88_WASM_V2_PIXEL_BUFFER_WORDS,
  type Z88WasmV2Exports
} from "@emu/machines/z88/wasm/Z88WasmV2Loader";
import { Z88_BASE_CLOCK_FREQUENCY, Z88_TACTS_IN_FRAME } from "@emu/machines/z88/z88MachineInfo";
import { z88WasmArtifactBytes } from "../harness/z88";

/*
 * The Cambridge Z88 WASM loader and the core's Step 1 surface: buffers, reset, LCD shape, timing
 * constants and the CPU register getters (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 */

async function loadBuilt(artifactName = "test-z88.wasm") {
  return loadZ88WasmV2({ artifactName, readArtifact: async () => z88WasmArtifactBytes() });
}

describe("Cambridge Z88 WASM loader", () => {
  afterEach(() => resetZ88WasmV2ModuleCache());

  it("the production artifact name is cambridge-z88.wasm", () => {
    expect(Z88_WASM_V2_ARTIFACT_NAME).toBe("cambridge-z88.wasm");
  });

  it("loads the built artifact and exposes typed views over its buffers", async () => {
    const runtime = await loadBuilt();

    expect(runtime.artifactName).toBe("test-z88.wasm");
    expect(runtime.exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(runtime.memory).toHaveLength(Z88_WASM_V2_MEMORY_SIZE);
    expect(runtime.pixelBuffer).toHaveLength(Z88_WASM_V2_PIXEL_BUFFER_WORDS);
    expect(runtime.pixelBufferBytes).toHaveLength(Z88_WASM_V2_PIXEL_BUFFER_WORDS * 4);
    expect(runtime.keyboardLines).toHaveLength(Z88_WASM_V2_KEYBOARD_LINE_COUNT);
    expect(runtime.audioSamples).toHaveLength(runtime.exports.z88GetAudioSampleCapacity() * 2);
    expect(runtime.exports.z88GetAudioSampleCapacity()).toBeGreaterThanOrEqual(960);
  });

  it("the views alias the core's memory; they do not copy it", async () => {
    const runtime = await loadBuilt();
    expect(runtime.memory.buffer).toBe(runtime.exports.memory.buffer);
    expect(runtime.memory.byteOffset).toBe(runtime.exports.z88MemoryPtr());
    expect(runtime.pixelBufferBytes.byteOffset).toBe(runtime.pixelBuffer.byteOffset);
    runtime.pixelBuffer[0] = 0xff7d1b46;
    // --- The same word, as RGBA bytes (little endian)
    expect(Array.from(runtime.pixelBufferBytes.subarray(0, 4))).toEqual([0x46, 0x1b, 0x7d, 0xff]);
  });

  it("no two buffers overlap", async () => {
    const runtime = await loadBuilt();
    const ranges = [runtime.memory, runtime.pixelBufferBytes, runtime.keyboardLines, runtime.audioSamples]
      .map((view) => [view.byteOffset, view.byteOffset + view.byteLength])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeGreaterThanOrEqual(ranges[i - 1][1]);
    }
  });

  it("hard reset clears the internal RAM only, as the TypeScript Z88 does; reset clears nothing", async () => {
    // --- Z88BankedMemory.resetInternalRam(): $080000-$0FFFFF; the cards keep their contents
    const runtime = await loadBuilt();
    const probes = [0x00_0000, 0x07_ffff, 0x08_0000, 0x0f_ffff, 0x10_0000, Z88_WASM_V2_MEMORY_SIZE - 1];
    for (const a of probes) runtime.memory[a] = 0xaa;
    runtime.exports.z88Reset();
    expect(probes.map((a) => runtime.memory[a])).toEqual(probes.map(() => 0xaa));
    runtime.exports.z88HardReset();
    expect(probes.map((a) => runtime.memory[a])).toEqual([0xaa, 0xaa, 0x00, 0x00, 0xaa, 0xaa]);
  });

  it("reset clears the pixels, the key lines and the audio buffer", async () => {
    const runtime = await loadBuilt();
    runtime.pixelBuffer[100] = 1;
    runtime.keyboardLines[3] = 0x04;
    runtime.audioSamples[7] = 1234;
    runtime.exports.z88Reset();
    expect(runtime.pixelBuffer[100]).toBe(0);
    expect(runtime.keyboardLines[3]).toBe(0);
    expect(runtime.audioSamples[7]).toBe(0);
  });

  it("has the Z88's clock and frame, the same as the TypeScript machine's", async () => {
    const runtime = await loadBuilt();
    runtime.exports.z88HardReset();
    expect(runtime.exports.z88GetBaseClockFrequency()).toBe(Z88_BASE_CLOCK_FREQUENCY);
    expect(runtime.exports.z88GetTactsInFrame()).toBe(Z88_TACTS_IN_FRAME);
    expect(runtime.exports.z88GetFrames()).toBe(0);
    expect(runtime.exports.z88GetTacts()).toBe(0);
  });

  it("the CPU registers come from the shared Z80 core's reset state", async () => {
    const runtime = await loadBuilt();
    runtime.exports.z88HardReset();
    const e = runtime.exports;
    expect([e.z88GetCpuAf(), e.z88GetCpuBc(), e.z88GetCpuDe(), e.z88GetCpuHl()]).toEqual([0xffff, 0, 0, 0]);
    expect(e.z88GetCpuPc()).toBe(0x0000);
    expect(e.z88GetCpuSp()).toBe(0xffff);
  });

  it.each([
    // --- The MC_SCREEN_SIZE options of Z88ScreenDevice.reset(): SCW, SCH -> width x height
    [0xff, 8, 640, 64],
    [0xff, 40, 640, 320],
    [0xff, 60, 640, 480],
    [100, 40, 800, 320],
    [100, 60, 800, 480]
  ])("LCD size SCW %i, SCH %i is %i x %i", async (scw, sch, width, height) => {
    const runtime = await loadBuilt();
    runtime.exports.z88SetLcdSize(scw, sch);
    expect(runtime.exports.z88GetScw()).toBe(scw);
    expect(runtime.exports.z88GetSch()).toBe(sch);
    expect(runtime.exports.z88GetScreenWidth()).toBe(width);
    expect(runtime.exports.z88GetScreenHeight()).toBe(height);
    expect(width * height).toBeLessThanOrEqual(runtime.pixelBuffer.length);
  });

  it.each([
    [0, 8],
    [101, 8],
    [0xff, 0],
    [0xff, 61]
  ])("an out-of-range LCD size (SCW %i, SCH %i) selects the 640 x 64 default", async (scw, sch) => {
    const runtime = await loadBuilt();
    runtime.exports.z88SetLcdSize(100, 60);
    runtime.exports.z88SetLcdSize(scw, sch);
    expect(runtime.exports.z88GetScreenWidth()).toBe(640);
    expect(runtime.exports.z88GetScreenHeight()).toBe(64);
  });

  it("the LCD defaults to 640 x 64 in a fresh instance", async () => {
    const runtime = await loadBuilt();
    expect(runtime.exports.z88GetScreenWidth()).toBe(640);
    expect(runtime.exports.z88GetScreenHeight()).toBe(64);
  });

  it("compiles the module once per artifact name, and each load gets its own instance", async () => {
    let reads = 0;
    const readArtifact = async () => {
      reads++;
      return z88WasmArtifactBytes();
    };
    const first = await loadZ88WasmV2({ artifactName: "cached.wasm", readArtifact });
    const second = await loadZ88WasmV2({ artifactName: "cached.wasm", readArtifact });
    expect(reads).toBe(1);
    expect(second.module).toBe(first.module);
    expect(second.exports.memory).not.toBe(first.exports.memory);
    first.memory[0x1234] = 0x77;
    expect(second.memory[0x1234]).toBe(0x00);

    resetZ88WasmV2ModuleCache();
    await loadZ88WasmV2({ artifactName: "cached.wasm", readArtifact });
    expect(reads).toBe(2);
    await loadZ88WasmV2({ artifactName: "other.wasm", readArtifact });
    expect(reads).toBe(3);
  });

  it("rejects an artifact without memory or with a missing export", async () => {
    const runtime = await loadBuilt();
    const { memory: _memory, ...withoutMemory } = runtime.exports;
    expect(() => validateZ88WasmV2Exports(withoutMemory as Partial<Z88WasmV2Exports>, "x.wasm")).toThrow(
      "Cambridge Z88 WASM artifact 'x.wasm' is missing WebAssembly memory."
    );
    const { z88HardReset: _hardReset, ...withoutHardReset } = runtime.exports;
    expect(() => validateZ88WasmV2Exports(withoutHardReset as Partial<Z88WasmV2Exports>, "x.wasm")).toThrow(
      "is missing export 'z88HardReset'"
    );

    await expect(
      loadZ88WasmV2({
        artifactName: "broken.wasm",
        readArtifact: async () => z88WasmArtifactBytes(),
        instantiate: async () => ({ exports: withoutHardReset as Z88WasmV2Exports })
      })
    ).rejects.toThrow("is missing export 'z88HardReset'");
  });

  it("rejects a buffer that lies outside linear memory", async () => {
    const runtime = await loadBuilt();
    const outside = { ...runtime.exports, z88PixelBufferPtr: () => runtime.exports.memory.buffer.byteLength - 16 };
    expect(() => createZ88WasmV2Views(outside as Z88WasmV2Exports, "x.wasm")).toThrow(
      "exposes pixelBuffer outside WASM memory"
    );
  });
});
