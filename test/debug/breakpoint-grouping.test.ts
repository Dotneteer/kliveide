import { describe, expect, it } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import {
  BREAKPOINT_GROUP_ORDER,
  groupBreakpoints,
  groupOf,
  shapeRank,
  type BreakpointListItem
} from "@renderer/appIde/utils/breakpoint-grouping";

/*
 * How the Breakpoints panel lays its rows out. Tested without a DOM, because the part worth testing
 * is the ordering rule - a mounted virtualized list would tell us almost nothing about it and cost
 * a great deal to ask.
 *
 * See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.9a.
 */

const LABELS: Record<number, string> = { [-1]: "R0", 0: "B0", 1: "B1" };

const group = (bps: BreakpointInfo[], grouped = true) =>
  groupBreakpoints(bps, LABELS, grouped);

/** The item list as a readable outline: headers as `# Title (n)`, rows as their key. */
const outline = (items: BreakpointListItem[], labels = LABELS): string[] =>
  items.map((item) =>
    item.kind === "header"
      ? `# ${item.group} (${item.count})`
      : keyOf(item.bp, labels)
  );

const keyOf = (bp: BreakpointInfo, _labels: Record<number, string>): string => {
  if (bp.nextReg !== undefined) {
    return `NR:$${bp.nextReg.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  if (bp.address !== undefined) {
    return `$${bp.address.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  // --- Before the bank test: a label-anchored breakpoint carries a bank too, and checking the bank
  // --- first printed the two shapes identically - which is exactly what the shape-order test is
  // --- trying to tell apart.
  if (bp.label) return `label ${bp.label}`;
  if (bp.bank !== undefined) return `bank ${bp.bank}`;
  if (bp.resource) return `[${bp.resource}]:${bp.line}`;
  return "?";
};

describe("groupOf", () => {
  it.each([
    ["an execution breakpoint", { address: 0x8000, exec: true }, "exec"],
    ["a memory read", { address: 0x8000, memoryRead: true }, "memRead"],
    ["a memory write", { address: 0x8000, memoryWrite: true }, "memWrite"],
    ["an I/O read", { address: 0x7ffd, ioRead: true }, "ioRead"],
    ["an I/O write", { address: 0x7ffd, ioWrite: true }, "ioWrite"],
    ["a NextReg write", { nextReg: 0x07 }, "nextRegWrite"],
    ["a source breakpoint", { resource: "a.asm", line: 3 }, "exec"]
  ])("puts %s in the right group", (_what, bp, expected) => {
    expect(groupOf(bp as BreakpointInfo)).toBe(expected);
  });

  it("lets the register decide before any kind flag", () => {
    // --- The same precedence `buildBreakpointKey` and `breakpointToForm` use: the register is the
    // --- binding, so a stray flag beside it cannot move the breakpoint to another group.
    expect(groupOf({ nextReg: 0x07, exec: true } as BreakpointInfo)).toBe("nextRegWrite");
  });
});

describe("shapeRank", () => {
  it("orders address, bank-relative, label-anchored, source", () => {
    expect(shapeRank({ address: 0x8000 })).toBeLessThan(shapeRank({ bank: 5, bankOffset: 0x100 }));
    expect(shapeRank({ bank: 5, bankOffset: 0x100 })).toBeLessThan(
      shapeRank({ label: "Draw", labelFile: "/g.nex.dis" })
    );
    expect(shapeRank({ label: "Draw", labelFile: "/g.nex.dis" })).toBeLessThan(
      shapeRank({ resource: "a.asm", line: 3 })
    );
  });
});

describe("groupBreakpoints - headers", () => {
  it("emits nothing for an empty set", () => {
    expect(group([])).toEqual([]);
  });

  it("emits a header per non-empty group, in the dialog's order", () => {
    const items = group([
      { nextReg: 0x07 },
      { address: 0x7ffd, ioWrite: true },
      { address: 0x8000, exec: true }
    ]);

    expect(outline(items)).toEqual([
      "# exec (1)",
      "$8000",
      "# ioWrite (1)",
      "$7FFD",
      "# nextRegWrite (1)",
      "NR:$07"
    ]);
  });

  it("emits no header at all for a group with nothing in it", () => {
    // --- A machine with three execution breakpoints should look as it always has, plus one header.
    const items = group([
      { address: 0x8000, exec: true },
      { address: 0x9000, exec: true }
    ]);

    expect(items.filter((i) => i.kind === "header")).toHaveLength(1);
  });

  it("counts the rows under each header", () => {
    const items = group([
      { address: 0x8000, exec: true },
      { address: 0x9000, exec: true },
      { address: 0xa000, memoryWrite: true }
    ]);

    const headers = items.filter((i) => i.kind === "header") as Extract<
      BreakpointListItem,
      { kind: "header" }
    >[];
    expect(headers.map((h) => [h.group, h.count])).toEqual([
      ["exec", 2],
      ["memWrite", 1]
    ]);
  });

  it("covers every group in the order constant, with no duplicates", () => {
    expect(new Set(BREAKPOINT_GROUP_ORDER).size).toBe(BREAKPOINT_GROUP_ORDER.length);
    const oneEach: BreakpointInfo[] = [
      { address: 0x8000, exec: true },
      { address: 0x8000, memoryRead: true },
      { address: 0x8000, memoryWrite: true },
      { address: 0x7ffd, ioRead: true },
      { address: 0x7ffd, ioWrite: true },
      { nextReg: 0x07 }
    ];
    expect(group(oneEach).filter((i) => i.kind === "header")).toHaveLength(
      BREAKPOINT_GROUP_ORDER.length
    );
  });
});

describe("groupBreakpoints - order", () => {
  it("sorts two addresses numerically, which a string compare on fixed-width hex also does", () => {
    const items = group([
      { address: 0x9000, exec: true },
      { address: 0x0a00, exec: true },
      { address: 0x1000, exec: true }
    ]);
    expect(outline(items)).toEqual(["# exec (3)", "$0A00", "$1000", "$9000"]);
  });

  it("orders the four shapes by rank within one group", () => {
    // --- Source breakpoints cluster at the foot rather than interleaving among the addresses.
    const items = group([
      { resource: "a.asm", line: 3 },
      { label: "Draw", labelFile: "/g.nex.dis", bank: 5 },
      { bank: 5, bankOffset: 0x100 },
      { address: 0x8000, exec: true }
    ]);
    expect(outline(items).slice(1)).toEqual([
      "$8000",
      "bank 5",
      "label Draw",
      "[a.asm]:3"
    ]);
  });

  it("does not drop a breakpoint that has no key", () => {
    // --- `getBreakpointDisplayKey` throws on one. Dropping the row would leave a breakpoint the
    // --- user can neither see nor delete, so it keeps its place and sorts last.
    const items = group([{ exec: true } as BreakpointInfo, { address: 0x8000, exec: true }]);
    expect(items.filter((i) => i.kind === "row")).toHaveLength(2);
  });

  it("is stable against the order the emulator listed them in", () => {
    // --- The bug grouping also fixes: rows came out in `breakpointDefs` insertion order, so the
    // --- list reshuffled every time a breakpoint was added or removed.
    const bps: BreakpointInfo[] = [
      { address: 0x9000, exec: true },
      { nextReg: 0x07 },
      { address: 0x8000, memoryWrite: true }
    ];
    const forwards = outline(group(bps));
    const backwards = outline(group([...bps].reverse()));
    expect(backwards).toEqual(forwards);
  });
});

describe("groupBreakpoints - the toggle", () => {
  it("drops every header when grouping is off", () => {
    const bps: BreakpointInfo[] = [
      { address: 0x8000, exec: true },
      { address: 0x9000, memoryWrite: true },
      { nextReg: 0x07 }
    ];
    expect(group(bps, false).every((i) => i.kind === "row")).toBe(true);
  });

  it("keeps the same rows in the same order, so the toggle only removes headers", () => {
    /*
     * The toggle hides headers; it does not reshuffle. Sorting differently in the two modes would
     * move every row as well as remove six of them - a lot of motion for a control whose purpose
     * is to reclaim those six rows.
     */
    const bps: BreakpointInfo[] = [
      { nextReg: 0x07 },
      { address: 0x9000, memoryWrite: true },
      { address: 0x8000, exec: true },
      { resource: "a.asm", line: 3 }
    ];
    const groupedRows = group(bps, true).filter((i) => i.kind === "row");
    const flatRows = group(bps, false);
    expect(outline(flatRows)).toEqual(outline(groupedRows));
  });

  it("returns an empty list for no breakpoints either way", () => {
    expect(group([], false)).toEqual([]);
  });
});
