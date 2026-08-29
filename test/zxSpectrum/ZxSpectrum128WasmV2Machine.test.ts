import { readFileSync } from "node:fs";

import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { buildSp128Wasm, productionOutput } from "../../scripts/build-sp128-wasm.cjs";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { FAST_LOAD, REWIND_REQUESTED, TAPE_MODE } from "@emu/machines/machine-props";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { describe, expect, it } from "vitest";

class TestWasmV2Machine extends ZxSpectrum128WasmV2Machine {
  constructor(private readonly rom0: Uint8Array, private readonly rom1 = testRom([])) {
    super(undefined, undefined, {
      artifactName: "machine-128-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return page === 1 ? this.rom1 : this.rom0;
  }
}

describe("ZX Spectrum 128K WASM v2 machine adapter", () => {
  it("sets up the v2 runtime and executes a C-owned normal frame", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();

    expect(machine.implementation).toBe("wasm");
    expect(machine.wasmV2Runtime?.artifactName).toBe("machine-128-v2.wasm");
    expect(machine.get64KFlatMemory()[0]).toBe(0x00);
    expect(machine.getCurrentPartitions()).toEqual([-1, -1, 5, 5, 2, 2, 0, 0]);
    expect(machine.screenWidthInPixels).toBeGreaterThan(256);
    expect(machine.screenHeightInPixels).toBeGreaterThan(192);

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.frames).toBe(1);
    expect(machine.pc).not.toBe(0);
    expect(machine.tacts).toBe(machine.tactsInFrame);
    expect(machine.frameJustCompleted).toBe(true);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.backend).toBe("wasm");
    expect(diagnostics.engine).toBe("v2");
    expect(diagnostics.frames).toBe(1);
    expect(diagnostics.normalFrames).toBe(1);
    expect(diagnostics.cpuRegisterSyncs).toBe(1);
  });

