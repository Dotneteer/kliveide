import { describe, it, expect } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  bankBreakpointMark,
  describeBankBreakpoints,
  formatBankBreakpointBadge,
  groupBankBreakpointsByOffset,
  selectBankRowBreakpoint,
  summarizeBankBreakpoints,
  type BankBreakpointSummary
} from "@renderer/appIde/DocumentPanels/Next/nexBankGutter";

/*
 * What a popped-out NEX bank's gutter shows, and what the viewer's bank heading counts.
 *
 * Both were decided inside components before this module existed, and the gutter's version had a
 * real defect: a `Map` keyed by offset alone kept whichever breakpoint the emulator's list happened
 * to end with, so the glyph — and the `bp-del` command built from it — depended on ordering.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §10.1 and §10.2.
 */

function bp(over: Partial<BreakpointInfo> = {}): BreakpointInfo {
  return { bank: 5, bankOffset: 0x0100, exec: true, ...over };
}

describe("groupBankBreakpointsByOffset", () => {
  it("keeps every breakpoint at an offset, not just the last", () => {
    const exec = bp();
    const write = bp({ exec: undefined, memoryWrite: true });
    const grouped = groupBankBreakpointsByOffset([exec, write], 5);
    expect(grouped.get(0x0100)).toEqual([exec, write]);
  });

  it("ignores another bank's breakpoints", () => {
    expect(groupBankBreakpointsByOffset([bp({ bank: 6 })], 5).size).toEqual(0);
  });

  it("ignores an address breakpoint that merely falls inside the bank's window", () => {
    // --- Not a breakpoint *on the bank*: page the bank elsewhere and it stops being related to any
    // --- row here at all.
    const addressBp: BreakpointInfo = { address: 0x8100, exec: true };
    expect(groupBankBreakpointsByOffset([addressBp], 5).size).toEqual(0);
  });

  it("handles bank 0 at offset 0, which is every falsy value at once", () => {
    const grouped = groupBankBreakpointsByOffset([bp({ bank: 0, bankOffset: 0 })], 0);
    expect(grouped.get(0)).toHaveLength(1);
  });
});

describe("selectBankRowBreakpoint", () => {
  it("prefers execution, whichever order the list arrives in", () => {
    // --- The gutter's own click creates execution breakpoints, so that is the kind the column reads
    // --- as being about. Both orders must agree, which is the whole point.
    const exec = bp();
    const write = bp({ exec: undefined, memoryWrite: true });
    expect(selectBankRowBreakpoint([exec, write])).toBe(exec);
    expect(selectBankRowBreakpoint([write, exec])).toBe(exec);
  });

  it("shows a watchpoint when that is all there is", () => {
    const read = bp({ exec: undefined, memoryRead: true });
    expect(selectBankRowBreakpoint([read])).toBe(read);
  });

  it("prefers an enabled breakpoint over a disabled one of the same kind", () => {
    // --- Otherwise a row could look disarmed while something there is live.
    const off = bp({ disabled: true });
    const on = bp();
    expect(selectBankRowBreakpoint([off, on])).toBe(on);
    expect(selectBankRowBreakpoint([on, off])).toBe(on);
  });

  it("still prefers a disabled execution breakpoint over an enabled watchpoint", () => {
    // --- Kind decides first: the column is about execution, and a disabled execution breakpoint is
    // --- exactly what the user would click the gutter to re-enable.
    const execOff = bp({ disabled: true });
    const writeOn = bp({ exec: undefined, memoryWrite: true });
    expect(selectBankRowBreakpoint([writeOn, execOff])).toBe(execOff);
  });

  it("copes with nothing", () => {
    expect(selectBankRowBreakpoint([])).toEqual(undefined);
    expect(selectBankRowBreakpoint(undefined as any)).toEqual(undefined);
  });
});

describe("summarizeBankBreakpoints", () => {
  it("counts each bank's breakpoints by kind", () => {
    const summaries = summarizeBankBreakpoints([
      bp({ bank: 5, bankOffset: 0x0100 }),
      bp({ bank: 5, bankOffset: 0x0200, exec: undefined, memoryRead: true }),
      bp({ bank: 5, bankOffset: 0x0300, exec: undefined, memoryWrite: true }),
      bp({ bank: 6, bankOffset: 0x0000 })
    ]);

    expect(summaries.get(5)).toEqual({
      total: 3,
      exec: 1,
      memRead: 1,
      memWrite: 1,
      disabled: 0,
      disabledByKind: { exec: 0, memRead: 0, memWrite: 0 }
    });
    expect(summaries.get(6)!.total).toEqual(1);
  });

  it("counts a disabled breakpoint in the total as well as separately", () => {
    // --- It is still armed in the sense that matters here: it is in the bank, and one click brings
    // --- it back. A badge that dropped it would make the bank look empty.
    const summary = summarizeBankBreakpoints([bp({ disabled: true })]).get(5);
    expect(summary).toMatchObject({ total: 1, exec: 1, disabled: 1 });
  });

  it("names no bank for breakpoints that are not bank-relative", () => {
    expect(summarizeBankBreakpoints([{ address: 0x8000, exec: true }]).size).toEqual(0);
    expect(summarizeBankBreakpoints([{ resource: "a.asm", line: 3, exec: true }]).size).toEqual(0);
  });

  it("skips an I/O breakpoint that claims a bank", () => {
    // --- Malformed rather than uninteresting: an I/O breakpoint watches a port. Counting it would
    // --- inflate a badge whose tooltip could not explain the extra one.
    const summaries = summarizeBankBreakpoints([bp({ exec: undefined, ioRead: true })]);
    expect(summaries.size).toEqual(0);
  });

  it("counts two breakpoints at one offset as two", () => {
    const summary = summarizeBankBreakpoints([
      bp(),
      bp({ exec: undefined, memoryWrite: true })
    ]).get(5);
    // --- The gutter shows one glyph for them; the badge is a tally, not a row count.
    expect(summary).toMatchObject({ total: 2, exec: 1, memWrite: 1 });
  });
});

