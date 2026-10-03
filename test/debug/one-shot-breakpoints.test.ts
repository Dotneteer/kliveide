import { describe, expect, it } from "vitest";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import { breakpointMatchesScope } from "@common/utils/breakpoint-scope";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

/*
 * One-shot breakpoints (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.1, G1.6).
 *
 * The decision itself needs no machine: a condition with no condition store fails safe (it counts
 * as true), so the tests that need a *false* condition use a hit rule instead, which is evaluated
 * entirely in TypeScript.
 */

const noPartition = () => undefined;

/** The project save's filter: only project-owned breakpoints are written (`projects.ts`). */
function savedByProject(ds: DebugSupport): BreakpointInfo[] {
  return ds.breakpoints.filter((bp) => breakpointMatchesScope(bp.owner, { kind: "project" }));
}

describe("one-shots — the two bugs (Phase 0)", () => {
  it("B1: a one-shot whose filter did not pass is not spent by another breakpoint's stop", () => {
    const ds = new DebugSupport();
    // --- The regular breakpoint stops every time; the one-shot only on its 3rd hit
    ds.addBreakpoint({ address: 0x8000, partition: 1, exec: true });
    ds.addBreakpoint({
      address: 0x8000,
      exec: true,
      oneShot: true,
      owner: { kind: "session" },
      hitCount: 3,
      hitMode: "eq"
    });

    expect(ds.shouldStopAt(0x8000, () => 1)).toBe(true);
    expect(ds.consumeFiredOneShots()).toBe(0);
    expect(ds.breakpoints.some((bp) => bp.oneShot)).toBe(true);
  });

  it("B2: run-to an address holding a user breakpoint keeps the user's breakpoint", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({
      address: 0x8000,
      exec: true,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    expect(ds.breakpoints).toHaveLength(2);

    expect(ds.shouldStopAt(0x8000, noPartition)).toBe(true);
    expect(ds.consumeFiredOneShots()).toBe(1);

    // --- The run-to target is gone; the user's breakpoint is still there and still stops
    expect(ds.breakpoints).toHaveLength(1);
    expect(ds.breakpoints[0].oneShot).toBeUndefined();
    expect(ds.shouldStopAt(0x8000, noPartition)).toBe(true);
  });
});

describe("one-shots — consumption (Phase 1)", () => {
  it("a one-shot with -hit 3 stops once, on the third pass, and is then gone", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({
      address: 0x8000,
      exec: true,
      oneShot: true,
      owner: { kind: "session" },
      hitCount: 3
    });
    const stops: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const stop = ds.shouldStopAt(0x8000, noPartition);
      stops.push(stop);
      if (stop) ds.consumeFiredOneShots();
    }
    expect(stops).toEqual([false, false, true, false, false]);
    expect(ds.breakpoints).toEqual([]);
  });

  it("a memory-write one-shot is consumed", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x9000, memoryWrite: true, oneShot: true, owner: { kind: "session" } });
    expect(ds.hasMemoryWrite([0x9000], 1, noPartition, [0x12])).toBe(true);
    expect(ds.consumeFiredOneShots()).toBe(1);
    expect(ds.breakpoints).toEqual([]);
    expect(ds.hasMemoryWrite([0x9000], 1, noPartition, [0x12])).toBe(false);
  });

  it("an I/O one-shot is consumed", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x00fe, ioWrite: true, oneShot: true, owner: { kind: "session" } });
    expect(ds.hasIoWrite(0x00fe, 7)).toBe(true);
    expect(ds.consumeFiredOneShots()).toBe(1);
    expect(ds.hasIoWrite(0x00fe, 7)).toBe(false);
  });

  it("reports the definitions that stopped the machine", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, oneShot: true, owner: { kind: "session" } });
    ds.shouldStopAt(0x8000, noPartition);
    ds.consumeFiredOneShots();
    expect(ds.lastStopBreakpoints).toHaveLength(1);
    expect(ds.lastStopBreakpoints[0]).toMatchObject({ address: 0x8000, oneShot: true });
    // --- A second call with nothing fired keeps the report
    expect(ds.consumeFiredOneShots()).toBe(0);
    expect(ds.lastStopBreakpoints).toHaveLength(1);
    ds.clearFiredBreakpoints();
    expect(ds.lastStopBreakpoints).toEqual([]);
  });

  it("a disabled one-shot neither stops nor is consumed", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, oneShot: true, disabled: true, owner: { kind: "session" } });
    expect(ds.shouldStopAt(0x8000, noPartition)).toBe(false);
    expect(ds.consumeFiredOneShots()).toBe(0);
    expect(ds.breakpoints).toHaveLength(1);
  });
});

