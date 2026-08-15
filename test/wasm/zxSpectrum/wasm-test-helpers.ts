import { readFileSync } from "node:fs";

import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { expect } from "vitest";
import { buildSp128Wasm, productionOutput as sp128WasmOutput } from "../../../scripts/build-sp128-wasm.cjs";
import { buildSp48Wasm, productionOutput as sp48WasmOutput } from "../../../scripts/build-sp48-wasm.cjs";
import { buildSpP3eWasm, productionOutput as spp3eWasmOutput } from "../../../scripts/build-spp3e-wasm.cjs";
import { SP128_IMPLEMENTATION } from "@emu/machines/zxSpectrum128/ZxSpectrum128Implementation";
import { SP48_IMPLEMENTATION } from "@emu/machines/zxSpectrum48/ZxSpectrum48Implementation";
import { SPP3E_IMPLEMENTATION } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";

type BuildCacheKey = "sp48" | "sp128" | "spp3e";

export type SpectrumModelId = BuildCacheKey;

export type TestCpuRegisters = Partial<{
  af: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  iy: number;
  ir: number;
  pc: number;
  sp: number;
  iff1: boolean;
  interruptMode: number;
  halted: boolean;
  tacts: number;
}>;

export type TestCpuRegisterSnapshot = Required<TestCpuRegisters>;

export type TestPagingState = {
  selectedRomPage: number;
  selectedRamBank: number;
  pagingEnabled?: boolean;
  useShadowScreen?: boolean;
  inSpecialPagingMode?: boolean;
  specialConfigMode?: number;
  diskMotorOn?: boolean;
  fdcCurrentDrive?: number;
  fdcOperationPhase?: number;
};

export type P3eTestMachineOptions = {
  artifactName?: string;
  config?: MachineConfigSet;
  diskSupport?: 0 | 1 | 2;
  modelInfo?: MachineModel;
};

export type SpectrumModelCase = {
  id: SpectrumModelId;
  name: string;
  createWasmMachine: () => Promise<TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine>;
  createOracleMachine: () => Promise<TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine>;
};

const DEFAULT_P3E_MODEL: MachineModel = {
  modelId: "spp3e",
  displayName: "ZX Spectrum +3E",
  config: {}
};

const builtArtifacts: Partial<Record<BuildCacheKey, boolean>> = {};

/**
 * Builds all Spectrum WASM artifacts used by shared tests.
 */
export function buildSpectrumWasmArtifacts(force = false): void {
  buildSp48WasmArtifact(force);
  buildSp128WasmArtifact(force);
  buildSpP3eWasmArtifact(force);
}

export function buildSp48WasmArtifact(force = false): void {
  if (!force && builtArtifacts.sp48) return;
  buildSp48Wasm();
  builtArtifacts.sp48 = true;
}

export function buildSp128WasmArtifact(force = false): void {
  if (!force && builtArtifacts.sp128) return;
  buildSp128Wasm();
  builtArtifacts.sp128 = true;
}

export function buildSpP3eWasmArtifact(force = false): void {
  if (!force && builtArtifacts.spp3e) return;
  buildSpP3eWasm();
  builtArtifacts.spp3e = true;
}

export function testRom(bytes: number[], size = 0x4000): Uint8Array {
  const rom = new Uint8Array(size);
  rom.set(bytes.slice(0, size));
  return rom;
}

export class TestSp48WasmMachine extends ZxSpectrum48WasmV2Machine {
  constructor (
    private readonly rom: Uint8Array = testRom([]),
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(
      modelInfo,
      {
        [SP48_IMPLEMENTATION]: "wasm",
        ...(config ?? {})
      },
      {
        artifactName: "test-sp48-machine-v2.wasm",
        readArtifact: async () => readFileSync(sp48WasmOutput)
      }
    );
  }

  protected override async loadRomFromResource(_romName: string, _page = -1): Promise<Uint8Array> {
    return this.rom;
  }

  initCode (code: number[], startAddress: number): void {
    initWasmCodeBytes(this, "sp48", code, startAddress);
  }

  setFrameTact (frameTact: number): void {
    setWasmAbsoluteTacts(this, "sp48", frameTact);
  }

  executeOne (): void {
    executeWasmInstruction(this, "sp48");
  }

