import {
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_ZX80,
  MI_ZX81
} from "@common/machines/constants";

/*
 * Which ROM a ROM page is (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.3).
 *
 * A partition label names a *slot*, not the ROM in it: the 128K's `R1`, a +3's `R3` and a custom 48K
 * ROM all look alike from the label (T6). What identifies a page is its bytes, and the CRC-32 of
 * them is the key the ROM annotations are found by. The Timex machine identified its ROM this way
 * first (`timexModels.ts`); the checksum lives here now so every machine shares it.
 */

/** The CRC-32 (IEEE) of a ROM image, as eight lower-case hex digits. */
export function romCrc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/** A ROM page's identity: its CRC-32 and size. */
export type RomPageIdentity = { crc32: string; size: number };

export function romPageIdentity(bytes: Uint8Array): RomPageIdentity {
  return { crc32: romCrc32(bytes), size: bytes.length };
}

/** What a known ROM page holds, which decides the machine-specific decoding of its code. */
export type RomPageKind =
  | "sp48-basic"
  | "sp128-editor"
  | "plus3-editor"
  | "plus3-syntax"
  | "plus3-dos"
  | "zx81"
  | "zx80";

/**
 * The ROM pages Klive ships, by CRC-32 (`src/public/roms`). Recorded by checksumming the files;
 * `test/annotations/romIdentity.test.ts` keeps it in step with them.
 */
export const KNOWN_ROM_PAGES: Readonly<Record<string, { file: string; kind: RomPageKind }>> = {
  ddee531f: { file: "sp48.rom", kind: "sp48-basic" },
  e76799d2: { file: "sp128-0.rom", kind: "sp128-editor" },
  b96a36be: { file: "sp128-1.rom", kind: "sp48-basic" },
  "17373da2": { file: "spp3-40-0.rom", kind: "plus3-editor" },
  f1d1d99e: { file: "spp3-40-1.rom", kind: "plus3-syntax" },
  "3dbf351d": { file: "spp3-40-2.rom", kind: "plus3-dos" },
  "04448eaa": { file: "spp3-40-3.rom", kind: "sp48-basic" },
  "30c9f490": { file: "spp3-41-0.rom", kind: "plus3-editor" },
  a7916b3f: { file: "spp3-41-1.rom", kind: "plus3-syntax" },
  c9a0b748: { file: "spp3-41-2.rom", kind: "plus3-dos" },
  b88fd6e3: { file: "spp3-41-3.rom", kind: "sp48-basic" },
  "1f86147a": { file: "spp3-41es-0.rom", kind: "plus3-editor" },
  a8ac4966: { file: "spp3-41es-1.rom", kind: "plus3-syntax" },
  f6bb0296: { file: "spp3-41es-2.rom", kind: "plus3-dos" },
  f6d25389: { file: "spp3-41es-3.rom", kind: "sp48-basic" },
  "7f4a5482": { file: "spp3e-0.rom", kind: "plus3-editor" },
  "5aeb4675": { file: "spp3e-1.rom", kind: "plus3-syntax" },
  "504755cb": { file: "spp3e-2.rom", kind: "plus3-dos" },
  "4b1dd6eb": { file: "zx81.rom", kind: "zx81" },
  "4c7fc597": { file: "zx80.rom", kind: "zx80" }
};

/** The kind of a page Klive knows, by its identity. */
export function knownRomPageKind(identity: RomPageIdentity | undefined): RomPageKind | undefined {
  return identity ? KNOWN_ROM_PAGES[identity.crc32]?.kind : undefined;
}

/**
 * The ROM partition that holds the 48K BASIC ROM on each Spectrum, for a page Klive does not know
 * (Q7): a user's custom 48K ROM, a Scorpion ROM set, a TC2048. Its 16K page is byte-bound against
 * the shipped 48K ROM's annotations, and the 48K custom disassembler decodes it.
 */
export function basic48RomPartition(machineId: string | undefined): number | undefined {
  switch (machineId) {
    case MI_SPECTRUM_48:
    case MI_TIMEX:
      return -1;
    case MI_SPECTRUM_128:
    case MI_SCORPION:
      return -2;
    case MI_SPECTRUM_3E:
      return -4;
    default:
      return undefined;
  }
}

/** Whether a ROM partition holds a 48K BASIC ROM: known by its bytes, or by its position (Q7). */
export function isBasic48RomPage(
  machineId: string | undefined,
  partition: number,
  identity: RomPageIdentity | undefined
): boolean {
  const kind = knownRomPageKind(identity);
  if (kind) return kind === "sp48-basic";
  return (
    partition === basic48RomPartition(machineId) &&
    (identity === undefined || identity.size === 0x4000)
  );
}

/** Whether the machine's ROM is the 8K ZX81 ROM (the ZX81, or a ZX80 with the upgrade). */
export function isZx81Rom(machineId: string | undefined, identity: RomPageIdentity | undefined): boolean {
  if (machineId !== MI_ZX81 && machineId !== MI_ZX80) return false;
  const kind = knownRomPageKind(identity);
  return kind ? kind === "zx81" : identity?.size === 0x2000;
}

/** Where a ROM partition's bytes came from, and what they are (`IAnyMachine.getRomSources`). */
export type RomSource = RomPageIdentity & {
  /** The file it was loaded from: `roms/sp48.rom` (shipped) or an absolute path; absent if unknown. */
  path?: string;
  /** The 16K page within that file. */
  page: number;
  /** The page's bytes, when asked for: byte binding compares them (§5.3). */
  bytes?: Uint8Array;
};

/** Whether a ROM source is one of the ROM files Klive ships (a relative `roms/…` path). */
export function isShippedRomPath(path: string | undefined): boolean {
  return !!path && /^roms[\\/]/.test(path);
}
