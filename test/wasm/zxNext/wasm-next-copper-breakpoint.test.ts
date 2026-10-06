import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { describeCopperStop } from "@emu/machines/MachineController";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * Copper breakpoints (`cu:`), end to end: `DebugSupport` authoring the 1024-bit watch, the core
 * latching the first completed instruction, and the debug loop turning a hit into a stop
 * (`.plans/COPPER_DEBUGGING_PLAN.md` Phase 8). `test/zxnext-hw/copper/copper-debug.test.ts` covers
 * the core's half on its own.
 *
 * The program uploads the C03 list through NEXTREG and starts it in mode 11, then spins.
 */

const START_ADDRESS = 0x8000;

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;
const C03 = [MOVE(0x40, 16), MOVE(0x41, 0x00), WAIT(96, 8), MOVE(0x40, 16), MOVE(0x41, 0x1c), HALT];

/** NEXTREG reg,value */
const nextreg = (reg: number, value: number) => [0xed, 0x91, reg, value];

/** Uploads `list` with $60 writes, starts mode 11, then `JR $`. */
function program(list: number[]): number[] {
  const code: number[] = [...nextreg(0x62, 0x00), ...nextreg(0x61, 0x00)];
  for (const w of list) code.push(...nextreg(0x60, w >> 8), ...nextreg(0x60, w & 0xff));
  code.push(...nextreg(0x62, 0xc0));
  code.push(0x18, 0xfe);
  return code;
}

function initialize(machine: ZxNextWasmV2Machine, code: number[], ...breakpoints: BreakpointInfo[]): DebugSupport {
  machine.hardReset();
  code.forEach((byte, offset) => machine.doWriteMemory(START_ADDRESS + offset, byte));
  machine.pc = START_ADDRESS;
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

/** Runs frames until a debug event, failing after `maxFrames`. */
function runToStop(machine: ZxNextWasmV2Machine, maxFrames = 10): number {
  for (let frame = 0; frame < maxFrames; frame++) {
    if (machine.executeMachineFrame() === FrameTerminationMode.DebugEvent) return frame;
  }
  throw new Error(`No debug stop in ${maxFrames} frames`);
}

describe("ZX Spectrum Next Copper breakpoints", () => {
  it("stops when the Copper satisfies a watched WAIT, reporting the hit's beam", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 2 });

    runToStop(wasm);
    expect(wasm.lastCopperHit).toMatchObject({ index: 2, kind: "wait", word: WAIT(96, 8), line: 96, hc: 76 });
    // --- The CPU is spinning on its JR when the Copper hits
    const jr = START_ADDRESS + program(C03).length - 2;
    expect(wasm.lastCopperHit!.pc).toBe(jr);
    expect(wasm.getCpuState().lastCopperHit).toEqual(wasm.lastCopperHit);
    expect(wasm.getCopperState().lastHit).toEqual(wasm.lastCopperHit);
  });

  it("stops on a watched MOVE and names the register in the stop message", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 4 });

    runToStop(wasm);
    const hit = wasm.lastCopperHit!;
    expect(hit).toMatchObject({ index: 4, kind: "move", line: 96 });
    expect(describeCopperStop(hit, wasm.getPartitionLabels())).toMatch(
      /^Copper breakpoint: \$004 MOVE \$41, \$1C \(Palette Value \(8 bit\)\) at line 96, hc \d+; CPU at \$[0-9A-F]{4}/
    );
  });

  it("the WAIT stop message says 'satisfied' and gives the paper x", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 2 });
    runToStop(wasm);
    expect(describeCopperStop(wasm.lastCopperHit!, wasm.getPartitionLabels())).toMatch(
      /^Copper breakpoint: \$002 WAIT 96, 8 satisfied at line 96, hc 76 \(x 64\); CPU at \$[0-9A-F]{4} in \w+$/
    );
  });

  it("resuming clears the hit and stops again on the next frame's pass", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 2 });
    runToStop(wasm);
    const first = wasm.frames;
    runToStop(wasm);
    expect(wasm.lastCopperHit).toMatchObject({ index: 2 });
    expect(wasm.frames).toBeGreaterThan(first);
  });

  it("applies a hit count (D6): -hit 3 stops on the third pass", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const ds = initialize(wasm, program(C03), { copperIndex: 2, hitCount: 3, hitMode: "eq" });
    const startFrames = wasm.frames;
    runToStop(wasm, 20);
    const passes = wasm.frames - startFrames;
    expect(wasm.lastCopperHit).toMatchObject({ index: 2 });
    expect(ds.breakpoints[0].copperIndex).toBe(2);
    // --- Two passes went by without stopping
    expect(passes).toBeGreaterThanOrEqual(2);
  });

  it("applies a condition: ADDR is the list index and VAL the word", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 4, condition: "VAL == $411C && ADDR == 4" });
    runToStop(wasm);
    expect(wasm.lastCopperHit).toMatchObject({ index: 4 });

    const other = await createTestZxNextWasmMachine();
    const ods = initialize(other, program(C03), { copperIndex: 4, condition: "VAL == $4100" });
    expect(ods.listBreakpointsWithState()[0].conditionError).toBeUndefined();
    for (let i = 0; i < 4; i++) {
      expect(other.executeMachineFrame()).not.toBe(FrameTerminationMode.DebugEvent);
    }
  });

  it("a disabled breakpoint does not stop", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 2, disabled: true });
    for (let i = 0; i < 4; i++) {
      expect(wasm.executeMachineFrame()).not.toBe(FrameTerminationMode.DebugEvent);
    }
  });

  it("a one-shot run-to (Run to here) is consumed when it fires", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const ds = initialize(wasm, program(C03), {
      copperIndex: 3,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    runToStop(wasm);
    expect(wasm.lastCopperHit).toMatchObject({ index: 3 });
    expect(ds.consumeFiredOneShots()).toBe(1);
    expect(ds.hasCopperBreakpoints()).toBe(false);
  });

  it("Step Copper stops on the next instruction the Copper completes", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03));
    // --- Let the list start, then step from the parked HALT: the next completion is index 0
    for (let i = 0; i < 2; i++) wasm.executeMachineFrame();
    wasm.requestCopperStep();
    runToStop(wasm);
    expect(wasm.lastCopperHit).toMatchObject({ index: 0, kind: "move", line: 0 });
    expect(wasm.copperStepPending).toBe(false);
    // --- And again. Not index 1: it completed two ticks after index 0, inside the same Z80
    // --- instruction, so the Copper had already run past it when the machine stopped (T1). The
    // --- next completion is the WAIT, at line 96.
    expect(wasm.getCopperState().pc).toBe(2);
    wasm.requestCopperStep();
    runToStop(wasm);
    expect(wasm.lastCopperHit).toMatchObject({ index: 2, kind: "wait", line: 96 });
  });

  it("without a cu: breakpoint the core's watch is disarmed", async () => {
    const wasm = await createTestZxNextWasmMachine();
    initialize(wasm, program(C03), { copperIndex: 2 });
    runToStop(wasm);
    wasm.executionContext.debugSupport = new DebugSupport(undefined, []);
    for (let i = 0; i < 3; i++) {
      expect(wasm.executeMachineFrame()).not.toBe(FrameTerminationMode.DebugEvent);
    }
    expect(wasm.wasmV2Runtime!.exports.zxnextTakeCopperHit()).toBe(0);
  });
});
