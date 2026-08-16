import { describe, expect, it } from "vitest";

import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { FAST_LOAD, REWIND_REQUESTED, TAPE_MODE } from "@emu/machines/machine-props";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type Prefix = "sp48" | "sp128" | "spp3e";
type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;

type TapeCase = {
  name: string;
  prefix: Prefix;
  createWasmMachine: () => Promise<WasmMachine>;
  createOracleMachine: () => Promise<OracleMachine>;
};

describe("ZX Spectrum WASM tape parity", () => {
  for (const testCase of tapeCases()) {
    it(`${testCase.name} uploads synthetic media blocks with metadata`, async () => {
      const machine = await testCase.createWasmMachine();
      const wasm = machine.wasmV2Runtime!;

      expect(callWasmExport(machine, `${testCase.prefix}TapeBeginUpload`)(2, 4)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeSetBlock`)(0, 0, 3, 1000, 10, 4, 4, 6, 12, 5, 8, 2)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeSetBlock`)(1, 3, 1, 750, 20, 5, 5, 7, 14, 6, 7, 9)).toBe(1);
      for (const [offset, value] of [0xaa, 0xbb, 0xcc, 0xdd].entries()) {
        expect(callWasmExport(machine, `${testCase.prefix}TapeWriteData`)(offset, value)).toBe(1);
      }
      expect(callWasmExport(machine, `${testCase.prefix}TapeFinishUpload`)()).toBe(1);

      expect(callWasmExport(machine, `${testCase.prefix}TapeGetLoaded`)()).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetBlockCount`)()).toBe(2);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetDataLength`)()).toBe(4);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetBlockOffset`)(1)).toBe(3);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetBlockLength`)(1)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetBlockPauseAfter`)(0)).toBe(1000);
      expectOptionalExport(machine, `${testCase.prefix}TapeGetBlockPilotPulseCount`, 0, 2);
      expectOptionalExport(machine, `${testCase.prefix}TapeGetBlockLastByteUsedBits`, 1, 7);
      expect(Array.from(wasm.tapeData.slice(0, 4))).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
    });

    it(`${testCase.name} synchronizes tape machine properties with the WASM runtime`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();
      const tape = [tapeBlock([0x13, 0x37, 0x42])];

      wasmMachine.setMachineProperty(MEDIA_TAPE, tape);
      oracleMachine.setMachineProperty(MEDIA_TAPE, [tapeBlock([0x13, 0x37, 0x42])]);
      wasmMachine.setMachineProperty(FAST_LOAD, false);
      oracleMachine.setMachineProperty(FAST_LOAD, false);
      wasmMachine.setMachineProperty(TAPE_MODE, TapeMode.Load);
      oracleMachine.setMachineProperty(TAPE_MODE, TapeMode.Load);

      expect(callWasmExport(wasmMachine, `${testCase.prefix}TapeGetLoaded`)()).toBe(1);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}TapeGetFastLoad`)()).toBe(0);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}TapeGetMode`)()).toBe(TapeMode.Load);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}TapeGetBlockCount`)()).toBe(1);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}TapeGetDataLength`)()).toBe(3);
      expect(Array.from(wasmMachine.wasmV2Runtime!.tapeData.slice(0, 3))).toEqual([0x13, 0x37, 0x42]);

      wasmMachine.setMachineProperty(REWIND_REQUESTED, true);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}TapeGetCurrentBlockIndex`)()).toBe(0);
      expect(oracleMachine.getMachineProperty(TAPE_MODE)).toBe(TapeMode.Load);
    });

    it(`${testCase.name} routes tape EAR through 0xfe reads while loading`, async () => {
      const machine = await testCase.createWasmMachine();

      machine.writeTestPort(0x00fe, 0x00);
      expect(machine.readTestPort(0x00fe) & 0x40).toBe(0x00);

      expect(callWasmExport(machine, `${testCase.prefix}TapeBeginUpload`)(1, 1)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeSetBlock`)(0, 0, 1, 1000, 10, 4, 4, 6, 12, 5, 8, 2)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeWriteData`)(0, 0x00)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeFinishUpload`)()).toBe(1);

      callWasmExport(machine, `${testCase.prefix}TapeSetMode`)(TapeMode.Load);
      expect(machine.readTestPort(0x00fe) & 0x40).toBe(0x40);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetCurrentEarBit`)()).toBe(1);

      machine.setAbsoluteTacts(testCase.prefix === "spp3e" ? 2169 : 11);
      expect(machine.readTestPort(0x00fe) & 0x40).toBe(0x00);
    });

    it(`${testCase.name} captures saved tape bytes and clears saved metadata`, async () => {
      const machine = await testCase.createWasmMachine();
      const runtime = machine.wasmV2Runtime!;
      const startRevision = callWasmExport(machine, `${testCase.prefix}TapeGetSavedRevision`)();

      callWasmExport(machine, `${testCase.prefix}TapeClearSavedBlocks`)();
      if (!hasWasmExport(machine, `${testCase.prefix}TapeAppendSavedByte`)) {
        expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedBlockCount`)()).toBe(0);
        expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedDataLength`)()).toBe(0);
        return;
      }
      expect(callWasmExport(machine, `${testCase.prefix}TapeAppendSavedByte`)(0xa5)).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeAppendSavedByte`)(0x5a)).toBe(1);

      expect(Array.from(runtime.tapeSaveData.slice(0, 2))).toEqual([0xa5, 0x5a]);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedBlockCount`)()).toBe(1);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedDataLength`)()).toBe(2);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedBlockOffset`)(0)).toBe(0);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedBlockLength`)(0)).toBe(2);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedRevision`)()).toBeGreaterThan(startRevision);

      callWasmExport(machine, `${testCase.prefix}TapeClearSavedBlocks`)();
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedBlockCount`)()).toBe(0);
      expect(callWasmExport(machine, `${testCase.prefix}TapeGetSavedDataLength`)()).toBe(0);
    });
  }
});

function tapeCases(): TapeCase[] {
  const rom = testRom([]);
  return [
    {
      name: "ZX Spectrum 48K",
      prefix: "sp48",
      createWasmMachine: () => createTestSp48WasmMachine(rom),
      createOracleMachine: () => createOracleSp48Machine(rom)
    },
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: () => createTestSp128WasmMachine(rom, rom),
      createOracleMachine: () => createOracleSp128Machine(rom, rom)
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: () => createTestSpp3eWasmMachine([rom, rom, rom, rom]),
      createOracleMachine: () => createOracleSpp3eMachine([rom, rom, rom, rom])
    }
  ];
}

function tapeBlock(bytes: number[]): TapeDataBlock {
  const block = new TapeDataBlock();
  block.data = new Uint8Array(bytes);
  return block;
}

function callWasmExport(machine: WasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}

function hasWasmExport(machine: WasmMachine, name: string): boolean {
  return typeof (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name] === "function";
}

function expectOptionalExport(machine: WasmMachine, name: string, argument: number, value: number): void {
  if (hasWasmExport(machine, name)) {
    expect(callWasmExport(machine, name)(argument)).toBe(value);
  }
}
