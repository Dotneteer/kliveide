import { describe, expect, it } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import {
  BREAKPOINT_HIT_MODES,
  breakpointFiltersOf,
  effectiveHitMode,
  hasBreakpointFilters,
  readStoredBreakpointFilters,
  sameBreakpointFilters,
  withoutBreakpointRuntimeState
} from "@common/utils/breakpoint-filters";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";

/*
 * Conditional breakpoints, Phase 1: the model and its persistence. Nothing evaluates a condition yet;
 * these pin which fields are stored, which are not, and that neither filter is part of the identity.
 * See `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.1, §4.7, C13.
 */

describe("the breakpoint's identity", () => {
  /** One of every binding shape, so no key branch is left untested. */
  const SHAPES: BreakpointInfo[] = [
    { address: 0x8000, exec: true },
    { address: 0x8000, partition: 3, exec: true },
    { address: 0x8000, memoryWrite: true },
    { address: 0x00fe, ioRead: true, ioMask: 0x00ff },
    { bank: 5, bankOffset: 0x0100, exec: true },
    { label: "DrawSprite", labelFile: "/p/Game.nex.dis", bank: 5, exec: true },
    { resource: "main.asm", line: 42, exec: true },
    { resource: "main.kbas", line: 7, column: 12, exec: true },
    { nextReg: 0x07 }
  ];

  it.each(SHAPES.map((bp) => [getBreakpointStorageKey(bp), bp] as const))(
    "%s keeps the condition and the hit rule out of its key",
    (_key, bp) => {
      const filtered: BreakpointInfo = {
        ...bp,
        condition: "A == $FF && !ZF",
        hitMode: "every",
        hitCount: 10,
        currentHits: 3,
        conditionInactive: "unknown label score"
      };
      // --- C13: `bp-set` on the same place replaces the filters rather than adding a breakpoint
      expect(getBreakpointStorageKey(filtered)).toBe(getBreakpointStorageKey(bp));
    }
  );
});

describe("effectiveHitMode", () => {
  it("is absent without a hit count, whatever the mode says", () => {
    expect(effectiveHitMode({})).toBeUndefined();
    expect(effectiveHitMode({ hitMode: "gt" })).toBeUndefined();
  });

  it("reads a bare hit count as 'equal', the only meaning an older file could have had", () => {
    expect(effectiveHitMode({ hitCount: 4 })).toBe("eq");
  });

  it.each(BREAKPOINT_HIT_MODES.map((mode) => [mode]))("keeps an explicit %s", (mode) => {
    expect(effectiveHitMode({ hitCount: 4, hitMode: mode })).toBe(mode);
  });
});

describe("breakpointFiltersOf", () => {
  it("returns nothing for an unfiltered breakpoint", () => {
    expect(breakpointFiltersOf({ address: 0x8000 })).toEqual({});
    expect(hasBreakpointFilters({ address: 0x8000 })).toBe(false);
  });

  it("keeps the condition verbatim, spacing included", () => {
    expect(breakpointFiltersOf({ condition: "  A == 1 " })).toEqual({ condition: "  A == 1 " });
  });

  it("drops a blank condition, which means 'always'", () => {
    expect(breakpointFiltersOf({ condition: "   " })).toEqual({});
    expect(hasBreakpointFilters({ condition: "" })).toBe(false);
  });

  it("drops a hit mode with no count to compare against", () => {
    expect(breakpointFiltersOf({ hitMode: "ge" })).toEqual({});
  });

  it("keeps a count with and without a mode", () => {
    expect(breakpointFiltersOf({ hitCount: 3 })).toEqual({ hitCount: 3 });
    expect(breakpointFiltersOf({ hitCount: 3, hitMode: "lt" })).toEqual({
      hitCount: 3,
      hitMode: "lt"
    });
    expect(hasBreakpointFilters({ hitCount: 3 })).toBe(true);
  });

  it("never carries runtime state", () => {
    expect(
      breakpointFiltersOf({ condition: "B", currentHits: 9, conditionError: "x", conditionInactive: "y" })
    ).toEqual({ condition: "B" });
  });
});

