/**
 * The bundled HT-1080Z ROM images (`src/public/roms`, `ht1080z-roms-readme.txt`): the one place that
 * names them, so that dropping the bundled images for user-supplied ones (`.plans/HT1080Z_PLAN.md`
 * §16, D2) is a change here only. `test/machines/ht1080z-rom-images.test.ts` checks each image's
 * size and CRC32 against this table.
 */

/** The HT ROM sets: Series I, Series II and the HT-1080Z/64 */
export type Ht1080zRomSetId = "s1" | "s2" | "s64";

/** One image: its resource name (without `.rom`), its size and the CRC32 it was shipped with */
export type Ht1080zRomImage = {
  readonly name: string;
  readonly size: number;
  readonly crc32: number;
};

/** The three images of one model */
export type Ht1080zRomSet = {
  /** The Level II BASIC, $0000-$2FFF */
  readonly basic: Ht1080zRomImage;
  /** The extension EPROM, $3000-$37FF */
  readonly extension: Ht1080zRomImage;
  /** The character generator: 128 glyphs x 16 rows, dots in bits 7-3 */
  readonly chargen: Ht1080zRomImage;
};

export const HT1080Z_BASIC_ROM_SIZE = 0x3000;
export const HT1080Z_EXTENSION_ROM_SIZE = 0x0800;
export const HT1080Z_CHARGEN_ROM_SIZE = 0x0800;

const set = (id: Ht1080zRomSetId, basic: number, extension: number, chargen: number): Ht1080zRomSet => ({
  basic: { name: `ht1080z-${id}`, size: HT1080Z_BASIC_ROM_SIZE, crc32: basic },
  extension: { name: `ht1080z-${id}-ext`, size: HT1080Z_EXTENSION_ROM_SIZE, crc32: extension },
  chargen: { name: `ht1080z-${id}-chargen`, size: HT1080Z_CHARGEN_ROM_SIZE, crc32: chargen }
});

/** The CRC32s are `.plans/HT1080Z_PLAN.md` §17's (the Series I and II BASIC images are identical) */
export const HT1080Z_ROM_SETS: Readonly<Record<Ht1080zRomSetId, Ht1080zRomSet>> = {
  s1: set("s1", 0x2bfef8f7, 0x2a851e33, 0xe8c59d4f),
  s2: set("s2", 0x2bfef8f7, 0x07415ac6, 0x6728f0ab),
  s64: set("s64", 0x48985a30, 0xfc12bd28, 0xe76b73a4)
};
