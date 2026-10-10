import { describe, it, expect } from "vitest";

import {
  ANY_PARTITION,
  annotationMachineWarning,
  bankSpaceFor,
  nextBankSpace,
  plus3BankSpace,
  scorpionBankSpace,
  sp128BankSpace,
  sp48BankSpace,
  timexBankSpace,
  zx8081BankSpace,
  zx8081RomAddresses,
  type BankSpace,
  type SlotPaging
} from "@common/annotations/bankSpace";
import { DebugSupport } from "@emu/machines/DebugSupport";
import {
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT,
  MC_MEM_SIZE
} from "@common/machines/constants";

/*
 * The bank space is where every annotation and bank breakpoint meets a Z80 address, so a mistake
 * here is silent: a label shows on the wrong bytes, or a bank breakpoint never fires (T1). Every
 * machine is checked by round trip — address → site → address — under every paging it allows.
 */

/** A 128K-style paging: the 16K partition of each slot, reported twice (T3). */
function paging16k(slot0: number, slot1: number, slot2: number, slot3: number): number[] {
  return [slot0, slot0, slot1, slot1, slot2, slot2, slot3, slot3];
}

/** Every address back from its site comes back to itself, for the given paging. */
function expectRoundTrip(space: BankSpace, slots: SlotPaging, step = 0x0101): void {
  for (let address = 0; address <= 0xffff; address += step) {
    const site = space.siteAt(address, slots);
    if (site?.kind !== "bank") continue;
    const back = space.addressesOf({ bank: site.bank, offset: site.offset }, slots);
    expect(back, `$${address.toString(16)}`).toContain(address);
    // --- ...and every address it reports maps back to the same site.
    for (const other of back) {
      expect(space.siteAt(other, slots)).toEqual(site);
    }
  }
}

describe("bankSpaceFor", () => {
  it("chooses each machine's space", () => {
    expect(bankSpaceFor(MI_ZXNEXT)?.id).toBe("next");
    expect(bankSpaceFor(MI_SPECTRUM_48)?.id).toBe("sp48");
    expect(bankSpaceFor(MI_SPECTRUM_128)?.id).toBe("sp128");
    expect(bankSpaceFor(MI_SPECTRUM_3E)?.id).toBe("plus3");
    expect(bankSpaceFor(MI_SCORPION)?.id).toBe("scorpion");
    expect(bankSpaceFor(MI_TIMEX)?.id).toBe("timex");
    expect(bankSpaceFor(MI_ZX81)?.id).toBe("zx81");
    expect(bankSpaceFor(MI_ZX80)?.id).toBe("zx80");
    expect(bankSpaceFor("z88")).toBeUndefined();
    expect(bankSpaceFor("c64")).toBeUndefined();
  });
});

describe("the Next bank space", () => {
  /** Today's functions, kept verbatim as the reference. */
  const oldSite = (slots: number[], address: number) => {
    const page = slots[(address >> 13) & 0x07];
    if (page === undefined || page < 0) return undefined;
    return { bank: page >> 1, bankOffset: (page & 0x01) * 0x2000 + (address & 0x1fff) };
  };
  const oldPartition = (bank: number, offset: number) => bank * 2 + ((offset >> 13) & 0x01);
  const oldAddresses = (offset: number) =>
    Array.from({ length: 8 }, (_, slot) => slot * 0x2000 + (offset & 0x1fff));

  it("gives exactly what the old functions gave", () => {
    const pagings = [
      [-1, -2, 10, 11, 4, 5, 0, 1],
      [-1, -2, 10, 11, 4, 5, 11, 10],
      [14, 15, 3, 8, 222, 223, 0, 7]
    ];
    for (const slots of pagings) {
      for (let address = 0; address <= 0xffff; address += 0x0123) {
        const site = nextBankSpace.siteAt(address, slots);
        const old = oldSite(slots, address);
        expect(site?.kind === "bank" ? { bank: site.bank, bankOffset: site.offset } : undefined).toEqual(old);
      }
    }
    for (const bank of [0, 5, 111]) {
      for (const offset of [0, 0x1fff, 0x2000, 0x3fff]) {
        expect(nextBankSpace.partitionOf({ bank, offset })).toBe(oldPartition(bank, offset));
        expect(nextBankSpace.candidateAddresses({ bank, offset })).toEqual(oldAddresses(offset));
      }
    }
  });

  it("finds a bank whose halves are paged apart and swapped", () => {
    const slots = [-1, -2, 10, 3, 4, 5, 11, 1];
    expect(nextBankSpace.addressesOf({ bank: 5, offset: 0x0100 }, slots)).toEqual([0x4100]);
    expect(nextBankSpace.addressesOf({ bank: 5, offset: 0x2100 }, slots)).toEqual([0xc100]);
    expectRoundTrip(nextBankSpace, slots);
  });

  it("names ROM partitions as ROM sites", () => {
    expect(nextBankSpace.siteAt(0x0100, [-1, -2, 10, 11, 4, 5, 0, 1])).toEqual({
      kind: "rom",
      partition: -1,
      offset: 0x0100
    });
  });
});

