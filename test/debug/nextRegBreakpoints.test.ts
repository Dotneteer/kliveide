import { describe, expect, it } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { DebugSupport, NEXTREG_WATCH_CPU, NEXTREG_WATCH_COPPER } from "@emu/machines/DebugSupport";

/*
 * The host half of NextReg write breakpoints: what `DebugSupport` hands the core, and the exact
 * decision it makes when the core reports a candidate.
 *
 * The split is the point. One slot per register cannot hold two different value filters, so the
 * table is allowed to be too generous and `hasNextRegWrite` is not. Every case below is really
 * asking "is the approximation still a superset of the exact answer?".
 *
 * See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.4.
 */

const FLAGS = 0x000;
const VALUE = 0x100;
const MASK = 0x200;

const support = (...bps: BreakpointInfo[]): DebugSupport => new DebugSupport(undefined, bps);

/** The three watch bytes for one register, as the core will read them. */
const watchFor = (d: DebugSupport, reg: number) => {
  const table = d.buildNextRegWatch();
  return { flags: table[FLAGS + reg], value: table[VALUE + reg], mask: table[MASK + reg] };
};

describe("NextReg breakpoints - the definition", () => {
  it("is not stored as an execution breakpoint", () => {
    // --- `addBreakpoint` derives `exec` by negating the four kind flags. A NextReg breakpoint has
    // --- none of them and no address either, so without the predicate it would claim `exec: true`
    // --- and the panel would render it with a disassembly cell it cannot fill.
    const stored = support({ nextReg: 0x07 }).breakpoints[0];
    expect(stored.exec).toBe(false);
  });

  it("keeps every field that makes it what it is", () => {
    // --- `addBreakpoint` rebuilds the definition field by field, and this file's own history is
    // --- three bugs caused by a field being left out of that literal.
    const stored = support({
      nextReg: 0x07,
      nextRegValue: 0x03,
      nextRegMask: 0x0f,
      nextRegCopper: true
    }).breakpoints[0];

    expect(stored).toMatchObject({
      nextReg: 0x07,
      nextRegValue: 0x03,
      nextRegMask: 0x0f,
      nextRegCopper: true
    });
  });

  it("arms no address flags, having no address to arm", () => {
    const d = support({ nextReg: 0x07 });
    expect(d.breakpointFlags.some((flag) => flag !== 0)).toBe(false);
  });
});

describe("NextReg breakpoints - hasNextRegBreakpoints", () => {
  it("is false with none, and on a set of ordinary breakpoints", () => {
    expect(new DebugSupport().hasNextRegBreakpoints()).toBe(false);
    expect(
      support({ address: 0x8000, exec: true }, { address: 0x9000, memoryWrite: true })
        .hasNextRegBreakpoints()
    ).toBe(false);
  });

  it("is true once one is armed, and false again when it is disabled", () => {
    expect(support({ nextReg: 0x07 }).hasNextRegBreakpoints()).toBe(true);
    expect(support({ nextReg: 0x07, disabled: true }).hasNextRegBreakpoints()).toBe(false);
  });
});

describe("NextReg breakpoints - the watch table", () => {
  it("arms CPU writes by default and copper writes only on request", () => {
    expect(watchFor(support({ nextReg: 0x07 }), 0x07).flags).toBe(NEXTREG_WATCH_CPU);
    expect(watchFor(support({ nextReg: 0x07, nextRegCopper: true }), 0x07).flags).toBe(
      NEXTREG_WATCH_CPU | NEXTREG_WATCH_COPPER
    );
  });

  it("leaves every register nobody watches at zero", () => {
    const table = support({ nextReg: 0x07 }).buildNextRegWatch();
    expect(table[FLAGS + 0x06]).toBe(0);
    expect(table[FLAGS + 0x08]).toBe(0);
  });

  it("uses a zero mask for an unfiltered breakpoint, which the core reads as 'any value'", () => {
    expect(watchFor(support({ nextReg: 0x07 }), 0x07)).toMatchObject({ value: 0, mask: 0 });
  });

  it("carries a filter's value and mask, defaulting the mask to $FF", () => {
    expect(watchFor(support({ nextReg: 0x07, nextRegValue: 0x03 }), 0x07)).toMatchObject({
      value: 0x03,
      mask: 0xff
    });
    expect(
      watchFor(support({ nextReg: 0x07, nextRegValue: 0x03, nextRegMask: 0x0f }), 0x07)
    ).toMatchObject({ value: 0x03, mask: 0x0f });
  });

  it("omits a disabled breakpoint entirely", () => {
    expect(watchFor(support({ nextReg: 0x07, disabled: true }), 0x07).flags).toBe(0);
  });

  it("is rebuilt from the definitions on every call, not kept in step with edits", () => {
    // --- The whole reason `buildNextRegWatch` exists rather than an invalidation hook: an edit
    // --- through any of the fifteen mutators must be visible without that mutator knowing.
    const d = support({ nextReg: 0x07 });
    expect(watchFor(d, 0x07).flags).toBe(NEXTREG_WATCH_CPU);

    d.removeBreakpoint({ nextReg: 0x07 });
    expect(watchFor(d, 0x07).flags).toBe(0);

    d.addBreakpoint({ nextReg: 0x07, nextRegCopper: true });
    expect(watchFor(d, 0x07).flags).toBe(NEXTREG_WATCH_CPU | NEXTREG_WATCH_COPPER);

    d.enableBreakpoint({ nextReg: 0x07, nextRegCopper: true }, false);
    expect(watchFor(d, 0x07).flags).toBe(0);
  });

  describe("two breakpoints on one register", () => {
    it("collapses two different filters to 'any value'", () => {
      // --- One slot, two filters. The core must catch both, so it is told to catch everything and
      // --- `hasNextRegWrite` sorts out which of the two actually wanted the write.
      const d = support(
        { nextReg: 0x07, nextRegValue: 0x00 },
        { nextReg: 0x07, nextRegValue: 0x03 }
      );
      expect(watchFor(d, 0x07)).toMatchObject({ flags: NEXTREG_WATCH_CPU, mask: 0 });
    });

    it("widens when a filtered one meets an unfiltered one, in either order", () => {
      const filteredFirst = support(
        { nextReg: 0x07, nextRegValue: 0x03 },
        { nextReg: 0x07, nextRegValue: undefined }
      );
      const unfilteredFirst = support(
        { nextReg: 0x07, nextRegValue: undefined },
        { nextReg: 0x07, nextRegValue: 0x03 }
      );
      expect(watchFor(filteredFirst, 0x07).mask).toBe(0);
      expect(watchFor(unfilteredFirst, 0x07).mask).toBe(0);
    });

    it("keeps the filter when both agree, so the common case stays narrow", () => {
      // --- Same key, so these are one breakpoint - but the widening rule must not fire on a
      // --- register whose filters are identical, or every re-add would widen the table.
      const d = support({ nextReg: 0x07, nextRegValue: 0x03, nextRegCopper: true });
      d.addBreakpoint({ nextReg: 0x07, nextRegValue: 0x03 });
      expect(watchFor(d, 0x07)).toMatchObject({ value: 0x03, mask: 0xff });
    });

    it("keeps registers independent", () => {
      const d = support(
        { nextReg: 0x07, nextRegValue: 0x00 },
        { nextReg: 0x07, nextRegValue: 0x03 },
        { nextReg: 0x4c, nextRegValue: 0x0b }
      );
      expect(watchFor(d, 0x07).mask).toBe(0);
      expect(watchFor(d, 0x4c)).toMatchObject({ value: 0x0b, mask: 0xff });
    });
  });
});

