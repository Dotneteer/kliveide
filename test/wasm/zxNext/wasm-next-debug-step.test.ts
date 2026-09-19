import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

type BreakpointCpu = {
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
  sp: number;
  prefix: number;
  halted: boolean;
  interruptMode: number;
  iff1: boolean;
  iff2: boolean;
  tacts: number;
  currentFrameTact: number;
};

type BreakpointSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  pc: number;
  executedInstructions: number;
  cpu: BreakpointCpu;
  disassembly: {
    hasSectionAtPc: boolean;
    preview: number[];
  };
};

type BreakpointCase = {
  name: string;
  startAddress: number;
  breakpointAddress: number;
  code: number[];
  expectedInstructions: number;
  /** CPU fields that differ from the seeded state when the breakpoint stops the frame */
  expectedCpu: Partial<BreakpointCpu>;
  expectedPreview: number[];
};

/** The registers `seedBreakpointRegisters` sets, plus the reset state of the rest. */
const SEEDED_CPU: BreakpointCpu = {
  af: 0x1200,
  bc: 0x3456,
  de: 0x789a,
  hl: 0xbcde,
  af_: 0x0102,
  bc_: 0x0304,
  de_: 0x0506,
  hl_: 0x0708,
  ix: 0x1111,
  iy: 0x2222,
  ir: 0x3300,
  wz: 0x4444,
  sp: 0xff00,
  prefix: 0,
  halted: false,
  interruptMode: 0,
  iff1: false,
  iff2: false,
  tacts: 0,
  currentFrameTact: 0
};

/**
 * Execution breakpoints through the WASM debug loop (`DebugStepMode.StopAtBreakpoint`). Register
 * results, R (+1 per M1) and the memory preview at PC follow from the programs. The T-state counts
 * and `currentFrameTact` are pinned: they are the values both the TypeScript and the WASM core agreed
 * on at tag `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Spectrum Next WASM debug breakpoints", () => {
  const cases: BreakpointCase[] = [
    {
      name: "pauses at the required $0001 execution breakpoint",
      startAddress: 0x0000,
      breakpointAddress: 0x0001,
      // --- NOP / LD A,$42 / NOP / NOP
      code: [0x00, 0x3e, 0x42, 0x00, 0x00],
      expectedInstructions: 1,
      expectedCpu: { ir: 0x3301, tacts: 4, currentFrameTact: 8 },
      expectedPreview: [0x3e, 0x42, 0x00, 0x00]
    },
    {
      name: "pauses after multiple deterministic CPU steps in RAM",
      startAddress: 0x8000,
      breakpointAddress: 0x8005,
      // --- LD A,$77 / LD BC,$1234 / NOP
      code: [0x3e, 0x77, 0x01, 0x34, 0x12, 0x00],
      expectedInstructions: 2,
      expectedCpu: { af: 0x7700, bc: 0x1234, ir: 0x3302, tacts: 17, currentFrameTact: 34 },
      expectedPreview: [0x00, 0x00, 0x00, 0x00]
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const wasm = await createTestZxNextWasmMachine();
      initializeBreakpointMachine(wasm, testCase);

      expect(executeUntilBreakpoint(wasm)).toEqual({
        termination: FrameTerminationMode.DebugEvent,
        lastTerminationReason: FrameTerminationMode.DebugEvent,
        pc: testCase.breakpointAddress,
        executedInstructions: testCase.expectedInstructions,
        cpu: { ...SEEDED_CPU, ...testCase.expectedCpu },
        disassembly: {
          hasSectionAtPc: true,
          preview: testCase.expectedPreview
        }
      });
    });
  }
});

function initializeBreakpointMachine(machine: ZxNextWasmV2Machine, testCase: BreakpointCase): void {
  machine.hardReset();
  seedBreakpointRegisters(machine);
  loadBreakpointProgram(machine, testCase.startAddress, testCase.code);
  machine.pc = testCase.startAddress;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  machine.executionContext.debugSupport = new DebugSupport(undefined, [
    { address: testCase.breakpointAddress, exec: true }
  ]);
  machine.executionContext.lastTerminationReason = undefined;
}

function seedBreakpointRegisters(machine: ZxNextWasmV2Machine): void {
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

function loadBreakpointProgram(
  machine: ZxNextWasmV2Machine,
  startAddress: number,
  code: number[]
): void {
  for (let i = 0; i < code.length; i++) {
    writeLoadedByte(machine, (startAddress + i) & 0xffff, code[i]);
  }
}

function writeLoadedByte(machine: ZxNextWasmV2Machine, address: number, value: number): void {
  const partition = machine.getPartition(address);
  if (partition != null) {
    // --- `getPartition` already answers in the same index space `getMemoryPartition` expects, so
    // --- there is nothing to convert. This used to double a positive partition and add the page's
    // --- low bit, compensating by hand for the two functions disagreeing: the resolver returned a
    // --- 16K bank while `getMemoryPartition` indexed 8K pages. See `.plans/NEX_DEBUGGING_PLAN.md`
    // --- §4.1 (Q9), which made the resolver answer in 8K pages and removed the mismatch.
    const memoryPartition = partition;
    const partitionBytes = machine.getMemoryPartition(memoryPartition);
    partitionBytes[address & (partition < 0 ? 0x3fff : 0x1fff)] = value;
  } else {
    machine.doWriteMemory(address, value);
  }
}

function executeUntilBreakpoint(machine: ZxNextWasmV2Machine): BreakpointSnapshot {
  const debugStepsBefore = machine.getWasmV2Diagnostics().debugSteps;
  const termination = machine.executeMachineFrame();
  const debugStepsAfter = machine.getWasmV2Diagnostics().debugSteps;
  const cpu = machine.getCpuState();
  const disassemblySections = machine.getDisassemblySections({ ram: true, screen: true });
  const preview = [
    machine.doReadMemory(cpu.pc),
    machine.doReadMemory((cpu.pc + 1) & 0xffff),
    machine.doReadMemory((cpu.pc + 2) & 0xffff),
    machine.doReadMemory((cpu.pc + 3) & 0xffff)
  ];

  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    pc: cpu.pc,
    executedInstructions: debugStepsAfter - debugStepsBefore,
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
      sp: cpu.sp,
      prefix: machine.prefix,
      halted: cpu.halted,
      interruptMode: cpu.interruptMode,
      iff1: cpu.iff1,
      iff2: cpu.iff2,
      tacts: cpu.tacts,
      currentFrameTact: machine.currentFrameTact
    },
    disassembly: {
      hasSectionAtPc: disassemblySections.some(
        section =>
          section.sectionType === MemorySectionType.Disassemble &&
          section.startAddress <= cpu.pc &&
          section.endAddress >= cpu.pc
      ),
      preview
    }
  };
}
