import { SPRITE_DIM, SpritePoint, clampToSprite } from "./sprite-raster";

/**
 * Rectangular pixel regions: marking them, lifting them out, and putting them back.
 *
 * Pure, like the raster and document modules, and for the same reason: this is the half of the
 * clipboard that has edge cases (a paste hanging off the corner, a region dragged backwards, a
 * selection that survives a sprite change) and none of them are worth discovering through the UI.
 *
 * **A region is always normalized and always inside the sprite.** Callers hand in two raw drag
 * points; everything downstream can assume `row`/`col` are the top-left and that
 * `row + height <= 16`.
 */

export type SpriteRegion = {
  row: number;
  col: number;
  width: number;
  height: number;
};

/** A lifted rectangle of pixels, with the shape needed to put it back. */
export type SpritePatch = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

export const WHOLE_SPRITE: SpriteRegion = {
  row: 0,
  col: 0,
  width: SPRITE_DIM,
  height: SPRITE_DIM
};

/** Build a region from the two corners of a drag, in any order. */
export function regionFromDrag(from: SpritePoint, to: SpritePoint): SpriteRegion {
  const a = clampToSprite(from);
  const b = clampToSprite(to);
  const row = Math.min(a.row, b.row);
  const col = Math.min(a.col, b.col);
  return {
    row,
    col,
    height: Math.abs(a.row - b.row) + 1,
    width: Math.abs(a.col - b.col) + 1
  };
}

export const regionContains = (region: SpriteRegion, at: SpritePoint): boolean =>
  at.row >= region.row &&
  at.row < region.row + region.height &&
  at.col >= region.col &&
  at.col < region.col + region.width;

export const isWholeSprite = (region: SpriteRegion): boolean =>
  region.row === 0 &&
  region.col === 0 &&
  region.width === SPRITE_DIM &&
  region.height === SPRITE_DIM;

/** Copy a region's pixels out of a sprite. */
export function extractRegion(map: Uint8Array, region: SpriteRegion): SpritePatch {
  const pixels = new Uint8Array(region.width * region.height);
  for (let r = 0; r < region.height; r++) {
    for (let c = 0; c < region.width; c++) {
      pixels[r * region.width + c] = map[(region.row + r) * SPRITE_DIM + (region.col + c)];
    }
  }
  return { width: region.width, height: region.height, pixels };
}

/** Blank a region, which is the other half of a cut. */
export function clearRegion(
  map: Uint8Array,
  region: SpriteRegion,
  fillIndex: number
): Uint8Array {
  const next = new Uint8Array(map);
  for (let r = 0; r < region.height; r++) {
    next.fill(
      fillIndex & 0xff,
      (region.row + r) * SPRITE_DIM + region.col,
      (region.row + r) * SPRITE_DIM + region.col + region.width
    );
  }
  return next;
}

/**
 * Stamp a patch down with its top-left at `at`.
 *
 * **Clips; never wraps and never resizes.** A patch pushed off the right-hand edge loses the
 * columns that fall outside rather than reappearing on the next row - which is what an unclamped
 * `row * 16 + col` would do, and exactly the bug the raster module exists to prevent.
 */
export function pasteRegion(map: Uint8Array, patch: SpritePatch, at: SpritePoint): Uint8Array {
  const next = new Uint8Array(map);
  for (let r = 0; r < patch.height; r++) {
    const row = at.row + r;
    if (row < 0 || row >= SPRITE_DIM) continue;
    for (let c = 0; c < patch.width; c++) {
      const col = at.col + c;
      if (col < 0 || col >= SPRITE_DIM) continue;
      next[row * SPRITE_DIM + col] = patch.pixels[r * patch.width + c];
    }
  }
  return next;
}

/**
 * Where a patch may be positioned.
 *
 * A floating paste is allowed to hang off the edge - you often want the bottom half of something -
 * but not to wander off entirely, which would leave the user nudging an invisible thing. One row or
 * column must stay on the sprite.
 */
export function clampPasteOrigin(at: SpritePoint, patch: SpritePatch): SpritePoint {
  return {
    row: Math.min(SPRITE_DIM - 1, Math.max(1 - patch.height, Math.round(at.row))),
    col: Math.min(SPRITE_DIM - 1, Math.max(1 - patch.width, Math.round(at.col)))
  };
}

/** The region a patch would occupy, for drawing its outline while it floats. */
export const patchRegionAt = (patch: SpritePatch, at: SpritePoint): SpriteRegion => ({
  row: at.row,
  col: at.col,
  width: patch.width,
  height: patch.height
});
