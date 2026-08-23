import { readFileSync } from "node:fs";

import { buildSpP3eWasm, productionOutput } from "../../scripts/build-spp3e-wasm.cjs";
import {
  createSpP3eWasmV2Views,
  loadSpP3eWasmV2,
  resetSpP3eWasmV2ModuleCache,
  SPP3E_WASM_V2_ARTIFACT_NAME,
  SPP3E_WASM_V2_KEYBOARD_LINE_COUNT,
  SPP3E_WASM_V2_MEMORY_SIZE,
  SPP3E_WASM_V2_RAM_SIZE,
  SPP3E_WASM_V2_ROM_SIZE,
  validateSpP3eWasmV2Exports,
  type SpP3eWasmV2Exports,
  type SpP3eWasmV2Runtime
} from "@emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader";
import { afterEach, describe, expect, it } from "vitest";

function findTact(runtime: SpP3eWasmV2Runtime, phase: number): number {
  for (let tact = 0; tact < runtime.exports.spp3eGetTactsInFrame(); tact++) {
    if (runtime.exports.spp3eGetRenderingPhase(tact) === phase) {
      return tact;
    }
  }
  throw new Error(`Cannot find rendering phase ${phase}.`);
}

describe("ZX Spectrum +3E WASM v2 loader", () => {
  afterEach(() => resetSpP3eWasmV2ModuleCache());

  it("loads the built v2 artifact and exposes direct typed views", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-built-spp3e-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    expect(runtime.artifactName).toBe("test-built-spp3e-v2.wasm");
    expect(runtime.exports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(runtime.memory).toHaveLength(SPP3E_WASM_V2_MEMORY_SIZE);
    expect(runtime.ram).toHaveLength(SPP3E_WASM_V2_RAM_SIZE);
    expect(runtime.rom).toHaveLength(SPP3E_WASM_V2_ROM_SIZE);
    expect(runtime.keyboardLines).toHaveLength(SPP3E_WASM_V2_KEYBOARD_LINE_COUNT);
    expect(runtime.diskData).toHaveLength(runtime.exports.spp3eGetDiskDataCapacity());
    expect(runtime.diskBData).toHaveLength(runtime.exports.spp3eGetDiskDataCapacity());
    expect(runtime.diskChanges).toHaveLength(runtime.exports.spp3eGetDiskChangeCapacity());
    expect(runtime.diskBChanges).toHaveLength(runtime.exports.spp3eGetDiskChangeCapacity());
    expect(runtime.tapeData).toHaveLength(runtime.exports.spp3eGetTapeDataCapacity());
    expect(runtime.tapeSaveData).toHaveLength(runtime.exports.spp3eGetTapeSaveDataCapacity());

    runtime.exports.spp3eHardReset();
    expect(runtime.exports.spp3eGetFrames()).toBe(0);
    expect(runtime.exports.spp3eGetTacts()).toBe(0);
    expect(runtime.keyboardLines[0]).toBe(0x00);

    expect(runtime.exports.spp3eExecuteFrame()).toBe(0);
    expect(runtime.exports.spp3eGetFrames()).toBe(1);
    expect(runtime.exports.spp3eGetTacts()).toBe(runtime.exports.spp3eGetTactsInFrame());

    runtime.exports.spp3eUploadRomByte(3, 0x0002, 0x7b);
    expect(runtime.rom[3 * 0x4000 + 0x0002]).toBe(0x7b);
    expect(runtime.exports.spp3eReadRomBank(3, 0x0002)).toBe(0x7b);

    const pixelWords = runtime.exports.spp3eGetScreenWidth() * runtime.exports.spp3eGetScreenHeight();
    expect(runtime.pixelBuffer).toHaveLength(pixelWords);
    expect(runtime.pixelBufferBytes).toHaveLength(pixelWords * 4);
    expect(runtime.audioSamples).toHaveLength(runtime.exports.spp3eGetAudioSampleCapacity() * 2);
  });

  it("maps ROM and RAM banks through the +3E reset layout", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-memory-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eUploadRomByte(0, 0x0002, 0x12);
    runtime.exports.spp3eUploadRomByte(1, 0x0002, 0x34);
    runtime.exports.spp3eWriteRamBank(5, 0x0003, 0x55);
    runtime.exports.spp3eWriteRamBank(2, 0x0004, 0x22);
    runtime.exports.spp3eWriteRamBank(0, 0x0005, 0x99);

    expect(runtime.exports.spp3eGetSelectedRom()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedBank()).toBe(0);
    expect(runtime.exports.spp3eGetPagingEnabled()).toBe(1);
    expect(runtime.exports.spp3eGetUseShadowScreen()).toBe(0);
    expect(runtime.exports.spp3eGetScreenBank()).toBe(5);
    expect(runtime.exports.spp3eGetInSpecialPagingMode()).toBe(0);
    expect(runtime.exports.spp3eGetSpecialConfigMode()).toBe(0);
    expect(runtime.exports.spp3eGetDiskMotorOn()).toBe(0);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(-1);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(5);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(2);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(0);
    expect(runtime.exports.spp3eGetRomFlag(0)).toBe(1);
    expect(runtime.exports.spp3eGetRomFlag(1)).toBe(0);

    expect(runtime.exports.spp3eReadMemory(0x0002)).toBe(0x12);
    expect(runtime.exports.spp3eReadMemory(0x4003)).toBe(0x55);
    expect(runtime.exports.spp3eReadMemory(0x8004)).toBe(0x22);
    expect(runtime.exports.spp3eReadMemory(0xc005)).toBe(0x99);
    expect(runtime.memory[0x0002]).toBe(0x12);
    expect(runtime.memory[0x4003]).toBe(0x55);
    expect(runtime.memory[0x8004]).toBe(0x22);
    expect(runtime.memory[0xc005]).toBe(0x99);

    runtime.exports.spp3eWriteMemory(0x0002, 0xff);
    runtime.exports.spp3eWriteMemory(0x4003, 0x66);
    runtime.exports.spp3eWriteMemory(0xc005, 0xaa);

    expect(runtime.exports.spp3eReadRomBank(0, 0x0002)).toBe(0x12);
    expect(runtime.exports.spp3eReadMemory(0x0002)).toBe(0x12);
    expect(runtime.exports.spp3eReadRamBank(5, 0x0003)).toBe(0x66);
    expect(runtime.exports.spp3eReadRamBank(0, 0x0005)).toBe(0xaa);
  });

  it("switches memory through the 0x7ffd paging port", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-7ffd-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eUploadRomByte(0, 0x0010, 0x10);
    runtime.exports.spp3eUploadRomByte(1, 0x0010, 0x11);
    runtime.exports.spp3eWriteRamBank(3, 0x0020, 0x33);
    runtime.exports.spp3eWriteRamBank(5, 0x0030, 0x55);
    runtime.exports.spp3eWriteRamBank(7, 0x0030, 0x77);

    runtime.exports.spp3eWritePort(0x7ffd, 0x1b);

    expect(runtime.exports.spp3eGetSelectedBank()).toBe(3);
    expect(runtime.exports.spp3eGetSelectedRom()).toBe(1);
    expect(runtime.exports.spp3eGetUseShadowScreen()).toBe(1);
    expect(runtime.exports.spp3eGetScreenBank()).toBe(7);
    expect(runtime.exports.spp3eGetPagingEnabled()).toBe(1);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(-2);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(5);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(2);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(3);
    expect(runtime.exports.spp3eReadMemory(0x0010)).toBe(0x11);
    expect(runtime.exports.spp3eReadMemory(0xc020)).toBe(0x33);
    expect(runtime.exports.spp3eReadScreenMemoryOffset(0x0030)).toBe(0x77);

    runtime.exports.spp3eWritePort(0x7ffd, 0x20);

    expect(runtime.exports.spp3eGetPagingEnabled()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedBank()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedRom()).toBe(0);
    expect(runtime.exports.spp3eGetUseShadowScreen()).toBe(0);
    expect(runtime.exports.spp3eGetScreenBank()).toBe(5);
    expect(runtime.exports.spp3eReadMemory(0x0010)).toBe(0x10);
    expect(runtime.exports.spp3eReadScreenMemoryOffset(0x0030)).toBe(0x55);

    runtime.exports.spp3eWritePort(0x7ffd, 0x1f);

    expect(runtime.exports.spp3eGetPagingEnabled()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedBank()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedRom()).toBe(0);
    expect(runtime.exports.spp3eGetUseShadowScreen()).toBe(0);
  });

  it("switches memory through the +3E 0x1ffd special paging port", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-1ffd-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eWriteRamBank(0, 0x0001, 0x10);
    runtime.exports.spp3eWriteRamBank(1, 0x0001, 0x11);
    runtime.exports.spp3eWriteRamBank(3, 0x0001, 0x13);
    runtime.exports.spp3eWriteRamBank(4, 0x0001, 0x14);
    runtime.exports.spp3eWriteRamBank(5, 0x0001, 0x15);
    runtime.exports.spp3eWriteRamBank(6, 0x0001, 0x16);
    runtime.exports.spp3eWriteRamBank(7, 0x0001, 0x17);

    runtime.exports.spp3eWritePort(0x1ffd, 0x01);

    expect(runtime.exports.spp3eGetInSpecialPagingMode()).toBe(1);
    expect(runtime.exports.spp3eGetSpecialConfigMode()).toBe(0);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(0);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(1);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(2);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(3);
    expect(runtime.exports.spp3eGetRomFlag(0)).toBe(0);
    expect(runtime.exports.spp3eReadMemory(0x0001)).toBe(0x10);
    expect(runtime.exports.spp3eReadMemory(0x4001)).toBe(0x11);
    expect(runtime.exports.spp3eReadMemory(0xc001)).toBe(0x13);

    runtime.exports.spp3eWritePort(0x1ffd, 0x03);

    expect(runtime.exports.spp3eGetSpecialConfigMode()).toBe(1);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(4);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(5);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(6);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(7);
    expect(runtime.exports.spp3eReadMemory(0x0001)).toBe(0x14);
    expect(runtime.exports.spp3eReadMemory(0xc001)).toBe(0x17);

    runtime.exports.spp3eWritePort(0x1ffd, 0x05);

    expect(runtime.exports.spp3eGetSelectedRom()).toBe(2);
    expect(runtime.exports.spp3eGetSpecialConfigMode()).toBe(2);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(4);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(5);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(6);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(3);

    runtime.exports.spp3eWritePort(0x1ffd, 0x0f);

    expect(runtime.exports.spp3eGetSpecialConfigMode()).toBe(3);
    expect(runtime.exports.spp3eGetDiskMotorOn()).toBe(1);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(4);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(7);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(6);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(3);
  });

  it("keeps 0x1ffd writable after the 0x7ffd paging lock", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-paging-lock-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eWritePort(0x7ffd, 0x20);
    runtime.exports.spp3eWritePort(0x7ffd, 0x1f);

    expect(runtime.exports.spp3eGetPagingEnabled()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedBank()).toBe(0);
    expect(runtime.exports.spp3eGetSelectedRom()).toBe(0);

    runtime.exports.spp3eWritePort(0x1ffd, 0x0f);

    expect(runtime.exports.spp3eGetPagingEnabled()).toBe(0);
    expect(runtime.exports.spp3eGetInSpecialPagingMode()).toBe(1);
    expect(runtime.exports.spp3eGetSpecialConfigMode()).toBe(3);
    expect(runtime.exports.spp3eGetDiskMotorOn()).toBe(1);
    expect(runtime.exports.spp3eGetCurrentPartition(0)).toBe(4);
    expect(runtime.exports.spp3eGetCurrentPartition(1)).toBe(7);
    expect(runtime.exports.spp3eGetCurrentPartition(2)).toBe(6);
    expect(runtime.exports.spp3eGetCurrentPartition(3)).toBe(3);
  });

  it("executes a simple Z80 instruction from the selected ROM", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-z80-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eUploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.spp3eUploadRomByte(0, 0x0001, 0x42);

    expect(runtime.exports.spp3eGetCpuPc()).toBe(0);
    expect(runtime.exports.spp3eExecuteInstruction()).toBe(0);

    expect(runtime.exports.spp3eGetCpuPc()).toBe(2);
    expect(runtime.exports.spp3eGetCpuAf() >> 8).toBe(0x42);
    expect(runtime.exports.spp3eGetCpuInstructionsExecuted()).toBe(1);
    expect(runtime.exports.spp3eGetCpuFrameSliceInstructions()).toBe(1);
    expect(runtime.exports.spp3eGetTacts()).toBe(7);
    expect(runtime.exports.spp3eGetCpuTacts()).toBe(7);
    expect(runtime.exports.spp3eGetLastMemoryAddress()).toBe(1);
    expect(runtime.exports.spp3eGetLastMemoryValue()).toBe(0x42);
    expect(runtime.exports.spp3eGetLastMemoryIsWrite()).toBe(0);
  });

  it("records CPU memory writes through the current page map", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-z80-write-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eUploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.spp3eUploadRomByte(0, 0x0001, 0xaa);
    runtime.exports.spp3eUploadRomByte(0, 0x0002, 0x32);
    runtime.exports.spp3eUploadRomByte(0, 0x0003, 0x00);
    runtime.exports.spp3eUploadRomByte(0, 0x0004, 0xc0);

    runtime.exports.spp3eExecuteInstruction();
    runtime.exports.spp3eExecuteInstruction();

    expect(runtime.exports.spp3eReadRamBank(0, 0x0000)).toBe(0xaa);
    expect(runtime.exports.spp3eReadMemory(0xc000)).toBe(0xaa);
    expect(runtime.exports.spp3eGetCpuPc()).toBe(5);
    expect(runtime.exports.spp3eGetLastMemoryAddress()).toBe(0xc000);
    expect(runtime.exports.spp3eGetLastMemoryValue()).toBe(0xaa);
    expect(runtime.exports.spp3eGetLastMemoryIsWrite()).toBe(1);
  });

  it("records CPU port writes through the +3E port handler", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-z80-port-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eUploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.spp3eUploadRomByte(0, 0x0001, 0x47);
    runtime.exports.spp3eUploadRomByte(0, 0x0002, 0xd3);
    runtime.exports.spp3eUploadRomByte(0, 0x0003, 0xfd);

    runtime.exports.spp3eExecuteInstruction();
    runtime.exports.spp3eExecuteInstruction();

    expect(runtime.exports.spp3eGetSelectedBank()).toBe(7);
    expect(runtime.exports.spp3eGetLastPortAddress()).toBe(0x47fd);
    expect(runtime.exports.spp3eGetLastPortValue()).toBe(0x47);
    expect(runtime.exports.spp3eGetLastPortIsWrite()).toBe(1);
  });

  it("applies +3E memory and I/O contention across normal and special paging", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-contention-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    for (let tact = 100; tact < 140; tact++) {
      runtime.exports.spp3eSetContentionValue(tact, 6);
    }
    expect(runtime.exports.spp3eGetContentionValue(100)).toBe(6);

    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0x4000);
    expect(runtime.exports.spp3eGetTacts()).toBe(106);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(6);

    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0xc000);
    expect(runtime.exports.spp3eGetTacts()).toBe(100);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(0);

    runtime.exports.spp3eWritePort(0x7ffd, 0x04);
    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0xc000);
    expect(runtime.exports.spp3eGetTacts()).toBe(106);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(6);

    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayPortWrite(0xc0ff);
    expect(runtime.exports.spp3eGetTacts()).toBe(128);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(24);

    runtime.exports.spp3eWritePort(0x1ffd, 0x01);
    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0x4000);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(0);

    runtime.exports.spp3eWritePort(0x1ffd, 0x03);
    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0xc000);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(6);

    runtime.exports.spp3eWritePort(0x1ffd, 0x05);
    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0xc000);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBe(0);
  });

  it("exposes v2 test/control exports as callable loader exports", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-control-exports-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetContentionValue(100, 6);
    runtime.exports.spp3eSetTacts(100);
    runtime.exports.spp3eResetContentionCounters();
    runtime.exports.spp3eDelayAddressBusAccess(0x4000);
    runtime.exports.spp3eDelayPortRead(0xc0ff);
    runtime.exports.spp3eDelayPortWrite(0xc0ff);
    runtime.exports.spp3eSetCpuAf(0x1234);
    runtime.exports.spp3eSetCpuBc(0x2345);
    runtime.exports.spp3eSetCpuDe(0x3456);
    runtime.exports.spp3eSetCpuHl(0x4567);
    runtime.exports.spp3eSetCpuIx(0x5678);
    runtime.exports.spp3eSetCpuIy(0x6789);
    runtime.exports.spp3eSetCpuPc(0x0100);
    runtime.exports.spp3eSetCpuSp(0xff00);
    runtime.exports.spp3eFdcResetController();
    runtime.exports.spp3eFdcSelectDrive(0, 1);

    expect(runtime.exports.spp3eGetContentionValue(100)).toBe(6);
    expect(runtime.exports.spp3eGetCurrentFrameTact()).toBeGreaterThanOrEqual(106);
    expect(runtime.exports.spp3eGetTotalContentionDelaySinceStart()).toBeGreaterThanOrEqual(6);
    expect(runtime.exports.spp3eGetContentionDelaySincePause()).toBeGreaterThanOrEqual(0);
    expect(runtime.exports.spp3eGetCpuAf()).toBe(0x1234);
    expect(runtime.exports.spp3eGetCpuBc()).toBe(0x2345);
    expect(runtime.exports.spp3eGetCpuDe()).toBe(0x3456);
    expect(runtime.exports.spp3eGetCpuHl()).toBe(0x4567);
    expect(runtime.exports.spp3eGetCpuIx()).toBe(0x5678);
    expect(runtime.exports.spp3eGetCpuIy()).toBe(0x6789);
    expect(runtime.exports.spp3eGetCpuPc()).toBe(0x0100);
    expect(runtime.exports.spp3eGetCpuSp()).toBe(0xff00);
    expect(runtime.exports.spp3eGetCpuTacts()).toBe(runtime.exports.spp3eGetTacts());
    expect(runtime.exports.spp3eFdcGetCurrentDrive()).toBe(0);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBeGreaterThanOrEqual(0);
  });

  it("updates the keyboard matrix and reads selected rows from port 0xfe", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-keyboard-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetKeyStatus(0, 1);
    runtime.exports.spp3eSetKeyStatus(6, 1);

    expect(runtime.keyboardLines[0]).toBe(0x01);
    expect(runtime.keyboardLines[1]).toBe(0x02);
    expect(runtime.exports.spp3eGetKeyboardLine(0)).toBe(0x01);
    expect(runtime.exports.spp3eGetKeyboardLine(1)).toBe(0x02);
    expect(runtime.exports.spp3eReadPort(0xfefe)).toBe(0xbe);
    expect(runtime.exports.spp3eReadPort(0xfdfe)).toBe(0xbd);

    runtime.exports.spp3eSetKeyStatus(0, 0);

    expect(runtime.exports.spp3eGetKeyboardLine(0)).toBe(0x00);
    expect(runtime.exports.spp3eReadPort(0xfefe)).toBe(0xbf);
  });

  it("tracks 0xfe border, ear, mic, and beeper state", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-port-fe-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    expect(runtime.exports.spp3eGetBorderColor()).toBe(7);
    expect(runtime.exports.spp3eReadPort(0xfffe)).toBe(0xbf);

    runtime.exports.spp3eWritePort(0x00fe, 0x1d);

    expect(runtime.exports.spp3eGetPortFeValue()).toBe(0x1d);
    expect(runtime.exports.spp3eGetBorderColor()).toBe(5);
    expect(runtime.exports.spp3eGetEarBit()).toBe(1);
    expect(runtime.exports.spp3eGetMicBit()).toBe(1);
    expect(runtime.exports.spp3eGetBeeperLevel()).toBe(3);
    expect(runtime.exports.spp3eReadPort(0xfffe)).toBe(0xbf);
  });

  it("renders mid-frame 0xfe border color changes incrementally", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-port-fe-border-timing-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eUploadRomByte(0, 0x0000, 0x3e);
    runtime.exports.spp3eUploadRomByte(0, 0x0001, 0x01);
    runtime.exports.spp3eUploadRomByte(0, 0x0002, 0xd3);
    runtime.exports.spp3eUploadRomByte(0, 0x0003, 0xfe);
    runtime.exports.spp3eUploadRomByte(0, 0x0400, 0x3e);
    runtime.exports.spp3eUploadRomByte(0, 0x0401, 0x02);
    runtime.exports.spp3eUploadRomByte(0, 0x0402, 0xd3);
    runtime.exports.spp3eUploadRomByte(0, 0x0403, 0xfe);

    runtime.exports.spp3eExecuteFrame();

    const redBorderPixels = runtime.pixelBuffer.filter(pixel => pixel === 0xffaa0000).length;
    const blueBorderPixels = runtime.pixelBuffer.filter(pixel => pixel === 0xff0000aa).length;
    expect(redBorderPixels).toBeGreaterThan(0);
    expect(blueBorderPixels).toBeGreaterThan(0);
  });

  it("renders border and normal screen memory into the pixel buffer", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-render-normal-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eWritePort(0xfe, 0x01);
    runtime.exports.spp3eWriteRamBank(5, 0x0000, 0x80);
    runtime.exports.spp3eWriteRamBank(5, 0x1800, 0x47);
    runtime.exports.spp3eRenderInstantScreen();

    const width = runtime.exports.spp3eGetScreenWidth();
    const displayPixel = (48 * width) + 48;
    const nextPixel = displayPixel + 1;

    expect(runtime.pixelBuffer[0]).toBe(0xffaa0000);
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xffffffff);
    expect(runtime.pixelBuffer[nextPixel]).toBe(0xff000000);
  });

  it("renders shadow screen memory from bank 7 when selected", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-render-shadow-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eWriteRamBank(5, 0x0000, 0x80);
    runtime.exports.spp3eWriteRamBank(5, 0x1800, 0x47);
    runtime.exports.spp3eWriteRamBank(7, 0x0000, 0x80);
    runtime.exports.spp3eWriteRamBank(7, 0x1800, 0x42);
    runtime.exports.spp3eRenderInstantScreen();

    const width = runtime.exports.spp3eGetScreenWidth();
    const displayPixel = (48 * width) + 48;
    expect(runtime.exports.spp3eGetScreenBank()).toBe(5);
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xffffffff);

    runtime.exports.spp3eWritePort(0x7ffd, 0x08);
    runtime.exports.spp3eRenderInstantScreen();

    expect(runtime.exports.spp3eGetScreenBank()).toBe(7);
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xff0000ff);
  });

  it("applies FLASH attributes using the frame counter", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-flash-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eWriteRamBank(5, 0x0000, 0x80);
    runtime.exports.spp3eWriteRamBank(5, 0x1800, 0x87);
    runtime.exports.spp3eRenderInstantScreen();

    const width = runtime.exports.spp3eGetScreenWidth();
    const displayPixel = (48 * width) + 48;
    expect(runtime.pixelBuffer[displayPixel]).toBe(0xff000000);

    for (let i = 0; i < 17; i++) {
      runtime.exports.spp3eExecuteFrame();
    }
    runtime.exports.spp3eRenderInstantScreen();

    expect(runtime.pixelBuffer[displayPixel]).toBe(0xffaaaaaa);
  });

  it("returns +2/+3 floating bus values for eligible unsupported port reads", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-floating-bus-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    const displayB1Tact = findTact(runtime, 4);
    const fetchTact = findTact(runtime, 2);

    runtime.exports.spp3eSetLastContendedValue(0x56);
    runtime.exports.spp3eSetTacts(displayB1Tact + 3);
    expect(runtime.exports.spp3eReadFloatingBus()).toBe(0x57);
    expect(runtime.exports.spp3eReadPort(0x1235)).toBe(0x57);

    runtime.exports.spp3eSetLastUlaReadValue(0x42);
    runtime.exports.spp3eSetTacts(fetchTact + 3);
    expect(runtime.exports.spp3eReadFloatingBus()).toBe(0x42);
    expect(runtime.exports.spp3eReadPort(0x1235)).toBe(0x42);

    expect(runtime.exports.spp3eReadPort(0x001f)).toBe(0xff);
    runtime.exports.spp3eWritePort(0x7ffd, 0x20);
    expect(runtime.exports.spp3eReadPort(0x1235)).toBe(0xff);
  });

  it("generates beeper audio samples for active 0xfe output", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-beeper-audio-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetAudioSampleRate(1000);
    runtime.exports.spp3eWritePort(0x00fe, 0x18);
    runtime.exports.spp3eExecuteFrame();

    const sampleCount = runtime.exports.spp3eGetAudioSampleCount();
    expect(runtime.exports.spp3eGetAudioSampleRate()).toBe(1000);
    expect(sampleCount).toBeGreaterThan(0);
    expect(sampleCount).toBeLessThanOrEqual(runtime.exports.spp3eGetAudioSampleCapacity());
    expect(runtime.audioSamples.slice(0, sampleCount * 2).some(sample => sample !== 0)).toBe(true);
  });

  it("exposes +3E AY register masks through direct exports and ports", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-psg-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetPsgRegisterIndex(1);
    runtime.exports.spp3eWritePsgRegisterValue(0xff);

    expect(runtime.exports.spp3eGetPsgRegisterIndex()).toBe(1);
    expect(runtime.exports.spp3eGetPsgRegisterValue(1)).toBe(0xff);
    expect(runtime.exports.spp3eReadPsgRegisterValue()).toBe(0x0f);
    expect(runtime.exports.spp3eGetPsgToneA()).toBe(0x0f00);

    runtime.exports.spp3eSetPsgRegisterIndex(8);
    runtime.exports.spp3eWritePsgRegisterValue(0x1f);
    expect(runtime.exports.spp3eGetPsgVolumeA()).toBe(0x0f);

    runtime.exports.spp3eWritePort(0xfffd, 0x18);
    expect(runtime.exports.spp3eGetPsgRegisterIndex()).toBe(8);
    runtime.exports.spp3eWritePort(0xbffd, 0x07);
    expect(runtime.exports.spp3eReadPort(0xfffd)).toBe(0x07);
  });

  it("mixes configured AY output into the stereo audio buffer", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-psg-audio-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetAudioSampleRate(1000);
    runtime.exports.spp3eSetPsgRegisterIndex(0);
    runtime.exports.spp3eWritePsgRegisterValue(4);
    runtime.exports.spp3eSetPsgRegisterIndex(7);
    runtime.exports.spp3eWritePsgRegisterValue(0x3e);
    runtime.exports.spp3eSetPsgRegisterIndex(8);
    runtime.exports.spp3eWritePsgRegisterValue(0x0f);
    runtime.exports.spp3eExecuteFrame();

    const sampleCount = runtime.exports.spp3eGetAudioSampleCount();
    expect(sampleCount).toBeGreaterThan(0);
    expect(runtime.exports.spp3eGetPsgCurrentOutput()).toBeGreaterThanOrEqual(0);
    expect(runtime.audioSamples.slice(0, sampleCount * 2).some(sample => sample !== 0)).toBe(true);
  });

  it("publishes tape upload metadata and routes tape EAR while loading", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-tape-load-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    expect(runtime.exports.spp3eTapeBeginUpload(1, 3)).toBe(1);
    expect(runtime.exports.spp3eTapeSetBlock(0, 0, 3, 1000)).toBe(1);
    expect(runtime.exports.spp3eTapeWriteData(0, 0x13)).toBe(1);
    expect(runtime.exports.spp3eTapeWriteData(1, 0x37)).toBe(1);
    expect(runtime.exports.spp3eTapeWriteData(2, 0x42)).toBe(1);
    expect(runtime.exports.spp3eTapeFinishUpload()).toBe(1);

    expect(runtime.tapeData.slice(0, 3)).toEqual(new Uint8Array([0x13, 0x37, 0x42]));
    expect(runtime.exports.spp3eTapeGetBlockCount()).toBe(1);
    expect(runtime.exports.spp3eTapeGetDataLength()).toBe(3);
    expect(runtime.exports.spp3eTapeGetBlockOffset(0)).toBe(0);
    expect(runtime.exports.spp3eTapeGetBlockLength(0)).toBe(3);
    expect(runtime.exports.spp3eTapeGetBlockPauseAfter(0)).toBe(1000);
    expect(runtime.exports.spp3eTapeGetLoaded()).toBe(1);
    expect(runtime.exports.spp3eTapeGetEof()).toBe(0);

    runtime.exports.spp3eTapeSetMode(1);
    expect(runtime.exports.spp3eTapeGetMode()).toBe(1);
    expect(runtime.exports.spp3eTapeGetCurrentEarBit()).toBe(1);
    expect(runtime.exports.spp3eReadPort(0xfffe) & 0x40).toBe(0x40);

    runtime.exports.spp3eSetTacts(2169);
    expect(runtime.exports.spp3eTapeGetCurrentEarBit()).toBe(0);
    expect(runtime.exports.spp3eReadPort(0xfffe) & 0x40).toBe(0x00);

    runtime.exports.spp3eTapeSetFastLoad(0);
    expect(runtime.exports.spp3eTapeGetFastLoad()).toBe(0);
    runtime.exports.spp3eTapeRewind();
    expect(runtime.exports.spp3eTapeGetCurrentBlockIndex()).toBe(0);
    expect(runtime.exports.spp3eTapeGetMode()).toBe(0);

    runtime.exports.spp3eWritePort(0x1ffd, 0x04);
    runtime.exports.spp3eWritePort(0x7ffd, 0x10);
    expect(runtime.exports.spp3eGetSelectedRom()).toBe(3);
    runtime.exports.spp3eSetCpuPc(0x056c);
    runtime.exports.spp3eExecuteInstruction();

    expect(runtime.exports.spp3eTapeGetMode()).toBe(1);
    expect(runtime.exports.spp3eTapeGetCurrentEarBit()).toBe(1);
  });

  it("publishes tape save bytes and saved block metadata", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-tape-save-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    const startRevision = runtime.exports.spp3eTapeGetSavedRevision();
    runtime.exports.spp3eTapeClearSavedBlocks();
    expect(runtime.exports.spp3eTapeAppendSavedByte(0xa5)).toBe(1);
    expect(runtime.exports.spp3eTapeAppendSavedByte(0x5a)).toBe(1);

    expect(runtime.tapeSaveData.slice(0, 2)).toEqual(new Uint8Array([0xa5, 0x5a]));
    expect(runtime.exports.spp3eTapeGetSavedBlockCount()).toBe(1);
    expect(runtime.exports.spp3eTapeGetSavedDataLength()).toBe(2);
    expect(runtime.exports.spp3eTapeGetSavedBlockOffset(0)).toBe(0);
    expect(runtime.exports.spp3eTapeGetSavedBlockLength(0)).toBe(2);
    expect(runtime.exports.spp3eTapeGetSavedRevision()).toBeGreaterThan(startRevision);
  });

  it("returns 0xff from FDC ports when no floppy drive is enabled", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-no-fdd-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetFdcEnabledDriveCount(0);

    expect(runtime.exports.spp3eGetFdcEnabledDriveCount()).toBe(0);
    expect(runtime.exports.spp3eReadPort(0x2ffd)).toBe(0xff);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0xff);
    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0xff);
  });

  it("exposes FDC reset, result phase, and data register state", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-fdc-reset-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();

    expect(runtime.exports.spp3eGetDiskDriveCount()).toBe(2);
    expect(runtime.exports.spp3eGetFdcEnabledDriveCount()).toBe(1);
    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0x80);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(0);
    expect(runtime.exports.spp3eFdcGetCurrentDrive()).toBe(0);
    expect(runtime.exports.spp3eReadPort(0x2ffd)).toBe(0x80);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0xff);

    runtime.exports.spp3eFdcSetResultPhase(1, 0x5a);

    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0xd0);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(2);
    expect(runtime.exports.spp3eFdcGetResultBytesLeft()).toBe(1);
    expect(runtime.exports.spp3eFdcGetResultRegister(0)).toBe(0x5a);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x5a);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(0);
    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0x80);

    runtime.exports.spp3eWritePort(0x3ffd, 0xa9);

    expect(runtime.exports.spp3eFdcGetCommandRegister()).toBe(0xa9);
    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(10);
    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0xd0);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x80);
  });

  it("uploads and ejects disk media for drive B with write-protect state", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-disk-b-upload-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetFdcEnabledDriveCount(2);
    const startRevision = runtime.exports.spp3eDiskGetRevision(1);

    expect(runtime.exports.spp3eDiskBeginUpload(1, 4, 1, 40, 1)).toBe(1);
    expect(runtime.exports.spp3eDiskWriteData(1, 0, 0x44)).toBe(1);
    expect(runtime.exports.spp3eDiskWriteData(1, 1, 0x53)).toBe(1);
    expect(runtime.exports.spp3eDiskWriteData(1, 2, 0x4b)).toBe(1);
    expect(runtime.exports.spp3eDiskWriteData(1, 3, 0x21)).toBe(1);
    expect(runtime.exports.spp3eDiskFinishUpload(1)).toBe(1);

    expect(runtime.diskBData.slice(0, 4)).toEqual(new Uint8Array([0x44, 0x53, 0x4b, 0x21]));
    expect(runtime.exports.spp3eDiskReadData(1, 2)).toBe(0x4b);
    expect(runtime.exports.spp3eDiskGetLoaded(1)).toBe(1);
    expect(runtime.exports.spp3eDiskGetLength(1)).toBe(4);
    expect(runtime.exports.spp3eDiskGetWriteProtected(1)).toBe(1);
    expect(runtime.exports.spp3eDiskGetHasTwoHeads(1)).toBe(0);
    expect(runtime.exports.spp3eDiskGetMaxCylinders(1)).toBe(40);
    expect(runtime.exports.spp3eDiskGetRevision(1)).toBe(startRevision + 1);

    runtime.exports.spp3eDiskSetWriteProtected(1, 0);
    expect(runtime.exports.spp3eDiskGetWriteProtected(1)).toBe(0);
    expect(runtime.exports.spp3eDiskGetRevision(1)).toBe(startRevision + 2);

    runtime.exports.spp3eDiskEject(1);
    expect(runtime.exports.spp3eDiskGetLoaded(1)).toBe(0);
    expect(runtime.exports.spp3eDiskGetReady(1)).toBe(0);
    expect(runtime.exports.spp3eDiskGetWriteProtected(1)).toBe(0);
  });

  it("tracks drive selection, head load, motor speed, and ready state per frame", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-disk-drive-state-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetFdcEnabledDriveCount(2);
    runtime.exports.spp3eDiskBeginUpload(0, 1, 0, 42, 2);
    runtime.exports.spp3eDiskWriteData(0, 0, 0xee);
    runtime.exports.spp3eDiskFinishUpload(0);

    runtime.exports.spp3eFdcSelectDrive(0, 1);

    expect(runtime.exports.spp3eFdcGetCurrentDrive()).toBe(0);
    expect(runtime.exports.spp3eDiskGetSelected(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetSelected(1)).toBe(0);
    expect(runtime.exports.spp3eDiskGetCurrentHead(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetHeadLoaded(0)).toBe(1);
    expect(runtime.exports.spp3eDiskGetTrack0(0)).toBe(1);
    expect(runtime.exports.spp3eFdcGetStatusRegister3() & 0x5c).toBe(0x1c);

    runtime.exports.spp3eWritePort(0x1ffd, 0x08);
    expect(runtime.exports.spp3eGetDiskMotorOn()).toBe(1);
    expect(runtime.exports.spp3eDiskGetMotorOn(0)).toBe(1);

    runtime.exports.spp3eExecuteFrame();
    expect(runtime.exports.spp3eDiskGetMotorSpeed(0)).toBe(2);
    expect(runtime.exports.spp3eDiskGetReady(0)).toBe(0);

    for (let i = 0; i < 49; i++) {
      runtime.exports.spp3eExecuteFrame();
    }

    expect(runtime.exports.spp3eDiskGetMotorSpeed(0)).toBe(100);
    expect(runtime.exports.spp3eDiskGetReady(0)).toBe(1);
    expect(runtime.exports.spp3eFdcGetStatusRegister3() & 0x20).toBe(0x20);

    runtime.exports.spp3eWritePort(0x1ffd, 0x00);
    runtime.exports.spp3eExecuteFrame();

    expect(runtime.exports.spp3eGetDiskMotorOn()).toBe(0);
    expect(runtime.exports.spp3eDiskGetMotorOn(0)).toBe(0);
    expect(runtime.exports.spp3eDiskGetMotorSpeed(0)).toBe(98);
    expect(runtime.exports.spp3eDiskGetReady(0)).toBe(0);
  });

  it("executes representative FDC specify, sense drive, seek, and sense interrupt commands", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-fdc-control-commands-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetFdcEnabledDriveCount(2);
    runtime.exports.spp3eDiskBeginUpload(1, 1, 1, 42, 2);
    runtime.exports.spp3eDiskWriteData(1, 0, 0xee);
    runtime.exports.spp3eDiskFinishUpload(1);

    runtime.exports.spp3eWritePort(0x3ffd, 0x03);
    runtime.exports.spp3eWritePort(0x3ffd, 0xdf);
    runtime.exports.spp3eWritePort(0x3ffd, 0x03);

    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(7);
    expect(runtime.exports.spp3eFdcGetStepRate()).toBe(3);
    expect(runtime.exports.spp3eFdcGetHeadUnloadTime()).toBe(240);
    expect(runtime.exports.spp3eFdcGetHeadLoadTime()).toBe(1);
    expect(runtime.exports.spp3eFdcGetNonDmaMode()).toBe(1);
    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0x80);

    runtime.exports.spp3eWritePort(0x3ffd, 0x04);
    runtime.exports.spp3eWritePort(0x3ffd, 0x05);

    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(8);
    expect(runtime.exports.spp3eFdcGetCurrentDrive()).toBe(1);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(2);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x5d);

    runtime.exports.spp3eWritePort(0x3ffd, 0x0f);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    runtime.exports.spp3eWritePort(0x3ffd, 0x12);

    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(9);
    expect(runtime.exports.spp3eDiskGetCurrentCylinder(1)).toBe(0x12);
    expect(runtime.exports.spp3eDiskGetTrack0(1)).toBe(0);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(0);

    runtime.exports.spp3eWritePort(0x3ffd, 0x08);

    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(6);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x21);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x12);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(0);
  });

  it("returns FDC Sense Drive results for absent and empty drive B", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-fdc-sense-drive-count-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eSetFdcEnabledDriveCount(1);
    runtime.exports.spp3eWritePort(0x3ffd, 0x04);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x00);

    runtime.exports.spp3eSetFdcEnabledDriveCount(2);
    runtime.exports.spp3eWritePort(0x3ffd, 0x04);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x59);
  });

  it("transfers FDC read/write data and journals dirty disk ranges", async () => {
    buildSpP3eWasm();
    const runtime = await loadSpP3eWasmV2({
      artifactName: "test-spp3e-fdc-data-commands-v2.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });

    runtime.exports.spp3eHardReset();
    runtime.exports.spp3eDiskBeginUpload(0, 128, 0, 42, 2);
    runtime.exports.spp3eDiskWriteData(0, 0, 0x9a);
    runtime.exports.spp3eDiskFinishUpload(0);
    runtime.exports.spp3eWritePort(0x1ffd, 0x08);
    for (let i = 0; i < 50; i++) {
      runtime.exports.spp3eExecuteFrame();
    }

    runtime.exports.spp3eWritePort(0x3ffd, 0x46);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    runtime.exports.spp3eWritePort(0x3ffd, 0x1b);
    runtime.exports.spp3eWritePort(0x3ffd, 0xff);

    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(0);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(1);
    expect(runtime.exports.spp3eFdcGetMainStatusRegister()).toBe(0xf0);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x9a);
    for (let i = 1; i < 128; i++) {
      runtime.exports.spp3eReadPort(0x3ffd);
    }
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(2);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x00);
    for (let i = 1; i < 7; i++) {
      runtime.exports.spp3eReadPort(0x3ffd);
    }

    runtime.exports.spp3eWritePort(0x3ffd, 0x45);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    runtime.exports.spp3eWritePort(0x3ffd, 0x01);
    runtime.exports.spp3eWritePort(0x3ffd, 0x1b);
    runtime.exports.spp3eWritePort(0x3ffd, 0xff);

    const revision = runtime.exports.spp3eFdcGetDirtyRevision();
    expect(runtime.exports.spp3eFdcGetCommandId()).toBe(1);
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(1);
    runtime.exports.spp3eWritePort(0x3ffd, 0x77);
    for (let i = 1; i < 128; i++) {
      runtime.exports.spp3eWritePort(0x3ffd, 0x00);
    }

    expect(runtime.exports.spp3eDiskReadData(0, 0)).toBe(0x77);
    expect(runtime.exports.spp3eFdcGetDirtyDrive()).toBe(0);
    expect(runtime.exports.spp3eFdcGetDirtyOffset()).toBe(0);
    expect(runtime.exports.spp3eFdcGetDirtyLength()).toBe(128);
    expect(runtime.exports.spp3eFdcGetDirtyRevision()).toBe(revision + 1);
    expect(runtime.diskChanges.slice(0, 8)).toEqual(new Uint8Array([0, 0, 0, 0, 128, 0, 0, 0]));
    expect(runtime.exports.spp3eFdcGetOperationPhase()).toBe(2);
    expect(runtime.exports.spp3eReadPort(0x3ffd)).toBe(0x00);
  });

  it("rejects artifacts without WebAssembly memory", () => {
    expect(() => validateSpP3eWasmV2Exports({})).toThrow(
      `ZX Spectrum +3E WASM v2 artifact '${SPP3E_WASM_V2_ARTIFACT_NAME}' is missing WebAssembly memory.`
    );
  });

  it("rejects artifacts missing required exports", () => {
    expect(() => validateSpP3eWasmV2Exports({
      memory: new WebAssembly.Memory({ initial: 1 })
    })).toThrow("missing export 'spp3eMemoryPtr'");
  });

  it("rejects typed views outside WASM memory", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const fn = () => 0;
    const exports = {
      memory,
      spp3eMemoryPtr: () => memory.buffer.byteLength - 4,
      spp3eRamPtr: fn,
      spp3eRomPtr: fn,
      spp3ePixelBufferPtr: fn,
      spp3eAudioSamplesPtr: fn,
      spp3eKeyboardLinesPtr: fn,
      spp3eDiskDataPtr: fn,
      spp3eDiskBDataPtr: fn,
      spp3eDiskChangesPtr: fn,
      spp3eDiskBChangesPtr: fn,
      spp3eTapeDataPtr: fn,
      spp3eTapeSaveDataPtr: fn,
      spp3eGetMemorySize: () => 8,
      spp3eGetRamSize: fn,
      spp3eGetRomSize: fn,
      spp3eGetScreenWidth: fn,
      spp3eGetScreenHeight: fn,
      spp3eGetPixelBufferStartOffset: fn,
      spp3eGetAudioSampleCapacity: fn,
      spp3eGetDiskDataCapacity: fn,
      spp3eGetDiskChangeCapacity: fn,
      spp3eGetTapeDataCapacity: fn,
      spp3eGetTapeSaveDataCapacity: fn
    } as unknown as SpP3eWasmV2Exports;

    expect(() => createSpP3eWasmV2Views(exports, "bad-spp3e.wasm")).toThrow(
      "exposes memory outside WASM memory"
    );
  });
});
