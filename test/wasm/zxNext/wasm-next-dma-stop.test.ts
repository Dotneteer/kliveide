import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { afterEach, describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { wasmDebugLoopOptions } from "@emu/machines/wasmDebugLoop";
import { DmaProblem, DmaWatchKind, describeDmaStop } from "@common/zxnext/dma/dmaStops";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * DMA stops (`dma:`) and DMA steps, end to end (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §12):
 * `DebugSupport` building the core's watch, the core latching the event and leaving its loop (at the end
 * of the instruction that wrote the port, or before the next instruction inside a transfer), and the
 * debug loop turning the hit into a stop - in the core and instruction by instruction alike.
 *
 * The program sends a setup to port $6B with OTIR from $8007, then spins at $8009-$800A.
 */

const START = 0x8000;
const OTIR_AT = 0x8007;
const MAIN = 0x8009;
const SETUP_AT = 0x8100;

/** A continuous copy of `len` bytes from $C000 to $D000 */
const COPY = (len: number, extra: number[] = []) => [0x83, 0x7d, 0x00, 0xc0, len & 0xff, len >> 8, 0x14, 0x10, 0xad, 0x00, 0xd0, ...extra, 0x82, 0xcf, 0x87];

function program(setup: number[]): number[] {
  // prettier-ignore
  return [
    0xf3,                               // 8000 DI
    0x21, SETUP_AT & 0xff, SETUP_AT >> 8, // 8001 LD HL,$8100
    0x01, 0x6b, setup.length,           // 8004 LD BC,len*256+$6B
    0xed, 0xb3,                         // 8007 OTIR
    0x00,                               // 8009 NOP   ; Main
    0x18, 0xfd                          // 800A JR $8009
  ];
}

