import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EP_ROM_IMAGES } from "@emu/machines/enterprise/EpRoms";

/*
 * The Enterprise 64/128 ROM images. A replaced or corrupted image fails here instead of booting to
 * a garbled screen. The CRC32s are `EpRoms.ts`'s, recorded when the images were taken from the
 * libretro ep128emu core (`src/public/roms/ep-roms-readme.txt`).
 */

const ROM_DIR = join(__dirname, "../../src/public/roms");

const EP_ROMS = EP_ROM_IMAGES;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const read = (name: string) => new Uint8Array(readFileSync(join(ROM_DIR, `${name}.rom`)));
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("Enterprise ROM images", () => {
  for (const rom of EP_ROMS) {
    it(`${rom.name} has the recorded size and CRC32`, () => {
      const bytes = read(rom.name);
      expect(bytes.length).toBe(rom.size);
      expect(crc32(bytes).toString(16)).toBe(rom.crc32.toString(16));
    });

    it(`${rom.name} carries its banner and the Intelligent Software notice`, () => {
      const text = latin1(read(rom.name));
      expect(text).toContain(rom.banner);
      expect(text).toContain("Intelligent Software Ltd");
    });
  }

  it("the cartridge and disk ROMs start with the EXOS_ROM signature", () => {
    for (const name of ["ep-basic20", "ep-basic21", "ep-exdos13"]) {
      expect(latin1(read(name).subarray(0, 8)), name).toBe("EXOS_ROM");
    }
  });
});
