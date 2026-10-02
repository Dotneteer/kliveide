/*
 * What the `.z88` viewer shows, computed without React (`.plans/Z88_SNAPSHOT_PLAN.md` §4.8): the
 * Blink registers' bit names, which bank each address range holds, each slot's banks, and the RTC
 * as a duration. The panel only lays these out.
 */

import type { Z88Snapshot } from "@common/z88/z88Snapshot";
import type { Z88SnapshotMapping } from "@common/z88/z88SnapshotMapping";

import { Z88_BANK_SIZE, Z88_INTERNAL_RAM_BANK, Z88_OZVM_HYBRID_TYPES } from "@common/z88/z88Snapshot";
import { decodeZ88Tim, type Z88Tim } from "@common/z88/z88Rtc";
import { ozvmCardTypeName } from "@common/z88/z88SnapshotMapping";

/** The parsed file and its mapping: the viewer's `fileInfo` */
export type Z88SnapshotFileInfo = {
  snapshot: Z88Snapshot;
  mapping: Z88SnapshotMapping;
};

/** Blink register bits, most significant first (Z88 Developers' Notes, "Blink") */
const COM_BITS = ["SRUN", "SBIT", "OVERP", "RESTIM", "PROGRAM", "RAMS", "VPPON", "LCDON"];
const INT_BITS = ["KWAIT", "A19", "FLAP", "UART", "BTL", "KEY", "TIME", "GINT"];
const STA_BITS = ["FLAPOPEN", "A19", "FLAP", "UART", "BTL", "KEY", "", "TIME"];
const RTC_BITS = ["", "", "", "", "", "MIN", "SEC", "TICK"];

/** The Blink registers whose bits have names */
export type Z88BlinkBitRegister = "COM" | "INT" | "STA" | "TMK" | "TSTA";

const BIT_NAMES: Record<Z88BlinkBitRegister, string[]> = {
  COM: COM_BITS,
  INT: INT_BITS,
  STA: STA_BITS,
  TMK: RTC_BITS,
  TSTA: RTC_BITS
};

/**
 * The names of a Blink register's set bits, most significant first; "none" when no named bit is set.
 * @param register The register
 * @param value Its value
 */
export function z88BlinkBitNames(register: Z88BlinkBitRegister, value: number): string {
  const names = BIT_NAMES[register].filter((name, index) => name && value & (0x80 >> index));
  return names.length > 0 ? names.join(" ") : "none";
}

/**
 * What a bank number holds in the snapshot: "ROM", "RAM" (internal), "Slot n", or "empty" when no
 * card answers there.
 * @param snapshot The parsed snapshot
 * @param bank The bank number
 */
export function z88BankOwner(snapshot: Z88Snapshot, bank: number): string {
  const slot = bank >> 6;
  if (slot === 0) {
    return bank < Z88_INTERNAL_RAM_BANK ? "ROM" : "RAM";
  }
  return snapshot.slots[slot] ? `Slot ${slot}` : "empty";
}

/** One address range of the 64K and the bank behind it */
export type Z88PagedRange = {
  start: number;
  end: number;
  bank: number;
  /** The offset within the bank where the range starts */
  offset: number;
  owner: string;
};

/** COM.RAMS: internal RAM at $0000-$1FFF */
const COM_RAMS = 0x04;

/**
 * The five ranges the Blink pages, as the core pages them (`buildZ88AddressSpace` agrees).
 * @param snapshot The parsed snapshot
 */
export function z88PagedRanges(snapshot: Z88Snapshot): Z88PagedRange[] {
  const { sr, com } = snapshot.blink;
  const low = com & COM_RAMS ? Z88_INTERNAL_RAM_BANK : 0x00;
  const ranges: Omit<Z88PagedRange, "owner">[] = [
    { start: 0x0000, end: 0x1fff, bank: low, offset: 0x0000 },
    { start: 0x2000, end: 0x3fff, bank: sr[0], offset: (sr[0] & 0x01) * 0x2000 },
    { start: 0x4000, end: 0x7fff, bank: sr[1], offset: 0x0000 },
    { start: 0x8000, end: 0xbfff, bank: sr[2], offset: 0x0000 },
    { start: 0xc000, end: 0xffff, bank: sr[3], offset: 0x0000 }
  ];
  return ranges.map((range) => ({ ...range, owner: z88BankOwner(snapshot, range.bank) }));
}

/**
 * Where an address lives: its range's bank and the offset within that bank.
 * @param snapshot The parsed snapshot
 * @param address A 64K address
 */
