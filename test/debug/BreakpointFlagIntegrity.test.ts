import { describe, it, expect } from "vitest";

import {
  DebugSupport,
  DIS_EXEC_BP,
  EXEC_BP,
  HIT_BP,
  MEM_WRITE_BP,
  PART_BP
} from "@emu/machines/DebugSupport";
import { bankRelativePartition } from "@common/utils/breakpoint-scope";

/*
 * One flags word per address, shared by every breakpoint at it.
 *
 * Four places used to mutate `breakpointFlags[address]` in their own way, each treating it as its
 * own — and each was wrong in a different direction. The cases below are the four, and they failed
 * before `refreshFlagsAt` derived the word from the definitions instead.
 *
 * These matter more than they look: a bank-relative breakpoint occupies *eight* addresses, so the
 * chance of a plain breakpoint landing on one of them is eight times what you would guess, and the
 * failure is silent in both directions — a breakpoint that stops when it should not, or stops
 * mattering for good.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.4.
 */

/** Bank 5 offset $0100 arms $0100, $2100, ... $E100; its partition is bank 5's low 8K page. */
const BANK5_OFFSET = 0x0100;
const BANK5_ADDRESS = 0x8100;
const BANK5_PARTITION = bankRelativePartition(5, BANK5_OFFSET);

/** The paging the bank breakpoint needs to fire at `$8100`. */
const paged = (address: number) => (((address >> 13) & 0x07) === 4 ? BANK5_PARTITION : undefined);

describe("adding a breakpoint where a bank-relative one is armed", () => {
  it("does not erase the bank breakpoint's flags", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: BANK5_OFFSET, exec: true });
    ds.addBreakpoint({ address: BANK5_ADDRESS, exec: true });

    expect(ds.breakpointFlags[BANK5_ADDRESS] & PART_BP).toBeTruthy();
    expect(ds.breakpointFlags[BANK5_ADDRESS] & EXEC_BP).toBeTruthy();
  });

  it("leaves the bank breakpoint working after the other one is removed", () => {
    /*
     * The visible consequence. With the flags assigned rather than derived, `PART_BP` was gone the
     * moment the plain breakpoint was added; removing it then cleared `EXEC_BP` too and the address
     * stopped stopping the machine — while the Breakpoints panel still listed the bank breakpoint.
     */
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: BANK5_OFFSET, exec: true });
    ds.addBreakpoint({ address: BANK5_ADDRESS, exec: true });
    ds.removeBreakpoint({ address: BANK5_ADDRESS, exec: true });

    expect(ds.shouldStopAt(BANK5_ADDRESS, paged)).toEqual(true);
  });

  it("still clears a breakpoint's own stale bits when its kind changes", () => {
    // --- What the old assignment did correctly, and a naive `|=` would have broken: the same
    // --- breakpoint re-added as a different kind must not keep the old kind's bit.
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x9000, memoryWrite: true });
    expect(ds.breakpointFlags[0x9000] & MEM_WRITE_BP).toBeTruthy();

    ds.removeBreakpoint({ address: 0x9000, memoryWrite: true });
    ds.addBreakpoint({ address: 0x9000, exec: true });

    expect(ds.breakpointFlags[0x9000] & MEM_WRITE_BP).toBeFalsy();
    expect(ds.breakpointFlags[0x9000] & EXEC_BP).toBeTruthy();
  });
});

describe("resolving a source breakpoint onto a bank breakpoint's address", () => {
  it("does not disarm the bank breakpoint", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: BANK5_OFFSET, exec: true });
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, BANK5_ADDRESS);

    expect(ds.breakpointFlags[BANK5_ADDRESS] & PART_BP).toBeTruthy();
    expect(ds.breakpointFlags[BANK5_ADDRESS] & EXEC_BP).toBeTruthy();
  });

  it("arms the resolved address", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0x8000);
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(true);
  });

  it("keeps a disabled source breakpoint disabled", () => {
    const ds = new DebugSupport();
    const bp = { resource: "a.asm", line: 3, exec: true };
    ds.addBreakpoint(bp);
    ds.enableBreakpoint(bp, false);
    ds.resolveBreakpoint("a.asm", 3, 0x8000);

    expect(ds.breakpointFlags[0x8000] & DIS_EXEC_BP).toBeTruthy();
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
  });
});

