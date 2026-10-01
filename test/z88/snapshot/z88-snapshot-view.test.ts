import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { unzipSync, zipSync } from "fflate";

import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";
import {
  filterZ88Banks,
  formatZ88Mirrors,
  formatZ88Rtc,
  z88AddressLocation,
  z88BankMirrors,
  z88BankPlacements,
  z88SlotBrowserItems,
  z88SlotFilters,
  z88BankDisassemblyBase,
  z88BankOwner,
  z88BlinkBitNames,
  z88PagedRanges,
  z88ViewedCards,
  type Z88SnapshotFileInfo
} from "@renderer/appIde/DocumentPanels/Z88/z88SnapshotView";

/*
 * What the `.z88` viewer shows (`.plans/Z88_SNAPSHOT_PLAN.md` §4.8, Phase 5), without React. The
 * sample's values come from its `snapshot.settings`.
 */

const SAMPLE = new Uint8Array(readFileSync(join(__dirname, "fixtures", "mm+jsw-oz5.z88")));

function infoOf(bytes: Uint8Array): Z88SnapshotFileInfo {
  const snapshot = parseZ88Snapshot(bytes);
  return { snapshot, mapping: mapZ88SnapshotToKlive(snapshot) };
}

/** The sample with settings replaced and members added */
function sampleWith(settings: Record<string, string>, members: Record<string, Uint8Array> = {}): Uint8Array {
  const entries = unzipSync(SAMPLE);
  let text = new TextDecoder("latin1").decode(entries["snapshot.settings"]);
  for (const [key, value] of Object.entries(settings)) {
    text = text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }
  entries["snapshot.settings"] = new TextEncoder().encode(text);
  return zipSync({ ...entries, ...members });
}

const sample = infoOf(SAMPLE);

describe("Z88 snapshot viewer - Blink bits", () => {
  it.each([
    ["COM", 0x05, "RAMS LCDON"],
    ["COM", 0x00, "none"],
    ["COM", 0xff, "SRUN SBIT OVERP RESTIM PROGRAM RAMS VPPON LCDON"],
    ["INT", 0x3b, "FLAP UART BTL TIME GINT"],
    ["STA", 0x05, "KEY TIME"],
    ["STA", 0x02, "none"],
    ["TMK", 0x07, "MIN SEC TICK"],
    ["TSTA", 0xf8, "none"]
  ] as const)("%s = $%i reads %s", (register, value, names) => {
    expect(z88BlinkBitNames(register, value)).toBe(names);
  });
});

describe("Z88 snapshot viewer - paging", () => {
  it("names the bank behind each range, as SR0-SR3 and COM.RAMS page them", () => {
    expect(z88PagedRanges(sample.snapshot)).toEqual([
      { start: 0x0000, end: 0x1fff, bank: 0x20, offset: 0x0000, owner: "RAM" },
      { start: 0x2000, end: 0x3fff, bank: 0x21, offset: 0x2000, owner: "RAM" },
      { start: 0x4000, end: 0x7fff, bank: 0x22, offset: 0x0000, owner: "RAM" },
      { start: 0x8000, end: 0xbfff, bank: 0xbe, offset: 0x0000, owner: "Slot 2" },
      { start: 0xc000, end: 0xffff, bank: 0xbf, offset: 0x0000, owner: "Slot 2" }
    ]);
  });

  it("pages ROM bank 0 into $0000 without COM.RAMS", () => {
    const info = infoOf(sampleWith({ COM: "01" }));
    expect(z88PagedRanges(info.snapshot)[0]).toMatchObject({ bank: 0x00, owner: "ROM" });
  });

  it("locates PC: $F523 is bank $BF, offset $3523", () => {
    expect(z88AddressLocation(sample.snapshot, 0xf523)).toEqual({ bank: 0xbf, offset: 0x3523 });
  });

  it("locates an address in SR0's half bank", () => {
    // --- SR0 = $21: the upper 8K of bank $20
    expect(z88AddressLocation(sample.snapshot, 0x2005)).toEqual({ bank: 0x20, offset: 0x2005 });
  });

  it("names an empty slot", () => {
    expect(z88BankOwner(sample.snapshot, 0x40)).toBe("empty");
  });
});