export function z88AddressLocation(
  snapshot: Z88Snapshot,
  address: number
): { bank: number; offset: number } {
  const range = z88PagedRanges(snapshot).find((r) => address >= r.start && address <= r.end)!;
  // --- SR0's bank shows an 8K half in $2000-$3FFF; it is the bank with bit 0 cleared
  const bank = range.start === 0x2000 ? range.bank & 0xfe : range.bank;
  return { bank, offset: range.offset + (address - range.start) };
}

/** A card the viewer lists: a slot's card, or slot 0's ROM and internal RAM */
export type Z88ViewedCard = {
  /** Unique within the snapshot: "rom", "ram", "slot1".."slot3" */
  key: string;
  title: string;
  /** OZvm's type name */
  typeName: string;
  sizeK: number;
  /** The Klive card it loads as, or why it cannot be loaded */
  klive: string;
  loadable: boolean;
  /** OZvm's type code: the internal RAM is 2 */
  ozvmType: number;
  /** Every bank of the card, with its contents; a hybrid card's banks say which half they are in */
  banks: { bank: number; bytes: Uint8Array; half?: Z88HybridHalf }[];
};

/** Which half of a hybrid (RAM + Flash) card a bank is in */
export type Z88HybridHalf = "RAM" | "flash";

/**
 * Every card of the snapshot, slot 0's ROM and RAM first, with its banks.
 * @param info The parsed snapshot and its mapping
 */
export function z88ViewedCards(info: Z88SnapshotFileInfo): Z88ViewedCard[] {
  const { snapshot, mapping } = info;
  const cards: Z88ViewedCard[] = [];

  const romType = snapshot.rom.ozvmType ?? 1;
  const rom = mapping.slots[0];
  cards.push({
    key: "rom",
    title: "Slot 0: ROM area",
    typeName: ozvmCardTypeName(romType),
    sizeK: snapshot.rom.bytes.length / 1024,
    klive: rom ? rom.cardType : "not supported in slot 0",
    loadable: !!rom,
    ozvmType: romType,
    banks: banksOf(snapshot.rom.bytes, 0x00)
  });
  cards.push({
    key: "ram",
    title: "Slot 0: internal RAM",
    typeName: ozvmCardTypeName(2),
    sizeK: snapshot.ram.length / 1024,
    klive: mapping.intRamMask !== undefined ? `internal RAM` : "size not supported",
    loadable: mapping.intRamMask !== undefined,
    ozvmType: 2,
    banks: banksOf(snapshot.ram, Z88_INTERNAL_RAM_BANK)
  });

  for (let slot = 1; slot <= 3; slot++) {
    const card = snapshot.slots[slot];
    if (!card) continue;
    const base = slot << 6;
    const hybrid = Z88_OZVM_HYBRID_TYPES.includes(card.ozvmType);
    const banks = hybrid
      ? [
          ...banksOf(card.ram, base).map((b) => ({ ...b, half: "RAM" as const })),
          ...banksOf(card.flash, base + 0x20).map((b) => ({ ...b, half: "flash" as const }))
        ]
      : banksOf(card.bytes, base);
    const mapped = mapping.slots[slot];
    cards.push({
      key: `slot${slot}`,
      title: `Slot ${slot}`,
      typeName: ozvmCardTypeName(card.ozvmType),
      sizeK: banks.length * (Z88_BANK_SIZE / 1024),
      klive: mapped ? mapped.cardType : hybrid ? "hybrid cards are not supported" : "not supported",
      loadable: !!mapped,
      ozvmType: card.ozvmType,
      banks
    });
  }
  return cards;
}

function banksOf(image: Uint8Array | undefined, firstBank: number): { bank: number; bytes: Uint8Array }[] {
  const banks: { bank: number; bytes: Uint8Array }[] = [];
  if (!image) return banks;
  for (let i = 0; i * Z88_BANK_SIZE < image.length; i++) {
    banks.push({
      bank: firstBank + i,
      bytes: image.subarray(i * Z88_BANK_SIZE, (i + 1) * Z88_BANK_SIZE)
    });
  }
  return banks;
}

/**
 * Whether the bank a segment register (or the fixed lower 8K) names is `bank`, through the card's
 * mirrors: a card smaller than its slot answers across the whole slot, so a 32K card in slot 2 has
 * banks $80 and $81, and SR3 = $BF pages $81.
 */
