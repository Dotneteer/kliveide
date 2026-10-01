import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { unzipSync, zipSync } from "fflate";

import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";
import {
  formatZ88Rtc,
  z88AddressLocation,
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
