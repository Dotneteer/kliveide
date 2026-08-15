import { describe, expect, it } from "vitest";

import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";

import {
  createOracleSp128Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  expectNormalizedSamples,
  testRom,
  type TestOracleSp128Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type Prefix = "sp128" | "spp3e";
type PsgWasmMachine = TestSp128WasmMachine | TestSpp3eWasmMachine;
type PsgOracleMachine = TestOracleSp128Machine | TestOracleSpp3eMachine;

type PsgCase = {
  name: string;
  prefix: Prefix;
  createWasmMachine: () => Promise<PsgWasmMachine>;
  createOracleMachine: () => Promise<PsgOracleMachine>;
};

describe("ZX Spectrum WASM PSG register and audio parity", () => {
  it("48K keeps PSG ports on the 48K fallback contract", async () => {
    const machine = await createTestSp48WasmMachine(testRom([]));

    machine.writeTestPort(0xfffd, 0x08);
    machine.writeTestPort(0xbffd, 0x0f);

    expect(hasWasmExport(machine, "sp48GetPsgRegisterIndex")).toBe(false);
    expect(machine.readTestPort(0xfffd)).toBe(0xff);
    expect(machine.readTestPort(0xbffd)).toBe(0xff);
  });

  for (const testCase of psgCases()) {
    it(`${testCase.name} resets PSG registers and selected index like TypeScript`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterIndex`)()).toBe(
        oracleMachine.psgDevice.getPsgState().psgRegisterIndex
      );
      for (const register of [0, 1, 6, 8, 13]) {
        expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterValue`)(register), `R${register}`).toBe(
          oracleMachine.psgDevice.getPsgState().regValues[register]
        );
      }
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterValue`)(7)).toBe(0x00);
      expect(oracleMachine.psgDevice.getPsgState().regValues[7]).toBe(0xff);
    });

    it(`${testCase.name} applies register index and read masks`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      for (const [register, value, masked] of [
        [1, 0xff, 0x0f],
        [6, 0xff, 0x1f],
        [8, 0xff, 0x1f],
        [13, 0xff, 0x0f]
      ] as const) {
        setPsgRegister(wasmMachine, oracleMachine, testCase.prefix, register, value);

        expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterIndex`)()).toBe(register);
        expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterValue`)(register)).toBe(
          oracleMachine.psgDevice.getPsgState().regValues[register]
        );
        expect(callWasmExport(wasmMachine, `${testCase.prefix}ReadPsgRegisterValue`)()).toBe(masked);
        expect(oracleMachine.psgDevice.readPsgRegisterValue()).toBe(masked);
      }
    });

    it(`${testCase.name} decodes PSG index/data ports like TypeScript`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      wasmMachine.writeTestPort(0xfffd, 0x18);
      oracleMachine.writeTestPort(0xfffd, 0x18);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgRegisterIndex`)()).toBe(
        oracleMachine.psgDevice.getPsgState().psgRegisterIndex
      );

      wasmMachine.writeTestPort(0xbffd, 0x07);
      oracleMachine.writeTestPort(0xbffd, 0x07);

      expect(wasmMachine.readTestPort(0xfffd)).toBe(oracleMachine.readTestPort(0xfffd));
      expect(wasmMachine.readTestPort(0xfffd)).toBe(0x07);
    });

    it(`${testCase.name} updates tone period, mixer, and volume state`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      setPsgRegister(wasmMachine, oracleMachine, testCase.prefix, 0, 0x34);
      setPsgRegister(wasmMachine, oracleMachine, testCase.prefix, 1, 0x12);
      setPsgRegister(wasmMachine, oracleMachine, testCase.prefix, 7, 0x3e);
      setPsgRegister(wasmMachine, oracleMachine, testCase.prefix, 8, 0x1f);

      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgToneA`)()).toBe(
        oracleMachine.psgDevice.getPsgState().toneA
      );
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgToneA`)()).toBe(0x0234);
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgVolumeA`)()).toBe(
        oracleMachine.psgDevice.getPsgState().volA
      );
      expect(callWasmExport(wasmMachine, `${testCase.prefix}GetPsgVolumeA`)()).toBe(0x0f);
      expect(oracleMachine.psgDevice.getPsgState().toneAEnabled).toBe(true);
      expect(oracleMachine.psgDevice.getPsgState().toneBEnabled).toBe(false);
      expect(oracleMachine.psgDevice.getPsgState().toneCEnabled).toBe(false);
    });

    it(`${testCase.name} generates normalized tone audio and reacts to mixer disable`, async () => {
      const toneMachine = await testCase.createWasmMachine();
      const mutedMachine = await testCase.createWasmMachine();

      const toneEnergy = capturePsgEnergy(toneMachine, testCase.prefix, () => {
        configureToneA(toneMachine, testCase.prefix, 4, 0x3e, 0x0f);
      });
      const mutedEnergy = capturePsgEnergy(mutedMachine, testCase.prefix, () => {
        configureToneA(mutedMachine, testCase.prefix, 4, 0x3f, 0x0f);
      });

      expect(toneEnergy).toBeGreaterThan(0);
      expect(mutedEnergy).toBeLessThan(toneEnergy);
      expectNormalizedSamples(toneMachine.getAudioSamples());
      expectNormalizedSamples(mutedMachine.getAudioSamples());
    });

    it(`${testCase.name} noise-only output has non-zero varied samples`, async () => {
      const machine = await testCase.createWasmMachine();

      const energy = capturePsgEnergy(machine, testCase.prefix, () => {
        setPsgRegister(machine, undefined, testCase.prefix, 6, 0x00);
        setPsgRegister(machine, undefined, testCase.prefix, 7, 0x37);
        setPsgRegister(machine, undefined, testCase.prefix, 8, 0x0f);
      }, 44100);

      const samples = rawAudioSamples(machine, testCase.prefix);
      expect(energy).toBeGreaterThan(0);
      expect(samples.filter(sample => sample !== 0).length).toBeGreaterThan(samples.length / 4);
      expect(new Set(samples).size).toBeGreaterThan(8);
      expectNormalizedSamples(machine.getAudioSamples());
    });

    it(`${testCase.name} envelope-shaped volume produces PSG output`, async () => {
      const machine = await testCase.createWasmMachine();

      const energy = capturePsgEnergy(machine, testCase.prefix, () => {
        setPsgRegister(machine, undefined, testCase.prefix, 0, 0x04);
        setPsgRegister(machine, undefined, testCase.prefix, 7, 0x3e);
        setPsgRegister(machine, undefined, testCase.prefix, 8, 0x10);
        setPsgRegister(machine, undefined, testCase.prefix, 11, 0x02);
        setPsgRegister(machine, undefined, testCase.prefix, 12, 0x00);
        setPsgRegister(machine, undefined, testCase.prefix, 13, 0x0e);
      }, 44100);

      expect(energy).toBeGreaterThan(0);
      expect(callWasmExport(machine, `${testCase.prefix}GetPsgCurrentOutput`)()).toBeGreaterThanOrEqual(0);
      expectNormalizedSamples(machine.getAudioSamples());
    });

    it(`${testCase.name} beeper and PSG mixed output remains normalized`, async () => {
      const beeperMachine = await testCase.createWasmMachine();
      const psgMachine = await testCase.createWasmMachine();
      const mixedMachine = await testCase.createWasmMachine();

      const beeperEnergy = capturePsgEnergy(beeperMachine, testCase.prefix, () => {
        beeperMachine.writeTestPort(0x00fe, 0x18);
      }, 44100);
      const psgEnergy = capturePsgEnergy(psgMachine, testCase.prefix, () => {
        configureToneA(psgMachine, testCase.prefix, 4, 0x3e, 0x0f);
      }, 44100);
      const mixedEnergy = capturePsgEnergy(mixedMachine, testCase.prefix, () => {
        mixedMachine.writeTestPort(0x00fe, 0x18);
        configureToneA(mixedMachine, testCase.prefix, 4, 0x3e, 0x0f);
      }, 44100);

      expect(beeperEnergy).toBeGreaterThan(0);
      expect(psgEnergy).toBeGreaterThan(0);
      expect(mixedEnergy).toBeGreaterThan(beeperEnergy);
      expectNormalizedSamples(mixedMachine.getAudioSamples());
    });

    it(`${testCase.name} mid-frame PSG register changes affect later output`, async () => {
      const machine = await testCase.createWasmMachine();

      machine.setMachineProperty(AUDIO_SAMPLE_RATE, 1000);
      configureToneA(machine, testCase.prefix, 4, 0x3e, 0x02);
      machine.setAbsoluteTacts(Math.floor(machine.tactsInFrame / 2));
      setPsgRegister(machine, undefined, testCase.prefix, 8, 0x0f);
      machine.executeMachineFrame();

      const samples = rawAudioSamples(machine, testCase.prefix);
      const firstHalfEnergy = samples.slice(0, Math.floor(samples.length / 2))
        .reduce((sum, sample) => sum + Math.abs(sample), 0);
      const secondHalfEnergy = samples.slice(Math.floor(samples.length / 2))
        .reduce((sum, sample) => sum + Math.abs(sample), 0);

      expect(firstHalfEnergy).toBeGreaterThan(0);
      expect(secondHalfEnergy).toBeGreaterThan(0);
      expect(secondHalfEnergy).not.toBe(firstHalfEnergy);
      expectNormalizedSamples(machine.getAudioSamples());
    });
  }

  it("+3E exposes B and C tone/volume debug state", async () => {
    const machine = await createTestSpp3eWasmMachine();

    setPsgRegister(machine, undefined, "spp3e", 2, 0x20);
    setPsgRegister(machine, undefined, "spp3e", 3, 0x01);
    setPsgRegister(machine, undefined, "spp3e", 4, 0x30);
    setPsgRegister(machine, undefined, "spp3e", 5, 0x02);
    setPsgRegister(machine, undefined, "spp3e", 9, 0x1e);
    setPsgRegister(machine, undefined, "spp3e", 10, 0x1d);

    expect(callWasmExport(machine, "spp3eGetPsgToneB")()).toBe(0x0120);
    expect(callWasmExport(machine, "spp3eGetPsgToneC")()).toBe(0x0230);
    expect(callWasmExport(machine, "spp3eGetPsgVolumeB")()).toBe(0x0e);
    expect(callWasmExport(machine, "spp3eGetPsgVolumeC")()).toBe(0x0d);
  });
});

function psgCases(): PsgCase[] {
  return [
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: () => createTestSp128WasmMachine(testRom([]), testRom([])),
      createOracleMachine: () => createOracleSp128Machine(testRom([]), testRom([]))
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: () => createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]),
      createOracleMachine: () => createOracleSpp3eMachine([testRom([]), testRom([]), testRom([]), testRom([])])
    }
  ];
}

function setPsgRegister(
  wasmMachine: PsgWasmMachine,
  oracleMachine: PsgOracleMachine | undefined,
  prefix: Prefix,
  register: number,
  value: number
): void {
  callWasmExport(wasmMachine, `${prefix}SetPsgRegisterIndex`)(register);
  callWasmExport(wasmMachine, `${prefix}WritePsgRegisterValue`)(value);
  oracleMachine?.psgDevice.setPsgRegisterIndex(register);
  oracleMachine?.psgDevice.writePsgRegisterValue(value);
}

function configureToneA(
  machine: PsgWasmMachine,
  prefix: Prefix,
  period: number,
  mixer: number,
  volume: number
): void {
  setPsgRegister(machine, undefined, prefix, 0, period & 0xff);
  setPsgRegister(machine, undefined, prefix, 1, (period >> 8) & 0x0f);
  setPsgRegister(machine, undefined, prefix, 7, mixer);
  setPsgRegister(machine, undefined, prefix, 8, volume);
}

function capturePsgEnergy(
  machine: PsgWasmMachine,
  prefix: Prefix,
  configure: () => void,
  sampleRate = 1000
): number {
  machine.setMachineProperty(AUDIO_SAMPLE_RATE, sampleRate);
  configure();
  machine.executeMachineFrame();
  return rawAudioSamples(machine, prefix).reduce((sum, sample) => sum + Math.abs(sample), 0);
}

function rawAudioSamples(machine: PsgWasmMachine, prefix: Prefix): number[] {
  const sampleCount = callWasmExport(machine, `${prefix}GetAudioSampleCount`)();
  return Array.from(machine.wasmV2Runtime!.audioSamples.slice(0, sampleCount * 2));
}

function callWasmExport(machine: PsgWasmMachine | TestSp48WasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}

function hasWasmExport(machine: TestSp48WasmMachine, name: string): boolean {
  return typeof (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name] === "function";
}