describe("Z88 snapshot viewer - cards", () => {
  it("lists slot 0's ROM and RAM, then the occupied slots, with their banks", () => {
    const cards = z88ViewedCards(sample);
    expect(
      cards.map(({ key, title, typeName, sizeK, klive, loadable, banks }) => ({
        key,
        title,
        typeName,
        sizeK,
        klive,
        loadable,
        banks: banks.map((b) => b.bank)
      }))
    ).toEqual([
      {
        key: "rom",
        title: "Slot 0: ROM area",
        typeName: "AMD Flash (29F)",
        sizeK: 512,
        klive: "AMDF29F040B",
        loadable: true,
        banks: Array.from({ length: 32 }, (_, i) => i)
      },
      {
        key: "ram",
        title: "Slot 0: internal RAM",
        typeName: "RAM",
        sizeK: 128,
        klive: "internal RAM",
        loadable: true,
        banks: Array.from({ length: 8 }, (_, i) => 0x20 + i)
      },
      {
        key: "slot2",
        title: "Slot 2",
        typeName: "UV EPROM (27C)",
        sizeK: 32,
        klive: "EPROMUV32",
        loadable: true,
        banks: [0x80, 0x81]
      },
      {
        key: "slot3",
        title: "Slot 3",
        typeName: "UV EPROM (27C)",
        sizeK: 32,
        klive: "EPROMUV32",
        loadable: true,
        banks: [0xc0, 0xc1]
      }
    ]);
  });

  it("hands each bank its own 16K", () => {
    const rom = z88ViewedCards(sample)[0];
    expect(rom.banks[1].bytes).toEqual(sample.snapshot.rom.bytes.subarray(0x4000, 0x8000));
  });

  it("shows a hybrid card, both halves, as not loadable", () => {
    const info = infoOf(
      sampleWith(
        { SLOT1TYPE: "8" },
        { "ram1.bin": new Uint8Array(0x8_0000), "flash1.bin": new Uint8Array(0x8_0000) }
      )
    );
    const slot1 = z88ViewedCards(info).find((c) => c.key === "slot1")!;
    expect(slot1).toMatchObject({
      typeName: "AMD hybrid 512K Flash + 512K RAM",
      sizeK: 1024,
      klive: "hybrid cards are not supported",
      loadable: false
    });
    expect(slot1.banks.map((b) => b.bank)).toEqual(Array.from({ length: 64 }, (_, i) => 0x40 + i));
  });

  it("disassembles a bank where the snapshot pages it, through the card's mirrors", () => {
    // --- Slot 2 holds a 32K EPROM (banks $80-$81); SR2 = $BE and SR3 = $BF are its mirrors
    expect(z88BankDisassemblyBase(sample.snapshot, 0x80, 2)).toBe(0x8000);
    expect(z88BankDisassemblyBase(sample.snapshot, 0x81, 2)).toBe(0xc000);
    // --- Internal RAM: SR1 = $22
    expect(z88BankDisassemblyBase(sample.snapshot, 0x22, 8)).toBe(0x4000);
  });

  it("disassembles a bank that is not paged in at $C000", () => {
    expect(z88BankDisassemblyBase(sample.snapshot, 0x00, 32)).toBe(0xc000);
    expect(z88BankDisassemblyBase(sample.snapshot, 0x25, 8)).toBe(0xc000);
    // --- Slot 3's banks are not paged in, though $C0/$C1 share their low bits with $80/$81
    expect(z88BankDisassemblyBase(sample.snapshot, 0xc1, 2)).toBe(0xc000);
  });
});

/*
 * The Slots browser's rows (`.plans/Z88_SLOT_BROWSER_PLAN.md` §4.2). The sample pages: COM.RAMS (bank
 * $20 at $0000), SR0 = $21 (the upper 8K of $20), SR1 = $22, SR2 = $BE and SR3 = $BF (the 32K EPROM
 * of slot 2 through its mirrors: $80 and $81). PC = $F523.
 */