function sameBankThroughMirrors(named: number, bank: number, cardBanks: number): boolean {
  const base = areaBase(bank);
  return areaBase(named) === base && (named - base) % cardBanks === (bank - base) % cardBanks;
}

/** Where the snapshot pages a bank in: one of the five ranges of `z88PagedRanges` */
export type Z88BankPlacement = {
  /** "SR0"-"SR3", or "$0000" for the fixed lower 8K (bank $00, or $20 with COM.RAMS) */
  name: string;
  /** The address range the bank's bytes appear at */
  start: number;
  end: number;
  /** The offset within the bank where the range starts (an odd SR0 shows the upper 8K) */
  offset: number;
};

/**
 * Every range the snapshot pages a bank into, through the card's mirrors.
 * @param snapshot The parsed snapshot
 * @param bank The bank number
 * @param cardBanks The number of banks of the card (or slot-0 area) holding it
 */
export function z88BankPlacements(
  snapshot: Z88Snapshot,
  bank: number,
  cardBanks: number
): Z88BankPlacement[] {
  return z88PagedRanges(snapshot)
    .map((range, index) => ({
      range,
      // --- SR0's bank shows an 8K half in $2000-$3FFF; it is the bank with bit 0 cleared
      named: range.start === 0x2000 ? range.bank & 0xfe : range.bank,
      name: index === 0 ? "$0000" : `SR${index - 1}`
    }))
    .filter(({ named }) => sameBankThroughMirrors(named, bank, cardBanks))
    .map(({ range, name }) => ({ name, start: range.start, end: range.end, offset: range.offset }));
}

/**
 * The address a bank's disassembly starts at: where the snapshot has it paged in (SR3 first, as the
 * segment most code runs in), else $C000 - the segment an application bank usually runs in.
 * @param snapshot The parsed snapshot
 * @param bank The bank number
 * @param cardBanks The number of banks of the card (or slot-0 area) holding it
 */
export function z88BankDisassemblyBase(snapshot: Z88Snapshot, bank: number, cardBanks: number): number {
  const { sr } = snapshot.blink;
  for (const segment of [3, 2, 1]) {
    if (sameBankThroughMirrors(sr[segment], bank, cardBanks)) {
      return segment * 0x4000;
    }
  }
  return 0xc000;
}

/** The first bank of the area a bank belongs to: slot 0's ROM ($00) or RAM ($20), or a slot */
function areaBase(bank: number): number {
  return bank < 0x40 ? bank & 0x20 : bank & 0xc0;
}

/** The number of bank numbers an area answers to: 32 for slot 0's halves, 64 for a slot */
function areaSize(bank: number): number {
  return bank < 0x40 ? 0x20 : 0x40;
}

/**
 * The other bank numbers a bank answers to in its area, when its card is smaller than the area.
 * @param bank The bank number
 * @param cardBanks The number of banks of the card (or slot-0 area) holding it
 */
export function z88BankMirrors(bank: number, cardBanks: number): number[] {
  const base = areaBase(bank);
  const mirrors: number[] = [];
  for (let other = bank + cardBanks; other < base + areaSize(bank); other += cardBanks) {
    mirrors.push(other);
  }
  return mirrors;
}

/** The mirrors as a short phrase: "none", "$81, $83" or "$83, $85, ... $BF (31 banks)" */
export function formatZ88Mirrors(mirrors: number[]): string {
  const hex = (bank: number) => `$${bank.toString(16).toUpperCase().padStart(2, "0")}`;
  if (mirrors.length === 0) return "none";
  if (mirrors.length <= 3) return mirrors.map(hex).join(", ");
  return `${hex(mirrors[0])}, ${hex(mirrors[1])}, ... ${hex(mirrors[mirrors.length - 1])} (${mirrors.length} banks)`;
}

/**
 * The value an erased (never written) byte of a card reads: `$00` for RAM, `$FF` for ROM, EPROM and
 * Flash. A bank holding only that value is shown as empty.
 * @param card The card
 * @param half The hybrid half the bank is in, if any
 */
export function z88ErasedValue(card: Z88ViewedCard, half?: Z88HybridHalf): number {
  if (half) return half === "RAM" ? 0x00 : 0xff;
  return card.ozvmType === 2 ? 0x00 : 0xff;
}

/** The views a Z88 bank pops out in */
export type Z88BankView = "memory" | "disassembly";

