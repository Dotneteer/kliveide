import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

type CpuSnapshot = {
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

type StepSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  wasmStopReason?: string;
  cpu: CpuSnapshot;
  memory: {
    writeAddresses: number[];
    writeValue: number | undefined;
    samples: Record<string, number>;
  };
};

/** What one step changes: CPU fields that differ from the previous step, plus the step's writes. */
type StepExpectation = {
  cpu: Partial<CpuSnapshot>;
  writeAddresses?: number[];
  writeValue?: number;
  samples?: Record<string, number>;
};

type CpuStepCase = {
  name: string;
  code: number[];
  memorySamples?: number[];
  steps: StepExpectation[];
};

const START_ADDRESS = 0x8000;
const MEMORY_SAMPLES = [START_ADDRESS, 0x9000, 0xc000];

/** The registers `seedCpuRegisters` sets, plus the reset state of the rest. */
const SEEDED_CPU: CpuSnapshot = {
  af: 0x1234,
  bc: 0x5678,
  de: 0x9abc,
  hl: 0xdef0,
  af_: 0x0102,
  bc_: 0x0304,
  de_: 0x0506,
  hl_: 0x0708,
  ix: 0x1111,
  iy: 0x2222,
  ir: 0x3344,
  wz: 0x5566,
  pc: START_ADDRESS,
  sp: 0xff00,
  prefix: 0,
  halted: false,
  interruptMode: 0,
  iff1: false,
  iff2: false,
  tacts: 0,
  currentFrameTact: 0,
  frames: 0
};

