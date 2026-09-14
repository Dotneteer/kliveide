import { describe, it, expect } from "vitest";

import {
  bankPartitions,
  changedFlagsIn,
  diffBankBytes,
  formatBankDiff,
  joinBankHalves
} from "@renderer/appIde/DocumentPanels/Next/nexLiveBank";

/*
 * The live bank, and what differs from the file.
 *
 * The popped-out bank has always shown the file, which hides the one thing a debugger most wants:
 * what the program did to the bank after it was loaded. See `.plans/NEX_DEBUGGING_PLAN.md` §11.3.
 */

const HALF = 0x2000;
const BANK = 0x4000;

function half(fill: number): Uint8Array {
  return new Uint8Array(HALF).fill(fill);
}

describe("bankPartitions", () => {
  it("pairs a 16K bank with the two 8K partitions to read", () => {
    // --- The emulator reads one partition at a time and a Next partition is 8K, so a bank is two
    // --- reads. Low half first, matching `bankRelativePartition`.
    expect(bankPartitions(5)).toEqual([10, 11]);
    expect(bankPartitions(0)).toEqual([0, 1]);
    expect(bankPartitions(111)).toEqual([222, 223]);
  });
});

describe("joinBankHalves", () => {
  it("puts the low half first", () => {
    const joined = joinBankHalves(half(0xaa), half(0xbb));
    expect(joined).toHaveLength(BANK);
    expect(joined![0]).toEqual(0xaa);
    expect(joined![HALF - 1]).toEqual(0xaa);
    expect(joined![HALF]).toEqual(0xbb);
    expect(joined![BANK - 1]).toEqual(0xbb);
  });

  it("refuses a missing half", () => {
    expect(joinBankHalves(undefined, half(0))).toEqual(undefined);
    expect(joinBankHalves(half(0), undefined)).toEqual(undefined);
  });

  it("refuses a half of the wrong size", () => {
    /*
     * What a machine mid-switch can hand back. Zero-padding it instead would report every byte
     * past the join as changed — a screen full of false positives rather than a missing feature.
     */
    expect(joinBankHalves(new Uint8Array(0x100), half(0))).toEqual(undefined);
    expect(joinBankHalves(half(0), new Uint8Array(BANK))).toEqual(undefined);
  });

  it("copies rather than aliasing its inputs", () => {
    const low = half(0x11);
    const joined = joinBankHalves(low, half(0x22));
    low[0] = 0x99;
    expect(joined![0]).toEqual(0x11);
  });
});

describe("diffBankBytes", () => {
  it("marks the bytes that differ, and counts them", () => {
    const file = new Uint8Array([1, 2, 3, 4]);
    const live = new Uint8Array([1, 9, 3, 8]);
    const diff = diffBankBytes(file, live);
    expect(diff!.changed).toEqual(2);
    expect(Array.from(diff!.mask)).toEqual([0, 1, 0, 1]);
  });

  it("reports nothing changed for an untouched bank", () => {
    const file = new Uint8Array([1, 2, 3]);
    const diff = diffBankBytes(file, new Uint8Array([1, 2, 3]));
    expect(diff!.changed).toEqual(0);
    expect(Array.from(diff!.mask)).toEqual([0, 0, 0]);
  });

  it("has nothing to compare without both sides", () => {
    expect(diffBankBytes(undefined, new Uint8Array(4))).toEqual(undefined);
    expect(diffBankBytes(new Uint8Array(4), undefined)).toEqual(undefined);
  });

  it("refuses two different lengths", () => {
    // --- Guessing an alignment would mark bytes that were never compared.
    expect(diffBankBytes(new Uint8Array(4), new Uint8Array(8))).toEqual(undefined);
  });

  it("notices a zero written over a non-zero, and the reverse", () => {
    // --- Both directions matter: a byte cleared to 0 is as much a change as one set.
    const diff = diffBankBytes(new Uint8Array([0, 5]), new Uint8Array([5, 0]));
    expect(Array.from(diff!.mask)).toEqual([1, 1]);
  });
});

describe("changedFlagsIn", () => {
  const diff = diffBankBytes(
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    new Uint8Array([1, 9, 3, 4, 5, 6, 7, 9])
  );

  it("gives one flag per byte of the row", () => {
    expect(changedFlagsIn(diff, 0, 4)).toEqual([false, true, false, false]);
  });

  it("is undefined for a row with nothing changed", () => {
    // --- A 16K bank is 2048 rows and almost all of them are usually untouched: no allocation and
    // --- no overlays for those.
    expect(changedFlagsIn(diff, 2, 4)).toEqual(undefined);
  });

  it("is undefined when there is no diff at all", () => {
    expect(changedFlagsIn(undefined, 0, 8)).toEqual(undefined);
  });

  it("reads the row's own slice of the mask, not the start of it", () => {
    expect(changedFlagsIn(diff, 4, 4)).toEqual([false, false, false, true]);
  });

  it("reports false past the end of the mask rather than throwing", () => {
    expect(changedFlagsIn(diff, 6, 4)).toEqual([false, true, false, false]);
  });

  it("returns a fresh array that no later diff can mutate", () => {
    // --- A `Uint8Array` view over the mask would alias it, and the row is still rendering these.
    const flags = changedFlagsIn(diff, 0, 4)!;
    diff!.mask[1] = 0;
    expect(flags).toEqual([false, true, false, false]);
  });
});

describe("formatBankDiff", () => {
  it("says nothing for an untouched bank", () => {
    // --- The absence says "same as the file" more clearly than "0 changed" would.
    expect(formatBankDiff(undefined)).toEqual(undefined);
    expect(formatBankDiff({ mask: new Uint8Array(4), changed: 0 })).toEqual(undefined);
  });

  it("counts the changed bytes, with the proportion in the tooltip", () => {
    const mask = new Uint8Array(200);
    const badge = formatBankDiff({ mask, changed: 50 });
    expect(badge!.text).toEqual("50 changed");
    expect(badge!.title).toContain("50 of 200 bytes");
    expect(badge!.title).toContain("(25%)");
  });

  it("says <1% rather than 0% for a handful of bytes in a whole bank", () => {
    // --- Rounding would print "(0%)" next to a count that is plainly not zero.
    const badge = formatBankDiff({ mask: new Uint8Array(0x4000), changed: 3 });
    expect(badge!.title).toContain("(<1%)");
  });

  it("explains what a change means, since it is not an error", () => {
    const badge = formatBankDiff({ mask: new Uint8Array(0x4000), changed: 1 });
    expect(badge!.title).toContain("written to the bank since it was loaded");
  });
});