  uploadTestRom (rom = this.rom): void {
    this.uploadRomBytes(rom);
  }

  readTestMemory (address: number): number {
    return this.wasmV2Runtime!.exports.sp48ReadMemory(address & 0xffff);
  }

  writeTestMemory (address: number, value: number): void {
    this.wasmV2Runtime!.exports.sp48WriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort (address: number): number {
    return this.wasmV2Runtime!.exports.sp48ReadPort(address & 0xffff);
  }

  writeTestPort (address: number, value: number): void {
    this.wasmV2Runtime!.exports.sp48WritePort(address & 0xffff, value & 0xff);
    this.getCpuState();
  }

  getTestCpuRegisters (): TestCpuRegisterSnapshot {
    return getWasmCpuRegisters(this, "sp48");
  }

  setTestCpuRegisters (registers: TestCpuRegisters): void {
    setWasmCpuRegisters(this, "sp48", registers);
  }

  setAbsoluteTacts (value: number): void {
    setWasmAbsoluteTacts(this, "sp48", value);
  }

  getCurrentFrameTactForTest (): number {
    return callWasmExport(this, "sp48GetCurrentFrameTact")();
  }

  getContentionDelayTotalForTest (): number {
    return callWasmExport(this, "sp48GetTotalContentionDelaySinceStart")();
  }

  getContentionValueForTest (tact: number): number {
    return callWasmExport(this, "sp48GetContentionValue")(tact);
  }

  getTestPagingState (): TestPagingState {
    return {
      selectedRomPage: 0,
      selectedRamBank: 0
    };
  }

  resetContentionCounters (): void {
    resetWasmContentionCounters(this, "sp48");
  }

  setContentionRange (startTact: number, count: number, value: number): void {
    setWasmContentionRange(this, "sp48", startTact, count, value);
  }
}

export class TestSp128WasmMachine extends ZxSpectrum128WasmV2Machine {
  constructor (
    private readonly rom0: Uint8Array = testRom([]),
    private readonly rom1: Uint8Array = testRom([]),
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(
      modelInfo,
      {
        [SP128_IMPLEMENTATION]: "wasm",
        ...(config ?? {})
      },
      {
        artifactName: "test-sp128-machine-v2.wasm",
        readArtifact: async () => readFileSync(sp128WasmOutput)
      }
    );
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return page === 1 ? this.rom1 : this.rom0;
  }

  initCode (code: number[], startAddress: number): void {
    initWasmCodeBytes(this, "sp128", code, startAddress);
  }

  setFrameTact (frameTact: number): void {
    setWasmAbsoluteTacts(this, "sp128", frameTact);
  }

  executeOne (): void {
    executeWasmInstruction(this, "sp128");
  }

  uploadTestRom (rom: Uint8Array, page = 0): void {
    this.uploadRomBytes(page === 1 ? -2 : -1, rom);
  }

  readTestMemory (address: number): number {
    return this.wasmV2Runtime!.exports.sp128ReadMemory(address & 0xffff);
  }

