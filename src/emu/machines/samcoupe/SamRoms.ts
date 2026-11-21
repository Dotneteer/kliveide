/**
 * The bundled SAM Coupé ROM images (`src/public/roms`, `sam-roms-readme.txt`): the one place that names
 * them, so that a later objection from a rights holder means a setting for a user-supplied image, not a
 * rewrite (`dev/plans/SAM_COUPE_PLAN.md` §17). `test/machines/sam-rom-images.test.ts` checks each image's
 * size and CRC32 against this table.
 */

/** The bundled ROM versions: 3.0 (the default, D3) and 3.1 */
export type SamRomId = "30" | "31";

/** One image: its resource name (without `.rom`), its size, its CRC32, its version byte (address 15) */
export type SamRomImage = {
  readonly id: SamRomId;
  readonly name: string;
  readonly size: number;
  readonly crc32: number;
  readonly version: number;
  /** The company line of the splash, which tells 3.0 ("plc") from 3.1 ("PLC") */
  readonly banner: string;
};

export const SAM_ROM_IMAGES: Readonly<Record<SamRomId, SamRomImage>> = {
  "30": {
    id: "30",
    name: "sam-rom30",
    size: 0x8000,
    crc32: 0xe535c25d,
    version: 30,
    banner: "MILES GORDON TECHNOLOGY plc"
  },
  "31": {
    id: "31",
    name: "sam-rom31",
    size: 0x8000,
    crc32: 0x0b7e3585,
    version: 31,
    banner: "MILES GORDON TECHNOLOGY PLC"
  }
};

export const SAM_DEFAULT_ROM: SamRomId = "30";

/** The image a `MC_SAM_ROM` setting selects (anything unknown is the default) */
export function samRomImage(setting: unknown): SamRomImage {
  return setting === "31" ? SAM_ROM_IMAGES["31"] : SAM_ROM_IMAGES[SAM_DEFAULT_ROM];
}
