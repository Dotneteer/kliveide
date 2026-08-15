import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type Prefix = "sp48" | "sp128" | "spp3e";
type DebugMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;

type PublicDebugCase = {
  name: string;
  prefix: "sp48" | "sp128";
  createMachine: (rom: Uint8Array) => Promise<TestSp48WasmMachine | TestSp128WasmMachine>;
};

describe("ZX Spectrum WASM debug step parity", () => {
  for (const testCase of publicDebugCases()) {
    it(`${testCase.name} StepInto executes exactly one WASM instruction`, async () => {
      const machine = await testCase.createMachine(testRom([0x3e, 0x77, 0x32, 0x00, 0x40, 0x00]));

      machine.executionContext.debugStepMode = DebugStepMode.StepInto;
      machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(machine.getCpuState()).toMatchObject({
        pc: 0x0002
      });
      expect(machine.getCpuState().af >> 8).toBe(0x77);
      expect(callWasmExport(machine, `${testCase.prefix}GetCpuPc`)()).toBe(0x0002);
      expect(machine.frames).toBe(0);

      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      const cpuState = machine.getCpuState();
      expect(cpuState.pc).toBe(0x0005);
      expect(cpuState.lastMemoryWrites[0]).toBe(0x4000);
      expect(cpuState.lastMemoryWriteValue).toBe(0x77);
      expect(machine.lastMemoryWritesCount).toBe(1);
      expect(machine.readTestMemory(0x4000)).toBe(0x77);
    });

    it(`${testCase.name} imports port write bus events during StepInto`, async () => {
      const machine = await testCase.createMachine(testRom([0x3e, 0x1d, 0xd3, 0xfe, 0x00]));

      machine.executionContext.debugStepMode = DebugStepMode.StepInto;
      machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);

      expect(machine.lastIoWritePort).toBe(0x1dfe);
      expect(machine.lastIoWriteValue).toBe(0x1d);
      expect(callWasmExport(machine, `${testCase.prefix}GetBorderColor`)()).toBe(5);
    });

    it(`${testCase.name} imports port read bus events during StepInto`, async () => {
      const machine = await testCase.createMachine(testRom([0x3e, 0xfe, 0xdb, 0xfe, 0x00]));

      machine.keyboardDevice.setKeyStatus(0, true);
      callWasmExport(machine, `${testCase.prefix}SetKeyStatus`)(0, 1);
      machine.executionContext.debugStepMode = DebugStepMode.StepInto;
      machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
      expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);

      expect(machine.getCpuState().af >> 8).toBe(0xbe);
      expect(machine.lastIoReadPort).toBe(0xfefe);
      expect(machine.lastIoReadValue).toBe(0xbe);
    });
  }

  it("48K exposes RET and RETN execution flags through WASM debug exports", async () => {
    const retMachine = await createTestSp48WasmMachine(testRom([0xc9]));
    retMachine.writeTestMemory(0x8000, 0x34);
    retMachine.writeTestMemory(0x8001, 0x12);
    retMachine.setTestCpuRegisters({ sp: 0x8000 });
    retMachine.executeOne();

    expect(callWasmExport(retMachine, "sp48GetCpuRetExecuted")()).toBe(1);
    expect(callWasmExport(retMachine, "sp48GetCpuRetnExecuted")()).toBe(0);
    expect(retMachine.getCpuState().pc).toBe(0x1234);

    const retnMachine = await createTestSp48WasmMachine(testRom([0xed, 0x45]));
    retnMachine.writeTestMemory(0x8000, 0x78);
    retnMachine.writeTestMemory(0x8001, 0x56);
    retnMachine.setTestCpuRegisters({ sp: 0x8000 });
    retnMachine.executeOne();
    retnMachine.executeOne();

    expect(callWasmExport(retnMachine, "sp48GetCpuRetExecuted")()).toBe(1);
    expect(callWasmExport(retnMachine, "sp48GetCpuRetnExecuted")()).toBe(1);
    expect(retnMachine.getCpuState().pc).toBe(0x5678);
  });

  it("48K debug loop publishes a completed frame and rendered output", async () => {
    const machine = await createTestSp48WasmMachine(testRom([0x00]));

    machine.executionContext.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.frameJustCompleted).toBe(true);
    expect(machine.frames).toBe(1);
    expect(callWasmExport(machine, "sp48GetFrameCompleted")()).toBe(1);
    expect(machine.getAudioSamples().length).toBeGreaterThan(0);
    expect(machine.getPixelBuffer().some(pixel => pixel !== 0)).toBe(true);
  });

  it("+3E direct WASM instruction stepping refreshes CPU and bus state", async () => {
    const machine = await createTestSpp3eWasmMachine([
      testRom([0x3e, 0x44, 0x32, 0x00, 0x40, 0xd3, 0xfe]),
      testRom([]),
      testRom([]),
      testRom([])
    ]);

    machine.executeOne();
    expect(machine.getTestCpuRegisters()).toMatchObject({
      pc: 0x0002
    });
    expect(machine.getTestCpuRegisters().af >> 8).toBe(0x44);

    machine.executeOne();
    expect(machine.readTestMemory(0x4000)).toBe(0x44);
    expect(callWasmExport(machine, "spp3eGetLastMemoryAddress")()).toBe(0x4000);
    expect(callWasmExport(machine, "spp3eGetLastMemoryValue")()).toBe(0x44);
    expect(callWasmExport(machine, "spp3eGetLastMemoryIsWrite")()).toBe(1);

    machine.executeOne();
    expect(callWasmExport(machine, "spp3eGetLastPortAddress")()).toBe(0x44fe);
    expect(callWasmExport(machine, "spp3eGetLastPortValue")()).toBe(0x44);
    expect(callWasmExport(machine, "spp3eGetLastPortIsWrite")()).toBe(1);
  });
});

function publicDebugCases(): PublicDebugCase[] {
  return [
    {
      name: "ZX Spectrum 48K",
      prefix: "sp48",
      createMachine: rom => createTestSp48WasmMachine(rom)
    },
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createMachine: rom => createTestSp128WasmMachine(rom, testRom([]))
    }
  ];
}

function callWasmExport(machine: DebugMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}
