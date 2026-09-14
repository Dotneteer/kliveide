import { describe, it, expect } from "vitest";
import { DebugSupport, EXEC_BP, PART_BP } from "@emu/machines/DebugSupport";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import {
  bankRelativeAddresses,
  bankRelativePartition,
  isBankRelative
} from "@common/utils/breakpoint-scope";

/**
 * A bank-relative breakpoint names an offset inside a ZX Spectrum Next 16K bank, and fires wherever
 * that bank happens to be paged. It is armed at all eight addresses its bank could appear at, and
 * the partition test at fire time picks out the real one.
 *
 * `paged` below is the test's stand-in for the machine's `getPartition` resolver: it says which 8K
 * partition is currently mapped at a given address.
 */
function paged(map: Record<number, number>): (address: number) => number | undefined {
  return (address) => map[(address >> 13) & 0x07];
}

/** Bank 5's low half is 8K page 10; its high half is page 11. */
const BANK5_LOW = 0x0a;
const BANK5_HIGH = 0x0b;

describe("bank-relative helpers", () => {
  it("resolves a bank offset to the 8K partition holding it", () => {
    // --- The only place the 16K-bank-to-8K-page conversion happens.
    expect(bankRelativePartition(5, 0x0000)).toEqual(BANK5_LOW);
    expect(bankRelativePartition(5, 0x1fff)).toEqual(BANK5_LOW);
    expect(bankRelativePartition(5, 0x2000)).toEqual(BANK5_HIGH);
    expect(bankRelativePartition(5, 0x3fff)).toEqual(BANK5_HIGH);
    expect(bankRelativePartition(0, 0x0000)).toEqual(0);
  });

  it("lists one candidate address per 8K slot, at the offset within the page", () => {
    expect(bankRelativeAddresses(0x0100)).toEqual([
      0x0100, 0x2100, 0x4100, 0x6100, 0x8100, 0xa100, 0xc100, 0xe100
    ]);
    // --- An offset in the bank's high half keeps only its in-page part.
    expect(bankRelativeAddresses(0x2100)).toEqual([
      0x0100, 0x2100, 0x4100, 0x6100, 0x8100, 0xa100, 0xc100, 0xe100
    ]);
  });

  it("recognises the shape", () => {
    expect(isBankRelative({ bank: 5, bankOffset: 0x100 })).toEqual(true);
    expect(isBankRelative({ address: 0x8000, partition: 5 })).toEqual(false);
    // --- An address wins: a breakpoint is never both.
    expect(isBankRelative({ address: 0x8000, bank: 5, bankOffset: 0x100 })).toEqual(false);
  });
});

describe("bank-relative breakpoint keys", () => {
  it("uses the `+` form, with the bank as plain hex", () => {
    // --- `+` cannot begin an address literal (`$`, a digit, or `%`), which is what separates this
    // --- from the absolute `<partition>:<address>` form. The bank is a 16K bank, not a partition
    // --- index, so it deliberately does not go through the partition label map.
    expect(getBreakpointStorageKey({ bank: 5, bankOffset: 0x0100, exec: true })).toEqual(
      "05:+$0100"
    );
    expect(getBreakpointStorageKey({ bank: 0x20, bankOffset: 0x3ffe, exec: true })).toEqual(
      "20:+$3FFE"
    );
  });

  it("carries the watchpoint suffix", () => {
    expect(getBreakpointStorageKey({ bank: 5, bankOffset: 0x100, memoryWrite: true })).toEqual(
      "05:+$0100:W"
    );
  });

  it("cannot collide with an address, partition-address or source key", () => {
    // --- Ownership is not part of a breakpoint's identity, which is only safe because these key
    // --- shapes are disjoint by construction. See `.plans/NEX_DEBUGGING_PLAN.md` §4.4.
    const keys = [
      getBreakpointStorageKey({ address: 0x0100, exec: true }),
      getBreakpointStorageKey({ address: 0x0100, partition: 5, exec: true }),
      getBreakpointStorageKey({ bank: 5, bankOffset: 0x0100, exec: true }),
      getBreakpointStorageKey({ resource: "main.asm", line: 12, exec: true })
    ];
    expect(new Set(keys).size).toEqual(keys.length);
    expect(keys).toEqual(["$0100", "5:$0100", "05:+$0100", "[main.asm]:12"]);
  });
});

