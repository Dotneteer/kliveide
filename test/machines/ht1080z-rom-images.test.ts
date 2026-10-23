import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HT1080Z_ROM_SETS, type Ht1080zRomImage } from "@emu/machines/ht1080z/Ht1080zRoms";

/*
 * The HT-1080Z ROM images (`.plans/HT1080Z_PLAN.md` §11, D2). A replaced or corrupted image fails
 * here instead of booting to a garbled screen. The CRC32s are the plan's §17 (and `Ht1080zRoms.ts`'s),
 * recorded when the images were taken from ht.homeserver.hu (`src/public/roms/ht1080z-roms-readme.txt`).
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

const read = (image: Ht1080zRomImage) => new Uint8Array(readFileSync(join(ROM_DIR, `${image.name}.rom`)));
const latin1 = (bytes: Uint8Array, from: number, to: number) => Buffer.from(bytes.subarray(from, to)).toString("latin1");

describe("HT-1080Z ROM images", () => {
  for (const [setId, romSet] of Object.entries(HT1080Z_ROM_SETS)) {
    for (const image of [romSet.basic, romSet.extension, romSet.chargen]) {
      it(`${setId}: ${image.name} has the recorded size and CRC32`, () => {
        const bytes = read(image);
        expect(bytes.length).toBe(image.size);
        expect(crc32(bytes).toString(16)).toBe(image.crc32.toString(16));
      });
    }
  }

  it("the boot prompts are the ones the plan records (§17)", () => {
    expect(latin1(read(HT1080Z_ROM_SETS.s2.basic), 0x105, 0x10b)).toBe("READY ");
    expect(latin1(read(HT1080Z_ROM_SETS.s64.basic), 0x105, 0x110)).toBe("MEMORY SIZE");
    expect(latin1(read(HT1080Z_ROM_SETS.s64.basic), 0x113, 0x11e)).toBe("BASIC  2.20");
  });

  it("the extension banners tell the models apart", () => {
    expect(latin1(read(HT1080Z_ROM_SETS.s1.extension), 0x40, 0x5b)).toBe("NEW KEYBOARD ROUTINE ENABLE");
    expect(latin1(read(HT1080Z_ROM_SETS.s64.extension), 0x40, 0x5b)).toBe("BASIC ROM EXTENSION  2.51  ");
  });

  it("Series I and II share their BASIC; every other image differs", () => {
    const { s1, s2, s64 } = HT1080Z_ROM_SETS;
    const same = (a: Ht1080zRomImage, b: Ht1080zRomImage) => Buffer.from(read(a)).equals(Buffer.from(read(b)));
    expect(same(s1.basic, s2.basic)).toBe(true);
    expect(same(s1.basic, s64.basic)).toBe(false);
    for (const kind of ["extension", "chargen"] as const) {
      expect(same(s1[kind], s2[kind]), kind).toBe(false);
      expect(same(s2[kind], s64[kind]), kind).toBe(false);
    }
  });
});