describe("the 128K-family bank spaces", () => {
  for (const space of [sp128BankSpace, plus3BankSpace]) {
    it(`${space.id}: round-trips under every RAM bank at $C000`, () => {
      for (let bank = 0; bank < 8; bank++) {
        expectRoundTrip(space, paging16k(-1, 5, 2, bank));
        expectRoundTrip(space, paging16k(-2, 5, 2, bank));
      }
    });

    it(`${space.id}: reads the eight-entry paging as 16K slots (T3)`, () => {
      const slots = paging16k(-1, 5, 2, 7);
      expect(space.siteAt(0x6000, slots)).toEqual({ kind: "bank", bank: 5, offset: 0x2000 });
      expect(space.siteAt(0xe123, slots)).toEqual({ kind: "bank", bank: 7, offset: 0x2123 });
      expect(space.siteAt(0x2000, slots)).toEqual({ kind: "rom", partition: -1, offset: 0x2000 });
    });

    it(`${space.id}: the partition is the bank, armed at the four 16K slots`, () => {
      expect(space.partitionOf({ bank: 7, offset: 0x2100 })).toBe(7);
      expect(space.candidateAddresses({ bank: 7, offset: 0x2100 })).toEqual([
        0x2100, 0x6100, 0xa100, 0xe100
      ]);
    });
  }

  it("plus3: the all-RAM special paging falls out of the same rule", () => {
    // --- $1FFD special mode 4-7-6-3: no ROM anywhere.
    const slots = paging16k(4, 7, 6, 3);
    expectRoundTrip(plus3BankSpace, slots);
    expect(plus3BankSpace.siteAt(0x0010, slots)).toEqual({ kind: "bank", bank: 4, offset: 0x0010 });
  });

  it("finds a bank paged at two slots at both", () => {
    // --- Not reachable on a 128K, but the arithmetic must not assume it cannot happen.
    const slots = paging16k(-1, 5, 2, 5);
    expect(sp128BankSpace.addressesOf({ bank: 5, offset: 0x10 }, slots)).toEqual([0x4010, 0xc010]);
  });

  it("scorpion: sixteen banks", () => {
    expect(scorpionBankSpace.maxBank).toBe(15);
    for (let bank = 0; bank < 16; bank++) expectRoundTrip(scorpionBankSpace, paging16k(-1, 5, 2, bank));
  });
});

