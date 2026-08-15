import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { AUDIO_SAMPLE_RATE, TAPE_MODE } from "@emu/machines/machine-props";
import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  expectSameMemoryReads,
  testRom,
  type SpectrumModelId,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;

type LifecycleCase = {
  id: SpectrumModelId;
  name: string;
  firstRomByte: number;
  createWasmMachine: () => Promise<WasmMachine>;
  createOracleMachine: () => Promise<OracleMachine>;
};

describe("ZX Spectrum WASM machine lifecycle parity", () => {
  for (const testCase of lifecycleCases()) {
    it(`${testCase.name} setup initializes the WASM runtime and ROM bytes`, async () => {
      const machine = await testCase.createWasmMachine();

      expect(machine.implementation).toBe("wasm");
      expect(machine.wasmV2Runtime).toBeDefined();
      expect(machine.readTestMemory(0x0000)).toBe(testCase.firstRomByte);
      expect(machine.get64KFlatMemory()[0x0000]).toBe(testCase.firstRomByte);
      expect(machine.getTestCpuRegisters()).toMatchObject({
        pc: 0x0000,
        sp: 0xffff,
        tacts: 0
      });
    });

    it(`${testCase.name} hard reset keeps ROMs available and resets CPU/frame state`, async () => {
      const machine = await testCase.createWasmMachine();

      machine.writeTestMemory(0x4000, 0xaa);
      machine.setTestCpuRegisters({
        pc: 0x1234,
        sp: 0x4567,
        tacts: 12345
      });

      machine.hardReset();

      expect(machine.readTestMemory(0x0000)).toBe(testCase.firstRomByte);
      expect(machine.readTestMemory(0x4000)).toBe(0x00);
      expect(machine.frames).toBe(0);
      expect(machine.frameJustCompleted).toBe(false);
      expect(machine.getTestCpuRegisters()).toMatchObject({
        pc: 0x0000,
        sp: 0xffff,
        tacts: 0
      });
    });

    it(`${testCase.name} soft reset preserves attached tape media and writable RAM`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();
      const wasmTape = [tapeBlock([0x00, 0x03, 0x4d, 0x59])];
      const oracleTape = [tapeBlock([0x00, 0x03, 0x4d, 0x59])];

      wasmMachine.writeTestMemory(0x4000, 0x5a);
      oracleMachine.writeTestMemory(0x4000, 0x5a);
      wasmMachine.setMachineProperty(MEDIA_TAPE, wasmTape);
      oracleMachine.setMachineProperty(MEDIA_TAPE, oracleTape);
      wasmMachine.setMachineProperty(TAPE_MODE, TapeMode.Load);
      oracleMachine.setMachineProperty(TAPE_MODE, TapeMode.Load);

      wasmMachine.reset();
      oracleMachine.reset();

      expectSameMemoryReads(wasmMachine, oracleMachine, [0x0000, 0x4000]);
      expect(wasmMachine.getMachineProperty(MEDIA_TAPE)).toBe(wasmTape);
      expect(oracleMachine.getMachineProperty(MEDIA_TAPE)).toBe(oracleTape);
      expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
        tapeBlocks: 1,
        tapeBytes: 4,
        tapeLoaded: true
      });
    });
  }

  for (const testCase of nopLifecycleCases()) {
    it(`${testCase.name} normal frame counters match the TypeScript oracle for a NOP ROM`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      expect(wasmMachine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
      expect(oracleMachine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);

      expect(wasmMachine.frames).toBe(oracleMachine.frames);
      expect(wasmMachine.frames).toBe(1);
      expect(wasmMachine.tacts).toBe(oracleMachine.tacts);
      expect(wasmMachine.tactsInFrame).toBe(oracleMachine.tactsInFrame);
      expect(wasmMachine.frameJustCompleted).toBe(oracleMachine.frameJustCompleted);
      expect(wasmMachine.frameJustCompleted).toBe(true);
      expect(wasmMachine.getWasmV2Diagnostics().normalFrames).toBe(1);
    });
  }

  it("synchronizes 48K clock multiplier writes only when the value changes", async () => {
    const machine = await createTestSp48WasmMachine(testRom([0x00]));
    const setupWrites = machine.getWasmV2Diagnostics().clockMultiplierWrites;

    machine.executeMachineFrame();
    expect(machine.getWasmV2Diagnostics().clockMultiplierWrites).toBe(setupWrites);

    machine.targetClockMultiplier = 2;
    machine.executeMachineFrame();
    const afterChange = machine.getWasmV2Diagnostics();
    expect(afterChange.clockMultiplierWrites).toBe(setupWrites + 1);
    expect(afterChange.clockMultiplier).toBe(2);

    machine.targetClockMultiplier = 2;
    machine.executeMachineFrame();
    expect(machine.getWasmV2Diagnostics().clockMultiplierWrites).toBe(
      afterChange.clockMultiplierWrites
    );
  });

  for (const testCase of lifecycleCases()) {
    it(`${testCase.name} synchronizes audio sample rate writes only when the value changes`, async () => {
      const machine = await testCase.createWasmMachine();
      const setupWrites = machine.getWasmV2Diagnostics().audioRateWrites;

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 22_050);
      machine.executeMachineFrame();
      const afterFirstChange = machine.getWasmV2Diagnostics().audioRateWrites;
      expect(afterFirstChange).toBe(setupWrites + 1);

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 22_050);
      machine.executeMachineFrame();
      expect(machine.getWasmV2Diagnostics().audioRateWrites).toBe(afterFirstChange);

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 44_100);
      machine.executeMachineFrame();
      expect(machine.getWasmV2Diagnostics().audioRateWrites).toBe(afterFirstChange + 1);
    });
  }
});

