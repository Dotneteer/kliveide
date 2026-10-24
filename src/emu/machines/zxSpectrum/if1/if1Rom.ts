/*
 * The ZX Interface 1's ROM (`.plans/MICRODRIVE_PLAN.md` Q1): Klive ships the second edition as
 * `roms/if1-2.rom`; the `SETTING_EMU_IF1_ROM` setting can name another 8K file. A user file is
 * identified by its CRC32 (MAME's hashes, `src/public/roms/if1-roms-readme.txt`), so the UI can say
 * which edition is running.
 */

/** The shipped ROM's resource name, as `Z80MachineBase.loadRomFromResource` takes it */
export const IF1_ROM_RESOURCE = "if1-2";

/** Every Interface 1 ROM is 8K: it pages over $0000-$1FFF */
export const IF1_ROM_SIZE = 0x2000;

export const IF1_V1_CRC32 = 0xe72a12ae;
export const IF1_V2_CRC32 = 0xbb66dd1e;

export type Interface1RomEdition = "v1" | "v2" | "custom";

export type Interface1RomCheck =
  | { ok: true; edition: Interface1RomEdition; crc32: number }
  | { ok: false; problem: "size"; size: number };

/** Checks a ROM image's size and tells which edition it is */
export function checkInterface1Rom(bytes: Uint8Array): Interface1RomCheck {
  if (bytes.length !== IF1_ROM_SIZE) return { ok: false, problem: "size", size: bytes.length };
  const crc = crc32(bytes);
  const edition: Interface1RomEdition =
    crc === IF1_V1_CRC32 ? "v1" : crc === IF1_V2_CRC32 ? "v2" : "custom";
  return { ok: true, edition, crc32: crc };
}

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
