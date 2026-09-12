import { describe, it, expect } from "vitest";
import {
  WHOLE_SPRITE,
  clampPasteOrigin,
  clearRegion,
  extractRegion,
  isWholeSprite,
  pasteRegion,
  regionContains,
  regionFromDrag
} from "@renderer/features/sprite-editor/sprite-selection";
import { SPRITE_DIM, SPRITE_SIZE } from "@renderer/features/sprite-editor/sprite-raster";

const BG = 0x00;
const blank = () => new Uint8Array(SPRITE_SIZE).fill(BG);
const at = (m: Uint8Array, r: number, c: number) => m[r * SPRITE_DIM + c];
/** A sprite where every pixel encodes its own index, so a move is traceable. */
const numbered = () => new Uint8Array(SPRITE_SIZE).map((_, i) => i & 0xff);

describe("regionFromDrag", () => {
  it("normalizes a drag made in any direction", () => {
    const forward = regionFromDrag({ row: 2, col: 3 }, { row: 5, col: 7 });
    expect(forward).toEqual({ row: 2, col: 3, height: 4, width: 5 });
    // Dragging up-and-left must produce the same rectangle, not a negative one.
    expect(regionFromDrag({ row: 5, col: 7 }, { row: 2, col: 3 })).toEqual(forward);
  });

  it("is inclusive of both ends, so a click selects one pixel", () => {
    expect(regionFromDrag({ row: 4, col: 4 }, { row: 4, col: 4 })).toEqual({
      row: 4,
      col: 4,
      width: 1,
      height: 1
    });
  });

  it("clips a drag that leaves the sprite", () => {
    const r = regionFromDrag({ row: -8, col: -8 }, { row: 40, col: 40 });
    expect(r).toEqual({ row: 0, col: 0, width: SPRITE_DIM, height: SPRITE_DIM });
    expect(isWholeSprite(r)).toBe(true);
  });

  it("reports what it contains", () => {
    const r = regionFromDrag({ row: 2, col: 2 }, { row: 4, col: 4 });
    expect(regionContains(r, { row: 3, col: 3 })).toBe(true);
    expect(regionContains(r, { row: 4, col: 4 })).toBe(true);
    expect(regionContains(r, { row: 5, col: 4 })).toBe(false);
    expect(regionContains(r, { row: 2, col: 1 })).toBe(false);
  });
});

describe("extractRegion / clearRegion", () => {
  it("lifts exactly the rectangle asked for", () => {
    const patch = extractRegion(numbered(), { row: 1, col: 2, width: 3, height: 2 });
    expect(patch.width).toBe(3);
    expect(patch.height).toBe(2);
    expect([...patch.pixels]).toEqual([18, 19, 20, 34, 35, 36]);
  });

  it("clears only the rectangle, to the given index", () => {
    const cleared = clearRegion(numbered(), { row: 1, col: 2, width: 3, height: 2 }, 0xe3);
    expect(at(cleared, 1, 2)).toBe(0xe3);
    expect(at(cleared, 2, 4)).toBe(0xe3);
    expect(at(cleared, 1, 1)).toBe(17); // just outside
    expect(at(cleared, 3, 2)).toBe(50);
  });

  it("never mutates the source", () => {
    const start = numbered();
    const snapshot = [...start];
    extractRegion(start, WHOLE_SPRITE);
    clearRegion(start, WHOLE_SPRITE, 1);
    expect([...start]).toEqual(snapshot);
  });
});

describe("pasteRegion", () => {
  it("round-trips a cut and paste back to where it came from", () => {
    const start = numbered();
    const region = { row: 3, col: 4, width: 5, height: 4 };
    const patch = extractRegion(start, region);
    const cut = clearRegion(start, region, 0);
    const back = pasteRegion(cut, patch, { row: region.row, col: region.col });
    expect([...back]).toEqual([...start]);
  });

  /*
   * Clipping, never wrapping. An unclamped `row * 16 + col` would reappear on the next row, which
   * is the same class of bug the raster module was built to prevent.
   */
  it("clips at the right-hand edge instead of wrapping to the next row", () => {
    const patch = { width: 4, height: 1, pixels: Uint8Array.from([1, 2, 3, 4]) };
    const out = pasteRegion(blank(), patch, { row: 5, col: 14 });
    expect(at(out, 5, 14)).toBe(1);
    expect(at(out, 5, 15)).toBe(2);
    // 3 and 4 fall off the edge and must not appear at the start of row 6.
    expect(at(out, 6, 0)).toBe(BG);
    expect(at(out, 6, 1)).toBe(BG);
  });

  it("clips at every other edge too", () => {
    const patch = { width: 3, height: 3, pixels: new Uint8Array(9).fill(7) };
    const topLeft = pasteRegion(blank(), patch, { row: -2, col: -2 });
    expect(at(topLeft, 0, 0)).toBe(7);
    expect([...topLeft].filter((v) => v === 7).length).toBe(1);

    const bottom = pasteRegion(blank(), patch, { row: 15, col: 15 });
    expect(at(bottom, 15, 15)).toBe(7);
    expect([...bottom].filter((v) => v === 7).length).toBe(1);
  });

  it("overwrites the whole rectangle, transparent pixels included", () => {
    // So that cutting and pasting elsewhere reproduces the source exactly.
    const start = new Uint8Array(SPRITE_SIZE).fill(9);
    const patch = { width: 2, height: 1, pixels: Uint8Array.from([0xe3, 5]) };
    const out = pasteRegion(start, patch, { row: 0, col: 0 });
    expect(at(out, 0, 0)).toBe(0xe3);
    expect(at(out, 0, 1)).toBe(5);
  });
});

describe("clampPasteOrigin", () => {
  it("lets a patch hang off an edge but not leave entirely", () => {
    const patch = { width: 4, height: 4, pixels: new Uint8Array(16) };
    // One row/column must stay on the sprite, or the user nudges something invisible.
    expect(clampPasteOrigin({ row: -99, col: -99 }, patch)).toEqual({ row: -3, col: -3 });
    expect(clampPasteOrigin({ row: 99, col: 99 }, patch)).toEqual({ row: 15, col: 15 });
    expect(clampPasteOrigin({ row: 4, col: 6 }, patch)).toEqual({ row: 4, col: 6 });
  });
});
