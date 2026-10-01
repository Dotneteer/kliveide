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
  /** Every bank of the card, with its contents */
  banks: { bank: number; bytes: Uint8Array }[];
};

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
    banks: banksOf(snapshot.rom.bytes, 0x00)
  });
  cards.push({
    key: "ram",
    title: "Slot 0: internal RAM",
    typeName: ozvmCardTypeName(2),
    sizeK: snapshot.ram.length / 1024,
    klive: mapping.intRamMask !== undefined ? `internal RAM` : "size not supported",
    loadable: mapping.intRamMask !== undefined,
    banks: banksOf(snapshot.ram, Z88_INTERNAL_RAM_BANK)
  });

  for (let slot = 1; slot <= 3; slot++) {
    const card = snapshot.slots[slot];
    if (!card) continue;
    const base = slot << 6;
    const hybrid = Z88_OZVM_HYBRID_TYPES.includes(card.ozvmType);
    const banks = hybrid
      ? [...banksOf(card.ram, base), ...banksOf(card.flash, base + 0x20)]
      : banksOf(card.bytes, base);
    const mapped = mapping.slots[slot];
    cards.push({
      key: `slot${slot}`,
      title: `Slot ${slot}`,
      typeName: ozvmCardTypeName(card.ozvmType),
      sizeK: banks.length * (Z88_BANK_SIZE / 1024),
      klive: mapped ? mapped.cardType : hybrid ? "hybrid cards are not supported" : "not supported",
      loadable: !!mapped,
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
 * The address a bank's disassembly starts at: where the snapshot has it paged in (SR3 first, as the
 * segment most code runs in), else $C000 - the segment an application bank usually runs in.
 *
 * A card smaller than its slot is mirrored across it, so a segment register can name the bank
 * through any of its mirrors: a 32K card in slot 2 has banks $80 and $81, and SR3 = $BF pages $81.
 * @param snapshot The parsed snapshot
 * @param bank The bank number
 * @param cardBanks The number of banks of the card (or slot-0 area) holding it
 */
export function z88BankDisassemblyBase(snapshot: Z88Snapshot, bank: number, cardBanks: number): number {
  const base = areaBase(bank);
  const index = (bank - base) % cardBanks;
  const { sr } = snapshot.blink;
  for (const segment of [3, 2, 1]) {
    const paged = sr[segment];
    if (areaBase(paged) === base && (paged - base) % cardBanks === index) {
      return segment * 0x4000;
    }
  }
  return 0xc000;
}

/** The first bank of the area a bank belongs to: slot 0's ROM ($00) or RAM ($20), or a slot */
function areaBase(bank: number): number {
  return bank < 0x40 ? bank & 0x20 : bank & 0xc0;
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
