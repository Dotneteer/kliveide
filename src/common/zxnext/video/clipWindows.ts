/*
 * The ZX Spectrum Next's layer clip windows in one coordinate space
 * (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.6): the 320 x 256 layer space, whose paper's top left is
 * (32, 32). Every rule copies the core's renderer (`zxnext-ula.c`), which follows `zxnext.vhd`.
 *
 * Each register holds four 8-bit values, x1, x2, y1, y2, written in turn; the units differ:
 * - ULA (`$1A`) and Layer 2 at 256 x 192 (`$18`): paper-relative pixels, so +32 on every edge;
 * - Layer 2 at 320 / 640 wide, the tilemap (`$1B`), and sprites over the border with clipping on
 *   (`$19`): X in units of two layer pixels (`x1 << 1` .. `x2 << 1 | 1`), Y as written;
 * - sprites over the border with clipping off: no clip; sprites not over the border: paper-relative,
 *   Y capped at the paper's last line.
 */

export const LAYER_SPACE_WIDTH = 320;
export const LAYER_SPACE_HEIGHT = 256;

/** An inclusive rectangle in layer space. */
export type LayerRect = { x1: number; y1: number; x2: number; y2: number };

/** The ULA paper in layer space. */
export const PAPER_RECT: LayerRect = { x1: 32, y1: 32, x2: 287, y2: 223 };

/** The whole 320 x 256 layer space. */
export const LAYER_SPACE_RECT: LayerRect = {
  x1: 0,
  y1: 0,
  x2: LAYER_SPACE_WIDTH - 1,
  y2: LAYER_SPACE_HEIGHT - 1
};

export type ClipValues = readonly [number, number, number, number];

const bytes = (clip: ClipValues) => clip.map((v) => v & 0xff) as [number, number, number, number];

/** A clip window whose X is in two-pixel units: `x1 << 1` .. `x2 << 1 | 1`, Y as written. */
function doubledX(clip: ClipValues): LayerRect {
  const [x1, x2, y1, y2] = bytes(clip);
  return { x1: x1 << 1, x2: (x2 << 1) | 1, y1, y2 };
}

/** A paper-relative clip window (+32 on every edge), Y capped at `maxY`. */
function paperRelative(clip: ClipValues, maxY: number): LayerRect {
  const [x1, x2, y1, y2] = bytes(clip);
  return { x1: x1 + 32, x2: x2 + 32, y1: y1 + 32, y2: Math.min(y2 + 32, maxY) };
}

/** `$1A`: the ULA (and LoRes) clip window. */
export function ulaClipWindow(clip: ClipValues): LayerRect {
  return paperRelative(clip, PAPER_RECT.y2);
}

/** `$18`: the Layer 2 clip window; `wide` for the 320 x 256 and 640 x 256 resolutions. */
export function layer2ClipWindow(clip: ClipValues, wide: boolean): LayerRect {
  return wide ? doubledX(clip) : paperRelative(clip, PAPER_RECT.y2);
}

/** `$19`: the sprite clip window, which depends on `$15`'s over-border and clipping bits. */
export function spriteClipWindow(
  clip: ClipValues,
  overBorder: boolean,
  clippingEnabled: boolean
): LayerRect {
  if (overBorder) return clippingEnabled ? doubledX(clip) : { ...LAYER_SPACE_RECT };
  return paperRelative(clip, PAPER_RECT.y2);
}

/**
 * `$1B`: the tilemap clip window, in 320-wide layer space for both column modes. The core compares
 * an 80-column pixel's `x >> 1` with it (TILEMAP_INSPECTOR_PLAN T6).
 */
export function tilemapClipWindow(clip: ClipValues): LayerRect {
  return doubledX(clip);
}