function lifecycleCases(): LifecycleCase[] {
  const rom48 = testRom([0x31]);
  const rom1280 = testRom([0x41]);
  const rom1281 = testRom([0x42]);
  const romP3e = [testRom([0x51]), testRom([0x52]), testRom([0x53]), testRom([0x54])];
  return [
    {
      id: "sp48",
      name: "ZX Spectrum 48K",
      firstRomByte: 0x31,
      createWasmMachine: () => createTestSp48WasmMachine(rom48),
      createOracleMachine: () => createOracleSp48Machine(rom48)
    },
    {
      id: "sp128",
      name: "ZX Spectrum 128K",
      firstRomByte: 0x41,
      createWasmMachine: () => createTestSp128WasmMachine(rom1280, rom1281),
      createOracleMachine: () => createOracleSp128Machine(rom1280, rom1281)
    },
    {
      id: "spp3e",
      name: "ZX Spectrum +3E",
      firstRomByte: 0x51,
      createWasmMachine: () => createTestSpp3eWasmMachine(romP3e),
      createOracleMachine: () => createOracleSpp3eMachine(romP3e)
    }
  ];
}

function nopLifecycleCases(): LifecycleCase[] {
  const rom = testRom([0x00]);
  const emptyRom = testRom([]);
  return [
    {
      id: "sp48",
      name: "ZX Spectrum 48K",
      firstRomByte: 0x00,
      createWasmMachine: () => createTestSp48WasmMachine(rom),
      createOracleMachine: () => createOracleSp48Machine(rom)
    },
    {
      id: "sp128",
      name: "ZX Spectrum 128K",
      firstRomByte: 0x00,
      createWasmMachine: () => createTestSp128WasmMachine(rom, emptyRom),
      createOracleMachine: () => createOracleSp128Machine(rom, emptyRom)
    },
    {
      id: "spp3e",
      name: "ZX Spectrum +3E",
      firstRomByte: 0x00,
      createWasmMachine: () => createTestSpp3eWasmMachine([rom, emptyRom, emptyRom, emptyRom]),
      createOracleMachine: () => createOracleSpp3eMachine([rom, emptyRom, emptyRom, emptyRom])
    }
  ];
}

function tapeBlock(bytes: number[]): TapeDataBlock {
  const block = new TapeDataBlock();
  block.data = new Uint8Array(bytes);
  return block;
}