  writeTestMemory (address: number, value: number): void {
    this.wasmV2Runtime!.exports.sp128WriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort (address: number): number {
    return this.wasmV2Runtime!.exports.sp128ReadPort(address & 0xffff);
  }

  writeTestPort (address: number, value: number): void {
    this.wasmV2Runtime!.exports.sp128WritePort(address & 0xffff, value & 0xff);
    this.getCpuState();
  }

  getTestCpuRegisters (): TestCpuRegisterSnapshot {
    return getWasmCpuRegisters(this, "sp128");
  }

  setTestCpuRegisters (registers: TestCpuRegisters): void {
    setWasmCpuRegisters(this, "sp128", registers);
  }

  setAbsoluteTacts (value: number): void {
    setWasmAbsoluteTacts(this, "sp128", value);
  }

  getCurrentFrameTactForTest (): number {
    return this.wasmV2Runtime!.exports.sp128GetCurrentFrameTact();
  }

  getContentionDelayTotalForTest (): number {
    return this.wasmV2Runtime!.exports.sp128GetTotalContentionDelaySinceStart();
  }

  getContentionValueForTest (tact: number): number {
    return this.wasmV2Runtime!.exports.sp128GetContentionValue(tact);
  }

  getTestPagingState (): TestPagingState {
    const wasm = this.wasmV2Runtime!.exports;
    return {
      selectedRomPage: wasm.sp128GetSelectedRom(),
      selectedRamBank: wasm.sp128GetSelectedBank(),
      pagingEnabled: wasm.sp128GetPagingEnabled() !== 0,
      useShadowScreen: wasm.sp128GetUseShadowScreen() !== 0
    };
  }

  resetContentionCounters (): void {
    resetWasmContentionCounters(this, "sp128");
  }

  setContentionRange (startTact: number, count: number, value: number): void {
    setWasmContentionRange(this, "sp128", startTact, count, value);
  }
}

export class TestSpp3eWasmMachine extends ZxSpectrumP3eWasmV2Machine {
  constructor (
    private readonly romPages: Uint8Array[] = [testRom([]), testRom([]), testRom([]), testRom([])],
    options: P3eTestMachineOptions = {}
  ) {
    super(
      options.modelInfo ?? DEFAULT_P3E_MODEL,
      {
        [SPP3E_IMPLEMENTATION]: "wasm",
        [MC_DISK_SUPPORT]: options.diskSupport ?? 2,
        ...(options.config ?? {})
      },
      {
        artifactName: options.artifactName ?? "test-spp3e-machine-v2.wasm",
        readArtifact: async () => readFileSync(spp3eWasmOutput)
      }
    );
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return this.romPages[page] ?? testRom([]);
  }

  initCode (code: number[], startAddress: number): void {
    initWasmCodeBytes(this, "spp3e", code, startAddress);
  }

  setFrameTact (frameTact: number): void {
    setWasmAbsoluteTacts(this, "spp3e", frameTact);
  }

  executeOne (): void {
    executeWasmInstruction(this, "spp3e");
  }

  uploadTestRom (rom: Uint8Array, page = 0): void {
    this.uploadRomBytes(-(page + 1), rom);
  }

  readTestMemory (address: number): number {
    return this.wasmV2Runtime!.exports.spp3eReadMemory(address & 0xffff);
  }

  writeTestMemory (address: number, value: number): void {
    this.wasmV2Runtime!.exports.spp3eWriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort (address: number): number {
    return this.wasmV2Runtime!.exports.spp3eReadPort(address & 0xffff);
  }

  writeTestPort (address: number, value: number): void {
    this.wasmV2Runtime!.exports.spp3eWritePort(address & 0xffff, value & 0xff);
    this.getCpuState();
  }

  getTestCpuRegisters (): TestCpuRegisterSnapshot {
    return getWasmCpuRegisters(this, "spp3e");
  }

  setTestCpuRegisters (registers: TestCpuRegisters): void {
    setWasmCpuRegisters(this, "spp3e", registers);
  }

  setAbsoluteTacts (value: number): void {
    setWasmAbsoluteTacts(this, "spp3e", value);
  }

  getCurrentFrameTactForTest (): number {
    return this.wasmV2Runtime!.exports.spp3eGetCurrentFrameTact();
  }

  getContentionDelayTotalForTest (): number {
    return this.wasmV2Runtime!.exports.spp3eGetTotalContentionDelaySinceStart();
  }

  getContentionValueForTest (tact: number): number {
    return this.wasmV2Runtime!.exports.spp3eGetContentionValue(tact);
  }

  getTestPagingState (): TestPagingState {
    this.getCpuState();
    const wasm = this.wasmV2Runtime!.exports;
    return {
      selectedRomPage: wasm.spp3eGetSelectedRom(),
      selectedRamBank: wasm.spp3eGetSelectedBank(),
      pagingEnabled: wasm.spp3eGetPagingEnabled() !== 0,
      useShadowScreen: wasm.spp3eGetUseShadowScreen() !== 0,
      inSpecialPagingMode: wasm.spp3eGetInSpecialPagingMode() !== 0,
      specialConfigMode: wasm.spp3eGetSpecialConfigMode(),
      diskMotorOn: wasm.spp3eGetDiskMotorOn() !== 0,
      fdcCurrentDrive: wasm.spp3eFdcGetCurrentDrive(),
      fdcOperationPhase: wasm.spp3eFdcGetOperationPhase()
    };
  }

  resetContentionCounters (): void {
    resetWasmContentionCounters(this, "spp3e");
  }

  setContentionRange (startTact: number, count: number, value: number): void {
    setWasmContentionRange(this, "spp3e", startTact, count, value);
  }
}

export class TestOracleSp48Machine extends ZxSpectrum48Machine {
  constructor (
    private readonly rom: Uint8Array = testRom([]),
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(modelInfo, {
      [SP48_IMPLEMENTATION]: "typescript",
      ...(config ?? {})
    });
  }

