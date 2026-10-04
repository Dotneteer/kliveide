/*
 * The React-free part of the ZX Spectrum snapshot viewer (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md`
 * §4.8): paging decoded, the 64K as the snapshot pages it, the bank list, and the AY registers in
 * words. The panel only lays these out.
 */

import {
  SPECTRUM_BANK_SIZE,
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine,
  type SpectrumSnapshot
} from "@common/spectrum/snapshot/spectrumSnapshot";
import type { SpectrumSnapshotMapping } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import type { BankBrowserItem } from "@renderer/controls/bankBrowser/BankBrowser";

/** What the viewer's loader produces */
export type SpectrumSnapshotFileInfo = {
  snapshot: SpectrumSnapshot;
  mapping: SpectrumSnapshotMapping;
};

/** $7FFD in words */
export type Port7ffdState = { bank: number; shadowScreen: boolean; rom: number; locked: boolean };

export function decode7ffd(value: number): Port7ffdState {
  return {
    bank: value & 0x07,
    shadowScreen: (value & 0x08) !== 0,
    rom: (value >> 4) & 0x01,
    locked: (value & 0x20) !== 0
  };
}

/** $1FFD in words */
export type Port1ffdState = {
  specialPaging: boolean;
  /** Special paging: the configuration (0-3); normal paging: the high bit of the ROM number */
  config: number;
  motorOn: boolean;
  printerStrobe: boolean;
};

export function decode1ffd(value: number): Port1ffdState {
  return {
    specialPaging: (value & 0x01) !== 0,
    config: (value >> 1) & 0x03,
    motorOn: (value & 0x08) !== 0,
    printerStrobe: (value & 0x10) !== 0
  };
}

/** The banks of the +2A/+3 special paging configurations, $0000-$FFFF */
const SPECIAL_CONFIGS: number[][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [4, 5, 6, 3],
  [4, 7, 6, 3]
];

/** What one 16K slot of the address space holds */
export type PagedRange = {
  start: number;
  end: number;
  /** A RAM bank, or undefined for ROM */
  bank?: number;
  /** The ROM page, for a ROM slot */
  rom?: number;
};

/** The four 16K slots of the 64K, as the snapshot pages them */
export function spectrumPagedRanges(snapshot: SpectrumSnapshot): PagedRange[] {
  const slot = (i: number, r: Omit<PagedRange, "start" | "end">): PagedRange => ({
    start: i * SPECTRUM_BANK_SIZE,
    end: i * SPECTRUM_BANK_SIZE + SPECTRUM_BANK_SIZE - 1,
    ...r
  });
  if (!isPagedSnapshotMachine(snapshot.machine)) {
    return [slot(0, { rom: 0 }), slot(1, { bank: 5 }), slot(2, { bank: 2 }), slot(3, { bank: 0 })];
  }
  const p7 = decode7ffd(snapshot.paging?.port7ffd ?? 0);
  const p1 =
    isPlus3SnapshotMachine(snapshot.machine) && snapshot.paging?.port1ffd !== undefined
      ? decode1ffd(snapshot.paging.port1ffd)
      : undefined;
  if (p1?.specialPaging) {
    return SPECIAL_CONFIGS[p1.config].map((bank, i) => slot(i, { bank }));
  }
  const rom = p1 ? ((p1.config & 0x02) | p7.rom) : p7.rom;
  return [slot(0, { rom }), slot(1, { bank: 5 }), slot(2, { bank: 2 }), slot(3, { bank: p7.bank })];
}

/** The bank the ULA shows: 7 with the shadow screen selected, else 5 */
export function spectrumScreenBank(snapshot: SpectrumSnapshot): number {
  return isPagedSnapshotMachine(snapshot.machine) && decode7ffd(snapshot.paging?.port7ffd ?? 0).shadowScreen
    ? 7
    : 5;
}

/**
 * The 64K the CPU sees. A snapshot holds no ROM, so a ROM slot is zero-filled; the viewer says so.
 */
