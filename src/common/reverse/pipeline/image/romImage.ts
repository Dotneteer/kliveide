import { knownRomPageKind, romKindOrigin, romPageIdentity, type RomPageKind } from "@common/roms/romIdentity";
import type { BinaryImage, ImageEntry } from "./binaryImage";
import { defaultCpuForRomKind, type Cpu } from "./cpu";

/*
 * The ROM-page adapter of the pipeline's image model (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` D3):
 * one 16K page (or a smaller ROM) becomes a one-bank image, decoded where the page runs
 * (`romKindOrigin`) with the CPU its kind runs on, unless the caller says otherwise (D2).
 */

/** The size of a ROM page: sidecars key their banks by 16K page. */
export const ROM_PAGE_SIZE = 0x4000;

/** The number of 16K pages in a ROM file (a smaller file is one page). */
export function romPageCount(file: Uint8Array): number {
  return Math.max(1, Math.ceil(file.length / ROM_PAGE_SIZE));
}

/** The bytes of one 16K page of a ROM file. */
export function romPageBytes(file: Uint8Array, page: number): Uint8Array {
  if (!Number.isInteger(page) || page < 0 || page >= romPageCount(file)) {
    throw new Error(`No page ${page}: the file has ${romPageCount(file)} page(s)`);
  }
  return file.subarray(page * ROM_PAGE_SIZE, Math.min(file.length, (page + 1) * ROM_PAGE_SIZE));
}

export type RomImageOptions = {
  /** The file the page came from, for messages and the work folder. */
  name: string;
  /** The page within the file (the bank's id); 0 when absent. */
  page?: number;
  /** The page's kind; absent means the one Klive knows the page by (its CRC), if any. */
  kind?: RomPageKind;
  /** Overrides the CPU the kind implies (D2). */
  cpu?: Cpu;
};

/** A ROM page as a pipeline image. */
export function imageFromRomPage(bytes: Uint8Array, options: RomImageOptions): BinaryImage {
  const page = options.page ?? 0;
  const kind = options.kind ?? knownRomPageKind(romPageIdentity(bytes));
  const origin = romKindOrigin(kind);
  const bank = String(page);
  return {
    name: options.name,
    cpu: options.cpu ?? defaultCpuForRomKind(kind),
    banks: [{ id: bank, bytes, origin }],
    entries: origin === 0 ? cpuVectorEntries(bank, bytes.length) : [],
    ...(kind ? { romKind: kind } : {})
  };
}

/**
 * The Z80's fixed entry addresses that fall inside a bank at $0000: reset, the eight restarts (RST
 * $38 is also the IM 1 interrupt) and the NMI. A page that runs elsewhere has none of its own.
 */
function cpuVectorEntries(bank: string, size: number): ImageEntry[] {
  const vectors: [number, string][] = [
    [0x00, "Reset (RST $00)"],
    [0x08, "RST $08"],
    [0x10, "RST $10"],
    [0x18, "RST $18"],
    [0x20, "RST $20"],
    [0x28, "RST $28"],
    [0x30, "RST $30"],
    [0x38, "RST $38, IM 1 interrupt"],
    [0x66, "NMI"]
  ];
  return vectors
    .filter(([offset]) => offset < size)
    .map(([offset, note]) => ({ bank, offset, source: "cpu-vector", note }));
}