describe("re-resolving after a rebuild", () => {
  it("stops stopping at the address the code moved away from", () => {
    /*
     * The user-visible defect: `resetBreakpointResolution` deleted `resolvedAddress` and left the
     * flags, so after a rebuild that shifted a line's code the machine stopped at the old address
     * *and* the new one — a phantom breakpoint with nothing in the panel to explain it.
     */
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0x8000);

    ds.resetBreakpointResolution();
    ds.resolveBreakpoint("a.asm", 3, 0x8010);

    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
    expect(ds.shouldStopAt(0x8010, () => undefined)).toEqual(true);
  });

  it("leaves a plain breakpoint at the vacated address alone", () => {
    // --- Clearing the address wholesale would take another breakpoint's flags with it.
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0x8000);

    ds.resetBreakpointResolution();

    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(true);
  });

  it("leaves a bank breakpoint at the vacated address alone", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: BANK5_OFFSET, exec: true });
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, BANK5_ADDRESS);

    ds.resetBreakpointResolution();

    expect(ds.shouldStopAt(BANK5_ADDRESS, paged)).toEqual(true);
  });
});

describe("two breakpoints of one kind at one address", () => {
  it("stays armed while either is enabled", () => {
    /*
     * A disabled breakpoint must not mask an enabled one. `collectBpFlags` sets `DIS_EXEC_BP` for a
     * disabled breakpoint, so OR-ing two definitions naively would set both `EXEC_BP` and
     * `DIS_EXEC_BP` and `shouldStopAt` would read the address as disabled — which is why the
     * disabled marker is decided per kind, from whether *every* contributor is disabled.
     */
    const ds = new DebugSupport();
    const off = { resource: "a.asm", line: 3, exec: true };
    ds.addBreakpoint(off);
    ds.enableBreakpoint(off, false);
    ds.resolveBreakpoint("a.asm", 3, 0x8000);
    ds.addBreakpoint({ address: 0x8000, exec: true });

    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(true);
  });

  it("is disabled only when both are", () => {
    const ds = new DebugSupport();
    const source = { resource: "a.asm", line: 3, exec: true };
    const direct = { address: 0x8000, exec: true };
    ds.addBreakpoint(source);
    ds.resolveBreakpoint("a.asm", 3, 0x8000);
    ds.addBreakpoint(direct);

    ds.enableBreakpoint(source, false);
    ds.enableBreakpoint(direct, false);

    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
  });
});

describe("flags unrelated to the change", () => {
  it("keeps a hit count's marker", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 3 });
    expect(ds.breakpointFlags[0x8000] & HIT_BP).toBeTruthy();
  });

  it("keeps an I/O breakpoint's flags where its port matches", () => {
    // --- `refreshFlagsAt` has to account for masked port breakpoints, or adding a code breakpoint
    // --- at an address a port breakpoint also claims would erase it.
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x00fe, ioRead: true, ioMask: 0x00ff });
    const before = ds.breakpointFlags[0x00fe];
    ds.addBreakpoint({ address: 0x00fe, exec: true });

    expect(ds.breakpointFlags[0x00fe] & before).toEqual(before);
    expect(ds.breakpointFlags[0x00fe] & EXEC_BP).toBeTruthy();
  });
});

