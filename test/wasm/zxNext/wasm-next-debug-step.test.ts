import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type BreakpointMachine = TestZxNextMachine | ZxNextWasmV2Machine;

type BreakpointCase = {
  name: string;
  startAddress: number;
  breakpointAddress: number;
  code: number[];
  expectedInstructions: number;
};

type BreakpointSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  pc: number;
  executedInstructions: number;
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
    sp: number;
    prefix: number;
    halted: boolean;
    interruptMode: number;
    iff1: boolean;
    iff2: boolean;
    tacts: number;
    currentFrameTact: number;
  };
  disassembly: {
    hasSectionAtPc: boolean;
    preview: number[];
  };
};

describe("ZX Spectrum Next WASM debug breakpoint parity", () => {
  const cases: BreakpointCase[] = [
    {
      name: "pauses at the required $0001 execution breakpoint",
      startAddress: 0x0000,
      breakpointAddress: 0x0001,
      code: [0x00, 0x3e, 0x42, 0x00, 0x00],
      expectedInstructions: 1
    },
    {
      name: "pauses after multiple deterministic CPU steps in RAM",
      startAddress: 0x8000,
      breakpointAddress: 0x8005,
      code: [0x3e, 0x77, 0x01, 0x34, 0x12, 0x00],
      expectedInstructions: 2
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const { oracle, wasm } = await createZxNextOracleHarness();
      initializeBreakpointMachine(oracle, testCase);
      initializeBreakpointMachine(wasm, testCase);

      const oracleSnapshot = executeUntilBreakpoint(oracle, testCase.expectedInstructions);
      const wasmSnapshot = executeUntilBreakpoint(
        wasm,
        wasm.getWasmV2Diagnostics().debugSteps + testCase.expectedInstructions
      );

      expect(wasmSnapshot).toEqual(oracleSnapshot);
      expect(oracleSnapshot).toMatchObject({
        termination: FrameTerminationMode.DebugEvent,
        lastTerminationReason: FrameTerminationMode.DebugEvent,
        pc: testCase.breakpointAddress,
        executedInstructions: testCase.expectedInstructions
      });
      expect(oracleSnapshot.disassembly.hasSectionAtPc).toBe(true);
    });
  }
});

function initializeBreakpointMachine(machine: BreakpointMachine, testCase: BreakpointCase): void {
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

function seedBreakpointRegisters(machine: BreakpointMachine): void {
  machine.af = 0x1200;
  machine.bc = 0x3456;
  machine.de = 0x789a;
  machine.hl = 0xbcde;
  machine.af_ = 0x0102;
  machine.bc_ = 0x0304;
  machine.de_ = 0x0506;
  machine.hl_ = 0x0708;
  machine.ix = 0x1111;
  machine.iy = 0x2222;
  machine.ir = 0x3300;
  machine.wz = 0x4444;
  machine.sp = 0xff00;
}

function loadBreakpointProgram(
  machine: BreakpointMachine,
  startAddress: number,
  code: number[]
): void {
  for (let i = 0; i < code.length; i++) {
    writeLoadedByte(machine, (startAddress + i) & 0xffff, code[i]);
  }
}

function writeLoadedByte(machine: BreakpointMachine, address: number, value: number): void {
  if (machine instanceof TestZxNextMachine) {
    const page = machine.memoryDevice.getPageInfo(address >>> 13);
    machine.memoryDevice.memory[page.readOffset + (address & 0x1fff)] = value;
    if (page.writeOffset != null) {
      machine.memoryDevice.memory[page.writeOffset + (address & 0x1fff)] = value;
    }
    return;
  }
  machine.doWriteMemory(address, value);
}

function executeUntilBreakpoint(
  machine: BreakpointMachine,
  expectedExecutedInstructions: number
): BreakpointSnapshot {
  const debugStepsBefore =
    machine instanceof ZxNextWasmV2Machine ? machine.getWasmV2Diagnostics().debugSteps : 0;
  const termination = machine.executeMachineFrame();
  const debugStepsAfter =
    machine instanceof ZxNextWasmV2Machine ? machine.getWasmV2Diagnostics().debugSteps : 0;
  const cpu = machine.getCpuState();
  const executedInstructions =
    machine instanceof ZxNextWasmV2Machine
      ? debugStepsAfter - debugStepsBefore
      : expectedExecutedInstructions;
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
    executedInstructions,
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
