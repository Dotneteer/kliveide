import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

type AccessStop = {
  termination: FrameTerminationMode;
  lastTerminationReason: FrameTerminationMode | undefined;
  pc: number;
  af: number;
  /** The instruction the Breakpoints panel reports the access against */
  opStartAddress: number;
};

type AccessCase = {
  name: string;
  code: number[];
  breakpoint: BreakpointInfo;
  expected: AccessStop;
};

const START_ADDRESS = 0x8000;

/**
 * The WASM debug loop only mirrors the core's bus activity when a breakpoint actually watches for
 * it, so these cases are what stands between that optimisation and silently dead watchpoints.
 *
 * PC, A and opStartAddress follow from the programs: the stop comes after the accessing instruction
 * completes, reported against that instruction's first byte. F = $FF is the value after a hard reset.
 * The unwatched frame's end PC/opStartAddress are pinned: they are the values both the TypeScript and
 * the WASM core agreed on at tag `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Spectrum Next WASM access breakpoints", () => {
  const cases: AccessCase[] = [
    {
      name: "stops on a watched memory write",
      // --- LD A,$77 / LD ($9000),A / NOP
      code: [0x3e, 0x77, 0x32, 0x00, 0x90, 0x00],
      breakpoint: { address: 0x9000, memoryWrite: true },
      expected: {
        termination: FrameTerminationMode.DebugEvent,
        lastTerminationReason: FrameTerminationMode.DebugEvent,
        pc: 0x8005,
        af: 0x77ff,
        opStartAddress: 0x8002
      }
    },
    {
      name: "stops on a watched memory read",
      // --- LD A,($9010) / NOP
      code: [0x3a, 0x10, 0x90, 0x00],
      breakpoint: { address: 0x9010, memoryRead: true },
      expected: {
        termination: FrameTerminationMode.DebugEvent,
        lastTerminationReason: FrameTerminationMode.DebugEvent,
        pc: 0x8003,
        // --- $9010 is zero after a hard reset
        af: 0x00ff,
        opStartAddress: 0x8000
      }
    },
    {
      name: "stops on a watched I/O write",
      // --- LD BC,$7FFD / LD A,$07 / OUT (C),A / NOP
      code: [0x01, 0xfd, 0x7f, 0x3e, 0x07, 0xed, 0x79, 0x00],
      breakpoint: { address: 0x7ffd, ioWrite: true },
      expected: {
        termination: FrameTerminationMode.DebugEvent,
        lastTerminationReason: FrameTerminationMode.DebugEvent,
        pc: 0x8007,
        af: 0x07ff,
        opStartAddress: 0x8005
      }
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const wasm = await createTestZxNextWasmMachine();
      initializeAccessMachine(wasm, testCase.code, testCase.breakpoint);

      expect(captureAccessStop(wasm)).toEqual(testCase.expected);
    });
  }

  it("leaves the frame alone when no breakpoint watches the same access", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initializeAccessMachine(
      wasm,
      // --- LD A,$77 / LD ($9000),A / NOP
      [0x3e, 0x77, 0x32, 0x00, 0x90, 0x00],
      // --- A write watch on a different address must not stop this program
      { address: 0x9001, memoryWrite: true }
    );

    const snapshot = captureAccessStop(wasm);

    expect(snapshot.termination).toBe(FrameTerminationMode.Normal);
    expect(snapshot).toEqual({
      termination: FrameTerminationMode.Normal,
      lastTerminationReason: FrameTerminationMode.Normal,
      // --- pinned: where the full frame of NOPs ends
      pc: 0xc53f,
      af: 0x77ff,
      opStartAddress: 0xc53e
    });
  });
});

function initializeAccessMachine(
  machine: ZxNextWasmV2Machine,
  code: number[],
  breakpoint: BreakpointInfo
): void {
  machine.hardReset();
  code.forEach((byte, offset) =>
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
  machine.executionContext.debugSupport = new DebugSupport(undefined, [breakpoint]);
  machine.executionContext.lastTerminationReason = undefined;
}

function captureAccessStop(machine: ZxNextWasmV2Machine): AccessStop {
  const termination = machine.executeMachineFrame();
  const cpu = machine.getCpuState();
  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    pc: cpu.pc,
    af: cpu.af,
    opStartAddress: cpu.opStartAddress
  };
}
