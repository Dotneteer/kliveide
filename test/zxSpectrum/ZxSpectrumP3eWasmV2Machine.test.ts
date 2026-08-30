import { readFileSync } from "node:fs";

import { buildSpP3eWasm, productionOutput } from "../../scripts/build-spp3e-wasm.cjs";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { TapeDataBlock as TapeDataBlockModel } from "@common/structs/TapeDataBlock";
import { TapeMode } from "@emu/abstractions/TapeMode";
import {
  AUDIO_SAMPLE_RATE,
  DISK_A_CHANGES,
  DISK_A_WP,
  DISK_B_WP,
  FAST_LOAD,
  REWIND_REQUESTED,
  TAPE_MODE
} from "@emu/machines/machine-props";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { loadSpP3eWasmV2 } from "@emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { describe, expect, it } from "vitest";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";

class TestWasmV2Machine extends ZxSpectrumP3eWasmV2Machine {
  constructor(private readonly romPages: Uint8Array[]) {
    super(
      undefined,
      { [MC_DISK_SUPPORT]: 2 },
      {
        artifactName: "test-spp3e-machine-lifecycle-v2.wasm",
        readArtifact: async () => readFileSync(productionOutput)
      }
    );
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return this.romPages[page] ?? testRom([]);
  }
}

