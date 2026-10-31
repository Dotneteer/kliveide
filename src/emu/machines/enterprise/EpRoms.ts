/**
 * The bundled Enterprise ROM images (`src/public/roms`, `ep-roms-readme.txt`): the one place that names
 * them, so that dropping the bundled images for user-supplied ones (`.plans/ENTERPRISE_PLAN.md` §17)
 * is a change here only. `test/machines/ep-rom-images.test.ts` checks each image's size and CRC32
 * against this table.
 */

/** The Enterprise ROM sets: EXOS 2.1 + IS-BASIC 2.1 (the 128), EXOS 2.0 + IS-BASIC 2.0 (the 64) */
export type EpRomSetId = "21" | "20";

/** One image: its resource name (without `.rom`), its size, the CRC32 it was shipped with, and its banner */
export type EpRomImage = {
  readonly name: string;
  readonly size: number;
  readonly crc32: number;
  readonly banner: string;
};

/** The images of one model */
export type EpRomSet = {
  /** EXOS with the word processor, segments 00h-01h */
  readonly exos: EpRomImage;
  /** IS-BASIC, the cartridge in segment 04h */
  readonly basic: EpRomImage;
};

export const EP_ROM_SETS: Readonly<Record<EpRomSetId, EpRomSet>> = {
  "21": {
    exos: { name: "ep-exos21", size: 0x8000, crc32: 0x982a3b44, banner: "EXOS 2.1" },
    basic: { name: "ep-basic21", size: 0x4000, crc32: 0x55f96251, banner: "BASIC version 2.1" }
  },
  "20": {
    exos: { name: "ep-exos20", size: 0x8000, crc32: 0xd421795f, banner: "EXOS 2.0" },
    basic: { name: "ep-basic20", size: 0x4000, crc32: 0x1228de34, banner: "BASIC version 2.0" }
  }
};

/** EXDOS 1.3, segments 20h-21h (Phase 9). Its CRC32 differs from MAME's `exdos13.rom` (the readme says so) */
export const EP_EXDOS_ROM_IMAGE: EpRomImage = {
  name: "ep-exdos13",
  size: 0x8000,
  crc32: 0xe0135929,
  banner: "EXDOS version 1.3"
};

/**
 * Klive's FILE: device ROM, segment 10h (`fileio/ep-klive-fileio.asm`, Klive's own code; the image is
 * checked against its source by `test/machines/ep-fileio-rom.test.ts`)
 */
export const EP_FILEIO_ROM_NAME = "ep-klive-fileio";

/** Every bundled image */
export const EP_ROM_IMAGES: readonly EpRomImage[] = [
  EP_ROM_SETS["20"].exos,
  EP_ROM_SETS["21"].exos,
  EP_ROM_SETS["20"].basic,
  EP_ROM_SETS["21"].basic,
  EP_EXDOS_ROM_IMAGE
];
