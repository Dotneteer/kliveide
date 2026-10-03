import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionContext";
import { bankLocalSymbolKey } from "@common/utils/breakpoint-condition/condition-types";

import { createSp48Session } from "../harness/sp48";
import { createSession } from "../harness/zxnext";
import {
  createTestSp128WasmMachine,
  createTestSpp3eWasmMachine
} from "../wasm/zxSpectrum/wasm-test-helpers";

/*
 * Conditional breakpoints on the real machines (the WASM cores), Phase 3 of
 * `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`: conditions read the core's registers and memory, hit
 * rules count real hits, and the access specials carry each access's own byte. Every program ends
 * in a plain breakpoint, so a condition that never fires fails the test at `Done` rather than by
 * running out of frames.
 */

const DJNZ_LOOP = `
        ld b,8
    Loop:
        nop
        djnz Loop
    Done:
        jr Done
`;

describe("conditional breakpoints - ZX Spectrum 48K", () => {
  async function loopSession() {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ${DJNZ_LOOP}
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    return { s, program, ds };
  }

  it("stops in a DJNZ loop when B == 3", async () => {
    const { s, program, ds } = await loopSession();
    ds.addBreakpoint({ address: program.symbol("Loop"), exec: true, condition: "B == 3" });

    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Loop"));
    expect(s.machine.b).toBe(3);
    expect(ds.listBreakpointsWithState().find((bp) => bp.condition)!.currentHits).toBe(1);
    expect(s.continueToBreakpoint()).toBe(program.symbol("Done"));
  });

  it("stops on every 4th pass with -hit *4", async () => {
    const { s, program, ds } = await loopSession();
    ds.addBreakpoint({ address: program.symbol("Loop"), exec: true, hitMode: "every", hitCount: 4 });

    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Loop"));
    expect(s.machine.b).toBe(5);
    // --- Resuming must not count the pass it stopped on a second time (§4.6)
    expect(s.continueToBreakpoint()).toBe(program.symbol("Loop"));
    expect(s.machine.b).toBe(1);
    expect(s.continueToBreakpoint()).toBe(program.symbol("Done"));
  });

  it("stops after the 5th pass with -hit >5", async () => {
    const { s, program, ds } = await loopSession();
    ds.addBreakpoint({ address: program.symbol("Loop"), exec: true, hitMode: "gt", hitCount: 5 });

    const seen: number[] = [];
    let pc = s.callToBreakpoint("Main");
    while (pc === program.symbol("Loop")) {
      seen.push(s.machine.b);
      pc = s.continueToBreakpoint();
    }
    expect(seen).toEqual([3, 2, 1]);
  });

  it("combines a condition and a hit rule: the 2nd time B is odd", async () => {
    const { s, program, ds } = await loopSession();
    ds.addBreakpoint({
      address: program.symbol("Loop"),
      exec: true,
      condition: "B & 1 == 1",
      hitCount: 2
    });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Loop"));
    expect(s.machine.b).toBe(5);
  });

  it("reads the shadow registers", async () => {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld a,$12
        ex af,af'
        ld a,$00
    Check:
        nop
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Check"), exec: true, condition: "AF' >> 8 == $12 && A == 0" });
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Check"));
  });

  async function writeSession() {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld sp,$9f00
        ld hl,$aa11
        ld ($9000),hl
    Second:
        ld a,$22
        ld ($9001),a
    Third:
        ld a,$aa
        ld ($9001),a
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    return { s, program, ds };
  }

  it("stops on a memory write with VAL == $AA, each address seeing its own byte", async () => {
    const { s, program, ds } = await writeSession();
    ds.addBreakpoint({ address: 0x9001, memoryWrite: true, condition: "VAL == $AA" });
    // --- `ld ($9000),hl` writes $11 to $9000 and $AA to $9001: only the second matches
    ds.addBreakpoint({ address: 0x9000, memoryWrite: true, condition: "VAL == $AA" });

    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Second"));
    expect(s.continueToBreakpoint()).toBe(program.symbol("Done"));
    const hits = ds.listBreakpointsWithState().filter((bp) => bp.memoryWrite);
    expect(hits.find((bp) => bp.address === 0x9001)!.currentHits).toBe(2);
    expect(hits.find((bp) => bp.address === 0x9000)!.currentHits).toBe(0);
  });

  it("gives ADDR on a memory breakpoint", async () => {
    const { s, program, ds } = await writeSession();
    ds.addBreakpoint({ address: 0x9001, memoryWrite: true, condition: "ADDR == $9001 && VAL == $22" });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Third"));
  });

  it("ignores a bank prefix on the 48K, which has no banks (C17)", async () => {
    const { s, program, ds } = await writeSession();
    ds.addBreakpoint({
      address: program.symbol("Second"),
      exec: true,
      condition: "b[05:$9000] == $11 && b[B5:$9001] == $AA && b[0A:+$9000] == $11"
    });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Second"));
  });

  it("binds a label after a build, and is inactive without it", async () => {
    const { s, program, ds } = await writeSession();
    ds.addBreakpoint({ address: program.symbol("Second"), exec: true, condition: "w[score] == $AA11" });
    // --- No symbols yet: inactive, so the run goes on to Done
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Done"));
    expect(ds.listBreakpointsWithState().find((bp) => bp.condition)!.conditionInactive).toBe(
      "unknown label score"
    );

    const { s: s2, program: p2, ds: ds2 } = await writeSession();
    ds2.setConditionSymbols({ score: 0x9000 });
    ds2.addBreakpoint({ address: p2.symbol("Second"), exec: true, condition: "w[score] == $AA11" });
    expect(s2.callToBreakpoint("Main")).toBe(p2.symbol("Second"));
  });

  it("filters a port write by its value", async () => {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld a,1
        out ($fe),a
        ld a,2
        out ($fe),a
    After:
        nop
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: 0x00fe, ioWrite: true, ioMask: 0x00ff, condition: "VAL == 2 && ADDR == $02FE" });
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("After"));
  });
});

