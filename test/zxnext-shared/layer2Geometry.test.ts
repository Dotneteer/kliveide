import { describe, expect, it } from "vitest";

import { LAYER2_NO_PIXEL, LAYER2_READ_BYTES, layer2Image, layer2Size } from "@common/zxnext/layer2/layer2Decode";
import {
  bankIndexAt,
  bankRegions,
  clipOnLayer,
  displayedImage,
  effectiveClip,
  readsPastLayer,
  sourceColumn,
  sourceRow,
  visibleWindow,
  wideWrappedX,
  wrappedY256
} from "@common/zxnext/layer2/layer2Geometry";
import { l2regs, patternSet } from "./layer2Fixtures";

/** The X wrap as `_layer2-helpers.ts` (the layer2.vhd transcription) writes it. */
function modelWideX(xPre: number): number {
  let x = xPre & 0x1ff;
  if (xPre >= 512 || ((xPre & 0x100) !== 0 && (xPre & 0xc0) !== 0)) x = (((((xPre >> 6) & 7) + 3) & 7) << 6) | (xPre & 0x3f);
  return x;
}

describe("Layer 2 geometry: scroll (T4)", () => {
  it("wraps wide X like layer2.vhd for every X 0-1023", () => {
    for (let x = 0; x < 1024; x++) {
      // --- the model covers the reachable range (319 + 511); beyond it both reduce x to 10 bits
      if (x <= 830) expect(wideWrappedX(x), `x = ${x}`).toBe(modelWideX(x));
      expect(wideWrappedX(x)).toBeLessThan(512);
    }
    expect(wideWrappedX(320)).toBe(0);
    expect(wideWrappedX(511)).toBe(191);
    expect(wideWrappedX(512)).toBe(192); // --- 512: bits 8-6 = 0 + 3
  });

  it("folds 256 x 192 rows back by adding one to bits 7-6", () => {
    expect(wrappedY256(191)).toBe(191);
    expect(wrappedY256(192)).toBe(0);
    expect(wrappedY256(300)).toBe(64 + 44);
    expect(wrappedY256(446)).toBe(254);
  });

  it("maps display pixels to source pixels per resolution", () => {
    expect(sourceColumn(l2regs({ scrollX: 0x1f0 }), 20)).toBe((20 + 0x1f0) & 0xff);
    expect(sourceColumn(l2regs({ resolution: 1, scrollX: 10 }), 315)).toBe(5);
    // --- 640: the scroll moves in 320-wide units, so two pixels at a time
    expect(sourceColumn(l2regs({ resolution: 2, scrollX: 1 }), 0)).toBe(2);
    expect(sourceColumn(l2regs({ resolution: 2, scrollX: 1 }), 1)).toBe(3);
    expect(sourceRow(l2regs({ resolution: 1, scrollY: 250 }), 10)).toBe(4);
  });
});

describe("Layer 2 geometry: clip (T8)", () => {
  it("is paper-relative at 256 x 192, doubled X when wide, doubled again at 640", () => {
    expect(effectiveClip(l2regs())).toEqual({ x1: 0, x2: 255, y1: 0, y2: 191 });
    expect(effectiveClip(l2regs({ resolution: 1, clip: [0, 159, 0, 255] }))).toEqual({ x1: 0, x2: 319, y1: 0, y2: 255 });
    expect(effectiveClip(l2regs({ resolution: 2, clip: [1, 2, 3, 4] }))).toEqual({ x1: 4, x2: 11, y1: 3, y2: 4 });
  });

  it("is empty when x1 > x2", () => {
    expect(clipOnLayer(l2regs({ clip: [10, 5, 0, 191] }))).toBeUndefined();
    expect(visibleWindow(l2regs({ clip: [10, 5, 0, 191] }))).toEqual([]);
  });
});

describe("Layer 2 geometry: visible window and the displayed image (D5)", () => {
  it("is the whole layer when nothing scrolls or clips", () => {
    expect(visibleWindow(l2regs())).toEqual([{ x1: 0, x2: 255, y1: 0, y2: 191 }]);
    expect(visibleWindow(l2regs({ resolution: 1, clip: [0, 159, 0, 255] }))).toEqual([{ x1: 0, x2: 319, y1: 0, y2: 255 }]);
  });

  it("splits where the scroll wraps", () => {
    const w = visibleWindow(l2regs({ resolution: 1, scrollX: 300, clip: [0, 159, 0, 255] }));
    expect(w).toEqual([
      { x1: 0, x2: 319, y1: 0, y2: 255 }
    ]);
    const small = visibleWindow(l2regs({ resolution: 1, scrollX: 310, scrollY: 250, clip: [0, 9, 0, 9] }));
    expect(small).toEqual([
      { x1: 0, x2: 9, y1: 0, y2: 3 },
      { x1: 310, x2: 319, y1: 0, y2: 3 },
      { x1: 0, x2: 9, y1: 250, y2: 255 },
      { x1: 310, x2: 319, y1: 250, y2: 255 }
    ]);
  });

  it("takes each displayed pixel from its scrolled source and clears outside the clip", () => {
    const data = patternSet();
    const regs = l2regs({ resolution: 1, scrollX: 37, scrollY: 200, clip: [2, 150, 5, 250] });
    const whole = layer2Image(1, data, 0);
    const shown = displayedImage(regs, data);
    const { width } = layer2Size(1);
    expect(shown[0]).toBe(LAYER2_NO_PIXEL);
    expect(shown[10 * width + 100]).toBe(whole[((10 + 200) & 0xff) * width + 137]);
  });

  it("T4: reads past the layer's banks when the X scroll reaches source columns 320-511", () => {
    const data = new Uint8Array(LAYER2_READ_BYTES);
    data[(320 << 8) | 0] = 0x42; // --- column 320: bank +5
    // --- display column 137 + scroll 503 = 640: bits 8-6 (2) + 3 = 5, so source column 320
    const regs = l2regs({ resolution: 1, scrollX: 503, clip: [0, 159, 0, 255] });
    expect(sourceColumn(regs, 137)).toBe(320);
    expect(displayedImage(regs, data)[137]).toBe(0x42);
    expect(readsPastLayer(regs)).toBe(true);
    expect(readsPastLayer(l2regs({ resolution: 1, scrollX: 100, clip: [0, 159, 0, 255] }))).toBe(false);
    // --- 256 x 192: rows 192-254 come from the fourth bank
    expect(readsPastLayer(l2regs({ scrollY: 255 }))).toBe(true);
    expect(readsPastLayer(l2regs({ scrollY: 255, clip: [0, 255, 0, 0] }))).toBe(false);
  });
});

describe("Layer 2 geometry: banks (T3)", () => {
  it("bands rows at 256 x 192 and columns wide", () => {
    expect(bankRegions(0).map((b) => b.rect)).toEqual([
      { x1: 0, x2: 255, y1: 0, y2: 63 },
      { x1: 0, x2: 255, y1: 64, y2: 127 },
      { x1: 0, x2: 255, y1: 128, y2: 191 }
    ]);
    expect(bankRegions(1).map((b) => b.rect.x1)).toEqual([0, 64, 128, 192, 256]);
    expect(bankRegions(2).map((b) => b.rect.x1)).toEqual([0, 128, 256, 384, 512]);
    expect(bankIndexAt(0, 0, 130)).toBe(2);
    expect(bankIndexAt(1, 130, 0)).toBe(2);
    expect(bankIndexAt(2, 130, 0)).toBe(1);
  });
});
