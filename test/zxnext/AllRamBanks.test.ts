import { describe, it, expect } from "vitest";

import { allRamBanksFor, bank16kForPartition } from "@emu/machines/zxNext/MemoryDevice";

/*
 * All-RAM mode: the ZX Spectrum +3's special paging configurations, which the Next inherits.
 *
 * This was a method on the interpreted `MemoryDevice` only, so the WASM Next — the machine people
 * actually run — reported `undefined` and the Memory Mapping panel's "All RAM" row read `Off`
 * whatever the program had done. It is a pure function of the reported `$1FFD` value now, so both
 * machines answer from the same table. See `.plans/NEX_DEBUGGING_PLAN.md` §11.5.
 *
 * The encoding under test is the one `MemoryDevice.port1ffdValue` *reports*: all-RAM mode in bit 0,
 * the configuration in bits 1-2. NextReg `$8E` lays those out differently and
 * `getWasmV2Port1ffdValue` converts; that conversion is the WASM machine's own business.
 */

describe("allRamBanksFor", () => {
  it("says nothing when all-RAM mode is off", () => {
    expect(allRamBanksFor(0x00)).toEqual(undefined);
    // --- Off with a configuration still selected: the configuration bits mean nothing on their own.
    expect(allRamBanksFor(0x06)).toEqual(undefined);
  });

  it("gives the +3's four configurations", () => {
    expect(allRamBanksFor(0x01)).toEqual([0, 1, 2, 3]);
    expect(allRamBanksFor(0x03)).toEqual([4, 5, 6, 7]);
    expect(allRamBanksFor(0x05)).toEqual([4, 5, 6, 3]);
    expect(allRamBanksFor(0x07)).toEqual([4, 7, 6, 3]);
  });

  it("ignores bits above the configuration", () => {
    // --- The reported value carries nothing else today, but it is a port value: the two bits this
    // --- reads are the two bits it should read.
    expect(allRamBanksFor(0xf1)).toEqual([0, 1, 2, 3]);
    expect(allRamBanksFor(0xff)).toEqual([4, 7, 6, 3]);
  });

  it("returns a fresh array each time", () => {
    // --- The panel formats it and the IPC layer serialises it; a shared array that a caller sorted
    // --- in place would change what the next caller sees.
    const first = allRamBanksFor(0x01);
    first!.push(99);
    expect(allRamBanksFor(0x01)).toEqual([0, 1, 2, 3]);
  });
});

/*
 * The 16K bank a page row reports.
 *
 * A Next partition is an 8K page (Q9), so a 16K bank is `partition >> 1`. The interpreted
 * `MemoryDevice` has always reported it that way — `setPageInfo(..., bank8k >> 1, bank8k)` — but the
 * WASM Next passed the partition index straight through. Since `bank8k` is also the 8K page, its
 * page rows printed the same number twice, and the Memory Mapping panel labels the second one
 * "16K bank". See `.plans/NEX_DEBUGGING_PLAN.md` §11.5.
 */

describe("bank16kForPartition", () => {
  it("halves a RAM partition, because a 16K bank is two 8K pages", () => {
    expect(bank16kForPartition(0)).toEqual(0);
    expect(bank16kForPartition(1)).toEqual(0);
    expect(bank16kForPartition(10)).toEqual(5);
    expect(bank16kForPartition(11)).toEqual(5);
    expect(bank16kForPartition(222)).toEqual(111);
    expect(bank16kForPartition(223)).toEqual(111);
  });

  it("passes a negative partition through, which the panel renders as `--`", () => {
    // --- The ROMs, the alt ROMs and DivMMC are not RAM banks and have no 16K bank at all.
    expect(bank16kForPartition(-1)).toEqual(-1);
    expect(bank16kForPartition(-7)).toEqual(-7);
    expect(bank16kForPartition(-23)).toEqual(-23);
  });

  it("reports the no-bank placeholder for an unpaged page", () => {
    // --- `0xff` is what the interpreted machine writes for the same case.
    expect(bank16kForPartition(undefined)).toEqual(0xff);
  });

  it("agrees with the interpreted machine's own derivation", () => {
    // --- `MemoryDevice` computes `bank8k >> 1` directly; this must not drift from it.
    for (const bank8k of [0, 1, 2, 3, 10, 11, 100, 101, 222, 223]) {
      expect(bank16kForPartition(bank8k)).toEqual(bank8k >> 1);
    }
  });
});
