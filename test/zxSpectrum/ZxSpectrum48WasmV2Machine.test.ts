import { readFileSync } from "node:fs";

import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { buildSp48Wasm, productionOutput } from "../../scripts/build-sp48-wasm.cjs";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { FAST_LOAD, REWIND_REQUESTED, TAPE_MODE } from "@emu/machines/machine-props";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { describe, expect, it } from "vitest";

class TestWasmV2Machine extends ZxSpectrum48WasmV2Machine {
  constructor(private readonly rom: Uint8Array) {
    super(undefined, undefined, {
      artifactName: "machine-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }
}

describe("ZX Spectrum 48K WASM v2 machine adapter", () => {
  it("sets up the v2 runtime and executes a full C-owned frame", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();

    expect(machine.implementation).toBe("wasm");
    expect(machine.wasmV2Runtime?.artifactName).toBe("machine-v2.wasm");
    expect(machine.get64KFlatMemory()[0]).toBe(0x00);
    expect(machine.screenWidthInPixels).toBeGreaterThan(256);
    expect(machine.screenHeightInPixels).toBeGreaterThan(192);

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.frames).toBe(1);
    expect(machine.pc).toBe(machine.wasmV2Runtime?.exports.sp48GetCpuPc());
    expect(machine.pc).not.toBe(0);
    expect(machine.tacts).toBeGreaterThanOrEqual(machine.tactsInFrame);
    expect(machine.frameJustCompleted).toBe(true);
    expect(machine.getPixelBuffer().length).toBeGreaterThan(256 * 192);
    expect(machine.getAudioSamples().length).toBeGreaterThan(0);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.backend).toBe("wasm");
    expect(diagnostics.engine).toBe("v2");
    expect(diagnostics.frames).toBe(1);
    expect(diagnostics.audioSamples).toBe(machine.getAudioSamples().length);
    expect(diagnostics.normalFrames).toBe(1);
    expect(diagnostics.clockMultiplier).toBe(1);
    expect(diagnostics.cpuRegisterSyncs).toBe(1);
  });

  it("routes memory and keyboard through the v2 runtime", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.doWriteMemory(0x4000, 0x42);
    expect(machine.doReadMemory(0x4000)).toBe(0x42);
    expect(machine.readScreenMemory(0)).toBe(0x42);

    machine.keyboardDevice.setKeyStatus(0, true);
    machine.executeMachineFrame();
    expect(machine.wasmV2Runtime?.keyboardLines[0]).toBe(0x01);
    const diagnosticsAfterFirstFrame = machine.getWasmV2Diagnostics();

    machine.executeMachineFrame();
    expect(machine.getWasmV2Diagnostics().keyboardLineWrites).toBe(
      diagnosticsAfterFirstFrame.keyboardLineWrites
    );
  });

