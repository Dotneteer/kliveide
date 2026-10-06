import { describe, expect, it } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { DebugSupport } from "@emu/machines/DebugSupport";
import {
  getBreakpointAddressSpec,
  getBreakpointDisplayKey,
  getBreakpointStorageKey
} from "@common/utils/breakpoints";
import {
  isCopperBreakpoint,
  isEventBreakpoint,
  isNextRegBreakpoint
} from "@common/utils/breakpoint-scope";

/*
 * The host half of Copper breakpoints (`cu:`): the key, the predicates, the definition `DebugSupport`
 * stores, and the 1024-bit watch it hands the ZX Spectrum Next core. See
 * `.plans/COPPER_DEBUGGING_PLAN.md` §4.7.
 */

const support = (...bps: BreakpointInfo[]): DebugSupport => new DebugSupport(undefined, bps);

const watchBit = (table: Uint8Array, index: number) => (table[index >> 3] >> (index & 7)) & 1;

describe("Copper breakpoints - key and predicates", () => {
  it("is keyed by its list index, in every form", () => {
    expect(getBreakpointStorageKey({ copperIndex: 0x0b })).toBe("CU:$00B");
    expect(getBreakpointDisplayKey({ copperIndex: 0x3ff }, {})).toBe("CU:$3FF");
    expect(getBreakpointAddressSpec({ copperIndex: 0 }, {})).toBe("CU:$000");
  });

  it("puts a run-to target in its own namespace", () => {
    expect(getBreakpointStorageKey({ copperIndex: 0x0b, runTo: true })).toBe("RT:CU:$00B");
    expect(getBreakpointAddressSpec({ copperIndex: 0x0b, runTo: true }, {})).toBe("CU:$00B");
  });

  it("is an event breakpoint, and not a NextReg one", () => {
    expect(isCopperBreakpoint({ copperIndex: 0 })).toBe(true);
    expect(isEventBreakpoint({ copperIndex: 0 })).toBe(true);
    expect(isNextRegBreakpoint({ copperIndex: 0 })).toBe(false);
    expect(isCopperBreakpoint({ nextReg: 0 })).toBe(false);
    expect(isEventBreakpoint({ nextReg: 0 })).toBe(true);
    expect(isEventBreakpoint({ address: 0x8000, exec: true })).toBe(false);
  });
});

describe("Copper breakpoints - the definition", () => {
  it("is not stored as an execution breakpoint, and keeps its index", () => {
    const d = support({ copperIndex: 0x0b, exec: true });
    const [bp] = d.breakpoints;
    expect(bp.exec).toBe(false);
    expect(bp.copperIndex).toBe(0x0b);
  });

  it("arms no address flag", () => {
    const d = support({ copperIndex: 0 });
    expect(d.breakpointFlags.every((f) => f === 0)).toBe(true);
  });

  it("is reported by hasCopperBreakpoints only while enabled", () => {
    expect(support().hasCopperBreakpoints()).toBe(false);
    expect(support({ nextReg: 7 }).hasCopperBreakpoints()).toBe(false);
    expect(support({ copperIndex: 1 }).hasCopperBreakpoints()).toBe(true);
    expect(support({ copperIndex: 1, disabled: true }).hasCopperBreakpoints()).toBe(false);
  });
});

describe("Copper breakpoints - the watch table", () => {
  it("sets one bit per enabled index", () => {
    const d = support({ copperIndex: 0 }, { copperIndex: 0x0b }, { copperIndex: 0x3ff }, { copperIndex: 5, disabled: true });
    const table = d.buildCopperWatch();
    expect(table).toHaveLength(128);
    expect(watchBit(table, 0)).toBe(1);
    expect(watchBit(table, 0x0b)).toBe(1);
    expect(watchBit(table, 0x3ff)).toBe(1);
    expect(watchBit(table, 5)).toBe(0);
    expect(table.reduce((n, b) => n + b.toString(2).split("1").length - 1, 0)).toBe(3);
  });

  it("is rebuilt from the current definitions on every call", () => {
    const d = support({ copperIndex: 7 });
    expect(watchBit(d.buildCopperWatch(), 7)).toBe(1);
    d.removeBreakpoint({ copperIndex: 7 });
    expect(watchBit(d.buildCopperWatch(), 7)).toBe(0);
  });
});

describe("Copper breakpoints - the decision", () => {
  it("stops only for the watched index", () => {
    const d = support({ copperIndex: 2 });
    expect(d.hasCopperHit(2, 0x8060)).toBe(true);
    expect(d.hasCopperHit(3, 0x8060)).toBe(false);
  });

  it("counts hits (-hit 3)", () => {
    const d = support({ copperIndex: 2, hitCount: 3, hitMode: "eq" });
    expect([d.hasCopperHit(2, 0), d.hasCopperHit(2, 0), d.hasCopperHit(2, 0), d.hasCopperHit(2, 0)]).toEqual([
      false,
      false,
      true,
      false
    ]);
  });

  it("ignores a disabled breakpoint", () => {
    expect(support({ copperIndex: 2, disabled: true }).hasCopperHit(2, 0)).toBe(false);
  });
});