describe("sameBreakpointFilters", () => {
  it("treats a bare count and an explicit 'eq' as the same rule", () => {
    expect(sameBreakpointFilters({ hitCount: 5 }, { hitCount: 5, hitMode: "eq" })).toBe(true);
  });

  it("treats a blank condition as no condition", () => {
    expect(sameBreakpointFilters({ condition: " " }, {})).toBe(true);
  });

  it("notices every difference that would need writing", () => {
    const base: BreakpointInfo = { condition: "A == 1", hitCount: 5, hitMode: "ge" };
    expect(sameBreakpointFilters(base, { ...base })).toBe(true);
    expect(sameBreakpointFilters(base, { ...base, condition: "A == 2" })).toBe(false);
    expect(sameBreakpointFilters(base, { ...base, hitCount: 6 })).toBe(false);
    expect(sameBreakpointFilters(base, { ...base, hitMode: "gt" })).toBe(false);
    expect(sameBreakpointFilters(base, { condition: "A == 1" })).toBe(false);
  });

  it("ignores runtime state", () => {
    expect(sameBreakpointFilters({ hitCount: 2 }, { hitCount: 2, currentHits: 7 })).toBe(true);
  });
});

describe("withoutBreakpointRuntimeState", () => {
  it("removes the three runtime fields and keeps everything else", () => {
    const listed: BreakpointInfo = {
      address: 0x8000,
      exec: true,
      disabled: true,
      condition: "w[score] > 100",
      hitMode: "every",
      hitCount: 4,
      currentHits: 17,
      conditionError: "Unexpected token",
      conditionInactive: "unknown label score"
    };
    expect(withoutBreakpointRuntimeState(listed)).toEqual({
      address: 0x8000,
      exec: true,
      disabled: true,
      condition: "w[score] > 100",
      hitMode: "every",
      hitCount: 4
    });
  });

  it("does not mutate what it is given", () => {
    const listed: BreakpointInfo = { address: 0x8000, currentHits: 2 };
    withoutBreakpointRuntimeState(listed);
    expect(listed.currentHits).toBe(2);
  });

  it("strips a zero hit count, which is still runtime state", () => {
    expect(withoutBreakpointRuntimeState({ address: 1, currentHits: 0 })).toEqual({ address: 1 });
  });
});

describe("readStoredBreakpointFilters", () => {
  it("reads every valid field", () => {
    expect(
      readStoredBreakpointFilters({ condition: "HL > $C000", hitMode: "le", hitCount: 65535 })
    ).toEqual({ filters: { condition: "HL > $C000", hitMode: "le", hitCount: 65535 }, problems: [] });
  });

  it("reads nothing from an entry without filters", () => {
    expect(readStoredBreakpointFilters({ bank: 5 })).toEqual({ filters: {}, problems: [] });
  });

  it("drops a condition that is not a string", () => {
    const { filters, problems } = readStoredBreakpointFilters({ condition: 42 });
    expect(filters).toEqual({});
    expect(problems).toEqual(["condition must be a string; ignored."]);
  });

  it("drops a blank condition silently: it means 'always'", () => {
    expect(readStoredBreakpointFilters({ condition: "" })).toEqual({ filters: {}, problems: [] });
  });

  it.each([[0], [65536], [1.5], ["3"], [-1]])("drops hit count %j, and its mode with it", (hitCount) => {
    const { filters, problems } = readStoredBreakpointFilters({ hitCount, hitMode: "ge" });
    expect(filters).toEqual({});
    // --- One problem: the mode is not reported again for a count already reported
    expect(problems).toEqual(["hitCount must be an integer 1..65535; ignored."]);
  });

  it("drops an unknown hit mode and keeps the count, which then means 'equal'", () => {
    const { filters, problems } = readStoredBreakpointFilters({ hitCount: 3, hitMode: "often" });
    expect(filters).toEqual({ hitCount: 3 });
    expect(problems).toEqual(["hitMode must be one of eq, gt, ge, lt, le, every; ignored."]);
  });

  it("reports a mode with no count", () => {
    const { filters, problems } = readStoredBreakpointFilters({ hitMode: "every" });
    expect(filters).toEqual({});
    expect(problems).toEqual(["hitMode without hitCount; ignored."]);
  });
});
