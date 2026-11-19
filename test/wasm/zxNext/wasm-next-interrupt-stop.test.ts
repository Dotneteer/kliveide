import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { afterEach, describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { wasmDebugLoopOptions } from "@emu/machines/wasmDebugLoop";
import { describeInterruptStop } from "@common/zxnext/interrupts/interruptStops";
import { NextIntEventKind, NextIntSource } from "@common/zxnext/interrupts/interruptState";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * Interrupt stops (`int:`), end to end (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §5): `DebugSupport`
 * building the core's watch, the core latching the event and leaving its in-core loop, and the debug
 * loop turning the hit into a stop. `test/zxnext-hw/interrupts/interrupt-debugging.test.ts` covers the
 * core's half on its own.
 *
 * The program switches hardware IM2 mode on with the ULA's interrupt only (vector $B6), I = $BE, and
 * spins; the handler at $9000 is `EI; RETI` (or `EI; RETN`).
 */

const START = 0x8000;
const MAIN = 0x8010;
const HANDLER = 0x9000;

// prettier-ignore
const PROGRAM = [
  0xf3,                   // 8000 DI
  0x3e, 0xbe,             // 8001 LD A,$BE
  0xed, 0x47,             // 8003 LD I,A
  0xed, 0x5e,             // 8005 IM 2
  0xed, 0x91, 0xc0, 0xa1, // 8007 NEXTREG $C0,$A1  ; hardware IM2 mode, vectors $A0-$BA
  0xed, 0x91, 0xc4, 0x01, // 800B NEXTREG $C4,$01  ; the ULA's interrupt only
  0xfb,                   // 800F EI
  0x00,                   // 8010 NOP              ; Main
  0x18, 0xfd              // 8011 JR $8010
];

function initialize(machine: ZxNextWasmV2Machine, retn: boolean, ...breakpoints: BreakpointInfo[]): DebugSupport {
  machine.hardReset();
  PROGRAM.forEach((byte, offset) => machine.doWriteMemory(START + offset, byte));
  [0xfb, 0xed, retn ? 0x45 : 0x4d].forEach((byte, offset) => machine.doWriteMemory(HANDLER + offset, byte));
  machine.doWriteMemory(0xbeb6, HANDLER & 0xff);
  machine.doWriteMemory(0xbeb7, HANDLER >> 8);
  machine.pc = START;
  machine.sp = 0xff00;
  machine.setTacts(0);
  machine.frameTacts = 0;
  machine.currentFrameTact = 0;
  machine.frames = 0;
  machine.frameCompleted = false;
  machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  const debugSupport = new DebugSupport();
  connectConditionSupport(debugSupport, machine);
  breakpoints.forEach((bp) => debugSupport.addBreakpoint(bp));
  machine.executionContext.debugSupport = debugSupport;
  machine.executionContext.lastTerminationReason = undefined;
  return debugSupport;
}

function runToStop(machine: ZxNextWasmV2Machine, maxFrames = 4): void {
  for (let frame = 0; frame < maxFrames; frame++) {
    if (machine.executeMachineFrame() === FrameTerminationMode.DebugEvent) return;
  }
  throw new Error(`No debug stop in ${maxFrames} frames`);
}

function expectNoStop(machine: ZxNextWasmV2Machine, frames = 3): void {
  for (let i = 0; i < frames; i++) {
    expect(machine.executeMachineFrame()).not.toBe(FrameTerminationMode.DebugEvent);
  }
}

afterEach(() => {
  wasmDebugLoopOptions.inCore = true;
});

describe("ZX Spectrum Next interrupt stops", () => {
  it("int:ack:ula stops at the handler's first instruction, naming the interrupted address", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, false, { interruptStop: "ack:ula" });
    runToStop(m);
    expect(m.pc).toBe(HANDLER);
    const stop = m.lastInterruptStop!;
    expect(stop).toMatchObject({ kind: NextIntEventKind.Acknowledge, source: NextIntSource.Ula, vector: 0xb6 });
    expect(stop.pc === MAIN || stop.pc === MAIN + 1).toBe(true);
    expect(describeInterruptStop(stop)).toMatch(/^Interrupt stop: ULA taken \(vector \$B6\), interrupting \$801[01]/);
    expect(m.getCpuState().lastInterruptStop).toEqual(stop);
  });

  it("stops once a frame, and resuming clears the last stop", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, false, { interruptStop: "ack" });
    runToStop(m);
    const first = m.lastInterruptStop!.frame;
    runToStop(m);
    expect(m.pc).toBe(HANDLER);
    expect(m.lastInterruptStop!.frame).toBe(first + 1);
  });

  it("int:ack:line never stops when only the ULA interrupts", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, false, { interruptStop: "ack:line" });
    expectNoStop(m);
    expect(m.lastInterruptStop).toBeUndefined();
  });

  it("a disabled stop does not stop", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, false, { interruptStop: "ack:ula", disabled: true });
    expectNoStop(m);
  });

  it("a condition reads the registers at the stop", async () => {
    const yes = await createTestZxNextWasmMachine();
    initialize(yes, false, { interruptStop: "ack:ula", condition: "A == $BE" });
    runToStop(yes);
    expect(yes.pc).toBe(HANDLER);

    const no = await createTestZxNextWasmMachine();
    initialize(no, false, { interruptStop: "ack:ula", condition: "A == $01" });
    expectNoStop(no);
  });

  it("int:retn stops after a RETN that leaves the ULA in service", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, true, { interruptStop: "retn" });
    runToStop(m);
    expect(m.lastInterruptStop).toMatchObject({ kind: NextIntEventKind.RetnInService, source: NextIntSource.Ula, pc: HANDLER + 1 });
    expect(m.getInterruptState().sources[NextIntSource.Ula].inService).toBe(true);
  });

  it("stops at the same place in the core's loop and instruction by instruction", async () => {
    const at = async (inCore: boolean) => {
      wasmDebugLoopOptions.inCore = inCore;
      const m = await createTestZxNextWasmMachine();
      initialize(m, false, { interruptStop: "ack:ula" });
      const stops: Array<{ pc: number; tacts: number; sp: number }> = [];
      for (let i = 0; i < 3; i++) {
        runToStop(m);
        stops.push({ pc: m.pc, tacts: m.tacts, sp: m.sp });
      }
      return stops;
    };
    const perInstruction = await at(false);
    const inCore = await at(true);
    expect(inCore).toEqual(perInstruction);
  });
});
