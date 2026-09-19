import { describe, it, expect } from "vitest";

import type { MemoryPageInfo } from "@emu/machines/zxNext/nextMemoryLayout";
import {
  bank16kPages,
  bankOffsetOfAddress,
  formatBankLocation,
  isContiguousPlacement,
  locateBank16k,
  isListedWhereItIsPaged,
  listedBankOffset,
  pcSpotlightAddress
} from "@renderer/appIde/DocumentPanels/Next/nextBankLocation";

/*
 * Where a 16K bank is in the Z80 address space right now.
 *
 * The Next's MMU is eight independent 8K slots, so a 16K bank is two pages that the hardware does
 * not require to be adjacent, in order, or both present. Every one of those cases is reachable and
 * each says something different to someone debugging a NEX, which is why this is a list of
 * placements rather than an address. See `.plans/NEX_DEBUGGING_PLAN.md` §11.2 and §4.6.
 */

/** A page holding nothing this test cares about: writable, pointing at some other 8K page. */
function page(bank8k: number, writable = true): MemoryPageInfo {
  return {
    readOffset: 0,
    writeOffset: writable ? 0 : null,
    bank16k: 0xff,
    bank8k
  };
}

/** Eight slots, each holding the 8K page whose number is given. */
function mapping(bank8ks: number[]): MemoryPageInfo[] {
  return bank8ks.map((b) => page(b));
}

describe("bank16kPages", () => {
  it("pairs a 16K bank with its two 8K pages", () => {
    expect(bank16kPages(5)).toEqual([10, 11]);
    expect(bank16kPages(0)).toEqual([0, 1]);
    expect(bank16kPages(111)).toEqual([222, 223]);
  });
});

describe("locateBank16k", () => {
  it("finds a bank paged in as one contiguous block", () => {
    // --- Bank 5 is 8K pages 10 and 11; at slots 4 and 5 that is $8000.
    const placements = locateBank16k(mapping([0, 1, 2, 3, 10, 11, 6, 7]), 5);
    expect(placements).toEqual([
      { page: 4, address: 0x8000, half: "low" },
      { page: 5, address: 0xa000, half: "high" }
    ]);
  });

  it("finds only the half that is paged in", () => {
    const placements = locateBank16k(mapping([0, 1, 2, 3, 10, 99, 6, 7]), 5);
    expect(placements).toEqual([{ page: 4, address: 0x8000, half: "low" }]);
  });

  it("finds halves that are not adjacent", () => {
    // --- Nothing in the hardware pairs the slots; two independent MMU writes can do this.
    const placements = locateBank16k(mapping([0, 11, 2, 3, 10, 5, 6, 7]), 5);
    expect(placements).toEqual([
      { page: 1, address: 0x2000, half: "high" },
      { page: 4, address: 0x8000, half: "low" }
    ]);
  });

  it("finds the same half in two slots at once", () => {
    // --- Also legal: two MMU registers can point at one 8K page.
    const placements = locateBank16k(mapping([10, 1, 2, 3, 10, 5, 6, 7]), 5);
    expect(placements.map((p) => p.page)).toEqual([0, 4]);
    expect(placements.every((p) => p.half === "low")).toEqual(true);
  });

  it("returns nothing for a bank that is not paged in", () => {
    expect(locateBank16k(mapping([0, 1, 2, 3, 4, 5, 6, 7]), 5)).toEqual([]);
  });

  it("ignores a slot that is not writable", () => {
    /*
     * A ROM'd slot's MMU register still holds whatever was last written to it. Matching on the
     * register alone would announce a RAM bank at an address where the ROM is — worse than "not
     * paged in", because the user would go and look there.
     */
    const pages = mapping([0, 1, 2, 3, 10, 11, 6, 7]);
    pages[4] = page(10, false);
    expect(locateBank16k(pages, 5)).toEqual([
      { page: 5, address: 0xa000, half: "high" }
    ]);
  });

  it("treats an absent writeOffset as not writable", () => {
    const pages = mapping([10, 1, 2, 3, 4, 5, 6, 7]);
    delete (pages[0] as any).writeOffset;
    expect(locateBank16k(pages, 5)).toEqual([]);
  });

  it("finds bank 0, whose pages are 0 and 1", () => {
    // --- Bank 0 and page 0 are both falsy; a truthiness test anywhere here would lose them.
    const placements = locateBank16k(mapping([0, 1, 2, 3, 4, 5, 6, 7]), 0);
    expect(placements).toEqual([
      { page: 0, address: 0x0000, half: "low" },
      { page: 1, address: 0x2000, half: "high" }
    ]);
  });

  it("has nothing to say without a mapping or a bank", () => {
    expect(locateBank16k(undefined, 5)).toEqual([]);
    expect(locateBank16k(mapping([10, 11, 2, 3, 4, 5, 6, 7]), undefined)).toEqual([]);
  });

  it("survives a mapping with holes in it", () => {
    const pages = mapping([0, 1, 2, 3, 10, 11, 6, 7]);
    (pages as any)[2] = undefined;
    expect(locateBank16k(pages, 5)).toHaveLength(2);
  });
});