describe("DebugSupport bank-relative execution breakpoints", () => {
  const bp: BreakpointInfo = { bank: 5, bankOffset: 0x0100, exec: true };

  it("is partition-scoped, never partitionless", () => {
    // --- `EXEC_BP` means "fires whatever is paged in here"; a bank breakpoint must never claim it.
    const ds = new DebugSupport();
    ds.addBreakpoint(bp);
    for (const address of bankRelativeAddresses(0x0100)) {
      const flags = ds.breakpointFlags[address];
      expect(!!(flags & PART_BP), address.toString(16)).toEqual(true);
      expect(!!(flags & EXEC_BP), address.toString(16)).toEqual(false);
    }
  });

  it("fires wherever its bank is paged, in every one of the eight slots", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(bp);

    for (let slot = 0; slot < 8; slot++) {
      const address = slot * 0x2000 + 0x0100;
      expect(ds.shouldStopAt(address, paged({ [slot]: BANK5_LOW })), `slot ${slot}`).toEqual(true);
    }
  });

  it("does not fire where a different bank is paged", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(bp);
    // --- Bank 6's low half at $8000
    expect(ds.shouldStopAt(0x8100, paged({ 4: 0x0c }))).toEqual(false);
  });

  /*
   * The reason this feature uses 8K partitions.
   *
   * Bank 5 offset $0100 lives in the bank's LOW half (8K page 10). If the bank's HIGH half (page 11)
   * is paged at $8000, then $8100 holds bank 5 offset $2100 — not $0100 — so the breakpoint must not
   * fire there.
   *
   * Under the old 16K reading both halves reported the same partition and this was impossible to
   * express: the breakpoint fired, pointing at the wrong byte. It now passes *by construction*
   * rather than by an added check, which is exactly why it still needs a test — a future change to
   * the partition granularity would silently break it.
   */
  it("does not fire where the other half of its own bank is paged", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint(bp);

    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_HIGH }))).toEqual(false);
    // --- …and the low half at the same address still does fire, so this is not vacuous.
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
  });

  it("distinguishes two breakpoints in the two halves of one bank", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true });
    ds.addBreakpoint({ bank: 5, bankOffset: 0x2100, exec: true });

    // --- Both project onto $8100, but only the half actually paged there may fire.
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_HIGH }))).toEqual(true);
    expect(ds.breakpoints.length).toEqual(2);
  });

  it("works for bank 0", () => {
    // --- Partition 0 was unreachable before Phase 0; bank 0 is a real NEX bank.
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 0, bankOffset: 0x0010, exec: true });
    expect(ds.shouldStopAt(0xc010, paged({ 6: 0 }))).toEqual(true);
    expect(ds.shouldStopAt(0xc010, paged({ 6: 1 }))).toEqual(false);
  });
});

