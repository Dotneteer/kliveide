import { describe, it, expect } from "vitest";

import type { NexHeader } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import {
  getDefaultDisassemblyOffsetForBank,
  getDefaultDisassemblyOffsetIndexForBank,
  getEntryPointBreakpointSite,
  getMappedBankForAddress,
  getProgramCounterBank,
  getStackPointerBank,
  NEX_SLOT_1_BANK,
  NEX_SLOT_2_BANK
} from "@renderer/appIde/DocumentPanels/Next/nexEntryState";

/*
 * The NEX start-up memory map.
 *
 * These answers used to live inside `NexFileViewerPanel.tsx`, where the only thing that could check
 * them was a DOM test asserting on rendered labels. They decide where a breakpoint on the NEX's
 * entry point goes, so they are worth pinning directly. See `.plans/NEX_DEBUGGING_PLAN.md` §11.1.
 */

function header(over: Partial<NexHeader> = {}): NexHeader {
  return {
    entryBank: 20,
    programCounter: 0xc000,
    stackPointer: 0xff00,
    ...over
  } as NexHeader;
}

describe("getMappedBankForAddress", () => {
  it("maps the three windows NextZXOS pages before handing over", () => {
    const h = header({ entryBank: 20 });
    expect(getMappedBankForAddress(h, 0x4000)).toEqual(NEX_SLOT_1_BANK);
    expect(getMappedBankForAddress(h, 0x7fff)).toEqual(NEX_SLOT_1_BANK);
    expect(getMappedBankForAddress(h, 0x8000)).toEqual(NEX_SLOT_2_BANK);
    expect(getMappedBankForAddress(h, 0xbfff)).toEqual(NEX_SLOT_2_BANK);
    expect(getMappedBankForAddress(h, 0xc000)).toEqual(20);
    expect(getMappedBankForAddress(h, 0xffff)).toEqual(20);
  });

  it("has no bank below $4000, which is ROM when the program starts", () => {
    // --- The whole reason an entry point down there cannot carry a bank breakpoint.
    expect(getMappedBankForAddress(header(), 0x0000)).toEqual(undefined);
    expect(getMappedBankForAddress(header(), 0x3fff)).toEqual(undefined);
  });

  it("masks an address to 16 bits rather than reading past the top", () => {
    expect(getMappedBankForAddress(header(), 0x1_4000)).toEqual(NEX_SLOT_1_BANK);
  });

  it("reports the entry bank at $C000 even when it is bank 0", () => {
    // --- Bank 0 is falsy, and a `||` fallback anywhere on this path would report the wrong bank.
    expect(getMappedBankForAddress(header({ entryBank: 0 }), 0xc000)).toEqual(0);
  });

  it("reports the same bank twice when the entry bank is also a fixed one", () => {
    // --- A NEX may name bank 5 or 2 as its entry bank, and then that bank really is visible at two
    // --- addresses at once. Address-to-bank stays a function; bank-to-address stops being one, and
    // --- `getDefaultDisassemblyOffsetForBank` has to pick — see the test below.
    const h = header({ entryBank: NEX_SLOT_1_BANK });
    expect(getMappedBankForAddress(h, 0x4000)).toEqual(NEX_SLOT_1_BANK);
    expect(getMappedBankForAddress(h, 0xc000)).toEqual(NEX_SLOT_1_BANK);
  });
});