describe("the 48K bank space (A3)", () => {
  it("names $4000, $8000 and $C000 as banks 5, 2 and 0 without asking the machine (T2)", () => {
    expect(sp48BankSpace.siteAt(0x4000, [])).toEqual({ kind: "bank", bank: 5, offset: 0 });
    expect(sp48BankSpace.siteAt(0x8123, undefined)).toEqual({ kind: "bank", bank: 2, offset: 0x0123 });
    expect(sp48BankSpace.siteAt(0xffff, [])).toEqual({ kind: "bank", bank: 0, offset: 0x3fff });
    expect(sp48BankSpace.siteAt(0x0d6b, [])).toEqual({ kind: "rom", partition: -1, offset: 0x0d6b });
    expectRoundTrip(sp48BankSpace, []);
  });

  it("has no other banks and no partitions", () => {
    expect(sp48BankSpace.addressesOf({ bank: 7, offset: 0 }, [])).toEqual([]);
    expect(sp48BankSpace.candidateAddresses({ bank: 7, offset: 0 })).toEqual([]);
    expect(sp48BankSpace.partitionOf({ bank: 5, offset: 0 })).toBeUndefined();
  });

  it("names the same bytes as a 128K in 48K mode, so a 48K file carries over", () => {
    const slots = paging16k(-2, 5, 2, 0);
    for (let address = 0x4000; address <= 0xffff; address += 0x0333) {
      expect(sp128BankSpace.siteAt(address, slots)).toEqual(sp48BankSpace.siteAt(address, []));
    }
    expect(annotationMachineWarning("sp48", "sp128")).toBeUndefined();
    expect(annotationMachineWarning("sp48", "next")).toMatch(/bank space/);
  });
});

describe("the Timex bank space", () => {
  const HOME = [-1, -2, 2, 3, 4, 5, 6, 7];

  it("annotates HOME as the 48K", () => {
    expect(timexBankSpace.siteAt(0x8100, HOME)).toEqual({ kind: "bank", bank: 2, offset: 0x0100 });
    expectRoundTrip(timexBankSpace, HOME);
  });

  it("gives no site for a DOCK or EXROM chunk (Q4)", () => {
    const dockAtC000 = [-1, -2, 2, 3, 4, 5, 14, 15];
    expect(timexBankSpace.siteAt(0xc000, dockAtC000)).toBeUndefined();
    expect(timexBankSpace.addressesOf({ bank: 0, offset: 0 }, dockAtC000)).toEqual([]);
    const exromAt0000 = [-3, -4, 2, 3, 4, 5, 6, 7];
    expect(timexBankSpace.siteAt(0x0000, exromAt0000)).toBeUndefined();
  });

  it("scopes a bank breakpoint to the HOME chunk, so it does not fire in a DOCK", () => {
    expect(timexBankSpace.partitionOf({ bank: 0, offset: 0x2100 })).toBe(7);
    expect(timexBankSpace.candidateAddresses({ bank: 0, offset: 0x2100 })).toEqual([0xe100]);
  });
});

