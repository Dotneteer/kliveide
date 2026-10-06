import { describe, expect, it } from "vitest";

import {
  byteAddress,
  isPriorityEntry,
  isTransparentEntry,
  LAYER2_NO_PIXEL,
  layer2ByteOffset,
  layer2Image,
  layer2Index,
  layer2PaletteIndex,
  layer2Resolution,
  layer2Size,
  pixelAddress,
  windowZ80Address,
  writeTarget
} from "@common/zxnext/layer2/layer2Decode";
import { l2regs, patternSet } from "./layer2Fixtures";

describe("Layer 2 decode: sizes and addressing (T2, T3)", () => {
  it("knows the three resolutions; $70 1X is 640 x 256", () => {
    expect(layer2Size(0)).toMatchObject({ width: 256, height: 192, bytes: 0xc000, banks: 3, wide: false });
    expect(layer2Size(1)).toMatchObject({ width: 320, height: 256, bytes: 0x14000, banks: 5, wide: true, nibbles: false });
    expect(layer2Size(2)).toMatchObject({ width: 640, height: 256, banks: 5, nibbles: true });
    expect(layer2Resolution(3)).toBe(2);
    expect(layer2Size(3).width).toBe(640);
  });

  it("is row-major at 256 x 192 and column-major in the wide modes", () => {
    expect(layer2ByteOffset(0, 10, 3)).toEqual({ offset: 0x030a });
    expect(layer2ByteOffset(1, 10, 3)).toEqual({ offset: 0x0a03 });
    expect(layer2ByteOffset(1, 319, 255)).toEqual({ offset: 0x13fff });
  });

  it("packs two 640 x 256 pixels per byte, high nibble first", () => {
    expect(layer2ByteOffset(2, 20, 3)).toEqual({ offset: 0x0a03, nibble: "hi" });
    expect(layer2ByteOffset(2, 21, 3)).toEqual({ offset: 0x0a03, nibble: "lo" });
    const data = new Uint8Array(0x14000);
    data[0x0a03] = 0x9c;
    expect(layer2Index(2, data, 20, 3, 0)).toBe(0x09);
    expect(layer2Index(2, data, 21, 3, 0)).toBe(0x0c);
  });

  it("decodes the whole image pixel for pixel in all three modes", () => {
    const data = patternSet();
    for (const res of [0, 1, 2]) {
      const { width, height } = layer2Size(res);
      const image = layer2Image(res, data, 0);
      expect(image.length).toBe(width * height);
      for (const [x, y] of [[0, 0], [width - 1, height - 1], [17, 101]]) {
        const { offset, nibble } = layer2ByteOffset(res, x, y);
        const b = data[offset];
        const want = nibble === "hi" ? b >> 4 : nibble === "lo" ? b & 15 : b;
        expect(image[y * width + x], `res ${res} (${x},${y})`).toBe(want);
      }
    }
  });
});

describe("Layer 2 decode: palette offset (T7)", () => {
  it("adds the offset to the high nibble of an 8-bit pixel, wrapping at 16", () => {
    expect(layer2PaletteIndex(0, 0x3a, 2)).toBe(0x5a);
    expect(layer2PaletteIndex(1, 0xf1, 3)).toBe(0x21);
  });

  it("makes the offset the high nibble of a 640 x 256 pixel", () => {
    expect(layer2PaletteIndex(2, 0x0a, 0)).toBe(0x0a);
    expect(layer2PaletteIndex(2, 0x0a, 7)).toBe(0x7a);
  });
});

describe("Layer 2 decode: the 2 MB limit (T5)", () => {
  it("has no pixel in a bank past 2 MB", () => {
    const data = patternSet();
    // --- $12 = 110: banks 110, 111 are RAM, 112 is not (256 x 192: rows 128-191)
    expect(layer2Index(0, data, 0, 127, 0, 110)).toBeDefined();
    expect(layer2Index(0, data, 0, 128, 0, 110)).toBeUndefined();
    const image = layer2Image(0, data, 0, 110);
    expect(image[128 * 256]).toBe(LAYER2_NO_PIXEL);
    // --- wide: column-major, so the banks are column bands
    expect(layer2Index(1, data, 127, 0, 0, 110)).toBeDefined();
    expect(layer2Index(1, data, 128, 0, 0, 110)).toBeUndefined();
  });
});