describe("the stored definition must be complete", () => {
  /*
   * `addBreakpoint` rebuilds the definition field by field, and was dropping `disabled` and
   * `hitCount`. That was survivable while the flags were assigned from the *incoming* breakpoint —
   * the machine behaved and only `listBreakpoints` was short — but the flags are derived from the
   * definitions now, so an incomplete definition is a wrong answer.
   */

  it("adds a breakpoint disabled when it was given disabled", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, disabled: true });

    expect(ds.breakpointFlags[0x8000] & DIS_EXEC_BP).toBeTruthy();
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
  });

  it("reports it back as disabled", () => {
    // --- What the Breakpoints panel and the project persister read.
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, disabled: true });
    expect(ds.breakpoints[0].disabled).toEqual(true);
  });

  it("keeps a bank-relative breakpoint's disabled state too", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: BANK5_OFFSET, exec: true, disabled: true });
    expect(ds.shouldStopAt(BANK5_ADDRESS, paged)).toEqual(false);
  });

  it("reports the hit count back", () => {
    // --- The breakpoint dialog shows this; it read `undefined` for every breakpoint until now.
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 7 });
    expect(ds.breakpoints[0].hitCount).toEqual(7);
  });

  it("keeps a statement breakpoint's column", () => {
    // --- The column is in the storage key but was missing from the literal, so the definition was
    // --- listed - and saved - as a line breakpoint on the same line.
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "main.kbas", line: 7, column: 12, exec: true });
    expect(ds.breakpoints[0].column).toEqual(12);
  });

  /*
   * Conditional breakpoints, Phase 1 (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.1): the condition
   * and the hit rule are stored on every binding shape, and the runtime-only fields never are.
   */
  const FILTERS = { condition: "A == $FF && !ZF", hitMode: "every" as const, hitCount: 4 };
  const SHAPES = [
    { address: 0x8000, exec: true },
    { address: 0x8000, partition: 3, exec: true },
    { address: 0x8000, memoryRead: true },
    { address: 0x00fe, ioWrite: true, ioMask: 0x00ff },
    { bank: 5, bankOffset: 0x0100, memoryWrite: true },
    { label: "DrawSprite", labelFile: "/p/Game.nex.dis", bank: 5, exec: true },
    { resource: "main.asm", line: 42, exec: true },
    { resource: "main.kbas", line: 7, column: 12, exec: true },
    { nextReg: 0x07, nextRegCopper: true }
  ];

  it.each(SHAPES.map((bp) => [JSON.stringify(bp), bp] as const))(
    "stores the condition and the hit rule of %s",
    (_name, bp) => {
      const ds = new DebugSupport();
      ds.addBreakpoint({ ...bp, ...FILTERS });
      expect(ds.breakpoints[0]).toMatchObject({ ...bp, ...FILTERS });
    }
  );

  it("never stores runtime state handed in by a caller", () => {
    // --- A caller round-tripping `listBreakpoints` output hands these back; a counter must not be
    // --- seeded, and a stale error must not stick, from what a listing once said.
    const ds = new DebugSupport();
    ds.addBreakpoint({
      address: 0x8000,
      exec: true,
      condition: "B == 0",
      currentHits: 17,
      conditionError: "stale",
      conditionInactive: "stale"
    });
    const [stored] = ds.breakpoints;
    expect(stored.condition).toEqual("B == 0");
    expect(stored).not.toHaveProperty("currentHits");
    expect(stored).not.toHaveProperty("conditionError");
    expect(stored).not.toHaveProperty("conditionInactive");
  });

  it("does not store a blank condition or a mode without a count", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "  ", hitMode: "gt" });
    const [stored] = ds.breakpoints;
    expect(stored).not.toHaveProperty("condition");
    expect(stored).not.toHaveProperty("hitMode");
  });

  it("replaces the filters when the same breakpoint is set again (C13)", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, ...FILTERS });
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "HL > $C000" });

    expect(ds.breakpoints).toHaveLength(1);
    expect(ds.breakpoints[0].condition).toEqual("HL > $C000");
    expect(ds.breakpoints[0]).not.toHaveProperty("hitCount");
  });

  it("keeps the filters through resetBreakpointsTo, the path undo, redo and restores take", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "main.asm", line: 42, exec: true, ...FILTERS });
    ds.resetBreakpointsTo(ds.breakpoints, { kind: "project" });
    expect(ds.breakpoints[0]).toMatchObject(FILTERS);
  });

  it("keeps a source breakpoint's filters when its line moves", () => {
    // --- `scrollBreakpoints` is how the editor tracks a breakpoint through inserted lines.
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "main.asm", line: 42, exec: true, ...FILTERS });
    ds.scrollBreakpoints({ resource: "main.asm", line: 10 }, 3);
    expect(ds.breakpoints[0]).toMatchObject({ line: 45, ...FILTERS });
  });

  it("keeps the filters through a rename of the source file", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "main.asm", line: 42, exec: true, ...FILTERS });
    ds.renameBreakpoints("main.asm", "game.asm");
    expect(ds.breakpoints[0]).toMatchObject({ resource: "game.asm", ...FILTERS });
  });

  it("keeps the filters through disabling and enabling", () => {
    const ds = new DebugSupport();
    const bp = { address: 0x8000, exec: true, ...FILTERS };
    ds.addBreakpoint(bp);
    ds.enableBreakpoint(bp, false);
    ds.enableBreakpoint(bp, true);
    expect(ds.breakpoints[0]).toMatchObject(FILTERS);
  });
});

describe("a partition-scoped breakpoint added disabled", () => {
  /*
   * `addPartitionEntry` hardcoded its entry as enabled, so these came out armed. Every caller
   * covered for it by calling `enableBreakpoint` afterwards — `applyBreakpointEdit` and
   * `resetBreakpointsTo` both do, and both explain in a comment that they must — which is how a
   * defect survives: the workaround is in the two paths anyone would test through.
   */

  it("is not armed", () => {
    const ds = new DebugSupport();
    const partition = bankRelativePartition(5, BANK5_OFFSET);
    ds.addBreakpoint({ address: BANK5_ADDRESS, partition, exec: true, disabled: true });
    expect(ds.shouldStopAt(BANK5_ADDRESS, paged)).toEqual(false);
  });

  it("arms once enabled", () => {
    const ds = new DebugSupport();
    const partition = bankRelativePartition(5, BANK5_OFFSET);
    const bp = { address: BANK5_ADDRESS, partition, exec: true, disabled: true };
    ds.addBreakpoint(bp);
    ds.enableBreakpoint(bp, true);
    expect(ds.shouldStopAt(BANK5_ADDRESS, paged)).toEqual(true);
  });
});