  protected override async loadRomFromResource(_romName: string, _page = -1): Promise<Uint8Array> {
    return this.rom;
  }

  initCode (code: number[], startAddress: number): void {
    initCodeBytes(this, code, startAddress);
  }

  setFrameTact (frameTact: number): void {
    setMachineFrameTact(this, frameTact);
  }

  executeOne (): void {
    this.executeCpuCycle();
  }

  uploadTestRom (rom = this.rom): void {
    this.uploadRomBytes(rom);
  }

  readTestMemory (address: number): number {
    return this.doReadMemory(address & 0xffff);
  }

  writeTestMemory (address: number, value: number): void {
    this.doWriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort (address: number): number {
    return this.doReadPort(address & 0xffff);
  }

  writeTestPort (address: number, value: number): void {
    this.doWritePort(address & 0xffff, value & 0xff);
  }

  getTestCpuRegisters (): TestCpuRegisterSnapshot {
    return getOracleCpuRegisters(this);
  }

  setTestCpuRegisters (registers: TestCpuRegisters): void {
    setOracleCpuRegisters(this, registers);
  }

  setAbsoluteTacts (value: number): void {
    this.setTacts(value);
  }

  getCurrentFrameTactForTest (): number {
    return this.currentFrameTact;
  }

  getContentionDelayTotalForTest (): number {
    return this.totalContentionDelaySinceStart;
  }

  getContentionValueForTest (tact: number): number {
    return this.getContentionValue(tact);
  }

  getTestPagingState (): TestPagingState {
    return {
      selectedRomPage: this.getSelectedRomPage(),
      selectedRamBank: this.getSelectedRamBank()
    };
  }

  resetContentionCounters (): void {
    resetMachineContentionCounters(this);
  }

  setContentionRange (startTact: number, count: number, value: number): void {
    setMachineContentionRange(this, startTact, count, value);
  }
}

export class TestOracleSp128Machine extends ZxSpectrum128Machine {
  constructor (
    private readonly rom0: Uint8Array = testRom([]),
    private readonly rom1: Uint8Array = testRom([])
  ) {
    super();
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return page === 1 ? this.rom1 : this.rom0;
  }

  initCode (code: number[], startAddress: number): void {
    initCodeBytes(this, code, startAddress);
  }

  setFrameTact (frameTact: number): void {
    setMachineFrameTact(this, frameTact);
  }

  executeOne (): void {
    this.executeCpuCycle();
  }

  uploadTestRom (rom: Uint8Array, page = 0): void {
    this.uploadRomBytes(page === 1 ? -2 : -1, rom);
  }

  readTestMemory (address: number): number {
    return this.doReadMemory(address & 0xffff);
  }

  writeTestMemory (address: number, value: number): void {
    this.doWriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort (address: number): number {
    return this.doReadPort(address & 0xffff);
  }

  writeTestPort (address: number, value: number): void {
    this.doWritePort(address & 0xffff, value & 0xff);
  }

  getTestCpuRegisters (): TestCpuRegisterSnapshot {
    return getOracleCpuRegisters(this);
  }

  setTestCpuRegisters (registers: TestCpuRegisters): void {
    setOracleCpuRegisters(this, registers);
  }

  setAbsoluteTacts (value: number): void {
    this.setTacts(value);
  }

  getCurrentFrameTactForTest (): number {
    return this.currentFrameTact;
  }

  getContentionDelayTotalForTest (): number {
    return this.totalContentionDelaySinceStart;
  }

  getContentionValueForTest (tact: number): number {
    return this.getContentionValue(tact);
  }

  getTestPagingState (): TestPagingState {
    return {
      selectedRomPage: this.getSelectedRomPage(),
      selectedRamBank: this.getSelectedRamBank(),
      pagingEnabled: this.pagingEnabled,
      useShadowScreen: this.useShadowScreen
    };
  }

  resetContentionCounters (): void {
    resetMachineContentionCounters(this);
  }

  setContentionRange (startTact: number, count: number, value: number): void {
    setMachineContentionRange(this, startTact, count, value);
  }
}

export class TestOracleSpp3eMachine extends ZxSpectrumP3EMachine {
  constructor (
    private readonly romPages: Uint8Array[] = [testRom([]), testRom([]), testRom([]), testRom([])],
    options: P3eTestMachineOptions = {}
  ) {
    super(options.modelInfo ?? DEFAULT_P3E_MODEL, {
      [SPP3E_IMPLEMENTATION]: "typescript",
      [MC_DISK_SUPPORT]: options.diskSupport ?? 2,
      ...(options.config ?? {})
    });
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return this.romPages[page] ?? testRom([]);
  }