  it("routes paged memory, partitions, and shadow screen through WASM", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x10]), testRom([0x11]));

    await machine.setup();
    machine.doWriteMemory(0x4000, 0x42);
    machine.doWriteMemory(0xc000, 0x99);
    expect(machine.doReadMemory(0x4000)).toBe(0x42);
    expect(machine.doReadMemory(0xc000)).toBe(0x99);
    expect(machine.readScreenMemory(0)).toBe(0x42);
    expect(machine.getMemoryPartition(5)[0]).toBe(0x42);
    expect(machine.getMemoryPartition(0)[0]).toBe(0x99);
    expect(machine.getMemoryPartition(-1)[0]).toBe(0x10);
    expect(machine.getMemoryPartition(-2)[0]).toBe(0x11);

    machine.wasmV2Runtime?.exports.sp128WriteRamBank(3, 0, 0x33);
    machine.doWritePort(0x7ffd, 0x1b);

    expect(machine.getSelectedRamBank()).toBe(3);
    expect(machine.getSelectedRomPage()).toBe(1);
    expect(machine.useShadowScreen).toBe(true);
    expect(machine.getCurrentPartitions()).toEqual([-2, -2, 5, 5, 2, 2, 3, 3]);
    expect(machine.doReadMemory(0x0000)).toBe(0x11);
    expect(machine.doReadMemory(0xc000)).toBe(0x33);
  });

  it("refreshes the exported pixel buffer during normal frame execution", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.doWritePort(0xfe, 0x01);
    machine.doWriteMemory(0x4000, 0x80);
    machine.doWriteMemory(0x5800, 0x47);

    const width = machine.screenWidthInPixels;
    const displayPixel = (48 * width) + 48;
    expect(machine.getPixelBuffer()[displayPixel]).toBe(0xff000000);

    machine.executeMachineFrame();

    expect(Array.from(machine.getPixelBuffer().slice(0, width * 2))).toContain(0xffaa0000);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(0xffffffff);
    expect(machine.getPixelBuffer()[displayPixel + 1]).toBe(0xff000000);
  });

  it("reports OS initialization from live WASM CPU state", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.wasmV2Runtime!.exports.sp128SetCpuIy(0x0000);
    expect(machine.isOsInitialized).toBe(false);

    machine.wasmV2Runtime!.exports.sp128SetCpuIy(0x5c3a);
    expect(machine.isOsInitialized).toBe(true);
  });

  it("executes repeated debug step-into operations in the WASM CPU", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00, 0x00, 0x00]));

    await machine.setup();
    machine.executionContext.debugStepMode = DebugStepMode.StepInto;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    expect(machine.pc).toBe(0);
    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.getCpuState().pc).toBe(1);

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.getCpuState().pc).toBe(2);
    expect(machine.wasmV2Runtime?.exports.sp128GetCpuPc()).toBe(2);
  });

  it("raises frame interrupts so the ROM can poll keyboard state", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0xfb, 0x00, 0x00]));

    await machine.setup();
    machine.keyboardDevice.setKeyStatus(0, true);
    machine.executeMachineFrame();

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.interruptsRaised).toBeGreaterThan(0);
    expect(machine.pc).not.toBe(0);
    expect(machine.wasmV2Runtime?.keyboardLines[0]).toBe(0x01);
    expect(machine.wasmV2Runtime?.exports.sp128ReadPort(0xfefe)).toBe(0xbe);
  });

  it("returns normalized floating audio samples for PSG noise", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.doWritePort(0xfffd, 6);
    machine.doWritePort(0xbffd, 16);
    machine.doWritePort(0xfffd, 7);
    machine.doWritePort(0xbffd, 0x37);
    machine.doWritePort(0xfffd, 8);
    machine.doWritePort(0xbffd, 0x0f);
    machine.executeMachineFrame();

    const samples = machine.getAudioSamples();
    const absoluteValues = samples.flatMap(sample => [Math.abs(sample.left), Math.abs(sample.right)]);

    expect(samples.length).toBeGreaterThan(0);
    expect(Math.max(...absoluteValues)).toBeLessThanOrEqual(1.0);
    expect(absoluteValues.some(value => value > 0.001 && value < 1.0)).toBe(true);
  });

  it("syncs keyboard rows to WASM only when changed", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));

    await machine.setup();
    machine.keyboardDevice.setKeyStatus(0, true);
    machine.executeMachineFrame();

    expect(machine.wasmV2Runtime?.keyboardLines[0]).toBe(0x01);
    expect(machine.wasmV2Runtime?.exports.sp128ReadPort(0xfefe)).toBe(0xbe);
    const diagnosticsAfterFirstFrame = machine.getWasmV2Diagnostics();

    machine.executeMachineFrame();
    expect(machine.getWasmV2Diagnostics().keyboardLineWrites).toBe(
      diagnosticsAfterFirstFrame.keyboardLineWrites
    );
  });

  it("uploads tape media and tape controls into the v2 runtime", async () => {
    buildSp128Wasm();
    const machine = new TestWasmV2Machine(testRom([0x00]));
    const headerBlock = tapeBlock([0x00, 0x03, 0x4d, 0x59], { pauseAfter: 500 });
    const dataBlock = tapeBlock([0xff, 0x10, 0x20, 0x30, 0x40]);

    await machine.setup();
    machine.setMachineProperty(FAST_LOAD, true);
    machine.setMachineProperty(MEDIA_TAPE, [headerBlock, dataBlock]);
    machine.setMachineProperty(TAPE_MODE, TapeMode.Load);

    const runtime = machine.wasmV2Runtime!;
    const wasm = runtime.exports;
    expect(wasm.sp128TapeGetLoaded()).toBe(1);
    expect(wasm.sp128TapeGetBlockCount()).toBe(2);
    expect(wasm.sp128TapeGetDataLength()).toBe(9);
    expect(runtime.tapeData.slice(0, 9)).toEqual(new Uint8Array([0x00, 0x03, 0x4d, 0x59, 0xff, 0x10, 0x20, 0x30, 0x40]));
    expect(wasm.sp128TapeGetBlockOffset(1)).toBe(4);
    expect(wasm.sp128TapeGetBlockLength(1)).toBe(5);
    expect(wasm.sp128TapeGetBlockPauseAfter(0)).toBe(500);
    expect(wasm.sp128TapeGetFastLoad()).toBe(1);
    expect(wasm.sp128TapeGetMode()).toBe(TapeMode.Load);

    machine.setMachineProperty(REWIND_REQUESTED, true);
    expect(wasm.sp128TapeGetCurrentBlockIndex()).toBe(0);
    expect(wasm.sp128TapeGetMode()).toBe(TapeMode.Load);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.tapeUploads).toBe(1);
    expect(diagnostics.tapeBlocks).toBe(2);
    expect(diagnostics.tapeBytes).toBe(9);
    expect(diagnostics.tapeLoaded).toBe(true);
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