function initialize(machine: ZxNextWasmV2Machine, setup: number[], ...breakpoints: BreakpointInfo[]): DebugSupport {
  machine.hardReset();
  program(setup).forEach((byte, offset) => machine.doWriteMemory(START + offset, byte));
  setup.forEach((byte, offset) => machine.doWriteMemory(SETUP_AT + offset, byte));
  for (let i = 0; i < 64; i++) machine.doWriteMemory(0xc000 + i, (i + 1) & 0xff);
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

const moved = (m: ZxNextWasmV2Machine) => {
  const s = m.getDmaState();
  return s.dialect === "z80" ? (s.counter + 1) & 0xffff : s.counter;
};
const snapshot = (m: ZxNextWasmV2Machine) => ({ pc: m.pc, tacts: m.tacts, moved: moved(m), stop: m.lastDmaStop?.kind });

afterEach(() => {
  wasmDebugLoopOptions.inCore = true;
});

/** Runs a scenario in the core and instruction by instruction; both must stop at the same place */
async function both(setup: number[], bp: BreakpointInfo): Promise<{ inCore: ReturnType<typeof snapshot>; m: ZxNextWasmV2Machine }> {
  const results: ReturnType<typeof snapshot>[] = [];
  let last: ZxNextWasmV2Machine | undefined;
  for (const inCore of [false, true]) {
    wasmDebugLoopOptions.inCore = inCore;
    const m = await createTestZxNextWasmMachine();
    initialize(m, setup, bp);
    runToStop(m);
    results.push(snapshot(m));
    last = m;
  }
  expect(results[1], "in the core and instruction by instruction").toEqual(results[0]);
  return { inCore: results[1], m: last! };
}

describe("ZX Spectrum Next DMA stops", () => {
  it("dma:enable stops at the end of the OTIR iteration that wrote $87", async () => {
    const { inCore, m } = await both(COPY(32), { dmaStop: "enable" });
    expect(inCore.pc).toBe(MAIN);
    expect(m.lastDmaStop).toMatchObject({ kind: DmaWatchKind.Enable, pc: OTIR_AT });
    // --- the transfer has not started: it starts after the next instruction's M1
    expect(inCore.moved).toBe(0);
    expect(describeDmaStop({ ...m.lastDmaStop!, partition: undefined })).toBe("DMA stop: enabled by the instruction at $8007");
  });

  it("dma:load stops at the end of the OTIR iteration that wrote $CF, OTIR still repeating", async () => {
    const { inCore, m } = await both(COPY(32), { dmaStop: "load" });
    expect(inCore.pc).toBe(OTIR_AT);
    expect(m.lastDmaStop).toMatchObject({ kind: DmaWatchKind.Load, pc: OTIR_AT });
  });

  it("dma:end stops after the last byte, the copy complete and the CPU free", async () => {
    const { inCore, m } = await both(COPY(32), { dmaStop: "end" });
    expect(inCore.moved).toBe(32);
    expect(m.lastDmaStop).toMatchObject({ kind: DmaWatchKind.End, moved: 32 });
    expect(m.isCpuSnoozed()).toBe(false);
    for (let i = 0; i < 32; i++) expect(m.doReadMemory(0xd000 + i)).toBe(i + 1);
  });

  it("dma:count stops inside the transfer, before the next instruction; resuming carries on", async () => {
    const { inCore, m } = await both(COPY(32), { dmaStop: "count:10" });
    expect(inCore.moved).toBe(10);
    expect(m.isCpuSnoozed()).toBe(true);
    expect(m.doReadMemory(0xd009)).toBe(10);
    expect(m.doReadMemory(0xd00a)).toBe(0);
    // --- a DMA step from there: one more byte
    m.requestDmaStep("byte");
    runToStop(m);
    expect(moved(m)).toBe(11);
    expect(m.lastDmaStop?.kind).toBe(DmaWatchKind.Byte);
    // --- to the end of the block
    m.requestDmaStep("block");
    runToStop(m);
    expect(moved(m)).toBe(32);
    expect(m.doReadMemory(0xd01f)).toBe(32);
  });

  it("dma:write stops after the byte written to the range", async () => {
    const { inCore, m } = await both(COPY(32), { dmaStop: "write:$d005" });
    expect(inCore.moved).toBe(6);
    expect(m.lastDmaStop).toMatchObject({ kind: DmaWatchKind.Write, address: 0xd005 });
  });

  it("dma:held stops once a hold of the bus passes the limit", async () => {
    const { m } = await both(COPY(64), { dmaStop: "held:100" });
    expect(m.lastDmaStop?.kind).toBe(DmaWatchKind.Held);
    expect(m.lastDmaStop!.heldTacts).toBeGreaterThan(100);
    expect(m.lastDmaStop!.heldTacts).toBeLessThan(120);
  });

  it("dma:problem stops at the write that left the DMA deaf", async () => {
    const { inCore, m } = await both([0xc3, 0x91, 0x87], { dmaStop: "problem" });
    expect(inCore.pc).toBe(OTIR_AT);
    expect(m.lastDmaStop).toMatchObject({ kind: DmaWatchKind.Problem, problem: DmaProblem.BecomesDeaf, pc: OTIR_AT });
  });

  it("the release step stops when the DMA lets go of the bus", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, COPY(32), { dmaStop: "count:4" });
    runToStop(m);
    m.executionContext.debugSupport!.removeBreakpoint({ dmaStop: "count:4" });
    m.requestDmaStep("release");
    runToStop(m);
    expect(m.lastDmaStop?.kind).toBe(DmaWatchKind.Release);
    expect(moved(m)).toBe(32);
    expect(m.isCpuSnoozed()).toBe(false);
  });

  it("a hit count applies: the third block end of an auto-restarting burst transfer", async () => {
    // --- burst with prescaler 10 and auto restart: the DMA lets the CPU run between bytes
    const setup = [0x83, 0x7d, 0x00, 0xc0, 4, 0, 0x14, 0x50, 0x21, 10, 0xcd, 0x00, 0xd0, 0xa2, 0xcf, 0x87];
    const m = await createTestZxNextWasmMachine();
    initialize(m, setup, { dmaStop: "end", hitCount: 3 } as BreakpointInfo);
    runToStop(m);
    expect(m.lastDmaStop?.kind).toBe(DmaWatchKind.End);
  });

  it("nothing stops with no DMA stop armed", async () => {
    const m = await createTestZxNextWasmMachine();
    initialize(m, COPY(32));
    for (let i = 0; i < 3; i++) expect(m.executeMachineFrame()).not.toBe(FrameTerminationMode.DebugEvent);
    expect(moved(m)).toBe(32);
  });

  it("a run stopped at every byte ends where an unstopped run does", async () => {
    const plain = await createTestZxNextWasmMachine();
    initialize(plain, COPY(64));
    plain.executeMachineFrame();

    const stepped = await createTestZxNextWasmMachine();
    initialize(stepped, COPY(64), { dmaStop: "count:1" });
    runToStop(stepped);
    let steps = 0;
    for (;;) {
      stepped.requestDmaStep("byte");
      const end = stepped.executeMachineFrame();
      if (end !== FrameTerminationMode.DebugEvent) break;
      steps++;
    }
    expect(steps).toBe(63);
    expect(stepped.frames).toBe(plain.frames);
    expect(stepped.tacts).toBe(plain.tacts);
    expect(stepped.pc).toBe(plain.pc);
    for (let i = 0; i < 64; i++) expect(stepped.doReadMemory(0xd000 + i)).toBe(plain.doReadMemory(0xd000 + i));
  });
});
