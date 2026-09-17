import { describe, expect, it } from "vitest";
import {
  isBlankPattern,
  NEX_SPRITE_TRANSPARENT,
  patternAt,
  patternColours,
  patternCount,
  patternHint,
  patternOffset,
  patternPixels,
  patternSize,
  patternSpan
} from "@renderer/appIde/DocumentPanels/Next/nexBankSprites";

const T = NEX_SPRITE_TRANSPARENT;

describe("pattern geometry", () => {
  it("sizes 8-bit patterns at 256 bytes and 4-bit at 128", () => {
    expect(patternSize("8bit")).toBe(256);
    expect(patternSize("4bit")).toBe(128);
  });

  it("counts whole patterns from the offset, ignoring a partial last one", () => {
    expect(patternCount("8bit", 0)).toBe(64);
    expect(patternCount("4bit", 0)).toBe(128);
    expect(patternCount("8bit", 3)).toBe(63);
    expect(patternCount("4bit", 0x3f81)).toBe(0);
    expect(patternCount("8bit", 0x4000)).toBe(0);
    expect(patternCount("8bit", -1)).toBe(0);
  });

  it("maps between pattern numbers and bank offsets", () => {
    expect(patternOffset(2, "8bit", 3)).toBe(0x203);
    expect(patternOffset(3, "4bit", 0)).toBe(0x180);
    expect(patternAt(0x203, "8bit", 3)).toBe(2);
    expect(patternAt(0x302, "8bit", 3)).toBe(2);
    expect(patternAt(2, "8bit", 3)).toBeUndefined();
    expect(patternAt(0x3fff, "8bit", 3)).toBeUndefined();
  });

  it("spans a range of patterns inclusively, in either order", () => {
    expect(patternSpan(1, 2, "8bit", 0)).toEqual({ start: 0x100, end: 0x2ff });
    expect(patternSpan(2, 1, "4bit", 3)).toEqual({ start: 0x83, end: 0x182 });
  });
});

describe("8-bit pixels", () => {
  it("reads one byte per pixel, row by row, from the pattern's offset", () => {
    const bytes = new Uint8Array(0x4000);
    for (let i = 0; i < 256; i++) bytes[0x103 + i] = i;
    const pixels = patternPixels(bytes, 1, { format: "8bit", offset: 3 });
    expect(pixels[0]).toBe(0);
    expect(pixels[17]).toBe(17);
    expect(pixels[255]).toBe(255);
  });

  it("treats a byte equal to the transparency index as transparent", () => {
    const bytes = new Uint8Array(256).fill(0xe3);
    bytes[5] = 0x03;
    const pixels = patternPixels(bytes, 0, { format: "8bit", offset: 0 });
    expect(pixels[0]).toBe(T);
    expect(pixels[5]).toBe(0x03);
    expect(patternPixels(bytes, 0, { format: "8bit", offset: 0, transparencyIndex: 0x03 })[5]).toBe(T);
  });

  it("reads past the buffer as zero rather than throwing", () => {
    expect(patternPixels(new Uint8Array(10), 0, { format: "8bit", offset: 0 })[200]).toBe(0);
  });
});

describe("4-bit pixels", () => {
  it("takes the high nibble for even x and the low nibble for odd x", () => {
    const bytes = new Uint8Array(0x4000);
    bytes[0] = 0x12;
    bytes[1] = 0x45;
    bytes[8] = 0x6a; // row 1, x = 0 and 1
    const pixels = patternPixels(bytes, 0, { format: "4bit", offset: 0 });
    expect([...pixels.slice(0, 4)]).toEqual([0x1, 0x2, 0x4, 0x5]);
    expect([pixels[16], pixels[17]]).toEqual([0x6, 0xa]);
  });

  it("places the palette offset in the high nibble", () => {
    const bytes = new Uint8Array([0x1c]);
    const pixels = patternPixels(bytes, 0, { format: "4bit", offset: 0, paletteOffset: 0xf });
    expect([pixels[0], pixels[1]]).toEqual([0xf1, 0xfc]);
  });

  it("compares a nibble with the low nibble of the transparency index", () => {
    const bytes = new Uint8Array([0x34, 0x43]);
    const pixels = patternPixels(bytes, 0, { format: "4bit", offset: 0, paletteOffset: 2 });
    expect([...pixels.slice(0, 4)]).toEqual([T, 0x24, 0x24, T]);
  });

  it("reads pattern P from P * 128", () => {
    const bytes = new Uint8Array(0x4000);
    bytes[0x183] = 0x9f;
    const pixels = patternPixels(bytes, 3, { format: "4bit", offset: 3 });
    expect([pixels[0], pixels[1]]).toEqual([0x9, 0xf]);
  });
});

describe("pattern hints", () => {
  it("recognises a blank pattern", () => {
    const pixels = patternPixels(new Uint8Array(256).fill(0xe3), 0, { format: "8bit", offset: 0 });
    expect(isBlankPattern(pixels)).toBe(true);
    expect(patternHint(pixels)).toEqual({ kind: "blank", transparent: true, index: T });
  });

  it("counts colours, most used first", () => {
    const bytes = new Uint8Array(256).fill(0xe3);
    bytes.fill(0xe0, 0, 10);
    bytes[20] = 0xff;
    const pixels = patternPixels(bytes, 0, { format: "8bit", offset: 0 });
    expect(patternColours(pixels)).toEqual([
      { index: T, count: 245 },
      { index: 0xe0, count: 10 },
      { index: 0xff, count: 1 }
    ]);
    expect(patternHint(pixels)).toEqual({ kind: "sprite", colours: 2, transparent: 245 });
  });

  it("calls a pattern with many colours noisy", () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    const pixels = patternPixels(bytes, 0, { format: "8bit", offset: 0 });
    expect(patternHint(pixels).kind).toBe("noisy");
  });
});
