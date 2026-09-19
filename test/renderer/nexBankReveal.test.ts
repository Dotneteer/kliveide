import { describe, expect, it, beforeEach, vi } from "vitest";

import type { MemoryPageInfo } from "@emu/machines/zxNext/nextMemoryLayout";

import { bank16kAtAddress } from "@renderer/appIde/DocumentPanels/Next/nextBankLocation";
import {
  recordNexLoad,
  resetNexLoadSessionForTests
} from "@renderer/appIde/DocumentPanels/Next/nexLoadSession";
import {
  resetNexBankRevealCacheForTests,
  revealNexBankAtPc,
  type NexBankRevealRequest
} from "@renderer/appIde/DocumentPanels/Next/nexBankReveal";

/**
 * An 8K page map: `pages[slot] = 8K page number`, or `null` for a slot showing ROM.
 *
 * A 16K bank B occupies pages `2B` (low) and `2B+1` (high), so bank 5 paged normally at `$4000` is
 * pages 10 and 11 in slots 2 and 3.
 */
function pageMap(pages: (number | null)[]): MemoryPageInfo[] {
  return pages.map((page) =>
    page === null
      ? ({ readOffset: 0, writeOffset: null } as MemoryPageInfo)
      : ({ readOffset: 0, writeOffset: 0, bank8k: page } as MemoryPageInfo)
  );
}

/** ROM in slots 0-1, bank 5 at $4000, bank 2 at $8000, bank 20 at $C000 — the NEX start-up map. */
const NEX_START_MAP = pageMap([null, null, 10, 11, 4, 5, 40, 41]);

describe("bank16kAtAddress", () => {
  it("names the bank visible at an address and where its byte 0 sits", () => {
    expect(bank16kAtAddress(NEX_START_MAP, 0x5c50)).toEqual({ bank: 5, baseAddress: 0x4000 });
    // --- The address that sent this whole feature: a jump into bank 2.
    expect(bank16kAtAddress(NEX_START_MAP, 0xa624)).toEqual({ bank: 2, baseAddress: 0x8000 });
    expect(bank16kAtAddress(NEX_START_MAP, 0xc123)).toEqual({ bank: 20, baseAddress: 0xc000 });
  });

  it("reports the base from the low half even when the address is in the high half", () => {
    // --- $7FFF is in slot 3, which holds bank 5's *high* page; the listing is still based at $4000.
    expect(bank16kAtAddress(NEX_START_MAP, 0x7fff)).toEqual({ bank: 5, baseAddress: 0x4000 });
  });

  it("says nothing for an address showing ROM", () => {
    // --- Which is where the PC sits for the whole of a NEX launch, and what keeps the reveal quiet.
    expect(bank16kAtAddress(NEX_START_MAP, 0x1202)).toBeUndefined();
    expect(bank16kAtAddress(NEX_START_MAP, 0x0000)).toBeUndefined();
  });

  it("falls back to the address's own slot when the bank's halves are split", () => {
    // --- The MMU does not require the two halves to be adjacent or in order. No single base
    // --- describes such a bank, so the numbering follows the address that was asked about.
    const split = pageMap([null, null, 10, 41, 4, 5, 40, 11]);
    expect(bank16kAtAddress(split, 0x5000)).toEqual({ bank: 5, baseAddress: 0x4000 });
    expect(bank16kAtAddress(split, 0xf000)).toEqual({ bank: 5, baseAddress: 0xc000 });
  });

  it("says nothing without a page map", () => {
    expect(bank16kAtAddress(undefined, 0x5c50)).toBeUndefined();
  });
});