/** A summary with only the given counts set; kinds default to nothing disabled. */
function summaryOf(over: Partial<BankBreakpointSummary>): BankBreakpointSummary {
  return {
    total: 1,
    exec: 1,
    memRead: 0,
    memWrite: 0,
    disabled: 0,
    disabledByKind: { exec: 0, memRead: 0, memWrite: 0 },
    ...over
  };
}

describe("formatBankBreakpointBadge", () => {
  it("is absent for a bank with nothing armed", () => {
    // --- An absent badge, not a zero: a column of `0`s down the viewer is noise claiming to be
    // --- information.
    expect(formatBankBreakpointBadge(undefined)).toEqual(undefined);
    expect(formatBankBreakpointBadge(summaryOf({ total: 0, exec: 0 }))).toEqual(undefined);
  });

  it("shows the count, and the breakdown in the tooltip", () => {
    const badge = formatBankBreakpointBadge(
      summaryOf({
        total: 3,
        exec: 1,
        memRead: 1,
        memWrite: 1,
        disabled: 0
      })
    );
    expect(badge!.text).toEqual("3");
    expect(badge!.title).toEqual(
      "3 breakpoints in this bank — 1 execution, 1 memory read, 1 memory write"
    );
  });

  it("says breakpoint, singular, for one", () => {
    const badge = formatBankBreakpointBadge(
      summaryOf({
        total: 1,
        exec: 1,
        memRead: 0,
        memWrite: 0,
        disabled: 0
      })
    );
    expect(badge!.title).toEqual("1 breakpoint in this bank — 1 execution");
  });

  it("mentions disabled ones", () => {
    const badge = formatBankBreakpointBadge(
      summaryOf({
        total: 2,
        exec: 2,
        memRead: 0,
        memWrite: 0,
        disabled: 1
      })
    );
    expect(badge!.title).toContain("1 disabled");
  });

  it("lists only the kinds that are present", () => {
    const badge = formatBankBreakpointBadge(
      summaryOf({
        total: 2,
        exec: 0,
        memRead: 0,
        memWrite: 2,
        disabled: 0
      })
    );
    expect(badge!.title).toEqual("2 breakpoints in this bank — 2 memory write");
  });
});

describe("bankBreakpointMark", () => {
  it("is absent for a bank with nothing set", () => {
    expect(bankBreakpointMark(undefined)).toEqual(undefined);
    expect(bankBreakpointMark(summaryOf({ total: 0, exec: 0 }))).toEqual(undefined);
  });

  it("counts each kind that is present, in exec/read/write order", () => {
    const mark = bankBreakpointMark(summaryOf({ total: 3, exec: 2, memWrite: 1 }));
    expect(mark).toMatchObject({
      off: false,
      counts: [
        { kind: "exec", count: 2 },
        { kind: "memWrite", count: 1 }
      ]
    });
    expect(mark!.title).toEqual("3 breakpoints in this bank — 2 execution, 1 memory write");
  });

  it("leaves disabled breakpoints out of the chip while some are enabled", () => {
    const mark = bankBreakpointMark(
      summaryOf({
        total: 3,
        exec: 2,
        memRead: 1,
        disabled: 2,
        disabledByKind: { exec: 1, memRead: 1, memWrite: 0 }
      })
    );
    expect(mark).toMatchObject({ off: false, counts: [{ kind: "exec", count: 1 }] });
  });

  it("greys the chip out, still counting, when every breakpoint is disabled", () => {
    const mark = bankBreakpointMark(
      summaryOf({
        total: 2,
        exec: 2,
        disabled: 2,
        disabledByKind: { exec: 2, memRead: 0, memWrite: 0 }
      })
    );
    expect(mark).toMatchObject({ off: true, counts: [{ kind: "exec", count: 2 }] });
  });

  it("agrees with the summary it was built from", () => {
    const counted = summarizeBankBreakpoints([
      bp(),
      bp({ bankOffset: 0x0200, disabled: true }),
      bp({ bankOffset: 0x0300, exec: undefined, memoryRead: true, disabled: true })
    ]).get(5);
    expect(bankBreakpointMark(counted)!.counts).toEqual([{ kind: "exec", count: 1 }]);
    expect(describeBankBreakpoints(counted)).toEqual([
      { kind: "exec", text: "2 execution (1 disabled)" },
      { kind: "memRead", text: "1 memory read (disabled)" }
    ]);
  });
});

describe("describeBankBreakpoints", () => {
  it("lists every kind present in words", () => {
    expect(describeBankBreakpoints(summaryOf({ total: 2, exec: 1, memWrite: 1 }))).toEqual([
      { kind: "exec", text: "1 execution" },
      { kind: "memWrite", text: "1 memory write" }
    ]);
  });

  it("is empty without a summary", () => {
    expect(describeBankBreakpoints(undefined)).toEqual([]);
  });
});