describe("conditional breakpoints - ZX Spectrum Next", () => {
  async function nextSession(source: string) {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
    Main:
        ${source}
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: s.symbol("Done"), exec: true });
    return { s, ds };
  }

  it("reads a Next register and the paging with nr() and page()", async () => {
    const { s, ds } = await nextSession(`
        nextreg $56,$21
    Check1:
        nop
        nextreg $56,$20
    Check2:
        nop
    `);
    const condition = "nr($56) == $20 && page($C000) == @20";
    ds.addBreakpoint({ address: s.symbol("Check1"), exec: true, condition });
    ds.addBreakpoint({ address: s.symbol("Check2"), exec: true, condition });
    expect(s.continueToBreakpoint()).toBe(s.symbol("Check2"));
  });

  it("reads a partition whatever is paged in, and a 16K bank and its local label", async () => {
    const { s, ds } = await nextSession(`
    Check:
        nop
    `);
    // --- Page $20 is the low half of 16K bank $10; nothing maps it
    s.pokePage(0x20, 0x0010, 0x5a);
    s.pokePage(0x21, 0x0001, 0x77);
    ds.setConditionSymbols({
      [bankLocalSymbolKey(0x10, "Flags")]: 0x0010,
      [bankLocalSymbolKey(0x10, "High")]: 0x2001,
      score: 0x5a
    });
    ds.addBreakpoint({
      address: s.symbol("Check"),
      exec: true,
      condition:
        "b[20:$C010] == $5A && [$C010] != $5A && b[10:+$0010] == score && " +
        "b[10:Flags] == $5A && b[10:High] == $77 && w[10:+$000F] == $5A00"
    });
    expect(s.continueToBreakpoint()).toBe(s.symbol("Check"));
  });

  it("filters a NextReg write breakpoint by VAL", async () => {
    const { s, ds } = await nextSession(`
        nextreg $07,1
        nextreg $07,2
    After:
        nop
    `);
    ds.addBreakpoint({ nextReg: 0x07, condition: "VAL == 2" });
    expect(s.continueToBreakpoint()).toBe(s.symbol("After"));
  });
});

/** Steps a directly created WASM machine in debug mode until a breakpoint stops it. */
function runToBreakpoint(machine: {
  executeMachineFrame(): FrameTerminationMode;
  pc: number;
  executionContext: { debugStepMode: DebugStepMode; debugSupport?: unknown };
}): number {
  machine.executionContext.debugStepMode = DebugStepMode.StopAtBreakpoint;
  for (let frame = 0; frame < 20; frame++) {
    if (machine.executeMachineFrame() === FrameTerminationMode.DebugEvent) return machine.pc;
  }
  throw new Error("No breakpoint hit");
}

// --- ld bc,$7ffd; ld a,3; out (c),a; Check: nop; Done: jr Done
const PAGE_BANK_3 = [0x01, 0xfd, 0x7f, 0x3e, 0x03, 0xed, 0x79, 0x00, 0x18, 0xfe];
const CHECK = 0x8007;
const DONE = 0x8008;

describe.each([
  ["ZX Spectrum 128", createTestSp128WasmMachine],
  ["ZX Spectrum +3E", createTestSpp3eWasmMachine]
])("conditional breakpoints - %s", (_name, create) => {
  it("reads a partition-qualified byte with a different bank paged in, and page()", async () => {
    const machine = await create();
    await machine.hardReset();
    PAGE_BANK_3.forEach((byte, i) => machine.doWriteMemory(0x8000 + i, byte));
    machine.getMemoryPartition(1)[0x0010] = 0x5a;
    machine.getMemoryPartition(3)[0x0010] = 0x33;
    machine.pc = 0x8000;
    machine.sp = 0x9f00;

    const ds = new DebugSupport();
    connectConditionSupport(ds, machine);
    machine.executionContext.debugSupport = ds;
    ds.addBreakpoint({
      address: CHECK,
      exec: true,
      condition: "b[B1:$C010] == $5A && [$C010] == $33 && page($C000) == @B3"
    });
    ds.addBreakpoint({ address: DONE, exec: true });

    expect(runToBreakpoint(machine)).toBe(CHECK);
  });
});