describe("the ZX80/ZX81 bank spaces (T11)", () => {
  it("16K: $C000 folds to $4000 and the ROM at $2000 to $0000", () => {
    const space = zx8081BankSpace("zx81", { ramKb: 16, rom8k: true });
    expect(space.canonicalAddress(0xc123)).toBe(0x4123);
    expect(space.canonicalAddress(0x8123)).toBe(0x4123);
    expect(space.canonicalAddress(0x2123)).toBe(0x0123);
    expect(space.siteAt(0xc123, undefined)).toEqual({ kind: "bank", bank: 1, offset: 0x0123 });
    expect(space.siteAt(0x2123, undefined)).toEqual({ kind: "rom", partition: -1, offset: 0x0123 });
    expect(space.addressesOf({ bank: 1, offset: 0x0123 }, undefined)).toEqual([0x4123, 0x8123, 0xc123]);
    expect(zx8081RomAddresses({ ramKb: 16, rom8k: true }, 0x0123)).toEqual([0x0123, 0x2123]);
    expectRoundTrip(space, undefined, 0x0111);
  });

  it("1K: the RAM repeats every kilobyte", () => {
    const space = zx8081BankSpace("zx81", { ramKb: 1, rom8k: true });
    expect(space.canonicalAddress(0x4523)).toBe(0x4123);
    expect(space.addressesOf({ bank: 1, offset: 0x0123 }, undefined)).toHaveLength(48);
    // --- A 1K site above the first kilobyte is not canonical: nothing names it.
    expect(space.addressesOf({ bank: 1, offset: 0x0523 }, undefined)).toEqual([]);
  });

  it("64K: $2000-$FFFF is real RAM, so nothing above the ROM is folded", () => {
    const space = zx8081BankSpace("zx81", { ramKb: 64, rom8k: true });
    expect(space.canonicalAddress(0xc123)).toBe(0xc123);
    expect(space.siteAt(0x2123, undefined)).toEqual({ kind: "bank", bank: 0, offset: 0x2123 });
    expect(space.siteAt(0xc123, undefined)).toEqual({ kind: "bank", bank: 3, offset: 0x0123 });
    expect(space.ramBanks).toEqual([0, 1, 2, 3]);
    expectRoundTrip(space, undefined, 0x0111);
  });

  it("the ZX80's 4K ROM repeats up to the RAM", () => {
    const space = zx8081BankSpace("zx80", { ramKb: 16, rom8k: false });
    expect(space.siteAt(0x1123, undefined)).toEqual({ kind: "rom", partition: -1, offset: 0x0123 });
    expect(zx8081RomAddresses({ ramKb: 16, rom8k: false }, 0x0123)).toEqual([
      0x0123, 0x1123, 0x2123, 0x3123
    ]);
  });

  it("refuses bank breakpoints", () => {
    expect(bankSpaceFor(MI_ZX81, { [MC_MEM_SIZE]: 16 })?.bankBreakpoints).toBe(false);
  });

  it("reads the model from the configuration", () => {
    const space = bankSpaceFor(MI_ZX81, { [MC_MEM_SIZE]: 64 })!;
    expect(space.siteAt(0x2000, undefined)).toEqual({ kind: "bank", bank: 0, offset: 0x2000 });
  });
});

describe("bank breakpoints in each bank space", () => {
  it("a 128K bank breakpoint fires only while its bank is paged", () => {
    const ds = new DebugSupport(undefined, [], sp128BankSpace);
    ds.addBreakpoint({ bank: 7, bankOffset: 0x0100, exec: true });
    expect(ds.shouldStopAt(0xc100, () => 7)).toBe(true);
    expect(ds.shouldStopAt(0xc100, () => 0)).toBe(false);
    // --- Not an 8K page: the high half of bank 7 is still bank 7.
    const ds2 = new DebugSupport(undefined, [], sp128BankSpace);
    ds2.addBreakpoint({ bank: 7, bankOffset: 0x2100, exec: true });
    expect(ds2.shouldStopAt(0xe100, () => 7)).toBe(true);
  });

  it("a 48K bank breakpoint fires at its fixed address, with nothing paged", () => {
    const ds = new DebugSupport(undefined, [], sp48BankSpace);
    ds.addBreakpoint({ bank: 2, bankOffset: 0x0100, exec: true });
    expect(ds.shouldStopAt(0x8100, () => undefined)).toBe(true);
    expect(ds.shouldStopAt(0xc100, () => undefined)).toBe(false);
  });

  it("arms a partitionless site with ANY_PARTITION", () => {
    expect(ANY_PARTITION).not.toBe(-1);
    const ds = new DebugSupport(undefined, [], sp48BankSpace);
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0000, exec: true, disabled: true });
    expect(ds.shouldStopAt(0x4000, () => undefined)).toBe(false);
    ds.enableBreakpoint({ bank: 5, bankOffset: 0x0000, exec: true }, true);
    expect(ds.shouldStopAt(0x4000, () => undefined)).toBe(true);
  });

  it("keeps the Next's arithmetic by default", () => {
    const ds = new DebugSupport(undefined, []);
    ds.addBreakpoint({ bank: 5, bankOffset: 0x2100, exec: true });
    expect(ds.shouldStopAt(0x6100, () => 11)).toBe(true);
    expect(ds.shouldStopAt(0x6100, () => 10)).toBe(false);
  });
});
