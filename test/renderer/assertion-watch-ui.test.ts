import { describe, expect, it, vi } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { WatchInfo } from "@common/state/AppState";
import {
  describeWatchpoints,
  overlappingWatchpoints,
  symbolAtAddress,
  watchByteCount,
  watchCoversAddress,
  watchSpecForRange,
  watchpointsForWatch,
  watchpointsOfWatch
} from "@renderer/appIde/utils/watch-watchpoints";
import { logpointSections } from "@renderer/appIde/utils/breakpoint-grouping";
import { disassemblyRowMenuItems } from "@renderer/appIde/DocumentPanels/disassemblyRowMenu";
import { breakpointGlyphIcon, breakpointGlyphOf } from "@renderer/appIde/utils/breakpoint-filter-text";
import {
  annotationStateKeyOf,
  isCommentDisabled,
  resetCommentStateForTests,
  setCommentBreakpointsEnabled
} from "@renderer/appIde/utils/annotation-state";
import { sourceCommentsReducer } from "@common/state/watch-reducer";
import { setSourceCommentsAction } from "@common/state/actions";

/*
 * The UI logic of `.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` Phases 2, 4 and 5: glyphs, the
 * disassembly row menu, the panel's comment sections, the session disabled map, the switches, and
 * the Watch <-> watchpoint link.
 */

const watch = (over: Partial<WatchInfo>): WatchInfo => ({ symbol: "score", type: "b", ...over });

describe("glyphs (O6)", () => {
  it("draws a one-shot with the '1', a conditional one with the combined mark, inactive first", () => {
    expect(breakpointGlyphOf({ address: 1, oneShot: true })).toBe("once");
    expect(breakpointGlyphOf({ address: 1, oneShot: true, hitCount: 3 })).toBe("onceConditional");
    expect(breakpointGlyphOf({ address: 1, oneShot: true, conditionInactive: "x" })).toBe("inactive");
    expect(breakpointGlyphIcon("once")).toBe("bp-once");
    expect(breakpointGlyphIcon("onceConditional")).toBe("bp-once-conditional");
  });

  it("draws comment marks for ASSERTION and WPMEM", () => {
    const owner = { kind: "annotation" as const };
    expect(breakpointGlyphOf({ owner, annotationKind: "ASSERTION", resource: "a", line: 1 })).toBe("assertion");
    expect(breakpointGlyphOf({ owner, annotationKind: "WPMEM", resource: "a", line: 1 })).toBe("watchpoint");
  });
});

describe("the disassembly row menu (§4.2)", () => {
  it("offers Add, Add One-Shot, Run to Here and a disabled Edit on an empty row", () => {
    const items = disassemblyRowMenuItems({ address: 0x8000, spec: "$8000" }, {});
    expect(items.map((i) => [i.text, i.command, !!i.disabled])).toEqual([
      ["Add Breakpoint", "bp-set $8000", false],
      ["Add One-Shot Breakpoint", "bp-set $8000 -once", false],
      ["Run to Here", "run-to $8000", false],
      ["Edit Breakpoint...", undefined, true],
      ["Show as Graphics", "gfx $8000", false]
    ]);
  });

  it("offers Remove, the one-shot toggle and Edit on a row with a breakpoint", () => {
    const bp: BreakpointInfo = { address: 0x8000, exec: true, hitCount: 2 };
    const items = disassemblyRowMenuItems({ address: 0x8000, spec: "$8000", breakpoint: bp }, {});
    expect(items[0]).toMatchObject({ text: "Remove Breakpoint", command: "bp-del $8000 -hit 2" });
    expect(items[1]).toMatchObject({ text: "Remove After It Stops", command: "bp-set $8000 -once -hit 2" });
    const once = disassemblyRowMenuItems(
      { address: 0x8000, spec: "$8000", breakpoint: { ...bp, oneShot: true } },
      {}
    );
    expect(once[1]).toMatchObject({ text: "Keep After It Stops", command: "bp-set $8000 -hit 2" });
  });
});

describe("the Breakpoints panel's comment sections (§4.8)", () => {
  const owner = { kind: "annotation" as const };
  const assertion: BreakpointInfo = { owner, annotationKind: "ASSERTION", resource: "m", line: 4, address: 0x8000, exec: true };
  const wp: BreakpointInfo = { owner, annotationKind: "WPMEM", resource: "m", line: 9, address: 0x8100, memoryWrite: true };

  it("lists ASSERTION and WPMEM comments in their own sections, with their switch", () => {
    const items = logpointSections([assertion, wp], undefined, {});
    expect(items.map((i) => (i.kind === "sectionHeader" ? `${i.section}:${i.on}` : i.kind))).toEqual([
      "assertions:true",
      "row",
      "wpmem:true",
      "row"
    ]);
  });

  it("keeps a switched-off section's header as the way back on", () => {
    const items = logpointSections([], undefined, { assertion: false });
    expect(items).toEqual([{ kind: "sectionHeader", section: "assertions", count: 0, on: false }]);
  });
});

