import { readFileSync } from "node:fs";

import type { MachineModel } from "@common/machines/info-types";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import { expect } from "vitest";
import { buildZxNextWasm, productionOutput as zxNextWasmOutput } from "../../../scripts/build-zxnext-wasm.cjs";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

export type ZxNextRomSet = {
  next: Uint8Array;
  divMmc: Uint8Array;
  multiface: Uint8Array;
  alt: Uint8Array;
};

export type TestCpuRegisters = Partial<{
  af: number;
  bc: number;
  de: number;
  hl: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  pc: number;
  sp: number;
  iff1: boolean;
  iff2: boolean;
  interruptMode: number;
  tacts: number;
}>;

export type TestCpuRegisterSnapshot = Required<TestCpuRegisters> & {
  halted: boolean;
};

let zxNextWasmBuilt = false;

export function buildZxNextWasmArtifact(force = false): void {
  if (!force && zxNextWasmBuilt) return;
  buildZxNextWasm();
  zxNextWasmBuilt = true;
}

export function testRom(bytes: number[], size = 0x4000): Uint8Array {
  const rom = new Uint8Array(size);
  rom.set(bytes.slice(0, size));
  return rom;
}

export function createTestZxNextRomSet(overrides: Partial<ZxNextRomSet> = {}): ZxNextRomSet {
  return {
    next: overrides.next ?? testRom([0x00], 0x10000),
    divMmc: overrides.divMmc ?? testRom([0xd1], 0x4000),
    multiface: overrides.multiface ?? testRom([0xf1], 0x4000),
    alt: overrides.alt ?? testRom([0xa1], 0x8000)
  };
}

export class TestZxNextWasmMachine extends ZxNextWasmV2Machine {
  constructor(
    private readonly romSet: ZxNextRomSet = createTestZxNextRomSet(),
    modelInfo?: MachineModel
  ) {
    super(modelInfo, undefined, {
      artifactName: "test-zxnext-machine-v2.wasm",
      readArtifact: async () => readFileSync(zxNextWasmOutput)
    });
  }

  protected override async loadRomFromFile(filename: string): Promise<Uint8Array> {
    return romForFilename(this.romSet, filename);
  }

  initCode(code: number[], startAddress: number): void {
    for (let i = 0; i < code.length; i++) {
      this.wasmV2Runtime!.exports.zxnextWriteMemory((startAddress + i) & 0xffff, code[i] & 0xff);
    }
  }

  executeOne(): void {
    this.wasmV2Runtime!.exports.zxnextExecuteInstruction();
    this.getCpuState();
  }

  readTestMemory(address: number): number {
    return this.wasmV2Runtime!.exports.zxnextReadMemory(address & 0xffff);
  }

  writeTestMemory(address: number, value: number): void {
    this.wasmV2Runtime!.exports.zxnextWriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort(address: number): number {
    return this.wasmV2Runtime!.exports.zxnextReadPort(address & 0xffff);
  }

  writeTestPort(address: number, value: number): void {
    this.wasmV2Runtime!.exports.zxnextWritePort(address & 0xffff, value & 0xff);
    this.getCpuState();
  }

  readNextReg(reg: number): number {
    return this.wasmV2Runtime!.exports.zxnextReadNextReg(reg & 0xff);
  }

  writeNextReg(reg: number, value: number): void {
    this.wasmV2Runtime!.exports.zxnextWriteNextReg(reg & 0xff, value & 0xff);
  }

  setPortReadValue(value: number): void {
    this.wasmV2Runtime!.exports.zxnextSetPortReadValue(value & 0xff);
  }

  getTestCpuRegisters(): TestCpuRegisterSnapshot {
    return getWasmCpuRegisters(this);
  }

  setTestCpuRegisters(registers: TestCpuRegisters): void {
    setWasmCpuRegisters(this, registers);
  }
}

export class TestOracleZxNextMachine extends ZxNextMachine {
  constructor(
    private readonly romSet: ZxNextRomSet = createTestZxNextRomSet(),
    modelInfo?: MachineModel
  ) {
    super(modelInfo);
    this.allowExtendedInstructions = true;
  }

  protected override async loadRomFromFile(filename: string): Promise<Uint8Array> {
    return romForFilename(this.romSet, filename);
  }

