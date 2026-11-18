import { describe, it, expect } from "vitest";

import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { edgesAt, FLOW_LANES, FLOW_MAX_SPAN, layoutFlow } from "@renderer/appIde/DocumentPanels/flowGutter";

/** A listing of one-byte rows from $8000, with jumps where given */
function listing(count: number, jumps: Record<number, { to: number; kind?: string; cond?: boolean }> = {}) {
  return Array.from({ length: count }, (_, i): DisassemblyItem => {
    const jump = jumps[i];
    return {
      address: 0x8000 + i,
      instruction: jump ? `jr $${(0x8000 + jump.to).toString(16)}` : "nop",
      ...(jump
        ? {
            branch: {
              kind: (jump.kind ?? "jr") as "jr",
              target: 0x8000 + jump.to,
              ...(jump.cond ? { condition: "nz" as const } : {}),
              tstatesTaken: 12,
              tstatesNotTaken: 7
            }
          }
        : {})
    } as DisassemblyItem;
  });
}

describe("layoutFlow", () => {
  it("draws a backward jump in lane 0 with a source, a target and the rows between", () => {
    const layout = layoutFlow(listing(10, { 6: { to: 2, cond: true } }));
    expect(layout.edges).toEqual([{ id: 0, from: 6, to: 2, up: true, conditional: true, lane: 0 }]);
    expect(layout.rows.get(6)).toEqual([{ edge: 0, lane: 0, kind: "source", down: false, conditional: true }]);
    expect(layout.rows.get(2)![0].kind).toBe("target");
    expect([3, 4, 5].map((r) => layout.rows.get(r)![0].kind)).toEqual(["pass", "pass", "pass"]);
    expect(layout.rows.get(7)).toBeUndefined();
  });

  it("puts the shortest jump innermost and never overlaps lanes", () => {
    const jumps: Record<number, { to: number }> = {};
    for (let i = 0; i < 12; i++) jumps[20 + i] = { to: 19 - i };
    const layout = layoutFlow(listing(60, jumps));
    const byLane = new Map<number, [number, number][]>();
    for (const e of layout.edges.filter((e) => e.lane !== undefined)) {
      const span: [number, number] = [Math.min(e.from, e.to!), Math.max(e.from, e.to!)];
      for (const other of byLane.get(e.lane!) ?? []) {
        expect(span[1] < other[0] || span[0] > other[1]).toBe(true);
      }
      byLane.set(e.lane!, [...(byLane.get(e.lane!) ?? []), span]);
    }
    expect(layout.edges.find((e) => e.from === 20)!.lane).toBe(0);
    // --- Twelve nested jumps, eight lanes: the four longest become stubs
    expect(layout.edges.filter((e) => e.lane === undefined)).toHaveLength(12 - FLOW_LANES);
  });

  it("makes a long jump two stubs and a jump out of the listing one", () => {
    const layout = layoutFlow(listing(120, { 100: { to: 100 - FLOW_MAX_SPAN - 1 }, 5: { to: 500 } }));
    const long = layout.edges.find((e) => e.from === 100)!;
    expect(long.lane).toBeUndefined();
    expect(layout.rows.get(100)![0].kind).toBe("stubOut");
    expect(layout.rows.get(100 - FLOW_MAX_SPAN - 1)![0].kind).toBe("stubIn");
    expect(layout.rows.get(50)).toBeUndefined();
    const out = layout.edges.find((e) => e.from === 5)!;
    expect(out.to).toBeUndefined();
    expect(out.up).toBe(false);
    expect(layout.rows.get(5)![0]).toMatchObject({ kind: "stubOut", down: true });
  });

  it("leaves calls and RSTs to the verdict hook", () => {
    const layout = layoutFlow(listing(10, { 1: { to: 8, kind: "call" }, 2: { to: 0, kind: "rst" }, 3: { to: 9, kind: "djnz" } }));
    expect(layout.edges.map((e) => e.from)).toEqual([3]);
    expect(layout.edges[0].conditional).toBe(true);
  });

  it("names the jumps of a row, not the ones passing through", () => {
    const layout = layoutFlow(listing(10, { 6: { to: 2 }, 4: { to: 8 } }));
    expect(edgesAt(layout, 6)).toEqual(new Set([layout.edges.find((e) => e.from === 6)!.id]));
    expect(edgesAt(layout, 5).size).toBe(0);
  });
});