describe("ZX Spectrum +2E/+3E WASM v2 machine adapter", () => {
  it("exposes stable screen dimensions before the WASM runtime is loaded", () => {
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });

    expect(machine.wasmV2Runtime).toBeUndefined();
    expect(machine.screenWidthInPixels).toBe(352);
    expect(machine.screenHeightInPixels).toBe(287);
    expect(machine.tactsInDisplayLine).toBe(176);
  });

  it("uses the WASM normal frame path while debug frames stay single-step controlled", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-frame-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    expect(runtime.exports.spp3eGetFdcEnabledDriveCount()).toBe(2);
    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(runtime.exports.spp3eGetFrames()).toBe(1);
    expect(machine.frames).toBe(1);
    expect(machine.tacts).toBe(runtime.exports.spp3eGetTactsInFrame());
    expect(machine.pc).toBe(runtime.exports.spp3eGetCpuPc());
    expect(machine.pc).not.toBe(0);
    expect(machine.getCpuState().pc).toBe(runtime.exports.spp3eGetCpuPc());
    expect(machine.getWasmV2Diagnostics().normalFrames).toBe(1);

    machine.executionContext.debugStepMode = DebugStepMode.StepInto;
    const wasmFramesBeforeDebug = runtime.exports.spp3eGetFrames();
    machine.executeMachineFrame();

    expect(runtime.exports.spp3eGetFrames()).toBe(wasmFramesBeforeDebug);
  });

  it("exposes the WASM-rendered pixel buffer to the emulator screen", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-screen-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    const width = runtime.exports.spp3eGetScreenWidth();
    const height = runtime.exports.spp3eGetScreenHeight();
    const displayPixel = 48 * width + 48;

    expect(machine.screenWidthInPixels).toBe(width);
    expect(machine.screenHeightInPixels).toBe(height);
    expect(machine.getBufferStartOffset()).toBe(0);
    expect(machine.getPixelBuffer()).toBe(runtime.pixelBuffer);
    expect(machine.getPixelBufferBytes()).toBe(runtime.pixelBufferBytes);
    expect(machine.getPixelBufferBytes().subarray(0, width * height * 4)).toHaveLength(width * height * 4);

    runtime.exports.spp3eWritePort(0xfe, 0x01);
    runtime.exports.spp3eWriteMemory(0x4000, 0x80);
    runtime.exports.spp3eWriteMemory(0x5800, 0x47);

    expect(machine.readScreenMemory(0)).toBe(0x80);

    machine.executeMachineFrame();

    expect(Array.from(machine.getPixelBuffer().slice(0, width * 2))).toContain(0xffaa0000);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(0xffffffff);
    expect(machine.getPixelBuffer()[displayPixel + 1]).toBe(0xff000000);
  });

  it("reports OS initialization from live WASM CPU state", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-os-initialized-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    runtime.exports.spp3eSetCpuIy(0x0000);
    expect(machine.isOsInitialized).toBe(false);

    runtime.exports.spp3eSetCpuIy(0x5c3a);
    expect(machine.isOsInitialized).toBe(true);
  });

  it("syncs disk media and write-protect properties into WASM", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-disk-sync-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    const diskA = new Uint8Array(readFileSync("test/testfiles/blank180K.dsk"));
    const diskB = new Uint8Array(diskA);
    const normalizedDisk = getFirstNormalizedSector(diskA);

    machine.setMachineProperty(DISK_A_WP, true);
    machine.setMachineProperty(MEDIA_DISK_A, diskA);
    machine.setMachineProperty(MEDIA_DISK_B, diskB);
    machine.setMachineProperty(DISK_B_WP, true);

    expect(runtime.exports.spp3eDiskGetLoaded(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetLoaded(1)).toBe(1);
    expect(runtime.exports.spp3eDiskGetWriteProtected(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetWriteProtected(1)).toBe(1);
    expect(runtime.exports.spp3eDiskGetLength(0)).toBe(40 * 9 * 512);
    expect(runtime.exports.spp3eDiskGetLength(1)).toBe(40 * 9 * 512);
    expect(runtime.diskData.slice(0, 4)).toEqual(normalizedDisk.data.slice(0, 4));
    expect(runtime.diskBData.slice(0, 4)).toEqual(normalizedDisk.data.slice(0, 4));

    machine.setMachineProperty(MEDIA_DISK_A);

    expect(runtime.exports.spp3eDiskGetLoaded(0)).toBe(0);
  });

  it("replays disk media attached before the WASM runtime is available", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-disk-pre-runtime-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    const diskA = new Uint8Array(readFileSync("test/testfiles/blank180K.dsk"));
    const normalizedDisk = getFirstNormalizedSector(diskA);

    machine.setMachineProperty(DISK_A_WP, true);
    machine.setMachineProperty(MEDIA_DISK_A, diskA);
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    expect(runtime.exports.spp3eDiskGetLoaded(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetWriteProtected(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetLength(0)).toBe(40 * 9 * 512);
    expect(runtime.diskData.slice(0, 4)).toEqual(normalizedDisk.data.slice(0, 4));
  });

  it("keeps attached disk media in WASM after machine reset", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-disk-reset-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    const diskA = new Uint8Array(readFileSync("test/testfiles/blank180K.dsk"));
    const normalizedDisk = getFirstNormalizedSector(diskA);
    machine.setMachineProperty(MEDIA_DISK_A, diskA);

    expect(runtime.exports.spp3eDiskGetLoaded(0)).toBe(1);

    machine.reset();

    expect(machine.getMachineProperty(MEDIA_DISK_A)).toBe(diskA);
    expect(runtime.exports.spp3eDiskGetLoaded(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetLength(0)).toBe(40 * 9 * 512);
    expect(runtime.diskData.slice(0, 4)).toEqual(normalizedDisk.data.slice(0, 4));
  });

  it("reads a real CPC DSK sector through the WASM FDC data command", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-real-dsk-read-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    const diskA = new Uint8Array(readFileSync("test/testfiles/blank180K.dsk"));
    const normalizedDisk = getFirstNormalizedSector(diskA);
    machine.setMachineProperty(MEDIA_DISK_A, diskA);

    expect(runtime.diskData[256]).toBe(normalizedDisk.data[256]);

    runtime.exports.spp3eWritePort(0x1ffd, 0x08);
    for (let i = 0; i < 50; i++) {
      runtime.exports.spp3eExecuteFrame();
    }
    expect(runtime.diskData[256]).toBe(normalizedDisk.data[256]);

    runtime.exports.spp3eWritePort(0x3ffd, 0x46);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, normalizedDisk.cylinder);
    runtime.exports.spp3eWritePort(0x3ffd, normalizedDisk.head);
    runtime.exports.spp3eWritePort(0x3ffd, normalizedDisk.record);
    runtime.exports.spp3eWritePort(0x3ffd, normalizedDisk.lengthCode);
    runtime.exports.spp3eWritePort(0x3ffd, normalizedDisk.record);
    runtime.exports.spp3eWritePort(0x3ffd, 0x1b);
    runtime.exports.spp3eWritePort(0x3ffd, 0xff);

    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(1);
    expect(runtime.exports.spp3eFdcGetDataRegister(3)).toBe(normalizedDisk.record);
    expect(runtime.exports.spp3eFdcGetDataRegister(4)).toBe(normalizedDisk.lengthCode);
    for (let i = 0; i < normalizedDisk.data.length; i++) {
      expect(runtime.exports.spp3eReadPort(0x3ffd), `sector byte ${i}`).toBe(
        normalizedDisk.data[i]
      );
    }
  });

  it("publishes WASM disk writes as sector changes before restart", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-disk-changes-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    const diskA = new Uint8Array(readFileSync("test/testfiles/blank180K.dsk"));
    const firstSector = getFirstNormalizedSector(diskA);
    machine.setMachineProperty(MEDIA_DISK_A, diskA);

    runtime.exports.spp3eWritePort(0x1ffd, 0x08);
    for (let i = 0; i < 50; i++) {
      runtime.exports.spp3eExecuteFrame();
    }

    runtime.exports.spp3eWritePort(0x3ffd, 0x45);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, firstSector.cylinder);
    runtime.exports.spp3eWritePort(0x3ffd, firstSector.head);
    runtime.exports.spp3eWritePort(0x3ffd, firstSector.record);
    runtime.exports.spp3eWritePort(0x3ffd, firstSector.lengthCode);
    runtime.exports.spp3eWritePort(0x3ffd, firstSector.record);
    runtime.exports.spp3eWritePort(0x3ffd, 0x1b);
    runtime.exports.spp3eWritePort(0x3ffd, 0xff);
    runtime.exports.spp3eWritePort(0x3ffd, 0x77);
    for (let i = 1; i < firstSector.data.length; i++) {
      runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    }

    machine.flushDiskChanges();

    const changes = machine.getMachineProperty(DISK_A_CHANGES);
    expect(changes.size).toBe(1);
    expect(changes.get(firstSector.record)[0]).toBe(0x77);
    expect(changes.get(firstSector.record)).toHaveLength(firstSector.data.length);
    expect(Array.from(runtime.diskChanges.slice(0, 8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("syncs keyboard rows into WASM before frames and port reads", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-keyboard-sync-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    machine.keyboardDevice.setKeyStatus(0, true);

    expect(machine.doReadPort(0xfefe)).toBe(0xbe);
    expect(runtime.exports.spp3eGetKeyboardLine(0)).toBe(0x01);

    machine.keyboardDevice.setKeyStatus(0, false);
    machine.keyboardDevice.setKeyStatus(6, true);
    machine.executeMachineFrame();

    expect(runtime.exports.spp3eGetKeyboardLine(0)).toBe(0x00);
    expect(runtime.exports.spp3eGetKeyboardLine(1)).toBe(0x02);
    expect(runtime.exports.spp3eReadPort(0xfdfe)).toBe(0xbd);
  });

  it("returns normalized WASM audio samples from normal frames", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-audio-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    machine.setMachineProperty(AUDIO_SAMPLE_RATE, 1000);
    runtime.exports.spp3eWritePort(0x00fe, 0x18);
    machine.executeMachineFrame();

    const samples = machine.getAudioSamples();
    const absoluteValues = samples.flatMap(sample => [Math.abs(sample.left), Math.abs(sample.right)]);

    expect(runtime.exports.spp3eGetAudioSampleRate()).toBe(1000);
    expect(samples.length).toBeGreaterThan(0);
    expect(Math.max(...absoluteValues)).toBeLessThanOrEqual(1.0);
    expect(absoluteValues.some(value => value > 0.001)).toBe(true);
    expect(machine.getWasmV2Diagnostics().audioSamples).toBe(samples.length);
  });

  it("uploads tape media and tape controls into WASM", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-machine-tape-sync-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    const machine = new ZxSpectrumP3eWasmV2Machine(undefined, { [MC_DISK_SUPPORT]: 2 });
    machine.wasmV2Runtime = runtime;
    machine.hardReset();

    const headerBlock = tapeBlock([0x00, 0x03, 0x4d, 0x59], { pauseAfter: 500 });
    const dataBlock = tapeBlock([0xff, 0x10, 0x20, 0x30, 0x40]);

    machine.setMachineProperty(FAST_LOAD, true);
    machine.setMachineProperty(MEDIA_TAPE, [headerBlock, dataBlock]);
    machine.setMachineProperty(TAPE_MODE, TapeMode.Load);

    const wasm = runtime.exports;
    expect(wasm.spp3eTapeGetLoaded()).toBe(1);
    expect(wasm.spp3eTapeGetBlockCount()).toBe(2);
    expect(wasm.spp3eTapeGetDataLength()).toBe(9);
    expect(runtime.tapeData.slice(0, 9)).toEqual(
      new Uint8Array([0x00, 0x03, 0x4d, 0x59, 0xff, 0x10, 0x20, 0x30, 0x40])
    );
    expect(wasm.spp3eTapeGetBlockOffset(1)).toBe(4);
    expect(wasm.spp3eTapeGetBlockLength(1)).toBe(5);
    expect(wasm.spp3eTapeGetBlockPauseAfter(0)).toBe(500);
    expect(wasm.spp3eTapeGetFastLoad()).toBe(1);
    expect(wasm.spp3eTapeGetMode()).toBe(TapeMode.Load);
    expect(wasm.spp3eTapeGetCurrentEarBit()).toBe(1);
    expect(machine.doReadPort(0xfffe) & 0x40).toBe(0x40);

    wasm.spp3eSetTacts(2169);
    expect(wasm.spp3eTapeGetCurrentEarBit()).toBe(0);
    expect(machine.doReadPort(0xfffe) & 0x40).toBe(0x00);

    machine.setMachineProperty(FAST_LOAD, false);
    expect(wasm.spp3eTapeGetFastLoad()).toBe(0);

    machine.setMachineProperty(REWIND_REQUESTED, true);
    expect(wasm.spp3eTapeGetCurrentBlockIndex()).toBe(0);
    expect(wasm.spp3eTapeGetMode()).toBe(TapeMode.Load);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics.tapeUploads).toBe(1);
    expect(diagnostics.tapeBlocks).toBe(2);
    expect(diagnostics.tapeBytes).toBe(9);
    expect(diagnostics.tapeLoaded).toBe(true);
  });

  it("keeps uploaded ROM pages across the app setup hard reset", async () => {
    buildSpP3eWasm();
    const machine = new TestWasmV2Machine([
      testRom([0x3e, 0x42, 0x00]),
      testRom([0x11]),
      testRom([0x22]),
      testRom([0x33])
    ]);

    await machine.setup();
    expect(machine.wasmV2Runtime?.exports.spp3eReadRomBank(0, 0)).toBe(0x3e);

    machine.hardReset();

    expect(machine.wasmV2Runtime?.exports.spp3eReadRomBank(0, 0)).toBe(0x3e);
    expect(machine.wasmV2Runtime?.exports.spp3eReadMemory(0)).toBe(0x3e);
  });
});

function testRom(prefix: number[]): Uint8Array {
  const rom = new Uint8Array(0x4000);
  rom.set(prefix);
  return rom;
}

function tapeBlock(bytes: number[], overrides: Partial<TapeDataBlock> = {}): TapeDataBlock {
  const block = new TapeDataBlockModel();
  block.data = new Uint8Array(bytes);
  block.pauseAfter = overrides.pauseAfter ?? 1000;
  return block;
}

function getFirstNormalizedSector(contents: Uint8Array): {
  cylinder: number;
  head: number;
  record: number;
  lengthCode: number;
  data: Uint8Array;
} {
  const disk = readDiskData(contents);
  const sector = disk.tracks[0].sectors[0];
  return {
    cylinder: sector.C,
    head: sector.H,
    record: sector.R,
    lengthCode: sector.N,
    data: sector.sectorData
  };
}