  initCode(code: number[], startAddress: number): void {
    for (let i = 0; i < code.length; i++) {
      this.memoryDevice.writeMemory((startAddress + i) & 0xffff, code[i] & 0xff);
    }
  }

  executeOne(): void {
    this.beforeOpcodeFetch();
    this.executeCpuCycle();
    this.afterOpcodeFetch();
  }

  readTestMemory(address: number): number {
    return this.doReadMemory(address & 0xffff);
  }

  writeTestMemory(address: number, value: number): void {
    this.doWriteMemory(address & 0xffff, value & 0xff);
  }

  readTestPort(address: number): number {
    return this.doReadPort(address & 0xffff);
  }

  writeTestPort(address: number, value: number): void {
    this.doWritePort(address & 0xffff, value & 0xff);
  }

  getTestCpuRegisters(): TestCpuRegisterSnapshot {
    return getOracleCpuRegisters(this);
  }

  setTestCpuRegisters(registers: TestCpuRegisters): void {
    setOracleCpuRegisters(this, registers);
  }
}

export async function createTestZxNextWasmMachine(
  romSet = createTestZxNextRomSet(),
  modelInfo?: MachineModel
): Promise<TestZxNextWasmMachine> {
  buildZxNextWasmArtifact();
  const machine = new TestZxNextWasmMachine(romSet, modelInfo);
  await machine.setup();
  return machine;
}

export async function createOracleZxNextMachine(
  romSet = createTestZxNextRomSet(),
  modelInfo?: MachineModel
): Promise<TestOracleZxNextMachine> {
  const machine = new TestOracleZxNextMachine(romSet, modelInfo);
  await machine.setup();
  return machine;
}

export function initCodeBytes(
  machine: { initCode: (code: number[], startAddress: number) => void; setTestCpuRegisters: (registers: TestCpuRegisters) => void },
  code: number[],
  startAddress = 0x8000
): void {
  machine.initCode(code, startAddress);
  machine.setTestCpuRegisters({ pc: startAddress, sp: 0xfffe, tacts: 0 });
}

export function executeOneInstruction(machine: { executeOne: () => void }): void {
  machine.executeOne();
}

export function expectSameCpuRegisters(
  wasmMachine: { getTestCpuRegisters: () => TestCpuRegisterSnapshot },
  oracleMachine: { getTestCpuRegisters: () => TestCpuRegisterSnapshot },
  fields: Array<keyof TestCpuRegisterSnapshot>
): void {
  const wasm = wasmMachine.getTestCpuRegisters();
  const oracle = oracleMachine.getTestCpuRegisters();
  for (const field of fields) {
    expect(wasm[field], field).toEqual(oracle[field]);
  }
}

export function expectSameMemoryReads(
  wasmMachine: { readTestMemory: (address: number) => number },
  oracleMachine: { readTestMemory: (address: number) => number },
  addresses: number[]
): void {
  for (const address of addresses) {
    expect(wasmMachine.readTestMemory(address), `memory ${address.toString(16)}`).toBe(
      oracleMachine.readTestMemory(address)
    );
  }
}

export function expectNormalizedSamples(samples: AudioSample[]): void {
  for (const sample of samples) {
    expect(Number.isFinite(sample.left)).toBe(true);
    expect(Number.isFinite(sample.right)).toBe(true);
    expect(Math.abs(sample.left)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(sample.right)).toBeLessThanOrEqual(1.0);
  }
}

function romForFilename(romSet: ZxNextRomSet, filename: string): Uint8Array {
  switch (filename) {
    case "roms/enNextZX.rom":
      return romSet.next;
    case "roms/enNxtmmc.rom":
      return romSet.divMmc;
    case "roms/enNextMf.rom":
      return romSet.multiface;
    case "roms/enAltZX.rom":
      return romSet.alt;
    default:
      throw new Error(`Unexpected ZX Next ROM request '${filename}'.`);
  }
}

function getWasmCpuRegisters(machine: TestZxNextWasmMachine): TestCpuRegisterSnapshot {
  machine.getCpuState();
  const wasm = machine.wasmV2Runtime!.exports;
  return {
    af: wasm.zxnextGetCpuAf(),
    bc: wasm.zxnextGetCpuBc(),
    de: wasm.zxnextGetCpuDe(),
    hl: wasm.zxnextGetCpuHl(),
    ix: wasm.zxnextGetCpuIx(),
    iy: wasm.zxnextGetCpuIy(),
    ir: wasm.zxnextGetCpuIr(),
    wz: wasm.zxnextGetCpuWz(),
    pc: wasm.zxnextGetCpuPc(),
    sp: wasm.zxnextGetCpuSp(),
    iff1: wasm.zxnextGetCpuIff1() !== 0,
    iff2: wasm.zxnextGetCpuIff2() !== 0,
    interruptMode: wasm.zxnextGetCpuInterruptMode(),
    tacts: wasm.zxnextGetTacts(),
    halted: wasm.zxnextGetCpuHalted() !== 0
  };
}

function setWasmCpuRegisters(machine: TestZxNextWasmMachine, registers: TestCpuRegisters): void {
  const wasm = machine.wasmV2Runtime!.exports;
  if (registers.af != null) wasm.zxnextSetCpuAf(registers.af & 0xffff);
  if (registers.bc != null) wasm.zxnextSetCpuBc(registers.bc & 0xffff);
  if (registers.de != null) wasm.zxnextSetCpuDe(registers.de & 0xffff);
  if (registers.hl != null) wasm.zxnextSetCpuHl(registers.hl & 0xffff);
  if (registers.ix != null) wasm.zxnextSetCpuIx(registers.ix & 0xffff);
  if (registers.iy != null) wasm.zxnextSetCpuIy(registers.iy & 0xffff);
  if (registers.ir != null) wasm.zxnextSetCpuIr(registers.ir & 0xffff);
  if (registers.wz != null) wasm.zxnextSetCpuWz(registers.wz & 0xffff);
  if (registers.pc != null) wasm.zxnextSetCpuPc(registers.pc & 0xffff);
  if (registers.sp != null) wasm.zxnextSetCpuSp(registers.sp & 0xffff);
  if (registers.iff1 != null) wasm.zxnextSetCpuIff1(registers.iff1 ? 1 : 0);
  if (registers.iff2 != null) wasm.zxnextSetCpuIff2(registers.iff2 ? 1 : 0);
  if (registers.interruptMode != null) wasm.zxnextSetCpuInterruptMode(registers.interruptMode);
  if (registers.tacts != null) wasm.zxnextSetTacts(registers.tacts >>> 0);
  machine.getCpuState();
}

function getOracleCpuRegisters(machine: TestOracleZxNextMachine): TestCpuRegisterSnapshot {
  return {
    af: machine.af,
    bc: machine.bc,
    de: machine.de,
    hl: machine.hl,
    ix: machine.ix,
    iy: machine.iy,
    ir: machine.ir,
    wz: machine.wz,
    pc: machine.pc,
    sp: machine.sp,
    iff1: machine.iff1,
    iff2: machine.iff2,
    interruptMode: machine.interruptMode,
    tacts: machine.tacts,
    halted: machine.halted
  };
}

function setOracleCpuRegisters(machine: TestOracleZxNextMachine, registers: TestCpuRegisters): void {
  if (registers.af != null) machine.af = registers.af & 0xffff;
  if (registers.bc != null) machine.bc = registers.bc & 0xffff;
  if (registers.de != null) machine.de = registers.de & 0xffff;
  if (registers.hl != null) machine.hl = registers.hl & 0xffff;
  if (registers.ix != null) machine.ix = registers.ix & 0xffff;
  if (registers.iy != null) machine.iy = registers.iy & 0xffff;
  if (registers.ir != null) machine.ir = registers.ir & 0xffff;
  if (registers.wz != null) machine.wz = registers.wz & 0xffff;
  if (registers.pc != null) machine.pc = registers.pc & 0xffff;
  if (registers.sp != null) machine.sp = registers.sp & 0xffff;
  if (registers.iff1 != null) machine.iff1 = registers.iff1;
  if (registers.iff2 != null) machine.iff2 = registers.iff2;
  if (registers.interruptMode != null) machine.interruptMode = registers.interruptMode;
  if (registers.tacts != null) machine.setTacts(registers.tacts >>> 0);
}
