import { describe, expect, it } from "vitest";

import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  expectNormalizedSamples,
  testRom,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type Prefix = "sp48" | "sp128" | "spp3e";
type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;

type BeeperCase = {
  name: string;
  prefix: Prefix;
  createWasmMachine: () => Promise<WasmMachine>;
};

describe("ZX Spectrum WASM beeper audio parity", () => {
  for (const testCase of beeperCases()) {
    it(`${testCase.name} generates normalized samples for active EAR/MIC output`, async () => {
      const machine = await testCase.createWasmMachine();

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 1000);
      machine.writeTestPort(0x00fe, 0x18);
      machine.executeMachineFrame();

      const sampleCount = getAudioSampleCount(machine, testCase.prefix);
      expect(sampleCount).toBeGreaterThan(0);
      expect(sampleCount).toBeLessThanOrEqual(getAudioSampleCapacity(machine, testCase.prefix));
      expect(rawAudioEnergy(machine)).toBeGreaterThan(0);
      expectNormalizedSamples(machine.getAudioSamples());
    });

    it(`${testCase.name} starts each frame with a fresh non-empty audio collection`, async () => {
      const machine = await testCase.createWasmMachine();

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 1000);
      machine.writeTestPort(0x00fe, 0x18);
      machine.executeMachineFrame();
      const firstCount = getAudioSampleCount(machine, testCase.prefix);
      const firstEnergy = rawAudioEnergy(machine);

      machine.executeMachineFrame();
      const secondCount = getAudioSampleCount(machine, testCase.prefix);
      const secondEnergy = rawAudioEnergy(machine);

      expect(firstCount).toBeGreaterThan(0);
      expect(secondCount).toBeGreaterThan(0);
      expect(secondCount).toBeLessThanOrEqual(getAudioSampleCapacity(machine, testCase.prefix));
      expect(firstEnergy).toBeGreaterThan(0);
      expect(secondEnergy).toBeGreaterThan(0);
    });

    it(`${testCase.name} sample count follows sample rate and clock multiplier`, async () => {
      const lowRateMachine = await testCase.createWasmMachine();
      const highRateMachine = await testCase.createWasmMachine();
      const doubledClockMachine = await testCase.createWasmMachine();

      const lowRateCount = captureFrameSampleCount(lowRateMachine, testCase.prefix, 1000);
      const highRateCount = captureFrameSampleCount(highRateMachine, testCase.prefix, 2000);
      doubledClockMachine.targetClockMultiplier = 2;
      const doubledClockCount = captureFrameSampleCount(doubledClockMachine, testCase.prefix, 1000);

      expect(lowRateCount).toBeGreaterThan(0);
      expect(highRateCount).toBeGreaterThan(lowRateCount);
      expect(doubledClockCount).toBeGreaterThanOrEqual(lowRateCount);
    });

    it(`${testCase.name} CPU-driven 0xfe toggles produce non-zero transitions`, async () => {
      const rom = testRom([
        0x3e, 0x10,
        0xd3, 0xfe,
        0x3e, 0x00,
        0xd3, 0xfe,
        0xc3, 0x00, 0x00
      ]);
      const machine = await testCase.createWasmMachine();

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 1000);
      machine.uploadTestRom(rom);
      machine.executeMachineFrame();

      const rawSamples = rawAudioSamples(machine);
      expect(getAudioSampleCount(machine, testCase.prefix)).toBeGreaterThan(0);
      expect(rawSamples.some(sample => sample !== 0)).toBe(true);
      expect(countDistinctValues(rawSamples)).toBeGreaterThan(1);
      expectNormalizedSamples(machine.getAudioSamples());
    });
  }
});

function beeperCases(): BeeperCase[] {
  return [
    {
      name: "ZX Spectrum 48K",
      prefix: "sp48",
      createWasmMachine: () => createTestSp48WasmMachine(testRom([]))
    },
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: () => createTestSp128WasmMachine(testRom([]), testRom([]))
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: () => createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])])
    }
  ];
}

function captureFrameSampleCount(machine: WasmMachine, prefix: Prefix, sampleRate: number): number {
  machine.setMachineProperty(AUDIO_SAMPLE_RATE, sampleRate);
  machine.writeTestPort(0x00fe, 0x18);
  machine.executeMachineFrame();
  return getAudioSampleCount(machine, prefix);
}

function getAudioSampleCount(machine: WasmMachine, prefix: Prefix): number {
  return callWasmExport(machine, `${prefix}GetAudioSampleCount`)();
}

function getAudioSampleCapacity(machine: WasmMachine, prefix: Prefix): number {
  return callWasmExport(machine, `${prefix}GetAudioSampleCapacity`)();
}

function rawAudioEnergy(machine: WasmMachine): number {
  return rawAudioSamples(machine).reduce((sum, sample) => sum + Math.abs(sample), 0);
}

function rawAudioSamples(machine: WasmMachine): number[] {
  const sampleCount =
    callOptionalWasmExport(machine, "sp48GetAudioSampleCount") ??
    callOptionalWasmExport(machine, "sp128GetAudioSampleCount") ??
    callOptionalWasmExport(machine, "spp3eGetAudioSampleCount") ??
    0;
  return Array.from(machine.wasmV2Runtime!.audioSamples.slice(0, sampleCount * 2));
}

function countDistinctValues(samples: number[]): number {
  return new Set(samples).size;
}

function callWasmExport(machine: WasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}

function callOptionalWasmExport(machine: WasmMachine, name: string): number | undefined {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  return typeof fn === "function" ? (fn as () => number)() : undefined;
}
