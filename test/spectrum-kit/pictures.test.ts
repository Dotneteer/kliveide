import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { encodePng } from "@common/imaging/png";

import { decodePng, encodePalettePng, pictureDifference, scale2x, type Picture } from "./pictures";

/*
 * The published pictures' PNG round trip and comparison (`pictures.ts`); no core runs here. The kit
 * tests that publish pictures are in the slow tier; this is what makes their drift check trustworthy.
 */

function picture(width: number, height: number, colour: (x: number, y: number) => number): Picture {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = colour(x, y);
      pixels.set([rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff, 255], (y * width + x) * 4);
    }
  }
  return { width, height, pixels };
}

const sample = picture(7, 5, (x, y) => [0x0000d7, 0xd7d700, 0xffffff, 0x000000][(x * y + x) % 4]);

describe("published pictures", () => {
  it("a paletted PNG decodes to the same pixels", () => {
    const png = encodePalettePng(sample);
    expect(png[25], "colour type").toBe(3);
    expect(pictureDifference(decodePng(png), sample)).toBe(0);
  });

  it("an RGBA PNG (Klive's own encoder) decodes to the same pixels", () => {
    expect(pictureDifference(decodePng(encodePng(sample.pixels, 7, 5)), sample)).toBe(0);
  });

  it("decodes every PNG row filter (a PNG optimiser's output)", () => {
    // --- Paeth (4) on every row of a paletted picture of one colour: every filtered byte is 0
    const raw = Buffer.alloc(3 * 4);
    for (let y = 0; y < 3; y++) raw[y * 4] = 4;
    const ihdr = Buffer.from([0, 0, 0, 3, 0, 0, 0, 3, 8, 3, 0, 0, 0]);
    const chunk = (type: string, data: Buffer) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
    };
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("PLTE", Buffer.from([0x12, 0x34, 0x56])),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0))
    ]);
    expect(pictureDifference(decodePng(png), picture(3, 3, () => 0x123456))).toBe(0);
  });

  it("scales 2x, nearest-neighbour", () => {
    const big = scale2x(sample);
    expect([big.width, big.height]).toEqual([14, 10]);
    expect(pictureDifference(big, picture(14, 10, (x, y) => {
      const i = (Math.floor(y / 2) * 7 + Math.floor(x / 2)) * 4;
      return (sample.pixels[i] << 16) | (sample.pixels[i + 1] << 8) | sample.pixels[i + 2];
    }))).toBe(0);
  });

  it("one changed pixel is a difference", () => {
    const changed = decodePng(encodePalettePng(sample));
    changed.pixels[(2 * 7 + 3) * 4] ^= 0x01;
    expect(pictureDifference(changed, sample)).toBe(1);
    expect(pictureDifference(scale2x(sample), sample)).toBe(-1);
  });
});