describe("Z88 snapshot viewer - slot browser items", () => {
  const items = z88SlotBrowserItems(sample);
  const itemOf = (bank: number) => items.find((item) => item.bank === bank)!;

  it("has one item per bank of every card, in card order", () => {
    expect(items).toHaveLength(32 + 8 + 2 + 2);
    expect(items.map((item) => item.cardKey).filter((k, i, all) => all.indexOf(k) === i)).toEqual([
      "rom",
      "ram",
      "slot2",
      "slot3"
    ]);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });

  it("places a mirrored bank where the snapshot pages it, with PC in it", () => {
    expect(itemOf(0x81)).toMatchObject({
      placements: [{ name: "SR3", start: 0xc000, end: 0xffff, offset: 0 }],
      pc: 0xf523,
      listedAt: 0xc000
    });
    expect(itemOf(0x80).placements.map((p) => p.name)).toEqual(["SR2"]);
    expect(itemOf(0x80).pc).toBeUndefined();
  });

  it("places internal RAM bank $20 at $0000 (COM.RAMS) and at $2000 (SR0's upper half)", () => {
    expect(itemOf(0x20).placements).toEqual([
      { name: "$0000", start: 0x0000, end: 0x1fff, offset: 0x0000 },
      { name: "SR0", start: 0x2000, end: 0x3fff, offset: 0x2000 }
    ]);
    expect(itemOf(0x22).placements.map((p) => p.name)).toEqual(["SR1"]);
  });

  it("does not place a bank that only shares low bits with a paged one", () => {
    expect(itemOf(0xc1).placements).toEqual([]);
    expect(itemOf(0x00).placements).toEqual([]);
  });

  it("puts SP in the bank that holds it", () => {
    const sp = sample.snapshot.cpu.sp;
    const holders = items.filter((item) => item.sp !== undefined);
    expect(holders).toHaveLength(1);
    expect(holders[0].sp).toBe(sp);
    expect(
      holders[0].placements.some((p) => sp >= p.start && sp <= p.end)
    ).toBe(true);
  });

  it("calls a bank empty by its card's erased value", () => {
    expect(itemOf(0x80).erasedValue).toBe(0xff);
    expect(itemOf(0x20).erasedValue).toBe(0x00);
    expect(itemOf(0x00).erasedValue).toBe(0xff);
    // --- The sample's slot 3 EPROM: whatever it holds, `empty` means "only the erased value"
    const c0 = z88ViewedCards(sample).find((c) => c.key === "slot3")!.banks[0].bytes;
    expect(itemOf(0xc0).empty).toBe(c0.every((v) => v === 0xff));
  });

  it("lists a small card's mirrors, and none for a card that fills its area", () => {
    expect(itemOf(0x81).mirrors).toEqual(Array.from({ length: 31 }, (_, i) => 0x83 + 2 * i));
    expect(itemOf(0x00).mirrors).toEqual([]);
    expect(itemOf(0x22).mirrors).toEqual([0x2a, 0x32, 0x3a]);
    expect(z88BankMirrors(0x81, 2)[30]).toBe(0xbf);
    expect(formatZ88Mirrors(itemOf(0x81).mirrors)).toBe("$83, $85, ... $BF (31 banks)");
    expect(formatZ88Mirrors([0x2a, 0x32, 0x3a])).toBe("$2A, $32, $3A");
    expect(formatZ88Mirrors([])).toBe("none");
  });

  it("pops RAM out as memory and code as disassembly, unless a view was used last", () => {
    expect(itemOf(0x20).lastView).toBe("memory");
    expect(itemOf(0x81).lastView).toBe("disassembly");
    expect(z88SlotBrowserItems(sample, { 0x81: "memory" }).find((i) => i.bank === 0x81)!.lastView).toBe(
      "memory"
    );
  });

  it("counts the snapshot's breakpoints in a bank, through its mirrors", () => {
    const info = infoOf(sampleWith({ Breakpoints: "BF3523,810100,dC00010" }));
    const withBps = z88SlotBrowserItems(info);
    const bank81 = withBps.find((i) => i.bank === 0x81)!;
    expect(bank81.breakpoints).toEqual(
      info.snapshot.breakpoints
        .filter((bp) => bp.bank === 0xbf || bp.bank === 0x81)
        .map((bp) => ({ offset: bp.offset, display: bp.display }))
    );
    expect(bank81.breakpoints.length).toBe(2);
  });

  it("splits a hybrid card into halves that do not mirror each other", () => {
    const info = infoOf(
      sampleWith(
        { SLOT1TYPE: "8" },
        { "ram1.bin": new Uint8Array(0x8_0000), "flash1.bin": new Uint8Array(0x8_0000).fill(0xff) }
      )
    );
    const hybrid = z88SlotBrowserItems(info).filter((i) => i.cardKey === "slot1");
    expect(hybrid[0]).toMatchObject({ bank: 0x40, half: "RAM", erasedValue: 0, empty: true, mirrors: [] });
    expect(hybrid[32]).toMatchObject({ bank: 0x60, half: "flash", erasedValue: 0xff, empty: true });
    expect(z88BankPlacements(info.snapshot, 0x60, 64)).toEqual([]);
  });

  it("filters to non-empty, paged-in, or one card's banks", () => {
    expect(filterZ88Banks(items, "pagedIn").map((i) => i.bank)).toEqual([0x20, 0x22, 0x80, 0x81]);
    expect(filterZ88Banks(items, "slot2").map((i) => i.bank)).toEqual([0x80, 0x81]);
    expect(filterZ88Banks(items, "nonEmpty").every((i) => !i.empty)).toBe(true);
    expect(filterZ88Banks(items, "all")).toBe(items);
    expect(z88SlotFilters(z88ViewedCards(sample)).map((f) => f.text)).toEqual([
      "All",
      "Non-empty",
      "Paged in",
      "ROM",
      "RAM",
      "Slot 2",
      "Slot 3"
    ]);
  });
});

describe("Z88 snapshot viewer - RTC", () => {
  it("formats the sample's RTC: 12 minutes, 41.405 seconds", () => {
    // --- TIM2 = $0C, TIM1 = $29 (41), TIM0 = $51 (81 x 5 ms)
    expect(formatZ88Rtc(sample.snapshot.blink.tim)).toBe("00:12:41.405");
  });

  it("adds days when there are any", () => {
    // --- TIM3 = 6: 6 x 256 minutes = 25h 36m
    expect(formatZ88Rtc([0, 0, 0, 6, 0])).toBe("1d 01:36:00.000");
  });
});