describe("one-shots — keys and persistence", () => {
  it("a user one-shot shares the regular breakpoint's key; a run-to target does not", () => {
    const regular = getBreakpointStorageKey({ address: 0x8000, exec: true });
    expect(getBreakpointStorageKey({ address: 0x8000, exec: true, oneShot: true })).toBe(regular);
    expect(getBreakpointStorageKey({ address: 0x8000, exec: true, oneShot: true, runTo: true })).toBe(
      `RT:${regular}`
    );
  });

  it("converting regular <-> one-shot changes what the project save writes", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    expect(savedByProject(ds)).toHaveLength(1);

    // --- Regular -> one-shot: the same key, now session-owned, so the save leaves it out
    ds.addBreakpoint({ address: 0x8000, exec: true, oneShot: true, owner: { kind: "session" } });
    expect(ds.breakpoints).toHaveLength(1);
    expect(savedByProject(ds)).toHaveLength(0);

    // --- "Keep after it stops": project-owned again
    ds.addBreakpoint({ address: 0x8000, exec: true });
    expect(savedByProject(ds)).toHaveLength(1);
    expect(savedByProject(ds)[0].oneShot).toBeUndefined();
  });

  it("a run-to target resolves on a source line alongside the user's breakpoint there", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "main.asm", line: 4, exec: true });
    ds.addBreakpoint({
      resource: "main.asm",
      line: 4,
      exec: true,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    ds.resolveBreakpoint("main.asm", 4, 0x8004);
    expect(ds.breakpoints.every((bp) => bp.resolvedAddress === 0x8004)).toBe(true);
    expect(ds.shouldStopAt(0x8004, noPartition)).toBe(true);
    expect(ds.consumeFiredOneShots()).toBe(1);
    expect(ds.breakpoints).toHaveLength(1);
  });
});

describe("memory ranges (S10)", () => {
  it("watches every byte of the range and nothing past it", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, memoryWrite: true, length: 5 });
    expect(getBreakpointStorageKey(ds.breakpoints[0])).toBe("$8000+5:W");
    expect(ds.hasMemoryWrite([0x8000], 1, noPartition)).toBe(true);
    expect(ds.hasMemoryWrite([0x8004], 1, noPartition)).toBe(true);
    expect(ds.hasMemoryWrite([0x8005], 1, noPartition)).toBe(false);
    expect(ds.hasMemoryWrite([0x7fff], 1, noPartition)).toBe(false);
  });

  it("removal clears only the flags no other breakpoint still needs", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, memoryWrite: true, length: 5 });
    ds.addBreakpoint({ address: 0x8002, memoryWrite: true });
    ds.removeBreakpoint({ address: 0x8000, memoryWrite: true, length: 5 });
    expect(ds.hasMemoryWrite([0x8000], 1, noPartition)).toBe(false);
    expect(ds.hasMemoryWrite([0x8002], 1, noPartition)).toBe(true);
  });

  it("disabling a range disables every byte, and enabling brings them back", () => {
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { address: 0x8000, memoryRead: true, length: 3 };
    ds.addBreakpoint(bp);
    ds.enableBreakpoint(bp, false);
    expect(ds.hasMemoryRead([0x8002], 1, noPartition)).toBe(false);
    ds.enableBreakpoint(bp, true);
    expect(ds.hasMemoryRead([0x8002], 1, noPartition)).toBe(true);
  });

  it("never wraps past $FFFF", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0xfffe, memoryWrite: true, length: 4 });
    expect(ds.hasMemoryWrite([0xffff], 1, noPartition)).toBe(true);
    expect(ds.hasMemoryWrite([0x0000], 1, noPartition)).toBe(false);
  });
});

describe("watch-anchored watchpoints (W3)", () => {
  it("resolve through the symbol table, move with it, and are inactive without it", () => {
    const ds = new DebugSupport();
    ds.setConditionSymbols({ score: 0x9000 });
    ds.addBreakpoint({ watchSymbol: "Score", memoryWrite: true, length: 2 });
    expect(ds.hasMemoryWrite([0x9001], 1, noPartition)).toBe(true);

    // --- A rebuild moved the label
    ds.setConditionSymbols({ score: 0xa000 });
    expect(ds.hasMemoryWrite([0x9001], 1, noPartition)).toBe(false);
    expect(ds.hasMemoryWrite([0xa001], 1, noPartition)).toBe(true);

    // --- The label is gone: inactive
    ds.setConditionSymbols({});
    expect(ds.hasMemoryWrite([0xa001], 1, noPartition)).toBe(false);
    expect(ds.listBreakpointsWithState()[0].conditionInactive).toMatch(/unknown symbol Score/);
  });
});