describe("revealNexBankAtPc", () => {
  /** A NEX carrying banks 5, 2 and 20, each filled with its own bank number. */
  function nexBytes(banks: number[]): Uint8Array {
    const bytes = new Uint8Array(512 + banks.length * 0x4000);
    bytes.set([0x4e, 0x65, 0x78, 0x74], 0); // --- 'Next'
    bytes.set([0x56, 0x31, 0x2e, 0x32], 4); // --- 'V1.2'
    banks.forEach((bank) => (bytes[18 + bank] = 1));
    // --- File order is 5, 2, 0, 1, 3, 4, 6..111, so fill in that order, not the caller's.
    const fileOrder = [5, 2, 0, 1, 3, 4, ...Array.from({ length: 106 }, (_, i) => i + 6)];
    let offset = 512;
    for (const bank of fileOrder) {
      if (!banks.includes(bank)) continue;
      bytes.fill(bank, offset, offset + 0x4000);
      offset += 0x4000;
    }
    return bytes;
  }

  function deps(pc: number, pages = NEX_START_MAP, banks = [5, 2, 20]) {
    const openBank = vi.fn(async (_: NexBankRevealRequest) => {});
    const readFile = vi.fn(async () => nexBytes(banks));
    return {
      openBank,
      readFile,
      all: {
        getPc: async () => pc,
        getPageInfo: async () => pages,
        readFile,
        openBank
      }
    };
  }

  beforeEach(() => {
    resetNexLoadSessionForTests();
    resetNexBankRevealCacheForTests();
    vi.clearAllMocks();
  });

  it("does nothing when no NEX was launched", async () => {
    const d = deps(0x5c50);
    expect(await revealNexBankAtPc(d.all)).toEqual("no-nex-session");
    expect(d.openBank).not.toHaveBeenCalled();
  });

  it("does nothing while the PC is in ROM", async () => {
    // --- The launch flow's own pauses land here, which is why the bank no longer appears early.
    recordNexLoad("/p/Game.nex", [5, 2, 20]);
    const d = deps(0x1202);
    expect(await revealNexBankAtPc(d.all)).toEqual("not-in-ram");
    expect(d.openBank).not.toHaveBeenCalled();
  });

  it("reveals the entry point's bank, based where the bank actually is", async () => {
    recordNexLoad("/p/Game.nex", [5, 2, 20]);
    const d = deps(0x5c50);

    expect(await revealNexBankAtPc(d.all)).toEqual("revealed");
    expect(d.openBank).toHaveBeenCalledTimes(1);
    const request = d.openBank.mock.calls[0][0];
    expect(request).toMatchObject({
      path: "/p/Game.nex",
      bank: 5,
      disassOffset: 0x4000,
      topAddress: 0x5c50
    });
    // --- The bank's own bytes, not another bank's: the file order is 5, 2, 0, 1, 3, 4, 6...
    expect(request.contents.length).toEqual(0x4000);
    expect(request.contents[0]).toEqual(5);
    // --- The annotation *sidecar*, not the NEX. Handing over the `.nex` made the annotation
    // --- session read a binary as its JSON: "Annotation file contains validation errors".
    expect(request.annotationPath).toEqual("/p/Game.nex.dis");
  });

  it("follows a jump into another bank", async () => {
    // --- The case that prompted this: stepping out of bank 5 into $A624.
    recordNexLoad("/p/Game.nex", [5, 2, 20]);
    const d = deps(0xa624);

    expect(await revealNexBankAtPc(d.all)).toEqual("revealed");
    expect(d.openBank.mock.calls[0][0]).toMatchObject({
      bank: 2,
      disassOffset: 0x8000,
      topAddress: 0xa624
    });
    expect(d.openBank.mock.calls[0][0].contents[0]).toEqual(2);
  });

  it("ignores a bank the running program paged in that the file never carried", async () => {
    recordNexLoad("/p/Game.nex", [5, 2, 20]);
    // --- Bank 33 in slot 2, which this NEX does not declare.
    const d = deps(0x5c50, pageMap([null, null, 66, 67, 4, 5, 40, 41]));
    expect(await revealNexBankAtPc(d.all)).toEqual("not-a-bank-of-this-nex");
    expect(d.openBank).not.toHaveBeenCalled();
  });

  it("reads the file once across repeated pauses", async () => {
    // --- Every step is a pause; re-parsing megabytes each time would be the wrong kind of helpful.
    recordNexLoad("/p/Game.nex", [5, 2, 20]);
    const d = deps(0x5c50);

    await revealNexBankAtPc(d.all);
    await revealNexBankAtPc(d.all);
    await revealNexBankAtPc(d.all);

    expect(d.readFile).toHaveBeenCalledTimes(1);
    expect(d.openBank).toHaveBeenCalledTimes(3);
  });

  it("re-reads when a different NEX is launched", async () => {
    recordNexLoad("/p/A.nex", [5, 2, 20]);
    const d = deps(0x5c50);
    await revealNexBankAtPc(d.all);

    recordNexLoad("/p/B.nex", [5, 2, 20]);
    await revealNexBankAtPc(d.all);

    expect(d.readFile).toHaveBeenCalledTimes(2);
  });
});