  initCode (code: number[], startAddress: number): void {
    initCodeBytes(this, code, startAddress);
  }

  setFrameTact (frameTact: number): void {
    setMachineFrameTact(this, frameTact);
  }

  executeOne (): void {
    this.executeCpuCycle();
  }

  uploadTestRom (rom: Uint8Array, page = 0): void {
    this.uploadRomBytes(-(page + 1), rom);
  }

  readTestMemory (address: number): number {
    return this.doReadMemory(address & 0xffff);
  }

  writeTestMemory (address: number, value: number): void {
    this.doWriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort (address: number): number {
    return this.doReadPort(address & 0xffff);
  }

  writeTestPort (address: number, value: number): void {
    this.doWritePort(address & 0xffff, value & 0xff);
  }

  getTestCpuRegisters (): TestCpuRegisterSnapshot {
    return getOracleCpuRegisters(this);
  }

  setTestCpuRegisters (registers: TestCpuRegisters): void {
    setOracleCpuRegisters(this, registers);
  }

  setAbsoluteTacts (value: number): void {
    this.setTacts(value);
  }

  getCurrentFrameTactForTest (): number {
    return this.currentFrameTact;
  }

  getContentionDelayTotalForTest (): number {
    return this.totalContentionDelaySinceStart;
  }

  getContentionValueForTest (tact: number): number {
    return this.getContentionValue(tact);
  }

  getTestPagingState (): TestPagingState {
    return {
      selectedRomPage: this.getSelectedRomPage(),
      selectedRamBank: this.getSelectedRamBank(),
      pagingEnabled: this.pagingEnabled,
      useShadowScreen: this.useShadowScreen,
      inSpecialPagingMode: this.inSpecialPagingMode,
      specialConfigMode: this.specialConfigMode,
      diskMotorOn: this.diskMotorOn
    };
  }

  resetContentionCounters (): void {
    resetMachineContentionCounters(this);
  }

  setContentionRange (startTact: number, count: number, value: number): void {
    setMachineContentionRange(this, startTact, count, value);
  }
}

export async function createTestSp48WasmMachine(
  rom = testRom([]),
  modelInfo?: MachineModel,
  config?: MachineConfigSet
): Promise<TestSp48WasmMachine> {
  buildSp48WasmArtifact();
  const machine = new TestSp48WasmMachine(rom, modelInfo, config);
  await machine.setup();
  return machine;
}

export async function createTestSp128WasmMachine(
  rom0 = testRom([]),
  rom1 = testRom([])
): Promise<TestSp128WasmMachine> {
  buildSp128WasmArtifact();
  const machine = new TestSp128WasmMachine(rom0, rom1);
  await machine.setup();
  return machine;
}

export async function createTestSpp3eWasmMachine(
  romPages = [testRom([]), testRom([]), testRom([]), testRom([])],
  options: P3eTestMachineOptions = {}
): Promise<TestSpp3eWasmMachine> {
  buildSpP3eWasmArtifact();
  const machine = new TestSpp3eWasmMachine(romPages, options);
  await machine.setup();
  return machine;
}

export async function createOracleSp48Machine(
  rom = testRom([]),
  modelInfo?: MachineModel,
  config?: MachineConfigSet
): Promise<TestOracleSp48Machine> {
  const machine = new TestOracleSp48Machine(rom, modelInfo, config);
  await machine.setup();
  return machine;
}

export async function createOracleSp128Machine(
  rom0 = testRom([]),
  rom1 = testRom([])
): Promise<TestOracleSp128Machine> {
  const machine = new TestOracleSp128Machine(rom0, rom1);
  await machine.setup();
  return machine;
}

export async function createOracleSpp3eMachine(
  romPages = [testRom([]), testRom([]), testRom([]), testRom([])],
  options: P3eTestMachineOptions = {}
): Promise<TestOracleSpp3eMachine> {
  const machine = new TestOracleSpp3eMachine(romPages, options);
  await machine.setup();
  return machine;
}

export function expectNormalizedSamples(samples: AudioSample[]): void {
  expect(samples.length).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(Number.isFinite(sample.left)).toBe(true);
    expect(Number.isFinite(sample.right)).toBe(true);
    expect(Math.abs(sample.left)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(sample.right)).toBeLessThanOrEqual(1.0);
  }
}

export function expectSameCpuStateSubset(
  wasmMachine: { getCpuState: () => Record<string, any> },
  tsMachine: { getCpuState: () => Record<string, any> },
  fields: string[]
): void {
  const wasmState = wasmMachine.getCpuState();
  const tsState = tsMachine.getCpuState();
  for (const field of fields) {
    expect(wasmState[field], field).toEqual(tsState[field]);
  }
}

export function expectSameMemoryReads(
  wasmMachine: { doReadMemory: (address: number) => number; readTestMemory?: (address: number) => number },
  tsMachine: { doReadMemory: (address: number) => number; readTestMemory?: (address: number) => number },
  addresses: number[]
): void {
  for (const address of addresses) {
    const wasmValue = wasmMachine.readTestMemory?.(address) ?? wasmMachine.doReadMemory(address);
    const tsValue = tsMachine.readTestMemory?.(address) ?? tsMachine.doReadMemory(address);
    expect(wasmValue, `memory ${address.toString(16)}`).toBe(
      tsValue
    );
  }
}

export function expectSamePartitions(
  wasmMachine: {
    getCurrentPartitions: () => number[];
    getSelectedRamBank: () => number;
    getSelectedRomPage: () => number;
  },
  tsMachine: {
    getCurrentPartitions: () => number[];
    getSelectedRamBank: () => number;
    getSelectedRomPage: () => number;
  }
): void {
  expect(wasmMachine.getCurrentPartitions()).toEqual(tsMachine.getCurrentPartitions());
  expect(wasmMachine.getSelectedRamBank()).toBe(tsMachine.getSelectedRamBank());
  expect(wasmMachine.getSelectedRomPage()).toBe(tsMachine.getSelectedRomPage());
}

export function for48And128AndP3e(run: (testCase: SpectrumModelCase) => void): void {
  spectrumModelCases().forEach(run);
}

export function for128Family(run: (testCase: SpectrumModelCase) => void): void {
  spectrumModelCases().filter(testCase => testCase.id !== "sp48").forEach(run);
}

export function forP3eDiskModels(run: (testCase: SpectrumModelCase) => void): void {
  spectrumModelCases().filter(testCase => testCase.id === "spp3e").forEach(run);
}

function spectrumModelCases (): SpectrumModelCase[] {
  const rom48 = testRom([0x00]);
  const rom1280 = testRom([0x10]);
  const rom1281 = testRom([0x11]);
  const romP3e = [testRom([0x20]), testRom([0x21]), testRom([0x22]), testRom([0x23])];
  return [
    {
      id: "sp48",
      name: "ZX Spectrum 48K",
      createWasmMachine: () => createTestSp48WasmMachine(rom48),
      createOracleMachine: () => createOracleSp48Machine(rom48)
    },
    {
      id: "sp128",
      name: "ZX Spectrum 128K",
      createWasmMachine: () => createTestSp128WasmMachine(rom1280, rom1281),
      createOracleMachine: () => createOracleSp128Machine(rom1280, rom1281)
    },
    {
      id: "spp3e",
      name: "ZX Spectrum +3E",
      createWasmMachine: () => createTestSpp3eWasmMachine(romP3e),
      createOracleMachine: () => createOracleSpp3eMachine(romP3e)
    }
  ];
}

function callWasmExport (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports } },
  name: string
): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, any> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available for this test helper.`);
  }
  return fn;
}

function maybeCallWasmExport (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports } },
  name: string,
  ...args: number[]
): number | undefined {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, any> | undefined)?.[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

function hasWasmExport (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports } },
  name: string
): boolean {
  return typeof (machine.wasmV2Runtime?.exports as Record<string, any> | undefined)?.[name] === "function";
}

function executeWasmInstruction (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports }; getCpuState: () => unknown },
  prefix: BuildCacheKey
): void {
  callWasmExport(machine, `${prefix}ExecuteInstruction`)();
  machine.getCpuState();
}

function initWasmCodeBytes (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports } },
  prefix: BuildCacheKey,
  code: number[],
  startAddress: number
): void {
  const writeMemory = callWasmExport(machine, `${prefix}WriteMemory`);
  for (let i = 0; i < code.length; i++) {
    writeMemory((startAddress + i) & 0xffff, code[i] & 0xff);
  }
}

function getWasmCpuRegisters (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports }; getCpuState: () => unknown },
  prefix: BuildCacheKey
): TestCpuRegisterSnapshot {
  machine.getCpuState();
  const ir = maybeCallWasmExport(machine, `${prefix}GetCpuIr`);
  const iff1 = maybeCallWasmExport(machine, `${prefix}GetCpuIff1`);
  const interruptMode = maybeCallWasmExport(machine, `${prefix}GetCpuInterruptMode`);
  return {
    af: callWasmExport(machine, `${prefix}GetCpuAf`)(),
    bc: callWasmExport(machine, `${prefix}GetCpuBc`)(),
    de: callWasmExport(machine, `${prefix}GetCpuDe`)(),
    hl: callWasmExport(machine, `${prefix}GetCpuHl`)(),
    ix: callWasmExport(machine, `${prefix}GetCpuIx`)(),
    iy: callWasmExport(machine, `${prefix}GetCpuIy`)(),
    ir: ir ?? 0,
    pc: callWasmExport(machine, `${prefix}GetCpuPc`)(),
    sp: callWasmExport(machine, `${prefix}GetCpuSp`)(),
    iff1: iff1 == null ? false : iff1 !== 0,
    interruptMode: interruptMode ?? 0,
    halted: callWasmExport(machine, `${prefix}GetCpuHalted`)() !== 0,
    tacts: callWasmExport(machine, `${prefix}GetTacts`)()
  };
}

function setWasmCpuRegisters (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports }; getCpuState: () => unknown },
  prefix: BuildCacheKey,
  registers: TestCpuRegisters
): void {
  const pairs: Array<[keyof TestCpuRegisters, string]> = [
    ["af", "Af"],
    ["bc", "Bc"],
    ["de", "De"],
    ["hl", "Hl"],
    ["ix", "Ix"],
    ["iy", "Iy"],
    ["pc", "Pc"],
    ["sp", "Sp"]
  ];
  for (const [field, exportSuffix] of pairs) {
    const value = registers[field];
    if (value != null) {
      callWasmExport(machine, `${prefix}SetCpu${exportSuffix}`)(value & 0xffff);
    }
  }
  if (registers.tacts != null) {
    callWasmExport(machine, `${prefix}SetTacts`)(registers.tacts >>> 0);
  }
  if (registers.iff1 != null) {
    const exportName = `${prefix}SetCpuIff1`;
    if (!hasWasmExport(machine, exportName)) throw new Error(`${exportName} is not available.`);
    callWasmExport(machine, exportName)(registers.iff1 ? 1 : 0);
  }
  if (registers.interruptMode != null) {
    const exportName = `${prefix}SetCpuInterruptMode`;
    if (!hasWasmExport(machine, exportName)) throw new Error(`${exportName} is not available.`);
    callWasmExport(machine, exportName)(registers.interruptMode);
  }
  if (registers.ir != null) {
    throw new Error(`${prefix}SetCpuIr is not available without changing the WASM implementation exports.`);
  }
  if (registers.halted != null) {
    throw new Error(`${prefix}SetCpuHalted is not available without changing the WASM implementation exports.`);
  }
  machine.getCpuState();
}

function setWasmAbsoluteTacts (
  machine: {
    wasmV2Runtime?: { exports: WebAssembly.Exports };
    getCpuState: () => unknown;
    frameTacts: number;
    currentFrameTact: number;
    tacts: number;
  },
  prefix: BuildCacheKey,
  value: number
): void {
  callWasmExport(machine, `${prefix}SetTacts`)(value >>> 0);
  machine.getCpuState();
}

function resetWasmContentionCounters (
  machine: {
    wasmV2Runtime?: { exports: WebAssembly.Exports };
    totalContentionDelaySinceStart: number;
    contentionDelaySincePause: number;
  },
  prefix: BuildCacheKey
): void {
  callWasmExport(machine, `${prefix}ResetContentionCounters`)();
  machine.totalContentionDelaySinceStart = 0;
  machine.contentionDelaySincePause = 0;
}

function setWasmContentionRange (
  machine: { wasmV2Runtime?: { exports: WebAssembly.Exports } },
  prefix: BuildCacheKey,
  startTact: number,
  count: number,
  value: number
): void {
  const setContentionValue = callWasmExport(machine, `${prefix}SetContentionValue`);
  for (let i = 0; i < count; i++) {
    setContentionValue(startTact + i, value);
  }
}

function getOracleCpuRegisters (
  machine: {
    af: number;
    bc: number;
    de: number;
    hl: number;
    ix: number;
    iy: number;
    ir: number;
    pc: number;
    sp: number;
    iff1: boolean;
    interruptMode: number;
    halted: boolean;
    tacts: number;
  }
): TestCpuRegisterSnapshot {
  return {
    af: machine.af,
    bc: machine.bc,
    de: machine.de,
    hl: machine.hl,
    ix: machine.ix,
    iy: machine.iy,
    ir: machine.ir,
    pc: machine.pc,
    sp: machine.sp,
    iff1: machine.iff1,
    interruptMode: machine.interruptMode,
    halted: machine.halted,
    tacts: machine.tacts
  };
}

function setOracleCpuRegisters (
  machine: {
    af: number;
    bc: number;
    de: number;
    hl: number;
    ix: number;
    iy: number;
    ir: number;
    pc: number;
    sp: number;
    iff1: boolean;
    interruptMode: number;
    halted: boolean;
    setTacts: (value: number) => void;
  },
  registers: TestCpuRegisters
): void {
  if (registers.af != null) machine.af = registers.af & 0xffff;
  if (registers.bc != null) machine.bc = registers.bc & 0xffff;
  if (registers.de != null) machine.de = registers.de & 0xffff;
  if (registers.hl != null) machine.hl = registers.hl & 0xffff;
  if (registers.ix != null) machine.ix = registers.ix & 0xffff;
  if (registers.iy != null) machine.iy = registers.iy & 0xffff;
  if (registers.ir != null) machine.ir = registers.ir & 0xffff;
  if (registers.pc != null) machine.pc = registers.pc & 0xffff;
  if (registers.sp != null) machine.sp = registers.sp & 0xffff;
  if (registers.iff1 != null) machine.iff1 = registers.iff1;
  if (registers.interruptMode != null) machine.interruptMode = registers.interruptMode;
  if (registers.halted != null) machine.halted = registers.halted;
  if (registers.tacts != null) machine.setTacts(registers.tacts);
}

function initCodeBytes (
  machine: { doWriteMemory: (address: number, value: number) => void },
  code: number[],
  startAddress: number
): void {
  for (let i = 0; i < code.length; i++) {
    machine.doWriteMemory((startAddress + i) & 0xffff, code[i]);
  }
}

function setMachineFrameTact (
  machine: { frameTacts: number; tacts: number; currentFrameTact: number },
  frameTact: number
): void {
  machine.frameTacts = frameTact;
  machine.tacts = frameTact;
  machine.currentFrameTact = frameTact;
}

function resetMachineContentionCounters (
  machine: { totalContentionDelaySinceStart: number; contentionDelaySincePause: number }
): void {
  machine.totalContentionDelaySinceStart = 0;
  machine.contentionDelaySincePause = 0;
}

function setMachineContentionRange (
  machine: { setContentionValue: (tact: number, value: number) => void },
  startTact: number,
  count: number,
  value: number
): void {
  for (let i = 0; i < count; i++) {
    machine.setContentionValue(startTact + i, value);
  }
}