/** One row of the Slots browser */
export type Z88BankItem = {
  key: string;
  bank: number;
  /** The card the bank belongs to: its `Z88ViewedCard.key` */
  cardKey: string;
  half?: Z88HybridHalf;
  size: number;
  /** Every byte is the card's erased value */
  empty: boolean;
  erasedValue: number;
  placements: Z88BankPlacement[];
  /** The program counter, when a range this bank is paged into holds it */
  pc?: number;
  sp?: number;
  /** The snapshot's own (OZvm) breakpoints in this bank, as offsets within it */
  breakpoints: Z88SnapshotBreakpointView[];
  mirrors: number[];
  /** The address byte 0 is disassembled at */
  listedAt: number;
  lastView: Z88BankView;
};

/** An OZvm breakpoint as the browser lists it */
export type Z88SnapshotBreakpointView = { offset: number; display: boolean };

/**
 * One item per bank of every card, in the viewer's card order.
 * @param info The parsed snapshot and its mapping
 * @param lastViews The view each bank last popped out in (the viewer's view state)
 */
export function z88SlotBrowserItems(
  info: Z88SnapshotFileInfo,
  lastViews: Record<number, Z88BankView> = {}
): Z88BankItem[] {
  const { snapshot } = info;
  const { pc, sp } = snapshot.cpu;
  const items: Z88BankItem[] = [];
  for (const card of z88ViewedCards(info)) {
    const hybrid = card.banks.some((b) => b.half);
    // --- A hybrid's halves are separate chips at fixed places, so neither mirrors the other.
    const cardBanks = hybrid ? areaSize(card.banks[0].bank) : card.banks.length;
    for (const { bank, bytes, half } of card.banks) {
      const erasedValue = z88ErasedValue(card, half);
      const placements = z88BankPlacements(snapshot, bank, cardBanks);
      const holds = (address: number) =>
        placements.some((p) => address >= p.start && address <= p.end);
      const isRam = erasedValue === 0x00;
      items.push({
        key: `${bank}`,
        bank,
        cardKey: card.key,
        half,
        size: bytes.length,
        empty: bytes.every((value) => value === erasedValue),
        erasedValue,
        placements,
        pc: holds(pc) ? pc : undefined,
        sp: holds(sp) ? sp : undefined,
        breakpoints: snapshot.breakpoints
          .filter((bp) => sameBankThroughMirrors(bp.bank, bank, cardBanks))
          .map((bp) => ({ offset: bp.offset, display: bp.display })),
        mirrors: hybrid ? [] : z88BankMirrors(bank, cardBanks),
        listedAt: z88BankDisassemblyBase(snapshot, bank, cardBanks),
        lastView: lastViews[bank] ?? (isRam ? "memory" : "disassembly")
      });
    }
  }
  return items;
}

/** The Slots browser's filters: everything, non-empty or paged-in banks, or one card */
export type Z88SlotFilter = "all" | "nonEmpty" | "pagedIn" | string;

/**
 * The filter buttons: the three general ones, then one per card present.
 * @param cards The snapshot's cards
 */
export function z88SlotFilters(cards: Z88ViewedCard[]): { value: string; text: string }[] {
  const names: Record<string, string> = { rom: "ROM", ram: "RAM" };
  return [
    { value: "all", text: "All" },
    { value: "nonEmpty", text: "Non-empty" },
    { value: "pagedIn", text: "Paged in" },
    ...cards.map((card) => ({
      value: card.key,
      text: names[card.key] ?? card.title
    }))
  ];
}

/**
 * The items a filter leaves.
 * @param items Every bank
 * @param filter The filter: general, or a card's key
 */
export function filterZ88Banks(items: Z88BankItem[], filter: Z88SlotFilter): Z88BankItem[] {
  switch (filter) {
    case "all":
      return items;
    case "nonEmpty":
      return items.filter((item) => !item.empty);
    case "pagedIn":
      return items.filter((item) => item.placements.length > 0);
    default:
      return items.filter((item) => item.cardKey === filter);
  }
}

/**
 * The RTC as a duration: "1d 02:03:04.250" (days only when there are any).
 * @param tim TIM0..TIM4
 */
export function formatZ88Rtc(tim: Z88Tim): string {
  const totalMs = decodeZ88Tim(tim);
  const days = Math.floor(totalMs / 86_400_000);
  const hours = Math.floor(totalMs / 3_600_000) % 24;
  const minutes = Math.floor(totalMs / 60_000) % 60;
  const seconds = Math.floor(totalMs / 1000) % 60;
  const ms = totalMs % 1000;
  const pad = (value: number, width = 2) => value.toString().padStart(width, "0");
  const time = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
  return days > 0 ? `${days}d ${time}` : time;
}
