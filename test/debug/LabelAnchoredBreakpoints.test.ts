import { describe, it, expect } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { DebugSupport } from "@emu/machines/DebugSupport";
import {
  getBreakpointDisplayKey,
  getBreakpointStorageKey
} from "@common/utils/breakpoints";
import {
  bankRelativePartition,
  effectiveBankSite,
  isBankRelative,
  isLabelAnchored
} from "@common/utils/breakpoint-scope";

/*
 * Breakpoints anchored to a label in a NEX annotation sidecar.
 *
 * The only binding mode that survives code moving. An address breakpoint names a place in memory
 * and a bank-relative one names an offset in a bank; both stop meaning what the user meant as soon
 * as a rebuild shifts the routine. "Break at `DrawSprite`" keeps meaning it.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.2.
 */

const SIDECAR = "Game.nex.dis";

/** A local-label breakpoint: `DrawSprite` in bank 5 of `Game.nex.dis`. */
function localLabelBp(over: Partial<BreakpointInfo> = {}): BreakpointInfo {
  return { label: "DrawSprite", labelFile: SIDECAR, bank: 5, exec: true, ...over };
}

/** A global-label breakpoint, which has no bank. */
function globalLabelBp(over: Partial<BreakpointInfo> = {}): BreakpointInfo {
  return { label: "Start", labelFile: SIDECAR, exec: true, ...over };
}

describe("identity", () => {
  it("is the label, not wherever it resolved to", () => {
    /*
     * The whole point. Keying it by the resolved site would change the key every time a rebuild
     * moved the code — which is the one thing this shape exists not to do — and every map keyed by
     * it (`breakpointDefs`, the sidecar's stored set, the panel) would see a different breakpoint.
     */
    const unresolved = localLabelBp();
    const resolved = localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 });
    const movedByRebuild = localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0180 });

    expect(getBreakpointStorageKey(resolved)).toEqual(getBreakpointStorageKey(unresolved));
    expect(getBreakpointStorageKey(movedByRebuild)).toEqual(getBreakpointStorageKey(unresolved));
  });

  it("is file-qualified, because a name means different things in different sidecars", () => {
    // --- §4.4: unlike a bank-relative breakpoint, two files' label breakpoints must not collapse.
    const other = localLabelBp({ labelFile: "Other.nex.dis" });
    expect(getBreakpointStorageKey(other)).not.toEqual(getBreakpointStorageKey(localLabelBp()));
  });

  it("distinguishes a local label from a global one of the same name", () => {
    const local = localLabelBp({ label: "Start", bank: 5 });
    expect(getBreakpointStorageKey(local)).not.toEqual(getBreakpointStorageKey(globalLabelBp()));
  });

  it("distinguishes the same label in two banks", () => {
    expect(getBreakpointStorageKey(localLabelBp({ bank: 6 }))).not.toEqual(
      getBreakpointStorageKey(localLabelBp({ bank: 5 }))
    );
  });

  it("uses the notation §4.7 settled on", () => {
    expect(getBreakpointStorageKey(localLabelBp())).toEqual("[Game.nex.dis]:05:DrawSprite");
    expect(getBreakpointStorageKey(globalLabelBp())).toEqual("[Game.nex.dis]:Start");
  });

  it("needs no partition label map, so both key forms agree", () => {
    // --- A NEX bank is 16K and a Next partition is an 8K page: routing the bank through the label
    // --- map is what confused the two index spaces in the first place (§4.1).
    expect(getBreakpointDisplayKey(localLabelBp(), {})).toEqual(
      getBreakpointStorageKey(localLabelBp())
    );
  });

  it("carries a watchpoint's kind suffix, like every other shape", () => {
    const watch = localLabelBp({ exec: undefined, memoryWrite: true });
    expect(getBreakpointStorageKey(watch)).toEqual("[Game.nex.dis]:05:DrawSprite:W");
  });

  it("is not mistaken for a source breakpoint", () => {
    // --- Both start with a bracketed file. A line number is all digits; a label never is, because
    // --- `isValidNexLabelName` follows the assembler's identifier convention.
    expect(getBreakpointStorageKey({ resource: "main.asm", line: 12 })).toEqual("[main.asm]:12");
    expect(getBreakpointStorageKey(globalLabelBp())).toEqual("[Game.nex.dis]:Start");
  });
});

