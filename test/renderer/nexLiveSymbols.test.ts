import { describe, it, expect } from "vitest";

import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import {
  bankSiteAtAddress,
  createNexLiveOperandLabelResolver,
  findNexLabelForAddress
} from "@renderer/appIde/DocumentPanels/Next/nexLiveSymbols";

/*
 * A NEX's hand-made labels in the *live* disassembly.
 *
 * The popped-out bank's listing already names things — it knows which bank it is showing. The live
 * view knows only Z80 addresses and its banks move underneath it, so the same routine reads
 * `call DrawSprite` in the pop-out and `call $C100` while the program runs, which is the moment the
 * name is worth most. See `.plans/NEX_DEBUGGING_PLAN.md` §13.1.
 */

/** Eight 8K slots. Bank 5 is pages 10/11, bank 6 is 12/13. */
const PAGED_BANK5_AT_C000 = [0, 1, 2, 3, 4, 5, 10, 11];

const annotations: NexFileAnnotations = {
  schemaVersion: 2,
  globalLabels: [{ name: "Entry", value: 0x8000 }],
  banks: {
    "5": {
      offsetIndex: 3,
      regions: [],
      localLabels: [
        { name: "DrawSprite", value: 0x0100 },
        { name: "HighHalf", value: 0x2100 }
      ]
    },
    "6": { offsetIndex: 3, regions: [], localLabels: [{ name: "Other", value: 0x0100 }] }
  }
} as any;

describe("bankSiteAtAddress", () => {
  it("inverts the live paging map", () => {
    // --- Slot 6 holds page 10 — bank 5's low half — so $C100 is bank 5 offset $0100.
    expect(bankSiteAtAddress(PAGED_BANK5_AT_C000, 0xc100)).toEqual({ bank: 5, bankOffset: 0x0100 });
  });

  it("recovers the high half from the page's low bit", () => {
    // --- Slot 7 holds page 11 — bank 5's *high* half — so $E100 is offset $2100, not $0100.
    expect(bankSiteAtAddress(PAGED_BANK5_AT_C000, 0xe100)).toEqual({ bank: 5, bankOffset: 0x2100 });
  });

  it("finds bank 0 at offset 0, which is every falsy value at once", () => {
    expect(bankSiteAtAddress([0, 1, 2, 3, 4, 5, 6, 7], 0x0000)).toEqual({
      bank: 0,
      bankOffset: 0
    });
  });

  it("has no site where nothing is paged", () => {
    expect(bankSiteAtAddress([undefined, 1, 2, 3, 4, 5, 6, 7], 0x0000)).toEqual(undefined);
    expect(bankSiteAtAddress(undefined, 0xc100)).toEqual(undefined);
  });

  it("has no site for a ROM or DivMMC page", () => {
    // --- Negative partitions are the ROMs, the alt ROMs and DivMMC — not banks of the NEX.
    expect(bankSiteAtAddress([-1, 1, 2, 3, 4, 5, 6, 7], 0x0100)).toEqual(undefined);
  });
});

describe("findNexLabelForAddress", () => {
  it("names an address from the bank paged there", () => {
    expect(findNexLabelForAddress(annotations, PAGED_BANK5_AT_C000, 0xc100)).toEqual("DrawSprite");
  });

  it("names the high half correctly", () => {
    expect(findNexLabelForAddress(annotations, PAGED_BANK5_AT_C000, 0xe100)).toEqual("HighHalf");
  });

  it("names nothing once the bank has been paged away", () => {
    // --- The whole reason this is recomputed as the program pages: a local label only applies
    // --- while its bank is actually at that address.
    const bank6There = [0, 1, 2, 3, 4, 5, 12, 13];
    expect(findNexLabelForAddress(annotations, bank6There, 0xc100)).toEqual("Other");
  });

  it("names a global label whatever is paged in", () => {
    // --- Its value is a 16-bit address, so it means the same thing regardless of the paging.
    expect(findNexLabelForAddress(annotations, PAGED_BANK5_AT_C000, 0x8000)).toEqual("Entry");
    expect(findNexLabelForAddress(annotations, undefined, 0x8000)).toEqual("Entry");
  });

  it("prefers a global label over a local one at the same address", () => {
    /*
     * The more specific claim of the two: a global label names one place in the address space,
     * while a local one names a place in a bank that could be anywhere.
     */
    const both: NexFileAnnotations = {
      ...annotations,
      globalLabels: [{ name: "Global", value: 0xc100 }]
    } as any;
    expect(findNexLabelForAddress(both, PAGED_BANK5_AT_C000, 0xc100)).toEqual("Global");
  });

  it("names nothing for an address with no label", () => {
    expect(findNexLabelForAddress(annotations, PAGED_BANK5_AT_C000, 0xc200)).toEqual(undefined);
  });

  it("names nothing without annotations", () => {
    expect(findNexLabelForAddress(undefined, PAGED_BANK5_AT_C000, 0xc100)).toEqual(undefined);
  });

  it("masks the address to 16 bits", () => {
    expect(findNexLabelForAddress(annotations, PAGED_BANK5_AT_C000, 0x1_c100)).toEqual(
      "DrawSprite"
    );
  });
});

describe("createNexLiveOperandLabelResolver", () => {
  it("is absent when there are no annotations, leaving the listing as it was", () => {
    // --- Cheaper than a resolver that always declines, and it guarantees the live view renders
    // --- byte-for-byte as before when no NEX is involved.
    expect(createNexLiveOperandLabelResolver(undefined, PAGED_BANK5_AT_C000)).toEqual(undefined);
  });

  it("names an operand that points at a label", () => {
    const resolve = createNexLiveOperandLabelResolver(annotations, PAGED_BANK5_AT_C000)!;
    expect(resolve({ operandValue: 0xc100 } as any)).toEqual("DrawSprite");
  });

  it("declines an operand that points at nothing named", () => {
    // --- Asked about *every* 16-bit operand, most of which are not addresses of anything.
    const resolve = createNexLiveOperandLabelResolver(annotations, PAGED_BANK5_AT_C000)!;
    expect(resolve({ operandValue: 0x1234 } as any)).toEqual(undefined);
  });

  it("declines an operand with no value", () => {
    const resolve = createNexLiveOperandLabelResolver(annotations, PAGED_BANK5_AT_C000)!;
    expect(resolve({ operandValue: undefined } as any)).toEqual(undefined);
  });
});