export function buildSpectrumAddressSpace(snapshot: SpectrumSnapshot): Uint8Array {
  const space = new Uint8Array(0x10000);
  for (const range of spectrumPagedRanges(snapshot)) {
    if (range.bank === undefined) continue;
    const bytes = snapshot.ram.get(range.bank);
    if (bytes) space.set(bytes, range.start);
  }
  return space;
}

/** Where an address is: its slot's bank (or ROM) and the offset in it */
export function spectrumAddressLocation(
  snapshot: SpectrumSnapshot,
  address: number
): { bank?: number; rom?: number; offset: number } {
  const range = spectrumPagedRanges(snapshot)[(address >> 14) & 0x03];
  return { bank: range.bank, rom: range.rom, offset: address & 0x3fff };
}

/** The address a bank is paged in at, if it is */
export function spectrumBankAddress(snapshot: SpectrumSnapshot, bank: number): number | undefined {
  return spectrumPagedRanges(snapshot).find((r) => r.bank === bank)?.start;
}

export type SpectrumBankView = "memory" | "disassembly";

/** A bank, as the RAM browser lists it */
export type SpectrumBankItem = BankBrowserItem<SpectrumBankView> & {
  /** Where it is paged in, if it is */
  pagedAt?: number;
  /** The address its disassembly is listed at: where it is paged, else $C000 */
  listedAt: number;
  /** PC / SP point into it (as the snapshot pages it) */
  pc?: number;
  sp?: number;
  /** The ULA shows it */
  screen: boolean;
  /** All bytes equal (often a never-used bank) */
  empty: boolean;
  bytes: Uint8Array;
};

/** Every bank the snapshot holds, in bank order */
export function spectrumBankItems(
  snapshot: SpectrumSnapshot,
  lastViews?: Record<number, SpectrumBankView>
): SpectrumBankItem[] {
  const screen = spectrumScreenBank(snapshot);
  const pcLoc = spectrumAddressLocation(snapshot, snapshot.cpu.pc);
  const spLoc = spectrumAddressLocation(snapshot, snapshot.cpu.sp);
  return [...snapshot.ram.keys()]
    .sort((a, b) => a - b)
    .map((bank) => {
      const bytes = snapshot.ram.get(bank)!;
      const pagedAt = spectrumBankAddress(snapshot, bank);
      return {
        key: `${bank}`,
        bank,
        lastView: lastViews?.[bank] ?? "memory",
        pagedAt,
        listedAt: pagedAt ?? 0xc000,
        pc: pcLoc.bank === bank ? snapshot.cpu.pc : undefined,
        sp: spLoc.bank === bank ? snapshot.cpu.sp : undefined,
        screen: bank === screen,
        empty: bytes.every((b) => b === bytes[0]),
        bytes
      };
    });
}

/** The AY-3-8912's registers in words */
export type AyState = {
  tone: [number, number, number];
  noise: number;
  /** Per channel A/B/C: tone on, noise on (R7's bits are active-low) */
  mixer: { tone: boolean; noise: boolean }[];
  /** Per channel: the volume, or "envelope" */
  volume: (number | "envelope")[];
  envelopePeriod: number;
  envelopeShape: number;
  portADirectionOut: boolean;
};

export function decodeAy(regs: Uint8Array): AyState {
  const r = (i: number) => regs[i] ?? 0;
  return {
    tone: [r(0) | ((r(1) & 0x0f) << 8), r(2) | ((r(3) & 0x0f) << 8), r(4) | ((r(5) & 0x0f) << 8)],
    noise: r(6) & 0x1f,
    mixer: [0, 1, 2].map((ch) => ({
      tone: (r(7) & (1 << ch)) === 0,
      noise: (r(7) & (8 << ch)) === 0
    })),
    volume: [8, 9, 10].map((i) => (r(i) & 0x10 ? "envelope" : r(i) & 0x0f)),
    envelopePeriod: r(11) | (r(12) << 8),
    envelopeShape: r(13) & 0x0f,
    portADirectionOut: (r(7) & 0x40) !== 0
  };
}