describe("isContiguousPlacement", () => {
  it("is true for both halves in order in an aligned slot pair", () => {
    expect(
      isContiguousPlacement([
        { page: 4, address: 0x8000, half: "low" },
        { page: 5, address: 0xa000, half: "high" }
      ])
    ).toEqual(true);
  });

  it("is false when the halves are swapped", () => {
    // --- High at $8000 and low at $A000 is not a 16K block, however adjacent the slots are.
    expect(
      isContiguousPlacement([
        { page: 4, address: 0x8000, half: "high" },
        { page: 5, address: 0xa000, half: "low" }
      ])
    ).toEqual(false);
  });

  it("is false across a 16K boundary", () => {
    // --- Slots 3 and 4 are adjacent but straddle $8000, so no single 16K address describes it.
    expect(
      isContiguousPlacement([
        { page: 3, address: 0x6000, half: "low" },
        { page: 4, address: 0x8000, half: "high" }
      ])
    ).toEqual(false);
  });

  it("is false for one half, or for more than two placements", () => {
    expect(isContiguousPlacement([{ page: 4, address: 0x8000, half: "low" }])).toEqual(false);
    expect(isContiguousPlacement([])).toEqual(false);
    expect(
      isContiguousPlacement([
        { page: 4, address: 0x8000, half: "low" },
        { page: 5, address: 0xa000, half: "high" },
        { page: 0, address: 0x0000, half: "low" }
      ])
    ).toEqual(false);
  });
});

describe("formatBankLocation", () => {
  it("gives one address for the ordinary contiguous case", () => {
    const { text, title } = formatBankLocation([
      { page: 4, address: 0x8000, half: "low" },
      { page: 5, address: 0xa000, half: "high" }
    ]);
    expect(text).toEqual("at $8000");
    expect(title).toContain("$8000-$BFFF");
    expect(title).toContain("slots 4 and 5");
  });

  it("says a paged-out bank keeps its breakpoints, which is the part that surprises people", () => {
    const { text, title } = formatBankLocation([]);
    expect(text).toEqual("not paged in");
    expect(title).toContain("stays armed");
  });

  it("names the half when only one is paged in", () => {
    const { text, title } = formatBankLocation([{ page: 4, address: 0x8000, half: "low" }]);
    expect(text).toEqual("$8000 (low)");
    expect(title).toContain("Only this bank's low 8K half");
  });

  it("lists both slots when the halves are apart", () => {
    const { text, title } = formatBankLocation([
      { page: 1, address: 0x2000, half: "high" },
      { page: 4, address: 0x8000, half: "low" }
    ]);
    expect(text).toEqual("$2000 (high), $8000 (low)");
    expect(title).toContain("not paged in as one contiguous block");
    expect(title).toContain("slot 1 at $2000 holds the high half");
    expect(title).toContain("slot 4 at $8000 holds the low half");
  });

  it("does not call two copies of one half a contiguous block", () => {
    const { text, title } = formatBankLocation([
      { page: 0, address: 0x0000, half: "low" },
      { page: 4, address: 0x8000, half: "low" }
    ]);
    expect(text).toEqual("$0000 (low), $8000 (low)");
    expect(title).toContain("Only this bank's low 8K half");
  });
});