describe("DebugSupport bank-relative removal and enabling", () => {
  it("removal leaves all eight candidate addresses clean", () => {
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { bank: 5, bankOffset: 0x0100, exec: true };
    ds.addBreakpoint(bp);

    ds.removeBreakpoint(bp);

    expect(ds.breakpoints).toEqual([]);
    for (const address of bankRelativeAddresses(0x0100)) {
      expect(ds.breakpointFlags[address], address.toString(16)).toEqual(0);
      expect(ds.breakpointData.has(address), address.toString(16)).toEqual(false);
    }
  });

  it("removal leaves a co-located partition breakpoint intact", () => {
    // --- The provenance tag exists for this: one bank breakpoint arms eight addresses, and a user's
    // --- own `bp-set` may already claim the same partition at one of them.
    const ds = new DebugSupport();
    const bankBp: BreakpointInfo = { bank: 5, bankOffset: 0x0100, exec: true };
    const userBp: BreakpointInfo = { address: 0x8100, partition: BANK5_LOW, exec: true };
    ds.addBreakpoint(bankBp);
    ds.addBreakpoint(userBp);

    ds.removeBreakpoint(bankBp);

    expect(ds.breakpoints.map((b) => getBreakpointStorageKey(b))).toEqual(["a:$8100"]);
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
    // --- …but the bank breakpoint's other seven addresses are gone
    expect(ds.shouldStopAt(0xc100, paged({ 6: BANK5_LOW }))).toEqual(false);
  });

  it("removing a partition breakpoint leaves a co-located bank breakpoint intact", () => {
    const ds = new DebugSupport();
    const bankBp: BreakpointInfo = { bank: 5, bankOffset: 0x0100, exec: true };
    const userBp: BreakpointInfo = { address: 0x8100, partition: BANK5_LOW, exec: true };
    ds.addBreakpoint(bankBp);
    ds.addBreakpoint(userBp);

    ds.removeBreakpoint(userBp);

    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
    expect(ds.shouldStopAt(0xc100, paged({ 6: BANK5_LOW }))).toEqual(true);
  });

  it("disables and re-enables across all eight addresses", () => {
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { bank: 5, bankOffset: 0x0100, exec: true };
    ds.addBreakpoint(bp);

    expect(ds.enableBreakpoint(bp, false)).toEqual(true);
    for (let slot = 0; slot < 8; slot++) {
      expect(
        ds.shouldStopAt(slot * 0x2000 + 0x0100, paged({ [slot]: BANK5_LOW })),
        `slot ${slot}`
      ).toEqual(false);
    }

    expect(ds.enableBreakpoint(bp, true)).toEqual(true);
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
  });

  it("disabling a bank breakpoint does not disable a co-located partition breakpoint", () => {
    const ds = new DebugSupport();
    const bankBp: BreakpointInfo = { bank: 5, bankOffset: 0x0100, exec: true };
    const userBp: BreakpointInfo = { address: 0x8100, partition: BANK5_LOW, exec: true };
    ds.addBreakpoint(bankBp);
    ds.addBreakpoint(userBp);

    ds.enableBreakpoint(bankBp, false);

    // --- The user's breakpoint still fires at its own address…
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
    // --- …while the bank breakpoint is silent everywhere else
    expect(ds.shouldStopAt(0xc100, paged({ 6: BANK5_LOW }))).toEqual(false);
  });
});

describe("DebugSupport bank-relative watchpoints", () => {
  it("triggers a memory write watchpoint only in its own bank half", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, memoryWrite: true });

    const writes = [0x8100];
    expect(ds.hasMemoryWrite(writes, 1, paged({ 4: BANK5_LOW }))).toEqual(true);
    expect(ds.hasMemoryWrite(writes, 1, paged({ 4: BANK5_HIGH }))).toEqual(false);
    expect(ds.hasMemoryRead(writes, 1, paged({ 4: BANK5_LOW }))).toEqual(false);
  });

  it("triggers a memory read watchpoint in its own bank", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 0x20, bankOffset: 0x2000, memoryRead: true });

    // --- Bank $20 high half is 8K page 65
    expect(ds.hasMemoryRead([0x4000], 1, paged({ 2: 0x41 }))).toEqual(true);
    expect(ds.hasMemoryRead([0x4000], 1, paged({ 2: 0x40 }))).toEqual(false);
  });
});

describe("DebugSupport one-shot breakpoints", () => {
  it("removes a spent one-shot and signs the change", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({
      bank: 5,
      bankOffset: 0x0100,
      exec: true,
      oneShot: true,
      owner: { kind: "session" }
    });

    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
    expect(ds.consumeOneShotsAt(0x8100, BANK5_LOW)).toEqual(1);

    expect(ds.breakpoints).toEqual([]);
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(false);
  });

  it("leaves a one-shot whose bank is not the one paged in", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true, oneShot: true });

    // --- It did not fire, so it is not spent.
    expect(ds.consumeOneShotsAt(0x8100, BANK5_HIGH)).toEqual(0);
    expect(ds.breakpoints.length).toEqual(1);
  });

  it("removes a plain address one-shot", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true, oneShot: true });

    expect(ds.consumeOneShotsAt(0x8000, undefined)).toEqual(1);
    expect(ds.breakpoints).toEqual([]);
  });

  it("leaves ordinary breakpoints alone", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true });

    expect(ds.consumeOneShotsAt(0x8000, undefined)).toEqual(0);
    expect(ds.consumeOneShotsAt(0x8100, BANK5_LOW)).toEqual(0);
    expect(ds.breakpoints.length).toEqual(2);
  });
});

