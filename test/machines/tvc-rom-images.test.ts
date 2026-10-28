import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TVC_HBF_ROM_IMAGE, TVC_ROM_SETS, type TvcRomImage } from "@emu/machines/tvc/TvcRoms";

/*
 * The Videoton TVC ROM images (`.plans/VIDEOTON_TVC_PLAN.md` D3). A replaced or corrupted image fails
 * here instead of booting to a garbled screen. The CRC32s are `TvcRoms.ts`'s, which match MAME's
 * tvc64 and tvc64p sets (`src/public/roms/tvc-roms-readme.txt`).
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

const read = (image: TvcRomImage) => new Uint8Array(readFileSync(join(ROM_DIR, `${image.name}.rom`)));
const latin1 = (bytes: Uint8Array, from: number, to: number) => Buffer.from(bytes.subarray(from, to)).toString("latin1");

describe("Videoton TVC ROM images", () => {
  it("VT-DOS: tvc-vtdos has the recorded size and CRC32 (MAME's d_tvcdos.128)", () => {
    const bytes = read(TVC_HBF_ROM_IMAGE);
    expect(bytes.length).toBe(TVC_HBF_ROM_IMAGE.size);
    expect(crc32(bytes).toString(16)).toBe(TVC_HBF_ROM_IMAGE.crc32.toString(16));
  });

  for (const [setId, romSet] of Object.entries(TVC_ROM_SETS)) {
    for (const image of [romSet.sysLow, romSet.sysHigh, romSet.exth]) {
      it(`BASIC ${setId}: ${image.name} has the recorded size and CRC32`, () => {
        const bytes = read(image);
        expect(bytes.length).toBe(image.size);
        expect(crc32(bytes).toString(16)).toBe(image.crc32.toString(16));
      });
    }
  }

  it("each model's SYS ROM carries its own banner", () => {
    expect(latin1(read(TVC_ROM_SETS["12"].sysLow), 0x1a85, 0x1a9a)).toBe("TV COMPUTER BASIC 1.2");
    expect(latin1(read(TVC_ROM_SETS["22"].sysLow), 0x0fa4, 0x0fb9)).toBe("TV COMPUTER BASIC 2.2");
  });
});
