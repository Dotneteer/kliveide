/**
 * The bundled Videoton TVC ROM images (`src/public/roms`, `tvc-roms-readme.txt`): the one place that
 * names them, so that dropping the bundled images for user-supplied ones (`.plans/VIDEOTON_TVC_PLAN.md`
 * D3, §16) is a change here only. `test/machines/tvc-rom-images.test.ts` checks each image's size and
 * CRC32 against this table.
 */

/** The TVC ROM sets: BASIC 1.2 (the 64K) and BASIC 2.2 (the 64K+) */
export type TvcRomSetId = "12" | "22";

/** One image: its resource name (without `.rom`), its size and the CRC32 it was shipped with */
export type TvcRomImage = {
  readonly name: string;
  readonly size: number;
  readonly crc32: number;
};

/** The three images of one model */
export type TvcRomSet = {
  /** The low 8K of the 16K SYS bank (C000-DFFF when page 3 shows SYS) */
  readonly sysLow: TvcRomImage;
  /** The high 8K of the SYS bank (E000-FFFF) */
  readonly sysHigh: TvcRomImage;
  /** The EXTH ROM, the high 8K of the EXT page (E000-FFFF) */
  readonly exth: TvcRomImage;
};

export const TVC_ROM_CHIP_SIZE = 0x2000;

const image = (name: string, crc32: number): TvcRomImage => ({ name, size: TVC_ROM_CHIP_SIZE, crc32 });

/** The CRC32s are MAME's tvc64 and tvc64p (BIOS v2.2) sets' */
export const TVC_ROM_SETS: Readonly<Record<TvcRomSetId, TvcRomSet>> = {
  "12": {
    sysLow: image("tvc12-d4", 0x834ca9be),
    sysHigh: image("tvc12-d3", 0x71753d02),
    exth: image("tvc12-d7", 0x1cbbeac6)
  },
  "22": {
    sysLow: image("tvc22-d6", 0x05ac3a34),
    sysHigh: image("tvc22-d4", 0xba6ad589),
    exth: image("tvc22-d7", 0x05e1c3a8)
  }
};
