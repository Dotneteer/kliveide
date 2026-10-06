import { describe, expect, it } from "vitest";

import {
  clippedFraction,
  effectiveClipWindow,
  isOnScreen,
  PAPER_RECT,
  spriteRect,
  transformPattern
} from "@common/zxnext/sprites/spriteGeometry";

// --- SPRITE_INSPECTOR_PLAN T8: the three branches of zxnext-ula.c's clip window
describe("effectiveClipWindow (T8)", () => {
  it("doubles X with over-border and clipping on", () => {
    expect(effectiveClipWindow([10, 100, 20, 200], true, true)).toEqual({ x1: 20, x2: 201, y1: 20, y2: 200 });
  });

  it("does not clip with over-border on and clipping off", () => {
    expect(effectiveClipWindow([10, 100, 20, 200], true, false)).toEqual({ x1: 0, x2: 319, y1: 0, y2: 255 });
  });

  it("is paper-relative without over-border, Y capped at 223", () => {
    expect(effectiveClipWindow([0, 255, 0, 191], false, true)).toEqual(PAPER_RECT);
    expect(effectiveClipWindow([0, 255, 0, 255], false, false)).toEqual({ x1: 32, x2: 287, y1: 32, y2: 223 });
  });
});

describe("spriteRect: the 9-bit wrap", () => {
  it("places a sprite at its position with 16 << scale", () => {
    expect(spriteRect({ x: 32, y: 32, scaleX: 1, scaleY: 0 })).toEqual({ x1: 32, y1: 32, x2: 63, y2: 47 });
  });

  it("wraps X above 319 and Y above 255 to negative", () => {
    expect(spriteRect({ x: 504, y: 500, scaleX: 0, scaleY: 0 })).toEqual({ x1: -8, y1: -12, x2: 7, y2: 3 });
    expect(spriteRect({ x: 319, y: 255, scaleX: 0, scaleY: 0 }).x1).toBe(319);
    expect(spriteRect({ x: 320, y: 256, scaleX: 0, scaleY: 0 })).toEqual({ x1: -192, y1: -256, x2: -177, y2: -241 });
  });

  it("knows when a sprite is on screen", () => {
    expect(isOnScreen(spriteRect({ x: 504, y: 0, scaleX: 0, scaleY: 0 }))).toBe(true);
    expect(isOnScreen(spriteRect({ x: 320, y: 0, scaleX: 0, scaleY: 0 }))).toBe(false);
  });
});

describe("clippedFraction", () => {
  const clip = { x1: 32, y1: 32, x2: 287, y2: 223 };
  it("is 0 inside, 1 outside, partial across an edge", () => {
    expect(clippedFraction(spriteRect({ x: 100, y: 100, scaleX: 0, scaleY: 0 }), clip)).toBe(0);
    expect(clippedFraction(spriteRect({ x: 0, y: 0, scaleX: 0, scaleY: 0 }), clip)).toBe(1);
    expect(clippedFraction(spriteRect({ x: 24, y: 100, scaleX: 0, scaleY: 0 }), clip)).toBe(0.5);
  });
});

describe("transformPattern (T10)", () => {
  // --- A pattern whose every pixel is its own index, so each output pixel names its source
  const ids = Int16Array.from({ length: 256 }, (_, i) => i);
  const at = (p: Int16Array, sx: number, sy: number) => p[sy * 16 + sx];

  it("is the identity with no transform", () => {
    expect(Array.from(transformPattern(ids, false, false, false))).toEqual(Array.from(ids));
  });

  it("mirrors X and Y", () => {
    expect(at(transformPattern(ids, false, true, false), 0, 0)).toBe(15);
    expect(at(transformPattern(ids, false, false, true), 0, 0)).toBe(15 * 16);
  });

  it("rotates 90° clockwise: the pattern's bottom-left lands top-left", () => {
    const r = transformPattern(ids, true, false, false);
    expect(at(r, 0, 0)).toBe(15 * 16);
    expect(at(r, 15, 0)).toBe(0);
  });

  it("mirrors after rotating, so rotation inverts the X mirror", () => {
    const r = transformPattern(ids, true, true, false);
    expect(at(r, 0, 0)).toBe(0);
  });
});