describe("getDefaultDisassemblyOffsetForBank", () => {
  it("gives each paged bank the address it will be seen at", () => {
    const h = header({ entryBank: 20 });
    expect(getDefaultDisassemblyOffsetForBank(NEX_SLOT_1_BANK, h)).toEqual(0x4000);
    expect(getDefaultDisassemblyOffsetForBank(NEX_SLOT_2_BANK, h)).toEqual(0x8000);
    expect(getDefaultDisassemblyOffsetForBank(20, h)).toEqual(0xc000);
  });

  it("falls back to $0000 for a bank that is not paged in at all", () => {
    // --- Most of a NEX's banks: nothing says where they will end up, so the dump shows them from 0.
    expect(getDefaultDisassemblyOffsetForBank(37, header({ entryBank: 20 }))).toEqual(0x0000);
  });

  it("picks the entry window for a bank paged in twice", () => {
    // --- Bank 2 named as the entry bank is visible at both `$8000` and `$C000`. One offset has to
    // --- be chosen for the dump, and it is the entry window — where the program is about to run.
    const h = header({ entryBank: NEX_SLOT_2_BANK });
    expect(getDefaultDisassemblyOffsetForBank(NEX_SLOT_2_BANK, h)).toEqual(0xc000);
    // --- So this pair does *not* round-trip, and that is a property of the map, not a bug.
    expect(getMappedBankForAddress(h, 0x8000)).toEqual(NEX_SLOT_2_BANK);
  });

  it("indexes the same answer as a 16K slot number", () => {
    const h = header({ entryBank: 20 });
    expect(getDefaultDisassemblyOffsetIndexForBank(NEX_SLOT_1_BANK, h)).toEqual(1);
    expect(getDefaultDisassemblyOffsetIndexForBank(NEX_SLOT_2_BANK, h)).toEqual(2);
    expect(getDefaultDisassemblyOffsetIndexForBank(20, h)).toEqual(3);
    expect(getDefaultDisassemblyOffsetIndexForBank(37, h)).toEqual(0);
  });
});

describe("getProgramCounterBank / getStackPointerBank", () => {
  it("resolves each register through the same map", () => {
    const h = header({ entryBank: 20, programCounter: 0xc123, stackPointer: 0x7f00 });
    expect(getProgramCounterBank(h)).toEqual(20);
    expect(getStackPointerBank(h)).toEqual(NEX_SLOT_1_BANK);
  });

  it("reports no bank for a register pointing into ROM", () => {
    const h = header({ programCounter: 0x0000, stackPointer: 0x3fff });
    expect(getProgramCounterBank(h)).toEqual(undefined);
    expect(getStackPointerBank(h)).toEqual(undefined);
  });
});

describe("getEntryPointBreakpointSite", () => {
  it("names the entry bank and the offset inside it", () => {
    const site = getEntryPointBreakpointSite(header({ entryBank: 20, programCounter: 0xc123 }));
    expect(site).toEqual({ bank: 20, bankOffset: 0x0123 });
  });

  it("takes the offset within the 16K bank, not within the slot's window", () => {
    // --- `& 0x3FFF`: an entry point at `$FFFF` is offset `$3FFF` of the entry bank.
    expect(getEntryPointBreakpointSite(header({ programCounter: 0xffff }))?.bankOffset).toEqual(
      0x3fff
    );
    expect(getEntryPointBreakpointSite(header({ programCounter: 0xc000 }))?.bankOffset).toEqual(0);
  });

  it("resolves an entry point in one of the fixed windows to that bank", () => {
    // --- NextZXOS decides where execution goes; a NEX can hand over inside bank 5 or bank 2.
    expect(getEntryPointBreakpointSite(header({ programCounter: 0x4100 }))).toEqual({
      bank: NEX_SLOT_1_BANK,
      bankOffset: 0x0100
    });
    expect(getEntryPointBreakpointSite(header({ programCounter: 0x8200 }))).toEqual({
      bank: NEX_SLOT_2_BANK,
      bankOffset: 0x0200
    });
  });

  it("refuses an entry point below $4000", () => {
    // --- ROM at hand-over. A bank breakpoint there would be armed somewhere the program's own code
    // --- never is, so it would either never fire or fire in the OS.
    expect(getEntryPointBreakpointSite(header({ programCounter: 0x0000 }))).toEqual(undefined);
    expect(getEntryPointBreakpointSite(header({ programCounter: 0x3fff }))).toEqual(undefined);
  });

  it("works for bank 0 at offset 0", () => {
    const site = getEntryPointBreakpointSite(header({ entryBank: 0, programCounter: 0xc000 }));
    expect(site).toEqual({ bank: 0, bankOffset: 0 });
  });
});
