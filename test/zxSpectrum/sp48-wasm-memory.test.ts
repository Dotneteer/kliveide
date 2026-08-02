import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";

import { readFileSync } from "node:fs";

import { MC_MEM_SIZE } from "@common/machines/constants";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";
import { loadSp48Wasm, resetSp48WasmModuleCache } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";
import { SP48_WASM_LAYOUT } from "@emu/machines/zxSpectrum48/wasm/sp48-wasm-layout.generated";
import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";
import { afterEach, describe, expect, it } from "vitest";

class TestTypeScript48Machine extends ZxSpectrum48Machine {
  constructor(modelInfo?: MachineModel, config?: MachineConfigSet) {
    super(modelInfo, config);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return testRom();
  }
}

class TestWasm48Machine extends ZxSpectrum48WasmMachine {
  constructor(modelInfo?: MachineModel, config?: MachineConfigSet) {
    super(modelInfo, config, actualLoaderOptions());
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return testRom();
  }
}

describe("ZX Spectrum 48K WASM memory/reset/snapshot", () => {
  afterEach(() => resetSp48WasmModuleCache());

  it("exposes 64K ROM/RAM storage through a linear-memory view", async () => {
    const runtime = await actualRuntime("p1-memory.wasm");
    const wasm = runtime.exports;

    expect(runtime.memory).toHaveLength(0x10000);
    expect(wasm.sp48_memory_size()).toBe(0x10000);

    wasm.sp48_load_rom_byte(0x0001, 0xaa);
    wasm.sp48_write_memory(0x4000, 0x55);
    wasm.sp48_write_memory(0xffff, 0x66);

    expect(runtime.memory[0x0001]).toBe(0xaa);
    expect(runtime.memory[0x4000]).toBe(0x55);
    expect(runtime.memory[0xffff]).toBe(0x66);
    expect(wasm.sp48_read_memory(0x1_ffff)).toBe(0x66);
  });

  it("protects ROM and 16K-model upper RAM while preserving patch helpers", async () => {
    const runtime = await actualRuntime("p1-protection.wasm");
    const wasm = runtime.exports;

    wasm.sp48_load_rom_byte(0x0002, 0x12);
    wasm.sp48_write_memory(0x0002, 0x34);
    expect(runtime.memory[0x0002]).toBe(0x12);

    wasm.sp48_patch_memory(0x0002, 0x34);
    expect(runtime.memory[0x0002]).toBe(0x34);

    wasm.sp48_set_16k_model(1);
    wasm.sp48_reset();
    expect(runtime.memory[0x7fff]).toBe(0x00);
    expect(runtime.memory[0x8000]).toBe(0xff);
    wasm.sp48_write_memory(0x8000, 0x77);
    expect(runtime.memory[0x8000]).toBe(0xff);
    wasm.sp48_patch_memory(0x8000, 0x77);
    expect(runtime.memory[0x8000]).toBe(0x77);
  });

  it("matches TypeScript memory behavior after setup and hard reset", async () => {
    const model16k = model({ [MC_MEM_SIZE]: 16 });
    const ts = new TestTypeScript48Machine(model16k);
    const wasm = new TestWasm48Machine(model16k);

    await ts.setup();
    await wasm.setup();

    expect(Array.from(wasm.get64KFlatMemory().subarray(0, 0x4000))).toEqual(Array.from(ts.get64KFlatMemory().subarray(0, 0x4000)));

    ts.hardReset();
    wasm.hardReset();
    expect(wasm.doReadMemory(0x4000)).toBe(ts.doReadMemory(0x4000));
    expect(wasm.doReadMemory(0x7fff)).toBe(ts.doReadMemory(0x7fff));
    expect(wasm.doReadMemory(0x8000)).toBe(ts.doReadMemory(0x8000));
    expect(wasm.doReadMemory(0xffff)).toBe(ts.doReadMemory(0xffff));
  });

  it("routes adapter reads and writes through WASM linear memory", async () => {
    const machine = new TestWasm48Machine();
    await machine.setup();

    machine.doWriteMemory(0x0000, 0x11);
    expect(machine.doReadMemory(0x0000)).toBe(testRom()[0]);

    machine.doWriteMemory(0x4000, 0x22);
    expect(machine.wasmRuntime!.memory[0x4000]).toBe(0x22);
    expect(machine.get64KFlatMemory()[0x4000]).toBe(0x22);

    machine.patchMemory(0x0000, 0x33);
    expect(machine.doReadMemory(0x0000)).toBe(0x33);
  });

  it("round-trips snapshot memory and machine state through packed blocks", async () => {
    const machine = new TestWasm48Machine();
    await machine.setup();

    machine.doWriteMemory(0x4000, 0x44);
    machine.wasmRuntime!.exports.sp48_write_port(0x00fe, 0x07);
    const snapshot = machine.exportWasmSnapshot();

    machine.doWriteMemory(0x4000, 0x55);
    machine.wasmRuntime!.exports.sp48_write_port(0x00fe, 0x02);
    machine.importWasmSnapshot(snapshot);

    expect(machine.doReadMemory(0x4000)).toBe(0x44);
    expect(machine.wasmRuntime!.machineState.getUint8(SP48_WASM_LAYOUT.machineStateUlaPortOffset)).toBe(0x07);
  });

  it("reports bounded dirty ranges for C-side memory changes", async () => {
    const machine = new TestWasm48Machine();
    await machine.setup();
    machine.clearWasmDirtyRanges();

    machine.doWriteMemory(0x4000, 0x10);
    machine.doWriteMemory(0x4005, 0x11);
    machine.patchMemory(0x0001, 0x12);

    expect(machine.getWasmDirtyRanges()).toEqual([
      { start: 0x4000, length: 1 },
      { start: 0x4005, length: 1 },
      { start: 0x0001, length: 1 }
    ]);

    machine.clearWasmDirtyRanges();
    expect(machine.getWasmDirtyRanges()).toEqual([]);
  });
});

async function actualRuntime(artifactName: string) {
  buildSp48Wasm();
  return await loadSp48Wasm({
    ...actualLoaderOptions(),
    artifactName
  });
}

function actualLoaderOptions(): Sp48WasmLoaderOptions {
  return {
    artifactName: "p1-adapter.wasm",
    readArtifact: async () => readFileSync(output)
  };
}

function model(config: MachineConfigSet): MachineModel {
  return {
    modelId: "test-sp48",
    displayName: "Test Spectrum 48K",
    config
  };
}

function testRom(): Uint8Array {
  return Uint8Array.from({ length: 0x4000 }, (_, index) => index & 0xff);
}