describe("NextReg breakpoints - hasNextRegWrite, the exact test", () => {
  it("accepts any value when the breakpoint has no filter", () => {
    const d = support({ nextReg: 0x07 });
    expect(d.hasNextRegWrite(0x07, 0x00, "cpu")).toBe(true);
    expect(d.hasNextRegWrite(0x07, 0xff, "cpu")).toBe(true);
  });

  it("rejects a different register", () => {
    expect(support({ nextReg: 0x07 }).hasNextRegWrite(0x08, 0x03, "cpu")).toBe(false);
  });

  it("rejects a disabled breakpoint", () => {
    expect(support({ nextReg: 0x07, disabled: true }).hasNextRegWrite(0x07, 0x03, "cpu")).toBe(
      false
    );
  });

  it("matches a filter exactly, and through a mask", () => {
    const exact = support({ nextReg: 0x07, nextRegValue: 0x03 });
    expect(exact.hasNextRegWrite(0x07, 0x03, "cpu")).toBe(true);
    expect(exact.hasNextRegWrite(0x07, 0x13, "cpu")).toBe(false);

    const masked = support({ nextReg: 0x07, nextRegValue: 0x03, nextRegMask: 0x0f });
    expect(masked.hasNextRegWrite(0x07, 0x13, "cpu")).toBe(true);
    expect(masked.hasNextRegWrite(0x07, 0x14, "cpu")).toBe(false);
  });

  it("rejects the write the widened table let through", () => {
    /*
     * The pair that makes the approximation safe. The table says "catch every write to $07"; the
     * core duly reports a write of $05, which neither breakpoint asked for, and this is what stops
     * the machine pausing on it.
     */
    const d = support(
      { nextReg: 0x07, nextRegValue: 0x00 },
      { nextReg: 0x07, nextRegValue: 0x03 }
    );
    expect(watchFor(d, 0x07).mask).toBe(0);

    expect(d.hasNextRegWrite(0x07, 0x05, "cpu")).toBe(false);
    expect(d.hasNextRegWrite(0x07, 0x00, "cpu")).toBe(true);
    expect(d.hasNextRegWrite(0x07, 0x03, "cpu")).toBe(true);
  });

  describe("origins", () => {
    it("accepts a CPU write for every breakpoint on the register", () => {
      expect(support({ nextReg: 0x07 }).hasNextRegWrite(0x07, 0x03, "cpu")).toBe(true);
      expect(
        support({ nextReg: 0x07, nextRegCopper: true }).hasNextRegWrite(0x07, 0x03, "cpu")
      ).toBe(true);
    });

    it("accepts a copper write only for a breakpoint that opted in", () => {
      expect(support({ nextReg: 0x07 }).hasNextRegWrite(0x07, 0x03, "copper")).toBe(false);
      expect(
        support({ nextReg: 0x07, nextRegCopper: true }).hasNextRegWrite(0x07, 0x03, "copper")
      ).toBe(true);
    });

    it("lets one breakpoint on a register answer for a copper write the other declined", () => {
      // --- Two breakpoints, one opted in. The copper write belongs to that one, so the machine
      // --- stops - the other simply does not object.
      const d = support(
        { nextReg: 0x07, nextRegValue: 0x00 },
        { nextReg: 0x07, nextRegValue: 0x03, nextRegCopper: true }
      );
      expect(d.hasNextRegWrite(0x07, 0x00, "copper")).toBe(false);
      expect(d.hasNextRegWrite(0x07, 0x03, "copper")).toBe(true);
    });
  });
});