describe("bankOffsetOfAddress", () => {
  /*
   * The inverse question: not "where is the bank" but "is *this* address in it", which is what the
   * program-counter spotlight asks. See `.plans/NEX_DEBUGGING_PLAN.md` §11.4.
   */

  const contiguous: ReturnType<typeof locateBank16k> = [
    { page: 4, address: 0x8000, half: "low" },
    { page: 5, address: 0xa000, half: "high" }
  ];

  it("maps an address in the low half to its offset", () => {
    expect(bankOffsetOfAddress(contiguous, 0x8000)).toEqual(0x0000);
    expect(bankOffsetOfAddress(contiguous, 0x8123)).toEqual(0x0123);
    expect(bankOffsetOfAddress(contiguous, 0x9fff)).toEqual(0x1fff);
  });

  it("adds $2000 for an address in the high half", () => {
    // --- The offset within an 8K slot is the offset within that half; only the half decides
    // --- whether $2000 is added.
    expect(bankOffsetOfAddress(contiguous, 0xa000)).toEqual(0x2000);
    expect(bankOffsetOfAddress(contiguous, 0xa123)).toEqual(0x2123);
    expect(bankOffsetOfAddress(contiguous, 0xbfff)).toEqual(0x3fff);
  });

  it("says nothing for an address outside the bank", () => {
    expect(bankOffsetOfAddress(contiguous, 0x0000)).toEqual(undefined);
    expect(bankOffsetOfAddress(contiguous, 0x7fff)).toEqual(undefined);
    expect(bankOffsetOfAddress(contiguous, 0xc000)).toEqual(undefined);
  });

  it("works when only one half is paged in", () => {
    const highOnly: ReturnType<typeof locateBank16k> = [
      { page: 6, address: 0xc000, half: "high" }
    ];
    expect(bankOffsetOfAddress(highOnly, 0xc100)).toEqual(0x2100);
    // --- The low half is nowhere, so an address in the slot below is not in this bank.
    expect(bankOffsetOfAddress(highOnly, 0xa100)).toEqual(undefined);
  });

  it("works when the halves are paged apart", () => {
    const split: ReturnType<typeof locateBank16k> = [
      { page: 1, address: 0x2000, half: "high" },
      { page: 4, address: 0x8000, half: "low" }
    ];
    expect(bankOffsetOfAddress(split, 0x2010)).toEqual(0x2010);
    expect(bankOffsetOfAddress(split, 0x8010)).toEqual(0x0010);
  });

  it("picks the slot the address is actually in when a half is paged twice", () => {
    const twice: ReturnType<typeof locateBank16k> = [
      { page: 0, address: 0x0000, half: "low" },
      { page: 4, address: 0x8000, half: "low" }
    ];
    expect(bankOffsetOfAddress(twice, 0x0042)).toEqual(0x0042);
    expect(bankOffsetOfAddress(twice, 0x8042)).toEqual(0x0042);
  });

  it("has nothing to say without placements or an address", () => {
    expect(bankOffsetOfAddress([], 0x8000)).toEqual(undefined);
    expect(bankOffsetOfAddress(undefined, 0x8000)).toEqual(undefined);
    expect(bankOffsetOfAddress(contiguous, undefined)).toEqual(undefined);
  });

  it("finds offset 0 of a bank at $0000, which is every falsy value at once", () => {
    const atZero: ReturnType<typeof locateBank16k> = [
      { page: 0, address: 0x0000, half: "low" },
      { page: 1, address: 0x2000, half: "high" }
    ];
    expect(bankOffsetOfAddress(atZero, 0x0000)).toEqual(0);
  });
});

describe("formatBankLocation with the program counter in the bank", () => {
  const contiguous: ReturnType<typeof locateBank16k> = [
    { page: 4, address: 0x8000, half: "low" },
    { page: 5, address: 0xa000, half: "high" }
  ];

  it("marks the readout and explains it", () => {
    // --- The most consequential thing the header can say, and the only thing that makes the
    // --- spotlight discoverable without scrolling to find it.
    const { text, title } = formatBankLocation(contiguous, 0x0123);
    expect(text).toEqual("at $8000 · PC");
    expect(title).toContain("program counter is in this bank, at offset $0123");
    expect(title).toContain("highlighted in the disassembly");
  });

  it("says nothing extra when the PC is elsewhere", () => {
    const { text, title } = formatBankLocation(contiguous, undefined);
    expect(text).toEqual("at $8000");
    expect(title).not.toContain("program counter");
  });

  it("marks a bank whose halves are apart too", () => {
    const split: ReturnType<typeof locateBank16k> = [
      { page: 1, address: 0x2000, half: "high" },
      { page: 4, address: 0x8000, half: "low" }
    ];
    const { text, title } = formatBankLocation(split, 0x2010);
    expect(text).toEqual("$2000 (high), $8000 (low) · PC");
    expect(title).toContain("offset $2010");
  });

  it("marks offset 0, which a truthiness test would drop", () => {
    expect(formatBankLocation(contiguous, 0).text).toEqual("at $8000 · PC");
  });
});

