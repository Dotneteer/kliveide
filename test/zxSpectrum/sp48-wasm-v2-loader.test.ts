import { readFileSync } from "node:fs";

import { buildSp48Wasm, productionOutput } from "../../scripts/build-sp48-wasm.cjs";
import {
  loadSp48WasmV2,
  resetSp48WasmV2ModuleCache,
  SP48_WASM_V2_ARTIFACT_NAME,
  SP48_WASM_V2_KEYBOARD_LINE_COUNT,
  SP48_WASM_V2_MEMORY_SIZE,
  SP48_WASM_V2_PIXEL_GUARD_LINES,
  type Sp48WasmV2Exports,
  type Sp48WasmV2Instance
} from "@emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader";
import { afterEach, describe, expect, it } from "vitest";

describe("ZX Spectrum 48K WASM v2 loader", () => {
  afterEach(() => resetSp48WasmV2ModuleCache());

  it("loads the built v2 artifact and exposes direct typed views", async () => {
    buildSp48Wasm();
    const runtime = await loadSp48WasmV2({
      artifactName: "test-built-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    expect(runtime.artifactName).toBe("test-built-v2.wasm");
    expect(runtime.exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(runtime.memory).toHaveLength(SP48_WASM_V2_MEMORY_SIZE);
    expect(runtime.keyboardLines).toHaveLength(SP48_WASM_V2_KEYBOARD_LINE_COUNT);
    expect(runtime.tapeData.length).toBeGreaterThan(0);
    expect(runtime.tapeSaveData.length).toBeGreaterThan(0);
    expect(runtime.tapeFileName.length).toBeGreaterThan(0);

    runtime.exports.sp48HardReset(0, 0);
    expect(runtime.exports.sp48GetRomSize()).toBe(0x4000);
    expect(runtime.exports.sp48GetFrames()).toBe(0);
    expect(runtime.exports.sp48GetTacts()).toBe(0);

    runtime.exports.sp48UploadRomByte(0, 0x00);
    expect(runtime.memory[0]).toBe(0x00);

    runtime.exports.sp48SetKeyStatus(0, 1);
    runtime.exports.sp48SetKeyStatus(6, 1);
    expect(runtime.keyboardLines[0]).toBe(0x01);
    expect(runtime.keyboardLines[1]).toBe(0x02);
    expect(runtime.exports.sp48GetKeyboardLine(0)).toBe(0x01);
    expect(runtime.exports.sp48GetKeyboardLine(1)).toBe(0x02);
    expect(runtime.exports.sp48ReadPort(0xfefe)).toBe(0xbe);
    expect(runtime.exports.sp48ReadPort(0xfdfe)).toBe(0xbd);
    runtime.exports.sp48SetKeyStatus(0, 0);
    expect(runtime.keyboardLines[0]).toBe(0x00);
    expect(runtime.exports.sp48ReadPort(0xfefe)).toBe(0xbf);

    expect(runtime.exports.sp48ExecuteFrame()).toBe(0);
    expect(runtime.exports.sp48GetFrames()).toBe(1);
    expect(runtime.exports.sp48GetTacts()).toBeGreaterThanOrEqual(runtime.exports.sp48GetTactsInFrame());
    expect(runtime.exports.sp48GetAudioSampleCount()).toBeGreaterThan(0);

    const pixelWords = runtime.exports.sp48GetScreenWidth() *
      (runtime.exports.sp48GetScreenHeight() + SP48_WASM_V2_PIXEL_GUARD_LINES);
    expect(runtime.pixelBuffer).toHaveLength(pixelWords);
    expect(runtime.pixelBufferBytes).toHaveLength(pixelWords * 4);
    expect(runtime.audioSamples).toHaveLength(runtime.exports.sp48GetAudioSampleCapacity() * 2);
  });

  it("exposes v2 test/control exports as callable loader exports", async () => {
    buildSp48Wasm();
    const runtime = await loadSp48WasmV2({
      artifactName: "test-sp48-control-exports-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp48HardReset(0, 0);
    runtime.exports.sp48SetTacts(14362);
    runtime.exports.sp48ResetContentionCounters();
    runtime.exports.sp48DelayAddressBusAccess(0x4000);
    runtime.exports.sp48DelayPortAccess(0xfefe);
    runtime.exports.sp48DelayPortRead(0xfefe);
    runtime.exports.sp48DelayPortWrite(0xfefe);
    runtime.exports.sp48WritePort(0xfe, 0x1d);

    expect(runtime.exports.sp48GetBaseClockFrequency()).toBe(3500000);
    expect(runtime.exports.sp48GetCurrentFrameTact()).toBeGreaterThanOrEqual(14362);
    expect(runtime.exports.sp48GetRasterLines()).toBe(312);
    expect(runtime.exports.sp48GetScreenLineTime()).toBe(224);
    expect(runtime.exports.sp48GetTimingScreenWidth()).toBe(352);
    expect(runtime.exports.sp48GetTimingScreenLines()).toBe(288);
    expect(runtime.exports.sp48GetFirstDisplayLine()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetFirstVisibleLine()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetFirstVisibleBorderTact()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetContentionValue(14362)).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetRenderingPhase(14362)).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetRenderingPixelAddress(14362)).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetRenderingAttributeAddress(14362)).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetRenderingPixelIndex(14362)).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetTotalContentionDelaySinceStart()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetContentionDelaySincePause()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetNextFrameStartTact()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetInterruptsRaised()).toBe(0);
    expect(runtime.exports.sp48GetInterruptLineActive()).toBe(0);
    expect(runtime.exports.sp48GetCpuInstructionsExecuted()).toBe(0);
    expect(runtime.exports.sp48GetCpuFrameSliceInstructions()).toBe(0);
    expect(runtime.exports.sp48GetCpuTacts()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetPortFeValue()).toBe(0x1d);
    expect(runtime.exports.sp48GetBorderColor()).toBe(5);
    expect(runtime.exports.sp48GetEarBit()).toBe(1);
    expect(runtime.exports.sp48GetMicBit()).toBe(1);
    expect(runtime.exports.sp48GetBeeperLevel()).toBeGreaterThan(0);
    expect(runtime.exports.sp48GetEarBitChangedFrom0Tacts()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetEarBitChangedFrom1Tacts()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.sp48GetDiagnosticFlags()).toBeGreaterThanOrEqual(0);
  });

  it("suppresses last bus event capture during normal frame execution", async () => {
    buildSp48Wasm();
    const runtime = await loadSp48WasmV2({
      artifactName: "test-sp48-normal-frame-bus-events-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.sp48HardReset(0, 0);
    runtime.exports.sp48UploadRomByte(0x0000, 0x3e);
    runtime.exports.sp48UploadRomByte(0x0001, 0x47);
    runtime.exports.sp48UploadRomByte(0x0002, 0xd3);
    runtime.exports.sp48UploadRomByte(0x0003, 0xfe);

    expect(runtime.exports.sp48ExecuteFrame()).toBe(0);

    expect(runtime.exports.sp48GetLastMemoryAddress()).toBe(0);
    expect(runtime.exports.sp48GetLastMemoryValue()).toBe(0);
    expect(runtime.exports.sp48GetLastMemoryIsWrite()).toBe(0);
    expect(runtime.exports.sp48GetLastPortAddress()).toBe(0);
    expect(runtime.exports.sp48GetLastPortValue()).toBe(0);
    expect(runtime.exports.sp48GetLastPortIsWrite()).toBe(0);

    runtime.exports.sp48HardReset(0, 0);
    runtime.exports.sp48UploadRomByte(0x0000, 0x3e);
    runtime.exports.sp48UploadRomByte(0x0001, 0x47);
    runtime.exports.sp48UploadRomByte(0x0002, 0xd3);
    runtime.exports.sp48UploadRomByte(0x0003, 0xfe);

    expect(runtime.exports.sp48ExecuteInstruction()).toBe(0);
    expect(runtime.exports.sp48GetLastMemoryAddress()).toBe(1);
    expect(runtime.exports.sp48GetLastMemoryValue()).toBe(0x47);
    expect(runtime.exports.sp48GetLastMemoryIsWrite()).toBe(0);

    expect(runtime.exports.sp48ExecuteInstruction()).toBe(0);
    expect(runtime.exports.sp48GetLastPortAddress()).toBe(0x47fe);
    expect(runtime.exports.sp48GetLastPortValue()).toBe(0x47);
    expect(runtime.exports.sp48GetLastPortIsWrite()).toBe(1);
  });

  it("uses the v2 artifact name by default", async () => {
    const runtime = await loadSp48WasmV2({
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeV2Instance()
    });

    expect(runtime.artifactName).toBe(SP48_WASM_V2_ARTIFACT_NAME);
  });

  it("rejects artifacts missing required v2 exports", async () => {
    await expect(loadSp48WasmV2({
      artifactName: "bad-v2.wasm",
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeV2Instance({ sp48ExecuteFrame: undefined })
    })).rejects.toThrow("missing export 'sp48ExecuteFrame'");
  });

  it("rejects v2 views that point outside WASM memory", async () => {
    await expect(loadSp48WasmV2({
      artifactName: "bad-v2-layout.wasm",
      readArtifact: async () => new Uint8Array([0]),
      compile: async () => ({} as WebAssembly.Module),
      instantiate: async () => fakeV2Instance({
        sp48PixelBufferPtr: () => 0x10_0000
      })
    })).rejects.toThrow("pixelBuffer outside WASM memory");
  });

  it("reuses a compiled module for the same v2 artifact name", async () => {
    let compileCount = 0;
    let readCount = 0;
    const module = {} as WebAssembly.Module;
    const options = {
      artifactName: "cached-v2.wasm",
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

    await loadSp48WasmV2(options);
    await loadSp48WasmV2(options);

    expect(readCount).toBe(1);
    expect(compileCount).toBe(1);
  });
});

function fakeV2Instance(overrides: Partial<Sp48WasmV2Exports> = {}): Promise<Sp48WasmV2Instance> {
  return Promise.resolve({
    exports: {
      memory: new WebAssembly.Memory({ initial: 8 }),
      sp48MemoryPtr: () => 0x00000,
      sp48PixelBufferPtr: () => 0x10000,
      sp48AudioSamplesPtr: () => 0x42000,
      sp48KeyboardLinesPtr: () => 0x45000,
      sp48TapeDataPtr: () => 0x46000,
      sp48TapeSaveDataPtr: () => 0x46100,
      sp48TapeFileNamePtr: () => 0x46200,
      sp48Reset: () => 0,
      sp48HardReset: () => 0,
      sp48ExecuteFrame: () => 0,
      sp48ExecuteInstruction: () => 0,
      sp48GetFrameCompleted: () => 0,
      sp48RenderInstantScreen: () => 0,
      sp48UploadRomByte: () => 0,
      sp48ReadMemory: () => 0,
      sp48WriteMemory: () => 0,
      sp48ReadPort: () => 0,
      sp48WritePort: () => 0,
      sp48SetKeyStatus: () => 0,
      sp48GetKeyboardLine: () => 0,
      sp48SetAudioSampleRate: () => 0,
      sp48DelayAddressBusAccess: () => 0,
      sp48DelayPortAccess: () => 0,
      sp48DelayPortRead: () => 0,
      sp48DelayPortWrite: () => 0,
      sp48ResetContentionCounters: () => 0,
      sp48GetBaseClockFrequency: () => 3500000,
      sp48GetScreenWidth: () => 256,
      sp48GetScreenHeight: () => 192,
      sp48GetPixelBufferStartOffset: () => 256,
      sp48GetAudioSampleCount: () => 0,
      sp48GetAudioSampleCapacity: () => 2048,
      sp48GetTactsInFrame: () => 69888,
      sp48SetTacts: () => 0,
      sp48SetTargetClockMultiplier: () => 0,
      sp48GetClockMultiplier: () => 1,
      sp48GetTargetClockMultiplier: () => 1,
      sp48GetTactsInCurrentFrame: () => 69888,
      sp48GetFrames: () => 0,
      sp48GetTacts: () => 0,
      sp48GetCurrentFrameTact: () => 0,
      sp48GetRasterLines: () => 312,
      sp48GetScreenLineTime: () => 224,
      sp48GetTimingScreenWidth: () => 352,
      sp48GetTimingScreenLines: () => 288,
      sp48GetFirstDisplayLine: () => 0,
      sp48GetFirstVisibleLine: () => 0,
      sp48GetFirstVisibleBorderTact: () => 0,
      sp48GetContentionValue: () => 0,
      sp48GetRenderingPhase: () => 0,
      sp48GetRenderingPixelAddress: () => 0,
      sp48GetRenderingAttributeAddress: () => 0,
      sp48GetRenderingPixelIndex: () => 0,
      sp48GetTotalContentionDelaySinceStart: () => 0,
      sp48GetContentionDelaySincePause: () => 0,
      sp48GetNextFrameStartTact: () => 69888,
      sp48GetInterruptsRaised: () => 0,
      sp48GetInterruptLineActive: () => 0,
      sp48GetCpuInstructionsExecuted: () => 0,
      sp48GetCpuFrameSliceInstructions: () => 0,
      sp48GetCpuTacts: () => 0,
      sp48GetCpuAf: () => 0,
      sp48SetCpuAf: () => 0,
      sp48GetCpuBc: () => 0,
      sp48SetCpuBc: () => 0,
      sp48GetCpuDe: () => 0,
      sp48SetCpuDe: () => 0,
      sp48GetCpuHl: () => 0,
      sp48SetCpuHl: () => 0,
      sp48GetCpuAfAlt: () => 0,
      sp48SetCpuAfAlt: () => 0,
      sp48GetCpuBcAlt: () => 0,
      sp48GetCpuDeAlt: () => 0,
      sp48GetCpuHlAlt: () => 0,
      sp48GetCpuIx: () => 0,
      sp48SetCpuIx: () => 0,
      sp48GetCpuIy: () => 0,
      sp48SetCpuIy: () => 0,
      sp48GetCpuIr: () => 0,
      sp48GetCpuWz: () => 0,
      sp48GetCpuPc: () => 0,
      sp48SetCpuPc: () => 0,
      sp48GetCpuSp: () => 0,
      sp48SetCpuSp: () => 0,
      sp48GetCpuHalted: () => 0,
      sp48GetCpuPrefix: () => 0,
      sp48GetCpuIff1: () => 0,
      sp48SetCpuIff1: () => 0,
      sp48GetCpuInterruptMode: () => 0,
      sp48SetCpuInterruptMode: () => 0,
      sp48GetCpuRetExecuted: () => 0,
      sp48GetCpuRetnExecuted: () => 0,
      sp48GetLastMemoryAddress: () => 0,
      sp48GetLastMemoryValue: () => 0,
      sp48GetLastMemoryIsWrite: () => 0,
      sp48GetLastPortAddress: () => 0,
      sp48GetLastPortValue: () => 0,
      sp48GetLastPortIsWrite: () => 0,
      sp48GetPortFeValue: () => 0xbf,
      sp48GetBorderColor: () => 7,
      sp48GetEarBit: () => 0,
      sp48GetMicBit: () => 0,
      sp48GetBeeperLevel: () => 0,
      sp48GetEarBitChangedFrom0Tacts: () => 0,
      sp48GetEarBitChangedFrom1Tacts: () => 0,
      sp48GetDiagnosticFlags: () => 0,
      sp48GetRomSize: () => 0x4000,
      sp48TapeClear: () => 0,
      sp48TapeSetFileNameByte: () => 0,
      sp48TapeBeginUpload: () => 1,
      sp48TapeSetBlock: () => 1,
      sp48TapeFinishUpload: () => 1,
      sp48TapeRewind: () => 0,
      sp48TapeSetMode: () => 0,
      sp48TapeSetFastLoad: () => 0,
      sp48TapeGetFastLoad: () => 0,
      sp48TapeGetBlockCount: () => 0,
      sp48TapeGetDataLength: () => 0,
      sp48TapeGetLoaded: () => 0,
      sp48TapeGetMode: () => 0,
      sp48TapeGetCurrentBlockIndex: () => 0,
      sp48TapeGetSavedBlockCount: () => 0,
      sp48TapeGetSavedDataLength: () => 0,
      sp48TapeGetSavedRevision: () => 0,
      sp48TapeGetSavedBlockOffset: () => 0,
      sp48TapeGetSavedBlockLength: () => 0,
      sp48TapeClearSavedBlocks: () => 0,
      sp48TapeGetBlockOffset: () => 0,
      sp48TapeGetBlockLength: () => 0,
      sp48TapeGetBlockPauseAfter: () => 0,
      sp48TapeGetBlockPilotPulseLength: () => 0,
      sp48TapeGetBlockSync1PulseLength: () => 0,
      sp48TapeGetBlockSync2PulseLength: () => 0,
      sp48TapeGetBlockZeroBitPulseLength: () => 0,
      sp48TapeGetBlockOneBitPulseLength: () => 0,
      sp48TapeGetBlockEndSyncPulseLength: () => 0,
      sp48TapeGetBlockLastByteUsedBits: () => 0,
      sp48TapeGetBlockPilotPulseCount: () => 0,
      sp48TapeGetDataCapacity: () => 0x100,
      sp48TapeGetFileNameCapacity: () => 0x100,
      sp48TapeGetSaveDataCapacity: () => 0x100,
      ...overrides
    } as Sp48WasmV2Exports
  });
}
