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
    expect(runtime.tapeData).toHaveLength(runtime.exports.sp128TapeGetDataCapacity());
    expect(runtime.tapeSaveData).toHaveLength(runtime.exports.sp128TapeGetSaveDataCapacity());

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

  it("executes a simple Z80 instruction from the selected ROM", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-z80-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128UploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.sp128UploadRomByte(0, 0x0001, 0x42);

    expect(runtime.exports.sp128GetCpuPc()).toBe(0);
    expect(runtime.exports.sp128ExecuteInstruction()).toBe(0);

    expect(runtime.exports.sp128GetCpuPc()).toBe(2);
    expect(runtime.exports.sp128GetCpuAf() >> 8).toBe(0x42);
    expect(runtime.exports.sp128GetCpuInstructionsExecuted()).toBe(1);
    expect(runtime.exports.sp128GetCpuFrameSliceInstructions()).toBe(1);
    expect(runtime.exports.sp128GetTacts()).toBe(7);
    expect(runtime.exports.sp128GetCpuTacts()).toBe(7);
    expect(runtime.exports.sp128GetLastMemoryAddress()).toBe(1);
    expect(runtime.exports.sp128GetLastMemoryValue()).toBe(0x42);
    expect(runtime.exports.sp128GetLastMemoryIsWrite()).toBe(0);
  });

  it("records CPU memory writes through the current page map", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-z80-write-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128UploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.sp128UploadRomByte(0, 0x0001, 0xaa);
    runtime.exports.sp128UploadRomByte(0, 0x0002, 0x32);
    runtime.exports.sp128UploadRomByte(0, 0x0003, 0x00);
    runtime.exports.sp128UploadRomByte(0, 0x0004, 0xc0);

    runtime.exports.sp128ExecuteInstruction();
    runtime.exports.sp128ExecuteInstruction();

    expect(runtime.exports.sp128ReadRamBank(0, 0x0000)).toBe(0xaa);
    expect(runtime.exports.sp128ReadMemory(0xc000)).toBe(0xaa);
    expect(runtime.exports.sp128GetCpuPc()).toBe(5);
    expect(runtime.exports.sp128GetLastMemoryAddress()).toBe(0xc000);
    expect(runtime.exports.sp128GetLastMemoryValue()).toBe(0xaa);
    expect(runtime.exports.sp128GetLastMemoryIsWrite()).toBe(1);
  });

  it("records CPU port writes through the 128K port handler", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-z80-port-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128UploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.sp128UploadRomByte(0, 0x0001, 0x47);
    runtime.exports.sp128UploadRomByte(0, 0x0002, 0xd3);
    runtime.exports.sp128UploadRomByte(0, 0x0003, 0xfd);

    runtime.exports.sp128ExecuteInstruction();
    runtime.exports.sp128ExecuteInstruction();

    expect(runtime.exports.sp128GetSelectedBank()).toBe(7);
    expect(runtime.exports.sp128GetLastPortAddress()).toBe(0x47fd);
    expect(runtime.exports.sp128GetLastPortValue()).toBe(0x47);
    expect(runtime.exports.sp128GetLastPortIsWrite()).toBe(1);
  });

  it("applies 128K memory and I/O contention with the odd-bank rule", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-contention-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    for (let tact = 100; tact < 140; tact++) {
      runtime.exports.sp128SetContentionValue(tact, 6);
    }
    expect(runtime.exports.sp128GetContentionValue(100)).toBe(6);

    runtime.exports.sp128SetTacts(100);
    runtime.exports.sp128ResetContentionCounters();
    runtime.exports.sp128DelayAddressBusAccess(0x4000);
    expect(runtime.exports.sp128GetTacts()).toBe(106);
    expect(runtime.exports.sp128GetTotalContentionDelaySinceStart()).toBe(6);

    runtime.exports.sp128SetTacts(100);
    runtime.exports.sp128ResetContentionCounters();
    runtime.exports.sp128DelayAddressBusAccess(0xc000);
    expect(runtime.exports.sp128GetTacts()).toBe(100);
    expect(runtime.exports.sp128GetTotalContentionDelaySinceStart()).toBe(0);

    runtime.exports.sp128WritePort(0x7ffd, 0x03);
    runtime.exports.sp128SetTacts(100);
    runtime.exports.sp128ResetContentionCounters();
    runtime.exports.sp128DelayAddressBusAccess(0xc000);
    expect(runtime.exports.sp128GetTacts()).toBe(106);
    expect(runtime.exports.sp128GetTotalContentionDelaySinceStart()).toBe(6);

    runtime.exports.sp128SetTacts(100);
    runtime.exports.sp128ResetContentionCounters();
    runtime.exports.sp128DelayPortWrite(0xc0ff);
    expect(runtime.exports.sp128GetTacts()).toBe(128);
    expect(runtime.exports.sp128GetTotalContentionDelaySinceStart()).toBe(24);
  });

  it("updates the keyboard matrix and reads selected rows from port 0xfe", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-keyboard-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128SetKeyStatus(0, 1);
    runtime.exports.sp128SetKeyStatus(6, 1);

    expect(runtime.keyboardLines[0]).toBe(0x01);
    expect(runtime.keyboardLines[1]).toBe(0x02);
    expect(runtime.exports.sp128GetKeyboardLine(0)).toBe(0x01);
    expect(runtime.exports.sp128GetKeyboardLine(1)).toBe(0x02);
    expect(runtime.exports.sp128ReadPort(0xfefe)).toBe(0xbe);
    expect(runtime.exports.sp128ReadPort(0xfdfe)).toBe(0xbd);

    runtime.exports.sp128SetKeyStatus(0, 0);

    expect(runtime.exports.sp128GetKeyboardLine(0)).toBe(0x00);
    expect(runtime.exports.sp128ReadPort(0xfefe)).toBe(0xbf);
  });

  it("tracks 0xfe border, ear, mic, and beeper state", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-port-fe-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128WritePort(0xfe, 0x1d);

    expect(runtime.exports.sp128GetPortFeValue()).toBe(0x1d);
    expect(runtime.exports.sp128GetBorderColor()).toBe(5);
    expect(runtime.exports.sp128GetMicBit()).toBe(1);
    expect(runtime.exports.sp128GetEarBit()).toBe(1);
    expect(runtime.exports.sp128GetBeeperLevel()).toBe(3);
    expect(runtime.exports.sp128ReadPort(0xfe) & 0x40).toBe(0x40);
  });

  it("generates beeper audio samples for active 0xfe output", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-beeper-audio-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128SetAudioSampleRate(1000);
    runtime.exports.sp128WritePort(0xfe, 0x18);
    runtime.exports.sp128ExecuteFrame();

    expect(runtime.exports.sp128GetAudioSampleRate()).toBe(1000);
    expect(runtime.exports.sp128GetAudioSampleCount()).toBe(20);
    expect(runtime.audioSamples[0]).not.toBe(0);
    expect(runtime.audioSamples[1]).not.toBe(0);
  });

  it("uses AY PSG register masks and PSG ports", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-psg-registers-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128WritePort(0xfffd, 1);
    runtime.exports.sp128WritePort(0xbffd, 0xff);

    expect(runtime.exports.sp128GetPsgRegisterIndex()).toBe(1);
    expect(runtime.exports.sp128GetPsgRegisterValue(1)).toBe(0xff);
    expect(runtime.exports.sp128ReadPsgRegisterValue()).toBe(0x0f);
    expect(runtime.exports.sp128ReadPort(0xfffd)).toBe(0x0f);
    expect(runtime.exports.sp128GetPsgToneA()).toBe(0x0f00);

    runtime.exports.sp128SetPsgRegisterIndex(8);
    runtime.exports.sp128WritePsgRegisterValue(0x1f);

    expect(runtime.exports.sp128GetPsgRegisterValue(8)).toBe(0x1f);
    expect(runtime.exports.sp128ReadPsgRegisterValue()).toBe(0x1f);
    expect(runtime.exports.sp128GetPsgVolumeA()).toBe(0x0f);
  });

  it("mixes PSG output into the exported audio sample buffer", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-psg-audio-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128SetAudioSampleRate(1000);
    runtime.exports.sp128SetPsgRegisterIndex(0);
    runtime.exports.sp128WritePsgRegisterValue(1);
    runtime.exports.sp128SetPsgRegisterIndex(1);
    runtime.exports.sp128WritePsgRegisterValue(0);
    runtime.exports.sp128SetPsgRegisterIndex(7);
    runtime.exports.sp128WritePsgRegisterValue(0xfe);
    runtime.exports.sp128SetPsgRegisterIndex(8);
    runtime.exports.sp128WritePsgRegisterValue(0x0f);
    runtime.exports.sp128ExecuteFrame();

    expect(runtime.exports.sp128GetAudioSampleCount()).toBe(20);
    expect(runtime.exports.sp128GetPsgCurrentOutput()).toBeGreaterThanOrEqual(0);
    expect(Array.from(runtime.audioSamples.slice(0, 40)).some(sample => sample !== 0)).toBe(true);
  });

  it("renders border and normal screen memory into the pixel buffer", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-render-normal-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128WritePort(0xfe, 0x01);
    runtime.exports.sp128WriteRamBank(5, 0x0000, 0x80);
    runtime.exports.sp128WriteRamBank(5, 0x1800, 0x47);
    runtime.exports.sp128RenderInstantScreen();

    const width = runtime.exports.sp128GetScreenWidth();
    const displayPixel = (48 * width) + 48;
    const nextPixel = displayPixel + 1;

    expect(runtime.pixelBuffer[0]).toBe(0xffaa0000);
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xffffffff);
    expect(runtime.pixelBuffer[nextPixel]).toBe(0xff000000);
  });

  it("renders shadow screen memory from bank 7 when selected", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-render-shadow-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128WriteRamBank(5, 0x0000, 0x80);
    runtime.exports.sp128WriteRamBank(5, 0x1800, 0x47);
    runtime.exports.sp128WriteRamBank(7, 0x0000, 0x80);
    runtime.exports.sp128WriteRamBank(7, 0x1800, 0x42);
    runtime.exports.sp128RenderInstantScreen();

    const width = runtime.exports.sp128GetScreenWidth();
    const displayPixel = (48 * width) + 48;
    expect(runtime.exports.sp128GetScreenBank()).toBe(5);
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xffffffff);

    runtime.exports.sp128WritePort(0x7ffd, 0x08);
    runtime.exports.sp128RenderInstantScreen();

    expect(runtime.exports.sp128GetScreenBank()).toBe(7);
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xff0000ff);
  });

  it("returns representative floating bus values for unsupported port reads", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-floating-bus-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128WriteRamBank(5, 0x0000, 0x5a);
    runtime.exports.sp128WriteRamBank(5, 0x1800, 0x2c);

    runtime.exports.sp128SetTacts(48 * 228);
    expect(runtime.exports.sp128ReadFloatingBus()).toBe(0x5a);
    expect(runtime.exports.sp128ReadPort(0x123f)).toBe(0x5a);

    runtime.exports.sp128SetTacts(48 * 228 + 1);
    expect(runtime.exports.sp128ReadFloatingBus()).toBe(0x2c);

    runtime.exports.sp128SetTacts(0);
    expect(runtime.exports.sp128ReadFloatingBus()).toBe(0xff);
    expect(runtime.exports.sp128ReadPort(0x001f)).toBe(0xff);
  });

  it("uploads tape block metadata and exposes playback controls", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-tape-load-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();

    expect(runtime.exports.sp128TapeBeginUpload(1, 3)).toBe(1);
    expect(runtime.exports.sp128TapeGetUploadActive()).toBe(1);
    expect(runtime.exports.sp128TapeSetBlock(0, 0, 3, 1000)).toBe(1);
    expect(runtime.exports.sp128TapeWriteData(0, 0xaa)).toBe(1);
    expect(runtime.exports.sp128TapeWriteData(1, 0xbb)).toBe(1);
    expect(runtime.exports.sp128TapeWriteData(2, 0xcc)).toBe(1);
    expect(runtime.exports.sp128TapeFinishUpload()).toBe(1);

    expect(runtime.exports.sp128TapeGetLoaded()).toBe(1);
    expect(runtime.exports.sp128TapeGetEof()).toBe(0);
    expect(runtime.exports.sp128TapeGetBlockCount()).toBe(1);
    expect(runtime.exports.sp128TapeGetDataLength()).toBe(3);
    expect(runtime.exports.sp128TapeGetBlockOffset(0)).toBe(0);
    expect(runtime.exports.sp128TapeGetBlockLength(0)).toBe(3);
    expect(runtime.exports.sp128TapeGetBlockPauseAfter(0)).toBe(1000);
    expect(Array.from(runtime.tapeData.slice(0, 3))).toEqual([0xaa, 0xbb, 0xcc]);

    runtime.exports.sp128TapeSetMode(1);
    expect(runtime.exports.sp128TapeGetMode()).toBe(1);
    expect(runtime.exports.sp128TapeGetCurrentEarBit()).toBe(0);

    runtime.exports.sp128TapeSetFastLoad(0);
    expect(runtime.exports.sp128TapeGetFastLoad()).toBe(0);
    runtime.exports.sp128TapeRewind();
    expect(runtime.exports.sp128TapeGetCurrentBlockIndex()).toBe(0);
    expect(runtime.exports.sp128TapeGetEof()).toBe(0);
  });

  it("captures a bounded saved tape byte stream with a revision counter", async () => {
    buildSp128Wasm();
    const runtime = await loadSp128WasmV2({
      artifactName: "test-sp128-tape-save-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp128HardReset();
    runtime.exports.sp128TapeClearSavedBlocks();

    const revisionBeforeSave = runtime.exports.sp128TapeGetSavedRevision();
    expect(runtime.exports.sp128TapeAppendSavedByte(0x42)).toBe(1);
    expect(runtime.exports.sp128TapeGetSavedBlockCount()).toBe(1);
    expect(runtime.exports.sp128TapeGetSavedDataLength()).toBe(1);
    expect(runtime.exports.sp128TapeGetSavedRevision()).toBe(revisionBeforeSave + 1);
    expect(runtime.exports.sp128TapeGetSavedBlockOffset(0)).toBe(0);
    expect(runtime.exports.sp128TapeGetSavedBlockLength(0)).toBe(1);
    expect(runtime.tapeSaveData[0]).toBe(0x42);

    runtime.exports.sp128TapeClearSavedBlocks();
    expect(runtime.exports.sp128TapeGetSavedBlockCount()).toBe(0);
    expect(runtime.exports.sp128TapeGetSavedDataLength()).toBe(0);
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
      sp128TapeDataPtr: () => 0xb5000,
      sp128TapeSaveDataPtr: () => 0xb5100,
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
      sp128ReadFloatingBus: () => 0xff,
      sp128SetKeyStatus: () => 0,
      sp128ReadPort: () => 0xff,
      sp128WritePort: () => 0,
      sp128SetAudioSampleRate: () => 0,
      sp128DelayAddressBusAccess: () => 0,
      sp128DelayPortRead: () => 0,
      sp128DelayPortWrite: () => 0,
      sp128ResetContentionCounters: () => 0,
      sp128SetContentionValue: () => 0,
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
      sp128SetTacts: () => 0,
      sp128GetSelectedRom: () => 0,
      sp128GetSelectedBank: () => 0,
      sp128GetPagingEnabled: () => 1,
      sp128GetUseShadowScreen: () => 0,
      sp128GetScreenBank: () => 5,
      sp128GetCurrentPartition: () => 0,
      sp128GetContentionValue: () => 0,
      sp128GetTotalContentionDelaySinceStart: () => 0,
      sp128GetContentionDelaySincePause: () => 0,
      sp128GetCpuInstructionsExecuted: () => 0,
      sp128GetCpuFrameSliceInstructions: () => 0,
      sp128GetCpuTacts: () => 0,
      sp128GetCpuAf: () => 0,
      sp128SetCpuAf: () => 0,
      sp128GetCpuBc: () => 0,
      sp128SetCpuBc: () => 0,
      sp128GetCpuDe: () => 0,
      sp128SetCpuDe: () => 0,
      sp128GetCpuHl: () => 0,
      sp128SetCpuHl: () => 0,
      sp128GetCpuIx: () => 0,
      sp128SetCpuIx: () => 0,
      sp128GetCpuIy: () => 0,
      sp128SetCpuIy: () => 0,
      sp128GetCpuPc: () => 0,
      sp128SetCpuPc: () => 0,
      sp128GetCpuSp: () => 0,
      sp128SetCpuSp: () => 0,
      sp128GetCpuHalted: () => 0,
      sp128GetCpuPrefix: () => 0,
      sp128GetLastMemoryAddress: () => 0,
      sp128GetLastMemoryValue: () => 0,
      sp128GetLastMemoryIsWrite: () => 0,
      sp128GetLastPortAddress: () => 0,
      sp128GetLastPortValue: () => 0,
      sp128GetLastPortIsWrite: () => 0,
      sp128GetKeyboardLine: () => 0,
      sp128GetPortFeValue: () => 0,
      sp128GetBorderColor: () => 7,
      sp128GetEarBit: () => 0,
      sp128GetMicBit: () => 0,
      sp128GetBeeperLevel: () => 0,
      sp128GetAudioSampleRate: () => 44100,
      sp128GetPsgRegisterIndex: () => 0,
      sp128SetPsgRegisterIndex: () => 0,
      sp128GetPsgRegisterValue: () => 0,
      sp128WritePsgRegisterValue: () => 0,
      sp128ReadPsgRegisterValue: () => 0,
      sp128GetPsgToneA: () => 0,
      sp128GetPsgVolumeA: () => 0,
      sp128GetPsgCurrentOutput: () => 0,
      sp128TapeClear: () => 0,
      sp128TapeBeginUpload: () => 1,
      sp128TapeSetBlock: () => 1,
      sp128TapeWriteData: () => 1,
      sp128TapeFinishUpload: () => 1,
      sp128TapeRewind: () => 0,
      sp128TapeSetMode: () => 0,
      sp128TapeSetFastLoad: () => 0,
      sp128TapeGetFastLoad: () => 1,
      sp128TapeGetMaxBlocks: () => 512,
      sp128TapeGetDataCapacity: () => 256,
      sp128TapeGetSaveDataCapacity: () => 128,
      sp128TapeGetSaveMaxBlocks: () => 64,
      sp128TapeGetBlockCount: () => 0,
      sp128TapeGetDataLength: () => 0,
      sp128TapeGetLoaded: () => 0,
      sp128TapeGetEof: () => 1,
      sp128TapeGetUploadActive: () => 0,
      sp128TapeGetMode: () => 0,
      sp128TapeGetCurrentBlockIndex: () => 0,
      sp128TapeGetCurrentEarBit: () => 1,
      sp128TapeGetBlockOffset: () => 0,
      sp128TapeGetBlockLength: () => 0,
      sp128TapeGetBlockPauseAfter: () => 0,
      sp128TapeGetSavedBlockCount: () => 0,
      sp128TapeGetSavedDataLength: () => 0,
      sp128TapeGetSavedRevision: () => 0,
      sp128TapeGetSavedBlockOffset: () => 0,
      sp128TapeGetSavedBlockLength: () => 0,
      sp128TapeClearSavedBlocks: () => 0,
      sp128TapeAppendSavedByte: () => 1,
      sp128GetDiagnosticFlags: () => 0,
      ...overrides
    } as Sp128WasmV2Exports
  });
}