  it("syncs clock multiplier changes to v2 only when needed", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    const setupWrites = machine.getWasmV2Diagnostics().clockMultiplierWrites;
    machine.executeMachineFrame();
    expect(machine.getWasmV2Diagnostics().clockMultiplierWrites).toBe(setupWrites);

    machine.targetClockMultiplier = 2;
    machine.executeMachineFrame();
    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.clockMultiplierWrites).toBe(setupWrites + 1);
    expect(diagnostics.clockMultiplier).toBe(2);
    expect(diagnostics.tactsInCurrentFrame).toBe(machine.tactsInFrame * 2);
  });

  it("uses the v2 pixel buffer for instant-screen snapshots", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.doWriteMemory(0x4000, 0xff);
    const snapshot = machine.renderInstantScreen();

    expect(snapshot).toHaveLength(machine.getPixelBuffer().length);
    expect(machine.getBufferStartOffset()).toBe(machine.wasmV2Runtime?.exports.sp48GetPixelBufferStartOffset());

    machine.executeMachineFrame();
    expect(machine.getWasmV2Diagnostics().cpuRegisterSyncs).toBe(1);
  });

  it("uploads tape media and tape controls into the v2 runtime", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));
    const headerBlock = tapeBlock([0x00, 0x03, 0x4d, 0x59], { pauseAfter: 500 });
    const dataBlock = tapeBlock([0xff, 0x10, 0x20, 0x30, 0x40], {
      pilotPulseCount: 42,
      lastByteUsedBits: 7
    });

    await machine.setup();
    machine.setMachineProperty(FAST_LOAD, true);
    machine.setMachineProperty(MEDIA_TAPE, [headerBlock, dataBlock]);
    machine.setMachineProperty(TAPE_MODE, TapeMode.Load);

    const runtime = machine.wasmV2Runtime!;
    const wasm = runtime.exports;
    expect(wasm.sp48TapeGetLoaded()).toBe(1);
    expect(wasm.sp48TapeGetBlockCount()).toBe(2);
    expect(wasm.sp48TapeGetDataLength()).toBe(9);
    expect(runtime.tapeData.slice(0, 9)).toEqual(new Uint8Array([0x00, 0x03, 0x4d, 0x59, 0xff, 0x10, 0x20, 0x30, 0x40]));
    expect(wasm.sp48TapeGetBlockOffset(1)).toBe(4);
    expect(wasm.sp48TapeGetBlockLength(1)).toBe(5);
    expect(wasm.sp48TapeGetBlockPauseAfter(0)).toBe(500);
    expect(wasm.sp48TapeGetBlockPilotPulseCount(1)).toBe(42);
    expect(wasm.sp48TapeGetBlockLastByteUsedBits(1)).toBe(7);
    expect(wasm.sp48TapeGetFastLoad()).toBe(1);
    expect(wasm.sp48TapeGetMode()).toBe(TapeMode.Load);

    machine.setMachineProperty(REWIND_REQUESTED, true);
    expect(wasm.sp48TapeGetCurrentBlockIndex()).toBe(0);
    expect(wasm.sp48TapeGetMode()).toBe(TapeMode.Load);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.tapeUploads).toBe(1);
    expect(diagnostics.tapeBlocks).toBe(2);
    expect(diagnostics.tapeBytes).toBe(9);
    expect(diagnostics.tapeLoaded).toBe(true);
  });

  it("executes a single v2 instruction and exposes fresh CPU state in debug step mode", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x3e, 0x77, 0x32, 0x00, 0x40, 0x00]));

    await machine.setup();
    machine.executionContext.debugStepMode = DebugStepMode.StepInto;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    let cpuState = machine.getCpuState();
    expect(cpuState.pc).toBe(0x0002);
    expect(cpuState.af >> 8).toBe(0x77);
    expect(cpuState.tacts).toBeGreaterThan(0);
    expect(machine.frames).toBe(0);

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    cpuState = machine.getCpuState();
    expect(cpuState.pc).toBe(0x0005);
    expect(cpuState.lastMemoryWrites[0]).toBe(0x4000);
    expect(machine.lastMemoryWritesCount).toBe(1);
    expect(cpuState.lastMemoryWriteValue).toBe(0x77);
    expect(machine.doReadMemory(0x4000)).toBe(0x77);
  });

  it("publishes completed frames and rendered output from the v2 debug loop", async () => {
    buildSp48Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.frameJustCompleted).toBe(true);
    expect(machine.frames).toBe(1);
    expect(machine.wasmV2Runtime?.exports.sp48GetFrameCompleted()).toBe(1);
    expect(machine.getAudioSamples().length).toBeGreaterThan(0);
    expect(machine.getPixelBuffer().some((pixel) => pixel !== 0)).toBe(true);
  });
});

function testRom(bytes: number[]): Uint8Array {
  const rom = new Uint8Array(0x4000);
  rom.set(bytes);
  return rom;
}

function tapeBlock(bytes: number[], overrides: Partial<TapeDataBlock> = {}): TapeDataBlock {
  const block = new TapeDataBlock();
  block.data = new Uint8Array(bytes);
  Object.assign(block, overrides);
  return block;
}
