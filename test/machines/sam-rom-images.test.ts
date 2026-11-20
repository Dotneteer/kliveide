import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SAM_ROM_IMAGES } from "@emu/machines/samcoupe/SamRoms";

/*
 * The SAM Coupé ROM images (`src/public/roms/sam-roms-readme.txt`). A replaced or corrupted image fails
 * here instead of booting to a garbled screen. The CRC32s are MAME's for rom30.z5 and rom31.z5.
 */

const ROM_DIR = join(__dirname, "../../src/public/roms");

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

describe("SAM Coupé ROM images", () => {
  for (const rom of Object.values(SAM_ROM_IMAGES)) {
    it(`${rom.name} has the recorded size, CRC32, version byte and banner`, () => {
      const bytes = read(rom.name);
      expect(bytes.length).toBe(rom.size);
      expect(crc32(bytes).toString(16)).toBe(rom.crc32.toString(16));
      expect(bytes[15]).toBe(rom.version);
      expect(Buffer.from(bytes).toString("latin1")).toContain(rom.banner);
    });

    it(`${rom.name} starts with DI; JP 00B0h`, () => {
      expect(Array.from(read(rom.name).subarray(0, 4))).toEqual([0xf3, 0xc3, 0xb0, 0x00]);
    });
  }

  it("the readme quotes Andrew Wright's grant", () => {
    const readme = readFileSync(join(ROM_DIR, "sam-roms-readme.txt"), "utf8");
    expect(readme).toContain("I hereby allow all my SAM Coupé titles (including ROMs) and associated");
  });
});