describe("suppressing user breakpoints during a launch flow", () => {
  /*
   * Loading a NEX means booting NextZXOS and *typing* `.nexload` at its command line. A keystroke
   * carries an absolute tact window, so a user breakpoint that pauses the machine while strokes are
   * still queued expires every one that has not been pressed yet, and the command line is left
   * half-written. The flow's own session-owned stop still has to fire, which is what this flag
   * separates. See `.plans/NEX_DEBUGGING_PLAN.md` §9.5.
   */

  it("lets a session-owned breakpoint through and holds a user one back", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({ address: 0x9000, exec: true, owner: { kind: "session" } });

    ds.suppressUserBreakpoints = true;
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
    expect(ds.shouldStopAt(0x9000, () => undefined)).toEqual(true);
  });

  it("changes nothing while it is off", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(true);
  });

  it("lets a session-owned bank-relative breakpoint through wherever its bank is paged", () => {
    // --- The entry-point stop is exactly this shape: the bank is not paged in when it is armed.
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true, owner: { kind: "session" } });
    ds.suppressUserBreakpoints = true;

    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(true);
    // --- Same breakpoint, a slot where its bank is not mapped: the partition test still rejects it.
    expect(ds.shouldStopAt(0xc100, paged({ 6: 0x20 }))).toEqual(false);
  });

  it("holds back a user bank-relative breakpoint", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true });
    ds.suppressUserBreakpoints = true;
    expect(ds.shouldStopAt(0x8100, paged({ 4: BANK5_LOW }))).toEqual(false);
  });

  it("holds back a user breakpoint that shares an address with a session one", () => {
    // --- A `Set` of session addresses maintained alongside the flags would answer "yes" here and
    // --- let the user's breakpoint fire after all, because both live at the same address.
    const ds = new DebugSupport();
    const partition = bankRelativePartition(5, 0x0100);
    ds.addBreakpoint({ address: 0x8100, partition, exec: true });
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true, owner: { kind: "session" } });

    ds.suppressUserBreakpoints = true;
    // --- The session one is what stops the machine, and it does stop it.
    expect(ds.shouldStopAt(0x8100, paged({ 4: partition }))).toEqual(true);

    // --- With the session breakpoint gone, the user's own is suppressed again.
    ds.removeBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true, owner: { kind: "session" } });
    expect(ds.shouldStopAt(0x8100, paged({ 4: partition }))).toEqual(false);
  });

  it("stops honouring a session breakpoint once it is removed", () => {
    // --- The derived predicate has to follow removal, or a one-shot the loop just consumed would
    // --- keep its address privileged for the rest of the window.
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { address: 0x9000, exec: true, owner: { kind: "session" } };
    ds.addBreakpoint(bp);
    ds.suppressUserBreakpoints = true;
    expect(ds.shouldStopAt(0x9000, () => undefined)).toEqual(true);

    ds.removeBreakpoint(bp);
    expect(ds.shouldStopAt(0x9000, () => undefined)).toEqual(false);
  });

  it("does not honour a disabled session breakpoint", () => {
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { address: 0x9000, exec: true, owner: { kind: "session" } };
    ds.addBreakpoint(bp);
    ds.enableBreakpoint(bp, false);
    ds.suppressUserBreakpoints = true;
    expect(ds.shouldStopAt(0x9000, () => undefined)).toEqual(false);
  });

  it("survives a scoped reset, which re-adds every breakpoint", () => {
    // --- `resetBreakpointsTo` rebuilds the flags from scratch; a cached set would go stale here.
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x9000, exec: true, owner: { kind: "session" } });
    ds.resetBreakpointsTo([{ address: 0x8000, exec: true }], { kind: "project" });

    ds.suppressUserBreakpoints = true;
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
    // --- The session breakpoint was not in scope, so it survived the reset and still fires.
    expect(ds.shouldStopAt(0x9000, () => undefined)).toEqual(true);
  });

  it("costs nothing at an address with no breakpoint", () => {
    const ds = new DebugSupport();
    ds.suppressUserBreakpoints = true;
    expect(ds.shouldStopAt(0x1234, () => undefined)).toEqual(false);
  });
});
