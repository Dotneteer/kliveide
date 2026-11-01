import type { RomPageKind } from "@common/roms/romIdentity";
import type { Cpu } from "./cpu";

/*
 * What the ROM annotation pipeline works on (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §3.3, D3): a
 * small image of banks, known entries and a CPU. The ROM-page adapter (`romImage.ts`) fills it today;
 * the `.nex` extension (§12) would add another adapter, not change the stages that read it.
 */

/** One bank of an image: its bytes and the CPU address its first byte runs at. */
export type ImageBank = {
  /** The bank's key, the same as the annotation file's `banks` key (a ROM's 16K page number). */
  id: string;
  bytes: Uint8Array;
  /** The address the bank is decoded at: offsets are counted from here ($C000 for an EXOS page). */
  origin: number;
};

/** How an entry is known before any analysis runs. */
export type ImageEntrySource =
  /** A CPU address on a bank at $0000: reset, the `RST` addresses, the IM 1 interrupt, the NMI. */
  | "cpu-vector"
  /** An entry the binary's format defines (a ROM header's entry point). */
  | "format";

/** A place code is known to start, from the image alone. */
export type ImageEntry = {
  bank: string;
  /** Offset within the bank. */
  offset: number;
  source: ImageEntrySource;
  /** What the entry is (`RST $08`, `NMI`). */
  note: string;
};

export type BinaryImage = {
  /** The file name the image came from (`ep-exdos13.rom`). */
  name: string;
  cpu: Cpu;
  banks: ImageBank[];
  entries: ImageEntry[];
  /** The ROM page kind: selects the custom decoders and, later, the convention plug-ins. */
  romKind?: RomPageKind;
};

/** The bank with this id; throws when the image has none, naming the ones it has. */
export function imageBank(image: BinaryImage, id: string): ImageBank {
  const bank = image.banks.find((b) => b.id === id);
  if (!bank) {
    throw new Error(`${image.name} has no bank "${id}" (it has ${image.banks.map((b) => b.id).join(", ")})`);
  }
  return bank;
}
