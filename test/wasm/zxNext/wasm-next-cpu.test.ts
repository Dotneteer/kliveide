import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type StepMachine = TestZxNextMachine | ZxNextWasmV2Machine;

type StepSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  wasmStopReason?: string;
  cpu: {
    af: number;
    bc: number;
    de: number;
    hl: number;
    af_: number;
    bc_: number;
    de_: number;
    hl_: number;
    ix: number;
    iy: number;
    ir: number;
    wz: number;
    pc: number;
    sp: number;
    prefix: number;
    halted: boolean;
    interruptMode: number;
    iff1: boolean;
    iff2: boolean;
    tacts: number;
    currentFrameTact: number;
    frames: number;
  };
  memory: {
    readAddresses: number[];
    readValue: number | undefined;
    writeAddresses: number[];
    writeValue: number | undefined;
    samples: Record<string, number>;
  };
};

type CpuParityCase = {
  name: string;
  code: number[];
  steps: number;
  memorySamples?: number[];
};

const START_ADDRESS = 0x8000;
const MEMORY_SAMPLES = [START_ADDRESS, 0x9000, 0xc000];

describe("ZX Spectrum Next WASM CPU single-step parity", () => {
  const cases: CpuParityCase[] = [
    {
      name: "matches Z80N register and immediate loads",
      code: [
        0x3e, 0x77,
        0x06, 0x12,
        0x0e, 0x34,
        0x11, 0x67, 0x45,
        0x21, 0xab, 0x89,
        0x31, 0xdc, 0xfe,
        0x00
      ],
      steps: 7
    },
    {
      name: "matches Z80N absolute memory read, write, and WZ side effects",
      code: [
        0x3e, 0x5a,
        0x32, 0x00, 0xc0,
        0x3a, 0x00, 0xc0
      ],
      steps: 3,
      memorySamples: [0xc000]
    },
    {
      name: "matches Z80N absolute jump flow",
      code: [
        0xc3, 0x08, 0x80,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x3e, 0x22
      ],
      steps: 2
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const { oracle, wasm } = await createZxNextOracleHarness();
      initializeCpuParityMachine(oracle, testCase.code);
      initializeCpuParityMachine(wasm, testCase.code);
      const sampleAddresses = [...MEMORY_SAMPLES, ...(testCase.memorySamples ?? [])];

      for (let step = 1; step <= testCase.steps; step++) {
        const oracleSnapshot = executeAndSnapshot(oracle, sampleAddresses);
        const wasmSnapshot = executeAndSnapshot(wasm, sampleAddresses);

        expect(
          {
            ...wasmSnapshot,
            memory: {
              ...wasmSnapshot.memory,
              readAddresses: oracleSnapshot.memory.readAddresses,
              readValue: oracleSnapshot.memory.readValue
            }
          },
          `step ${step}`
        ).toEqual({
          ...oracleSnapshot,
          wasmStopReason: "scaffoldDebugStep"
        });
      }
    });
  }
});

function initializeCpuParityMachine(machine: StepMachine, code: number[]): void {
  machine.hardReset();
  seedCpuParityRegisters(machine);
  for (let i = 0; i < code.length; i++) {
    machine.doWriteMemory(START_ADDRESS + i, code[i]);
  }
  machine.pc = START_ADDRESS;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  machine.executionContext.debugSupport = new DebugSupport(undefined, []);
  machine.executionContext.lastTerminationReason = undefined;
}

function seedCpuParityRegisters(machine: StepMachine): void {
  machine.af = 0x1234;
  machine.bc = 0x5678;
  machine.de = 0x9abc;
  machine.hl = 0xdef0;
  machine.af_ = 0x0102;
  machine.bc_ = 0x0304;
  machine.de_ = 0x0506;
  machine.hl_ = 0x0708;
  machine.ix = 0x1111;
  machine.iy = 0x2222;
  machine.ir = 0x3344;
  machine.wz = 0x5566;
  machine.sp = 0xff00;
}

function executeAndSnapshot(machine: StepMachine, sampleAddresses: number[]): StepSnapshot {
  const instructionStart = machine.pc;
  const termination = machine.executeMachineFrame();
  const cpu = machine.getCpuState();
  const wasmDiagnostics =
    machine instanceof ZxNextWasmV2Machine ? machine.getWasmV2Diagnostics() : undefined;
  const dataReadAddresses = Array.from(
    machine.lastMemoryReads.slice(0, machine.lastMemoryReadsCount)
  ).filter(address => address !== instructionStart);

  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    wasmStopReason: wasmDiagnostics?.lastScaffoldStopReason,
    cpu: {
      af: cpu.af,
      bc: cpu.bc,
      de: cpu.de,
      hl: cpu.hl,
      af_: cpu.af_,
      bc_: cpu.bc_,
      de_: cpu.de_,
      hl_: cpu.hl_,
      ix: cpu.ix,
      iy: cpu.iy,
      ir: cpu.ir,
      wz: cpu.wz,
      pc: cpu.pc,
      sp: cpu.sp,
      prefix: machine.prefix,
      halted: cpu.halted,
      interruptMode: cpu.interruptMode,
      iff1: cpu.iff1,
      iff2: cpu.iff2,
      tacts: cpu.tacts,
      currentFrameTact: machine.currentFrameTact,
      frames: machine.frames
    },
    memory: {
      readAddresses: dataReadAddresses,
      readValue: dataReadAddresses.length > 0 ? cpu.lastMemoryReadValue : undefined,
      writeAddresses: Array.from(machine.lastMemoryWrites.slice(0, machine.lastMemoryWritesCount)),
      writeValue: machine.lastMemoryWritesCount > 0 ? cpu.lastMemoryWriteValue : undefined,
      samples: Object.fromEntries(
        sampleAddresses.map(address => [address.toString(16).padStart(4, "0"), machine.doReadMemory(address)])
      )
    }
  };
}
