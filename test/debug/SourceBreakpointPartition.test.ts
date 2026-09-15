import { describe, it, expect } from "vitest";

import { DebugSupport } from "@emu/machines/DebugSupport";
import { bankRelativePartition } from "@common/utils/breakpoint-scope";
import {
  bankOffsetOfLine,
  resolvedPartitionFor
} from "@common/utils/source-breakpoint-partition";

/*
 * A source breakpoint that knows which `.bank` its line is in.
 *
 * The assembler has always known — `.bank N, offset` records both on the segment — and
 * `refreshSourceCodeBreakpoints` threw it away, taking only the address. So a breakpoint on a line
 * in one `.bank` section fired inside *another* one, because both are assembled at the same Z80
 * addresses. On the ZX Spectrum Next that is not an edge case: sharing addresses is the point of
 * `.bank`.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.4.
 */

/** `.bank 5` with no offset: assembled at `$C000`. */
const bank5 = { bank: 5, bankOffset: 0, startAddress: 0xc000 };

describe("resolvedPartitionFor", () => {
  it("converts a 16K bank to an 8K page on the ZX Spectrum Next", () => {
    // --- Q9: a Next partition is an 8K page, so which half of the bank the line is in matters.
    expect(resolvedPartitionFor(bank5, 0xc000, "zxnext")).toEqual(bankRelativePartition(5, 0x0000));
    expect(resolvedPartitionFor(bank5, 0xdfff, "zxnext")).toEqual(bankRelativePartition(5, 0x1fff));
    expect(resolvedPartitionFor(bank5, 0xe000, "zxnext")).toEqual(bankRelativePartition(5, 0x2000));
    expect(resolvedPartitionFor(bank5, 0xffff, "zxnext")).toEqual(bankRelativePartition(5, 0x3fff));
  });

  it("passes the bank straight through on machines whose partitions are 16K", () => {
    // --- The 128K and +3: a partition *is* the bank, so converting would name a bank that is
    // --- never paged anywhere and the breakpoint would silently never fire.
    expect(resolvedPartitionFor(bank5, 0xc000, "sp128")).toEqual(5);
    expect(resolvedPartitionFor(bank5, 0xffff, "sp128")).toEqual(5);
    expect(resolvedPartitionFor(bank5, 0xc000, "spp3e")).toEqual(5);
  });

  it("leaves unbanked code partitionless", () => {
    // --- Such a breakpoint fires whatever is paged in, which is what every non-banked project
    // --- depends on.
    expect(resolvedPartitionFor({ startAddress: 0x8000 }, 0x8010, "zxnext")).toEqual(undefined);
    expect(resolvedPartitionFor(undefined, 0x8010, "zxnext")).toEqual(undefined);
  });

  it("handles bank 0, whose partition is page 0", () => {
    const bank0 = { bank: 0, bankOffset: 0, startAddress: 0xc000 };
    expect(resolvedPartitionFor(bank0, 0xc000, "zxnext")).toEqual(0);
  });

  it("accounts for a segment that starts partway into its bank", () => {
    // --- `.bank 5, $2000` assembles at `$E000`, so its first line is at bank offset $2000 — the
    // --- bank's *high* half, and therefore the other 8K page.
    const offsetSegment = { bank: 5, bankOffset: 0x2000, startAddress: 0xe000 };
    expect(resolvedPartitionFor(offsetSegment, 0xe000, "zxnext")).toEqual(
      bankRelativePartition(5, 0x2000)
    );
  });
});

describe("bankOffsetOfLine", () => {
  it("measures from the segment's own start", () => {
    expect(bankOffsetOfLine(bank5, 0xc123)).toEqual(0x0123);
    expect(bankOffsetOfLine({ bank: 5, bankOffset: 0x100, startAddress: 0xc100 }, 0xc123)).toEqual(
      0x0123
    );
  });

  it("clamps into the bank", () => {
    // --- A macro or a `.xorg` can report a line outside its segment; naming an offset in a
    // --- neighbouring bank would arm the breakpoint in the wrong one.
    expect(bankOffsetOfLine(bank5, 0x4000)).toEqual(0);
    expect(bankOffsetOfLine(bank5, 0x1_0000)).toEqual(0x3fff);
  });
});

describe("resolving a source breakpoint into a partition", () => {
  const PARTITION = bankRelativePartition(5, 0x0000);
  /** Bank 5's low page is paged at `$C000`. */
  const paged = (address: number) =>
    ((address >> 13) & 0x07) === 6 ? PARTITION : undefined;

  it("fires only while that partition is paged in", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0xc000, PARTITION);

    expect(ds.shouldStopAt(0xc000, paged)).toEqual(true);
    // --- The same address with a different bank paged there: a different `.bank` section's code,
    // --- which is exactly the misfire this fixes.
    expect(ds.shouldStopAt(0xc000, () => bankRelativePartition(6, 0))).toEqual(false);
  });

  it("stays partitionless when no partition is given", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0xc000);

    // --- Unbanked: fires whatever is paged in.
    expect(ds.shouldStopAt(0xc000, () => 99)).toEqual(true);
  });

  it("reports the partition back", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0xc000, PARTITION);
    expect(ds.breakpoints[0].resolvedPartition).toEqual(PARTITION);
  });

  it("respects the breakpoint's disabled state", () => {
    const ds = new DebugSupport();
    const bp = { resource: "a.asm", line: 3, exec: true, disabled: true };
    ds.addBreakpoint(bp);
    ds.resolveBreakpoint("a.asm", 3, 0xc000, PARTITION);
    expect(ds.shouldStopAt(0xc000, paged)).toEqual(false);
  });

  it("drops the old partition when a rebuild moves the line to another bank", () => {
    /*
     * The stale-entry counterpart of the stale-flags bug: the partition entry lives in
     * `breakpointData`, not in the flags, so clearing the flags alone would leave the old bank
     * still firing at that address.
     */
    const ds = new DebugSupport();
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0xc000, PARTITION);

    const otherPartition = bankRelativePartition(6, 0x0000);
    ds.resetBreakpointResolution();
    ds.resolveBreakpoint("a.asm", 3, 0xc000, otherPartition);

    expect(ds.shouldStopAt(0xc000, () => otherPartition)).toEqual(true);
    expect(ds.shouldStopAt(0xc000, paged)).toEqual(false);
  });

  it("leaves a bank-relative breakpoint's entry alone when resolution is reset", () => {
    // --- A bank breakpoint's entry is tagged and owns its own lifetime; the two can share both an
    // --- address and a partition.
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0000, exec: true });
    ds.addBreakpoint({ resource: "a.asm", line: 3, exec: true });
    ds.resolveBreakpoint("a.asm", 3, 0xc000, PARTITION);

    ds.resetBreakpointResolution();

    expect(ds.shouldStopAt(0xc000, paged)).toEqual(true);
  });
});