describe("the session's disabled comments (S3)", () => {
  it("remembers a disabled comment by resource, line and kind, and forgets it on enable", async () => {
    resetCommentStateForTests();
    const bp: BreakpointInfo = { owner: { kind: "annotation" }, annotationKind: "WPMEM", resource: "m.asm", line: 9, address: 1, memoryRead: true };
    const emuApi = { enableBreakpoint: vi.fn().mockResolvedValue(true) };
    const key = annotationStateKeyOf(bp)!;
    expect(key).toBe("m.asm:9:WPMEM");
    await setCommentBreakpointsEnabled(emuApi, [bp], false);
    expect(isCommentDisabled(key)).toBe(true);
    expect(emuApi.enableBreakpoint).toHaveBeenCalledWith(bp, false);
    await setCommentBreakpointsEnabled(emuApi, [bp], true);
    expect(isCommentDisabled(key)).toBe(false);
    expect(annotationStateKeyOf({ address: 1 })).toBeUndefined();
    // --- A LOGPOINT comment's logpoint carries no annotationKind, and is keyed as LOGPOINT (Q6)
    expect(
      annotationStateKeyOf({ owner: { kind: "annotation" }, resource: "m.asm", line: 3, address: 1, logMessage: "x" })
    ).toBe("m.asm:3:LOGPOINT");
  });
});

describe("the comment switches (S6)", () => {
  it("stores only a switch that is off", () => {
    expect(sourceCommentsReducer({}, setSourceCommentsAction({ assertion: true, wpmem: true }))).toEqual({});
    expect(sourceCommentsReducer({}, setSourceCommentsAction({ assertion: false }))).toEqual({ assertion: false });
    expect(sourceCommentsReducer({ wpmem: false }, setSourceCommentsAction(undefined))).toEqual({});
  });
});

describe("the Watch <-> watchpoint link (§3.3)", () => {
  it("sizes a watchpoint by the watch's type (W2), and has none for a direct watch", () => {
    expect(watchByteCount(watch({ type: "b" }))).toBe(1);
    expect(watchByteCount(watch({ type: "f" }))).toBe(1);
    expect(watchByteCount(watch({ type: "w" }))).toBe(2);
    expect(watchByteCount(watch({ type: "-w" }))).toBe(2);
    expect(watchByteCount(watch({ type: "l" }))).toBe(4);
    expect(watchByteCount(watch({ type: "-l" }))).toBe(4);
    expect(watchByteCount(watch({ type: "a", length: 7 }))).toBe(7);
    expect(watchByteCount(watch({ type: "s", length: 3 }))).toBe(3);
    expect(watchByteCount(watch({ type: "w", direct: true }))).toBeUndefined();
  });

  it("creates symbol-anchored watchpoints, one per access kind (W2, W3)", () => {
    expect(watchpointsForWatch(watch({ type: "w" }), "w")).toEqual([
      { watchSymbol: "score", length: 2, memoryWrite: true }
    ]);
    expect(watchpointsForWatch(watch({ type: "b" }), "rw")).toEqual([
      { watchSymbol: "score", memoryRead: true },
      { watchSymbol: "score", memoryWrite: true }
    ]);
    expect(watchpointsForWatch(watch({ direct: true }), "w")).toEqual([]);
  });

  it("finds every enabled memory breakpoint over a watch's bytes, whoever made it (W4)", () => {
    const bps: BreakpointInfo[] = [
      { address: 0x8001, memoryWrite: true },
      { address: 0x7ff0, memoryRead: true, length: 0x10 },
      { address: 0x8000, memoryWrite: true, disabled: true },
      { address: 0x8000, exec: true },
      { watchSymbol: "score", resolvedAddress: 0x8003, memoryWrite: true },
      { address: 0x8004, memoryWrite: true }
    ];
    const over = overlappingWatchpoints(0x8000, 4, bps);
    expect(over.map((bp) => bp.address ?? bp.resolvedAddress)).toEqual([0x8001, 0x8003]);
    expect(describeWatchpoints(over)[1]).toMatch(/from the watch on score/);
    expect(watchpointsOfWatch(watch({ symbol: "SCORE" }), bps)).toHaveLength(1);
  });

  it("adds a watch only for a symbol starting at the address that no watch shows yet (W5, Q4)", () => {
    const symbols = { score: 0x8000, lives: 0x8002 };
    expect(symbolAtAddress(0x8002, symbols)).toBe("lives");
    expect(symbolAtAddress(0x8001, symbols)).toBeUndefined();
    expect(watchCoversAddress(0x8001, [watch({ type: "w" })], symbols)).toBe(true);
    expect(watchCoversAddress(0x8002, [watch({ type: "w" })], symbols)).toBe(false);
    expect(watchSpecForRange("lives", 1)).toBe("lives:b");
    expect(watchSpecForRange("lives", 2)).toBe("lives:w");
    expect(watchSpecForRange("lives", 4)).toBe("lives:l");
    expect(watchSpecForRange("lives", 5)).toBe("lives:a:5");
  });
});