/**
 * Single-stepping (`DebugStepMode.StepInto`) through the WASM debug loop: every step stops with a
 * debug event after exactly one instruction. Register results, PC, R (+1 per M1) and WZ follow from
 * the Z80 semantics of each instruction. The T-state counts and `currentFrameTact` are pinned: they
 * are the values both the TypeScript and the WASM core agreed on at tag
 * `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Spectrum Next WASM CPU single step", () => {
  const cases: CpuStepCase[] = [
    {
      name: "executes Z80N register and immediate loads",
      code: [
        0x3e, 0x77,
        0x06, 0x12,
        0x0e, 0x34,
        0x11, 0x67, 0x45,
        0x21, 0xab, 0x89,
        0x31, 0xdc, 0xfe,
        0x00
      ],
      steps: [
        // --- LD A,$77
        { cpu: { af: 0x7734, ir: 0x3345, pc: 0x8002, tacts: 7, currentFrameTact: 14 } },
        // --- LD B,$12
        { cpu: { bc: 0x1278, ir: 0x3346, pc: 0x8004, tacts: 14, currentFrameTact: 28 } },
        // --- LD C,$34
        { cpu: { bc: 0x1234, ir: 0x3347, pc: 0x8006, tacts: 21, currentFrameTact: 42 } },
        // --- LD DE,$4567
        { cpu: { de: 0x4567, ir: 0x3348, pc: 0x8009, tacts: 31, currentFrameTact: 62 } },
        // --- LD HL,$89AB
        { cpu: { hl: 0x89ab, ir: 0x3349, pc: 0x800c, tacts: 41, currentFrameTact: 82 } },
        // --- LD SP,$FEDC
        { cpu: { sp: 0xfedc, ir: 0x334a, pc: 0x800f, tacts: 51, currentFrameTact: 102 } },
        // --- NOP
        { cpu: { ir: 0x334b, pc: 0x8010, tacts: 55, currentFrameTact: 110 } }
      ]
    },
    {
      name: "executes Z80N absolute memory read, write, and WZ side effects",
      code: [
        0x3e, 0x5a,
        0x32, 0x00, 0xc0,
        0x3a, 0x00, 0xc0
      ],
      memorySamples: [0xc000],
      steps: [
        // --- LD A,$5A
        { cpu: { af: 0x5a34, ir: 0x3345, pc: 0x8002, tacts: 7, currentFrameTact: 14 } },
        // --- LD ($C000),A: WZ = A:(nn + 1) low byte
        {
          cpu: { ir: 0x3346, wz: 0x5a01, pc: 0x8005, tacts: 20, currentFrameTact: 40 },
          writeAddresses: [0xc000],
          writeValue: 0x5a,
          samples: { c000: 0x5a }
        },
        // --- LD A,($C000): WZ = nn + 1
        { cpu: { ir: 0x3347, wz: 0xc001, pc: 0x8008, tacts: 33, currentFrameTact: 66 } }
      ]
    },
    {
      name: "executes Z80N absolute jump flow",
      code: [
        0xc3, 0x08, 0x80,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x3e, 0x22
      ],
      steps: [
        // --- JP $8008: WZ = target
        { cpu: { wz: 0x8008, ir: 0x3345, pc: 0x8008, tacts: 10, currentFrameTact: 20 } },
        // --- LD A,$22
        { cpu: { af: 0x2234, ir: 0x3346, pc: 0x800a, tacts: 17, currentFrameTact: 34 } }
      ]
    },
    {
      name: "applies 28 MHz memory-read wait-state timing",
      code: [
        0xed, 0x91, 0x07, 0x03,
        0x3a, 0x00, 0x80,
        0x00
      ],
      steps: [
        // --- NEXTREG $07,$03 (28 MHz)
        { cpu: { ir: 0x3345, pc: 0x8004, tacts: 20, currentFrameTact: 40 } },
        // --- LD A,($8000): A = $ED, WZ = nn + 1
        { cpu: { af: 0xed34, wz: 0x8001, ir: 0x3346, pc: 0x8007, tacts: 37, currentFrameTact: 44 } },
        // --- NOP
        { cpu: { ir: 0x3347, pc: 0x8008, tacts: 42, currentFrameTact: 45 } }
      ]
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const wasm = await createTestZxNextWasmMachine();
      initializeCpuStepMachine(wasm, testCase.code);
      const sampleAddresses = [...MEMORY_SAMPLES, ...(testCase.memorySamples ?? [])];

      let expectedCpu = SEEDED_CPU;
      let expectedSamples: Record<string, number> = {
        ...Object.fromEntries(sampleAddresses.map(address => [hexKey(address), 0])),
        [hexKey(START_ADDRESS)]: testCase.code[0]
      };
      testCase.steps.forEach((step, index) => {
        expectedCpu = { ...expectedCpu, ...step.cpu };
        expectedSamples = { ...expectedSamples, ...step.samples };
        expect(executeAndSnapshot(wasm, sampleAddresses), `step ${index + 1}`).toEqual({
          termination: FrameTerminationMode.DebugEvent,
          lastTerminationReason: FrameTerminationMode.DebugEvent,
          wasmStopReason: "debugStep",
          cpu: expectedCpu,
          memory: {
            writeAddresses: step.writeAddresses ?? [],
            writeValue: step.writeValue,
            samples: expectedSamples
          }
        });
      });
    });
  }
});

function hexKey(address: number): string {
  return address.toString(16).padStart(4, "0");
}

function initializeCpuStepMachine(machine: ZxNextWasmV2Machine, code: number[]): void {
  machine.hardReset();
  seedCpuRegisters(machine);
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

function seedCpuRegisters(machine: ZxNextWasmV2Machine): void {
  machine.af = SEEDED_CPU.af;
  machine.bc = SEEDED_CPU.bc;
  machine.de = SEEDED_CPU.de;
  machine.hl = SEEDED_CPU.hl;
  machine.af_ = SEEDED_CPU.af_;
  machine.bc_ = SEEDED_CPU.bc_;
  machine.de_ = SEEDED_CPU.de_;
  machine.hl_ = SEEDED_CPU.hl_;
  machine.ix = SEEDED_CPU.ix;
  machine.iy = SEEDED_CPU.iy;
  machine.ir = SEEDED_CPU.ir;
  machine.wz = SEEDED_CPU.wz;
  machine.sp = SEEDED_CPU.sp;
}

function executeAndSnapshot(machine: ZxNextWasmV2Machine, sampleAddresses: number[]): StepSnapshot {
  const termination = machine.executeMachineFrame();
  const cpu = machine.getCpuState();

  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    wasmStopReason: machine.getWasmV2Diagnostics().lastWasmStopReason,
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
      writeAddresses: Array.from(machine.lastMemoryWrites.slice(0, machine.lastMemoryWritesCount)),
      writeValue: machine.lastMemoryWritesCount > 0 ? cpu.lastMemoryWriteValue : undefined,
      samples: Object.fromEntries(
        sampleAddresses.map(address => [hexKey(address), machine.doReadMemory(address)])
      )
    }
  };
}