describe("Layer 2 decode: addresses (D6)", () => {
  it("gives bank:offset, the 8K page and the physical address", () => {
    const a = pixelAddress(1, 9, 100, 7); // --- set offset $6407: bank 9 + 1, offset $2407
    expect(a).toMatchObject({ bank16: 10, offset: 0x2407, setOffset: 0x6407, page8k: 21, physical: 0x040000 + 10 * 0x4000 + 0x2407 });
    expect(pixelAddress(2, 9, 201, 7).nibble).toBe("lo");
    expect(byteAddress(111, 0x4000).outsideRam).toBe(true);
  });
});

describe("Layer 2 decode: the $123B window (T1)", () => {
  it("maps 16K of $12 at $0000-$3FFF, segment by bits 7-6", () => {
    for (const segment of [0, 1, 2]) {
      const t = writeTarget(l2regs({ port123B: (segment << 6) | 0x01 }));
      expect(t).toMatchObject({ mappedForWrites: true, mappedForReads: false, useShadow: false, segment });
      expect(t.slices).toEqual([{ z80Start: 0, z80End: 0x3fff, bank16: 8 + segment, outsideRam: false }]);
    }
  });

  it("maps 48K for segment 3", () => {
    const t = writeTarget(l2regs({ port123B: 0xc5 }));
    expect(t.mappedForReads).toBe(true);
    expect(t.slices.map((s) => [s.z80Start, s.bank16])).toEqual([[0, 8], [0x4000, 9], [0x8000, 10]]);
  });

  it("maps the shadow bank with bit 3", () => {
    const t = writeTarget(l2regs({ port123B: 0x49, shadowBank: 20 }));
    expect(t.useShadow).toBe(true);
    expect(t.slices[0].bank16).toBe(21);
  });

  it("adds the bank offset modulo 8 to the segment, then wraps the bank at 128", () => {
    expect(writeTarget(l2regs({ port123B: 0x81, bankOffset: 3 })).slices[0].bank16).toBe(8 + 5);
    expect(writeTarget(l2regs({ port123B: 0x81, bankOffset: 7 })).slices[0].bank16).toBe(8 + 1);
    expect(writeTarget(l2regs({ port123B: 0x01, activeBank: 126, bankOffset: 4 })).slices[0]).toMatchObject({
      bank16: 2,
      outsideRam: false
    });
    expect(writeTarget(l2regs({ port123B: 0x01, activeBank: 115 })).slices[0].outsideRam).toBe(true);
  });

  it("covers every $123B value and offset without throwing, and finds Z80 addresses", () => {
    for (let p = 0; p < 256; p++) {
      if (p & 0x10) continue;
      for (let off = 0; off < 8; off++) {
        const t = writeTarget(l2regs({ port123B: p, bankOffset: off }));
        expect(t.slices.length).toBe((p >> 6) === 3 ? 3 : 1);
      }
    }
    const t = writeTarget(l2regs({ port123B: 0xc1 }));
    expect(windowZ80Address(t, 0x040000 + 9 * 0x4000 + 0x123)).toBe(0x4123);
    expect(windowZ80Address(t, 0x040000 + 12 * 0x4000)).toBeUndefined();
  });
});

describe("Layer 2 decode: palette entries (T6, D10)", () => {
  it("compares RGB(8:1) with $14, so two entries differing in blue bit 0 are both transparent", () => {
    expect(isTransparentEntry(0xe3 << 1, 0xe3)).toBe(true);
    expect(isTransparentEntry((0xe3 << 1) | 1, 0xe3)).toBe(true);
    expect(isTransparentEntry(0x200 | (0xe3 << 1), 0xe3)).toBe(true);
    expect(isTransparentEntry(0xe2 << 1, 0xe3)).toBe(false);
  });

  it("reads the priority bit", () => {
    expect(isPriorityEntry(0x200 | 0x1ff)).toBe(true);
    expect(isPriorityEntry(0x1ff)).toBe(false);
  });
});