describe("effectiveBankSite", () => {
  it("prefers a stated site", () => {
    const stated = { bank: 5, bankOffset: 0x0100, exec: true };
    expect(effectiveBankSite(stated)).toEqual({ bank: 5, bankOffset: 0x0100 });
  });

  it("falls back to a resolved offset", () => {
    /*
     * A local label's `bank` is the scope its name was looked up in, and resolution can only ever
     * put it in that same bank — so the bank agrees either way and it is the *offset* that comes
     * from resolution. (This test used to assert a resolved bank of 6 against a stated 5, a state
     * nothing can produce.)
     */
    expect(effectiveBankSite(localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0200 }))).toEqual(
      { bank: 5, bankOffset: 0x0200 }
    );
  });

  it("has no site for an unresolved label breakpoint", () => {
    // --- Armed nowhere, and waiting — exactly as a source breakpoint is before its list file.
    expect(effectiveBankSite(localLabelBp())).toEqual(undefined);
    expect(isBankRelative(localLabelBp())).toEqual(false);
  });

  it("has no site for an address breakpoint, however it is annotated", () => {
    // --- A breakpoint is never both an address and a bank site.
    expect(effectiveBankSite({ address: 0x8000, resolvedBank: 5, resolvedBankOffset: 0 })).toEqual(
      undefined
    );
  });

  it("finds bank 0 at offset 0, which is every falsy value at once", () => {
    expect(effectiveBankSite({ resolvedBank: 0, resolvedBankOffset: 0 })).toEqual({
      bank: 0,
      bankOffset: 0
    });
  });
});

describe("isLabelAnchored", () => {
  it("needs both the label and the file", () => {
    expect(isLabelAnchored(localLabelBp())).toEqual(true);
    expect(isLabelAnchored({ label: "X", exec: true })).toEqual(false);
    expect(isLabelAnchored({ labelFile: SIDECAR, exec: true })).toEqual(false);
    expect(isLabelAnchored({ address: 0x8000, exec: true })).toEqual(false);
  });

  it("is true whether or not it has resolved", () => {
    expect(isLabelAnchored(localLabelBp({ resolvedBank: 5, resolvedBankOffset: 1 }))).toEqual(true);
  });
});

describe("arming", () => {
  const PARTITION = bankRelativePartition(5, 0x0100);
  const paged = (address: number) => (((address >> 13) & 0x07) === 4 ? PARTITION : undefined);

  it("fires from a resolved local label, wherever the bank is paged", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 }));

    expect(ds.shouldStopAt(0x8100, paged)).toEqual(true);
    // --- A different bank paged at the same address: not this breakpoint's bank.
    expect(ds.shouldStopAt(0x8100, () => bankRelativePartition(6, 0x0100))).toEqual(false);
  });

  it("fires from a resolved global label at its address", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(globalLabelBp({ resolvedAddress: 0x8000 }));
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(true);
  });

  it("fires nowhere while unresolved", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(localLabelBp());
    expect(ds.shouldStopAt(0x8100, paged)).toEqual(false);
    // --- But it exists, and is listed.
    expect(ds.breakpoints).toHaveLength(1);
  });

  it("keeps its label and resolution through a scoped replace", () => {
    /*
     * `addBreakpoint` rebuilds the stored definition field by field, and resolution works by
     * rewriting the whole set — so a dropped `label` or `resolvedBank` would be dropped on every
     * refresh, and the breakpoint would quietly become armed-nowhere for good.
     */
    const ds = new DebugSupport();
    const bp = localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 });
    ds.resetBreakpointsTo([bp], { kind: "project" });

    const stored = ds.breakpoints[0];
    expect(stored.label).toEqual("DrawSprite");
    expect(stored.labelFile).toEqual(SIDECAR);
    expect(stored.resolvedBank).toEqual(5);
    expect(stored.resolvedBankOffset).toEqual(0x0100);
    expect(ds.shouldStopAt(0x8100, paged)).toEqual(true);
  });

  it("stops firing at the old place when a rebuild moves the label", () => {
    const ds = new DebugSupport();
    ds.resetBreakpointsTo(
      [localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 })],
      { kind: "project" }
    );
    expect(ds.shouldStopAt(0x8100, paged)).toEqual(true);

    // --- Re-resolved after the code moved within the bank. Same breakpoint, same key.
    ds.resetBreakpointsTo(
      [localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0180 })],
      { kind: "project" }
    );

    expect(ds.shouldStopAt(0x8100, paged)).toEqual(false);
    expect(ds.shouldStopAt(0x8180, (a) => (((a >> 13) & 7) === 4 ? PARTITION : undefined))).toEqual(
      true
    );
  });

  it("can be removed by its key while resolved", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 }));
    // --- The caller holds the unresolved form; the key must still match.
    expect(ds.removeBreakpoint(localLabelBp())).toEqual(true);
    expect(ds.breakpoints).toHaveLength(0);
    expect(ds.shouldStopAt(0x8100, paged)).toEqual(false);
  });

  it("can be disabled by its key while resolved", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(localLabelBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 }));
    ds.enableBreakpoint(localLabelBp(), false);
    expect(ds.shouldStopAt(0x8100, paged)).toEqual(false);
  });
});
