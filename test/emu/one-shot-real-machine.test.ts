import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";

/*
 * One-shot breakpoints on the real 48K core (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md`
 * Phase 1): a one-shot stops once and is gone, a filtered one waits for its own filters, a run-to
 * target leaves the user's breakpoint alone, and a memory one-shot is spent at its stop. The harness
 * has no machine controller, so where the controller spends a memory stop's one-shots the test
 * calls `consumeFiredOneShots` itself.
 */

async function loop(passes = 5) {
  const s = await createSp48Session();
  const program = await s.loadCode(`
      .org $8000
  Main:
      ld b,${passes}
  Loop:
      ld a,b
      ld (Last),a
      djnz Loop
  Done:
      jr Done
  Last:
      .defb 0
  `);
  const ds = s.attachDebugSupport();
  ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
  return { s, program, ds };
}

describe("one-shot breakpoints - ZX Spectrum 48K", () => {
  it("stops once at a one-shot, which is then gone", async () => {
    const { s, program, ds } = await loop();
    const at = program.symbol("Loop");
    ds.addBreakpoint({ address: at, exec: true, oneShot: true, owner: { kind: "session" } });
    expect(s.callToBreakpoint("Main")).toBe(at);
    expect(ds.breakpoints.some((bp) => bp.address === at)).toBe(false);
    expect(s.continueToBreakpoint()).toBe(program.symbol("Done"));
  });

  it("-once -hit 3 stops on the third pass, with B = 3", async () => {
    const { s, program, ds } = await loop();
    const at = program.symbol("Loop");
    ds.addBreakpoint({ address: at, exec: true, oneShot: true, owner: { kind: "session" }, hitCount: 3 });
    expect(s.callToBreakpoint("Main")).toBe(at);
    expect(s.machine.b).toBe(3);
    expect(s.continueToBreakpoint()).toBe(program.symbol("Done"));
  });

  it("a conditional one-shot is not spent by a user breakpoint stopping at the same address (B1)", async () => {
    const { s, program, ds } = await loop();
    const at = program.symbol("Loop");
    // --- A source breakpoint resolved onto the address: a second definition at the same place
    ds.addBreakpoint({ resource: "main.asm", line: 4, exec: true, hitCount: 1 });
    ds.resolveBreakpoint("main.asm", 4, at);
    ds.addBreakpoint({ address: at, exec: true, oneShot: true, owner: { kind: "session" }, condition: "B == 2" });
    // --- The user's breakpoint stops on the first pass (B = 5); the one-shot's condition is false
    expect(s.callToBreakpoint("Main")).toBe(at);
    expect(s.machine.b).toBe(5);
    expect(ds.breakpoints.filter((bp) => bp.oneShot)).toHaveLength(1);
    // --- ...and the one-shot still stops when B = 2
    expect(s.continueToBreakpoint()).toBe(at);
    expect(s.machine.b).toBe(2);
    expect(ds.breakpoints.filter((bp) => bp.oneShot)).toHaveLength(0);
  });

  it("run-to an address with a user breakpoint keeps the user's breakpoint (B2)", async () => {
    const { s, program, ds } = await loop();
    const at = program.symbol("Loop");
    ds.addBreakpoint({ address: at, exec: true });
    ds.addBreakpoint({ address: at, exec: true, oneShot: true, runTo: true, owner: { kind: "session" } });
    expect(s.callToBreakpoint("Main")).toBe(at);
    expect(ds.breakpoints.filter((bp) => bp.address === at)).toHaveLength(1);
    expect(s.continueToBreakpoint()).toBe(at);
  });

  it("spends a memory-write one-shot at its stop", async () => {
    const { s, program, ds } = await loop();
    const last = program.symbol("Last");
    ds.addBreakpoint({ address: last, memoryWrite: true, oneShot: true, owner: { kind: "session" } });
    s.callToBreakpoint("Main");
    expect(s.peek(last)).toBe(5);
    expect(ds.consumeFiredOneShots()).toBe(1);
    expect(s.continueToBreakpoint()).toBe(program.symbol("Done"));
  });
});