describe("pcSpotlightAddress", () => {
  it("numbers the spotlight by the listing's own offset", () => {
    // --- The pop-out's rows are numbered by the offset dropdown, and the row compares its own
    // --- displayed address — so the mark has to follow that, not the machine's addressing.
    expect(pcSpotlightAddress(0x0000, 0x0123)).toEqual(0x0123);
    expect(pcSpotlightAddress(0xc000, 0x0123)).toEqual(0xc123);
    expect(pcSpotlightAddress(0x4000, 0x3fff)).toEqual(0x7fff);
  });

  it("is -1 when the program counter is not in this bank", () => {
    /*
     * The guard this function exists for. `disassOffset + (pcOffset ?? 0)` reads as an equivalent
     * simplification and would spotlight the first row of the listing every time the program
     * counter was somewhere else.
     */
    expect(pcSpotlightAddress(0x0000, undefined)).toEqual(-1);
    expect(pcSpotlightAddress(0xc000, undefined)).toEqual(-1);
  });

  it("spotlights offset 0, rather than treating it as nowhere", () => {
    expect(pcSpotlightAddress(0xc000, 0)).toEqual(0xc000);
    expect(pcSpotlightAddress(0x0000, 0)).toEqual(0);
  });
});

/*
 * The branch gutter has to know whether a listing's addresses are real before it resolves any
 * destination from them. See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md §15.19.
 */
describe("isListedWhereItIsPaged", () => {
  const at = (base: number) => [
    { page: base / 0x2000, address: base, half: "low" as const },
    { page: base / 0x2000 + 1, address: base + 0x2000, half: "high" as const }
  ];

  it("agrees when the bank is paged at the address it is listed at", () => {
    expect(isListedWhereItIsPaged(at(0x4000), 0x4000)).toBe(true);
    expect(isListedWhereItIsPaged(at(0x8000), 0x8000)).toBe(true);
    expect(isListedWhereItIsPaged(at(0xc000), 0xc000)).toBe(true);
  });

  it("refuses when the listing is numbered somewhere the bank is not", () => {
    // --- Genuine flags, fictional addresses: every destination would name a place this code is not.
    expect(isListedWhereItIsPaged(at(0x4000), 0x8000)).toBe(false);
    expect(isListedWhereItIsPaged(at(0x8000), 0x0000)).toBe(false);
  });

  it("refuses when the bank is not paged in at all", () => {
    expect(isListedWhereItIsPaged([], 0x4000)).toBe(false);
    expect(isListedWhereItIsPaged(undefined, 0x4000)).toBe(false);
  });

  it("refuses a bank split across non-adjacent slots", () => {
    // --- No single base for a listing to agree with.
    const split = [
      { page: 2, address: 0x4000, half: "low" as const },
      { page: 7, address: 0xe000, half: "high" as const }
    ];
    expect(isListedWhereItIsPaged(split, 0x4000)).toBe(false);
  });

  it("refuses a half-paged bank", () => {
    expect(isListedWhereItIsPaged([{ page: 2, address: 0x4000, half: "low" }], 0x4000)).toBe(false);
  });
});

/*
 * The identity a bank-relative breakpoint uses. See §15.20 of the CSpect plan.
 */
describe("listedBankOffset", () => {
  it("inverts the listing's numbering", () => {
    expect(listedBankOffset(0x4000, 0x4000)).toBe(0x0000);
    expect(listedBankOffset(0x5c50, 0x4000)).toBe(0x1c50);
    expect(listedBankOffset(0xa624, 0x8000)).toBe(0x2624);
    expect(listedBankOffset(0x7fff, 0x4000)).toBe(0x3fff);
  });

  it("works for a bank listed from zero", () => {
    // --- A bank that is not paged in at start-up is listed at $0000.
    expect(listedBankOffset(0x0100, 0x0000)).toBe(0x0100);
  });

  it("refuses an address outside the bank", () => {
    expect(listedBankOffset(0x3fff, 0x4000)).toBeUndefined();
    expect(listedBankOffset(0x8000, 0x4000)).toBeUndefined();
  });
});
