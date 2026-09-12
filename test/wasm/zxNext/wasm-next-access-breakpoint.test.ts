import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type AccessMachine = TestZxNextMachine | ZxNextWasmV2Machine;

type AccessCase = {
  name: string;
  code: number[];
  breakpoint: BreakpointInfo;
  expectedPc: number;
};

const START_ADDRESS = 0x8000;

/**
 * The WASM debug loop only mirrors the core's bus activity when a breakpoint actually watches for
 * it, so these cases are what stands between that optimisation and silently dead watchpoints. Each
 * one is checked against the TypeScript machine rather than against a hard-coded expectation.
 */
describe("ZX Spectrum Next WASM access breakpoint parity", () => {
  const cases: AccessCase[] = [
    {
      name: "stops on a watched memory write",
      // --- LD A,$77 / LD ($9000),A / NOP
      code: [0x3e, 0x77, 0x32, 0x00, 0x90, 0x00],
      breakpoint: { address: 0x9000, memoryWrite: true },
      expectedPc: 0x8005
    },
    {
      name: "stops on a watched memory read",
      // --- LD A,($9010) / NOP
      code: [0x3a, 0x10, 0x90, 0x00],
      breakpoint: { address: 0x9010, memoryRead: true },
      expectedPc: 0x8003
    },
    {
      name: "stops on a watched I/O write",
      // --- LD BC,$7FFD / LD A,$07 / OUT (C),A / NOP
      code: [0x01, 0xfd, 0x7f, 0x3e, 0x07, 0xed, 0x79, 0x00],
      breakpoint: { address: 0x7ffd, ioWrite: true },
      expectedPc: 0x8007
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const { oracle, wasm } = await createZxNextOracleHarness();
      initializeAccessMachine(oracle, testCase);
      initializeAccessMachine(wasm, testCase);

      const oracleSnapshot = captureAccessStop(oracle);
      const wasmSnapshot = captureAccessStop(wasm);

      expect(wasmSnapshot).toEqual(oracleSnapshot);
      expect(wasmSnapshot).toMatchObject({
        termination: FrameTerminationMode.DebugEvent,
        pc: testCase.expectedPc
      });
    });
  }

  it("leaves the frame alone when no breakpoint watches the same access", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const unwatched: AccessCase = {
      name: "unwatched",
      // --- LD A,$77 / LD ($9000),A / NOP
      code: [0x3e, 0x77, 0x32, 0x00, 0x90, 0x00],
      // --- A write watch on a different address must not stop this program
      breakpoint: { address: 0x9001, memoryWrite: true },
      expectedPc: 0
    };
    initializeAccessMachine(oracle, unwatched);
    initializeAccessMachine(wasm, unwatched);

    const oracleSnapshot = captureAccessStop(oracle);
    const wasmSnapshot = captureAccessStop(wasm);

    expect(wasmSnapshot).toEqual(oracleSnapshot);
    expect(wasmSnapshot.termination).toBe(FrameTerminationMode.Normal);
  });
});

function initializeAccessMachine(machine: AccessMachine, testCase: AccessCase): void {
  machine.hardReset();
  testCase.code.forEach((byte, offset) =>
    machine.doWriteMemory(START_ADDRESS + offset, byte)
  );
  machine.pc = START_ADDRESS;
  machine.sp = 0xff00;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  machine.executionContext.debugSupport = new DebugSupport(undefined, [testCase.breakpoint]);
  machine.executionContext.lastTerminationReason = undefined;
}

function captureAccessStop(machine: AccessMachine): {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  pc: number;
  af: number;
} {
  const termination = machine.executeMachineFrame();
  const cpu = machine.getCpuState();
  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    pc: cpu.pc,
    af: cpu.af
  };
}
