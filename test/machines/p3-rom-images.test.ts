import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The Amstrad +2A/+3 ROM images (`.plans/PLUS3_AMSTRAD_ROMS_PLAN.md` §4, Phase 0). A wrong or
 * corrupted image would boot to a garbled menu; here it fails instead. The CRC32s were taken from
 * the files when they were added (source: `src/public/roms/spp3-roms-readme.txt`).
 */

const ROM_DIR = join(__dirname, "../../src/public/roms");

const SETS: Record<string, { version: string; crc: number[] }> = {
  "spp3-40": { version: "V 4.0", crc: [0x17373da2, 0xf1d1d99e, 0x3dbf351d, 0x04448eaa] },
  "spp3-41": { version: "V 4.1", crc: [0x30c9f490, 0xa7916b3f, 0xc9a0b748, 0xb88fd6e3] },
  "spp3-41es": { version: "V 4.1", crc: [0x1f86147a, 0xa8ac4966, 0xf6bb0296, 0xf6d25389] }
};

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

const read = (romId: string, page: number) =>
  new Uint8Array(readFileSync(join(ROM_DIR, `${romId}-${page}.rom`)));

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("Amstrad +2A/+3 ROM images", () => {
  for (const [romId, { version, crc }] of Object.entries(SETS)) {
    it(`${romId}: four 16K pages with the recorded CRC32s`, () => {
      for (let page = 0; page < 4; page++) {
        const bytes = read(romId, page);
        expect(bytes.length, `${romId}-${page}`).toBe(16_384);
        expect(crc32(bytes).toString(16), `${romId}-${page}`).toBe(crc[page].toString(16));
      }
    });

    it(`${romId}: ROM 0 carries the Amstrad copyright and its version`, () => {
      const text = latin1(read(romId, 0));
      expect(text).toContain("1982, 1986, 1987 Amstrad Plc.");
      expect(text).toContain(`SPECTRUM +3 test program ${version}`);
    });
  }

  it("no two sets are identical", () => {
    const ids = Object.keys(SETS);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const same = [0, 1, 2, 3].every((p) => Buffer.from(read(ids[i], p)).equals(Buffer.from(read(ids[j], p))));
        expect(same, `${ids[i]} vs ${ids[j]}`).toBe(false);
      }
    }
  });

  it("the Spanish set is the Spanish ROM (its 128K editor differs from the English v4.1)", () => {
    expect(Buffer.from(read("spp3-41es", 0)).equals(Buffer.from(read("spp3-41", 0)))).toBe(false);
  });
});
