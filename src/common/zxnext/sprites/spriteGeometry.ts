/*
 * Where ZX Spectrum Next sprites land, in sprite space (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.1, T8,
 * T10). Pure; every rule here copies `zxnextUlaProcessSprites` in `zxnext-ula.c`.
 *
 * Sprite space is 320 x 256. The paper's top left is (32, 32), so the paper is (32,32)-(287,223).
 */

export const SPRITE_SPACE_WIDTH = 320;
export const SPRITE_SPACE_HEIGHT = 256;

/** An inclusive rectangle in sprite space. */
export type SpriteSpaceRect = { x1: number; y1: number; x2: number; y2: number };

/** The ULA paper in sprite space. */
export const PAPER_RECT: SpriteSpaceRect = { x1: 32, y1: 32, x2: 287, y2: 223 };

/**
 * The `$19` clip window in sprite space. Its units differ per mode (`zxnext-ula.c`, T8):
 * - over border on, clipping on: X is doubled (`x1 << 1`, `x2 << 1 | 1`), Y as written;
 * - over border on, clipping off: no clip, the whole 320 x 256;
 * - over border off: paper-relative (+32 on every edge), and Y is capped at 223.
 *
 * @param clip `$19`'s four values: x1, x2, y1, y2
 */
export function effectiveClipWindow(
  clip: readonly [number, number, number, number],
  overBorder: boolean,
  clippingEnabled: boolean
): SpriteSpaceRect {
  const [cx1, cx2, cy1, cy2] = clip.map((v) => v & 0xff);
  if (overBorder) {
    if (clippingEnabled) {
      return { x1: cx1 << 1, x2: (cx2 << 1) | 1, y1: cy1, y2: cy2 };
    }
    return { x1: 0, x2: SPRITE_SPACE_WIDTH - 1, y1: 0, y2: SPRITE_SPACE_HEIGHT - 1 };
  }
  return { x1: cx1 + 32, x2: cx2 + 32, y1: cy1 + 32, y2: Math.min(cy2 + 32, 223) };
}

/** The fields of a resolved sprite the geometry needs. */
export type SpritePlacement = { x: number; y: number; scaleX: number; scaleY: number };

/**
 * The sprite's on-screen rectangle (inclusive), with the 9-bit wrap: an X above 319 or a Y above
 * 255 is negative (`- 512`). The size is `16 << scale` per axis, and rotation does not swap it.
 */
export function spriteRect({ x, y, scaleX, scaleY }: SpritePlacement): SpriteSpaceRect {
  let sx = x & 0x1ff;
  let sy = y & 0x1ff;
  if (sx > 319) sx -= 512;
  if (sy > 255) sy -= 512;
  return { x1: sx, y1: sy, x2: sx + (16 << (scaleX & 3)) - 1, y2: sy + (16 << (scaleY & 3)) - 1 };
}

/** The overlap of two rectangles, or `undefined` when they do not touch. */
export function intersectRect(a: SpriteSpaceRect, b: SpriteSpaceRect): SpriteSpaceRect | undefined {
  const r = {
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    x2: Math.min(a.x2, b.x2),
    y2: Math.min(a.y2, b.y2)
  };
  return r.x1 <= r.x2 && r.y1 <= r.y2 ? r : undefined;
}

export const rectArea = (r: SpriteSpaceRect) => (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);

const SPRITE_SPACE: SpriteSpaceRect = {
  x1: 0,
  y1: 0,
  x2: SPRITE_SPACE_WIDTH - 1,
  y2: SPRITE_SPACE_HEIGHT - 1
};

/** Any part of the rectangle is inside the 320 x 256 sprite space. */
export function isOnScreen(rect: SpriteSpaceRect): boolean {
  return intersectRect(rect, SPRITE_SPACE) !== undefined;
}

/**
 * How much of the rectangle the clip window and the edge of sprite space hide, `0..1`: 0 when it is
 * entirely shown, 1 when nothing of it is.
 */
export function clippedFraction(rect: SpriteSpaceRect, clip: SpriteSpaceRect): number {
  const window = intersectRect(clip, SPRITE_SPACE);
  const shown = window ? intersectRect(rect, window) : undefined;
  return shown ? 1 - rectArea(shown) / rectArea(rect) : 1;
}

/**
 * A 16 x 16 pattern as the engine shows it, before scale (T10). The hardware rotates 90° clockwise
 * first and mirrors in screen space afterwards, so rotation inverts the X mirror. The mapping is
 * `zxnextSpritesVariantScreenOffset` (`zxnext-sprites.c`): pattern pixel (row, col) lands on screen
 * pixel (sx, sy).
 */
export function transformPattern<T extends ArrayLike<number> & { length: number }>(
  pixels: T,
  rotate: boolean,
  xmirror: boolean,
  ymirror: boolean
): Int16Array {
  const out = new Int16Array(256);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      let sx: number;
      let sy: number;
      if (rotate) {
        sx = xmirror ? row : 15 - row;
        sy = ymirror ? 15 - col : col;
      } else {
        sx = xmirror ? 15 - col : col;
        sy = ymirror ? 15 - row : row;
      }
      out[(sy << 4) | sx] = pixels[(row << 4) | col];
    }
  }
  return out;
}

/** The variant index the core stores a transform under: `rotate << 2 | xmirror << 1 | ymirror`. */
export function transformVariant(rotate: boolean, xmirror: boolean, ymirror: boolean): number {
  return (rotate ? 4 : 0) | (xmirror ? 2 : 0) | (ymirror ? 1 : 0);
}
