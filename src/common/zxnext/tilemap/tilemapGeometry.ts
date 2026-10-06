/*
 * Where the tilemap lands (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.1, T6). Pure.
 *
 * Coordinates are **layer pixels**: 320 x 256 at 40 columns, 640 x 256 at 80 (T6), with (0, 0) the
 * top left of the 320 x 256 layer space (the paper starts at (32, 32) in 320-wide units). The map is
 * as wide as the layer, so the display is a scrolled, wrapped and clipped view of the whole map (D4).
 */
import { tilemapClipWindow, type LayerRect } from "../video/clipWindows";
import { TILEMAP_HEIGHT, type TilemapMode, type TilemapRegs } from "./tilemapDecode";

export type { LayerRect } from "../video/clipWindows";

/** Layer pixels per 320-wide unit: 1 at 40 columns, 2 at 80 */
const xScale = (mode: Pick<TilemapMode, "columns">) => (mode.columns === 80 ? 2 : 1);

/**
 * The `$1B` clip window in layer pixels (T6): `x1 << 1` .. `x2 << 1 | 1` in 320-wide units, so at
 * 80 columns `x1 << 2` .. `x2 << 2 | 3`. Y as written.
 */
export function effectiveClip(regs: Pick<TilemapRegs, "clip">, mode: Pick<TilemapMode, "columns">): LayerRect {
  const r = tilemapClipWindow(regs.clip);
  const s = xScale(mode);
  return { x1: r.x1 * s, x2: r.x2 * s + (s - 1), y1: r.y1, y2: r.y2 };
}

/** A rectangle clipped to the layer, or undefined when nothing of it is on the layer. */
function onLayer(r: LayerRect, width: number): LayerRect | undefined {
  const c = {
    x1: Math.max(0, r.x1),
    y1: Math.max(0, r.y1),
    x2: Math.min(width - 1, r.x2),
    y2: Math.min(TILEMAP_HEIGHT - 1, r.y2)
  };
  return c.x1 <= c.x2 && c.y1 <= c.y2 ? c : undefined;
}

/** Splits [a, b] (inclusive, a in range) into the parts on either side of a wrap at `size`. */
function wrapSpan(a: number, b: number, size: number): [number, number][] {
  if (b < size) return [[a, b]];
  return [
    [a, size - 1],
    [0, b - size]
  ];
}

/**
 * The part of the unscrolled map that reaches the screen: the clip window moved by the scroll, wrapped
 * both ways, so up to four rectangles (D4). Empty when the clip window is empty.
 */
export function visibleWindow(regs: TilemapRegs, mode: TilemapMode): LayerRect[] {
  const clip = onLayer(effectiveClip(regs, mode), mode.width);
  if (!clip) return [];
  const sx = regs.scrollX % mode.width;
  const sy = regs.scrollY & 0xff;
  const xs = wrapSpan(clip.x1 + sx, clip.x2 + sx, mode.width);
  const ys = wrapSpan(clip.y1 + sy, clip.y2 + sy, TILEMAP_HEIGHT);
  const out: LayerRect[] = [];
  for (const [y1, y2] of ys) for (const [x1, x2] of xs) out.push({ x1, x2, y1, y2 });
  return out;
}

/** The map pixel shown at layer pixel (x, y) of the display (scroll applied, clip not). */
export function mapPixelOfDisplay(regs: TilemapRegs, mode: TilemapMode, x: number, y: number): { x: number; y: number } {
  return { x: (x + regs.scrollX) % mode.width, y: (y + regs.scrollY) & 0xff };
}

/** Whether layer pixel (x, y) of the display is inside the clip window. */
export function isInsideClip(regs: TilemapRegs, mode: TilemapMode, x: number, y: number): boolean {
  const c = effectiveClip(regs, mode);
  return x >= c.x1 && x <= c.x2 && y >= c.y1 && y <= c.y2;
}

/**
 * The cell under layer pixel (x, y) of the view: of the map itself (*Whole map*) or of the display
 * (*As displayed*, scroll applied). Undefined off the layer.
 */
export function cellAtLayerPixel(
  regs: TilemapRegs,
  mode: TilemapMode,
  x: number,
  y: number,
  asDisplayed: boolean
): { col: number; row: number } | undefined {
  if (x < 0 || y < 0 || x >= mode.width || y >= TILEMAP_HEIGHT) return undefined;
  const p = asDisplayed ? mapPixelOfDisplay(regs, mode, x, y) : { x, y };
  return { col: p.x >> 3, row: p.y >> 3 };
}

/** A cell's rectangle on the unscrolled map, in layer pixels. */
export function layerPixelOfCell(col: number, row: number): LayerRect {
  return { x1: col * 8, y1: row * 8, x2: col * 8 + 7, y2: row * 8 + 7 };
}

/**
 * Where a cell appears on the display (*As displayed*), as up to four rectangles (a cell can straddle
 * the wrap), before clipping.
 */
export function displayRectsOfCell(regs: TilemapRegs, mode: TilemapMode, col: number, row: number): LayerRect[] {
  const x = (((col * 8 - regs.scrollX) % mode.width) + mode.width) % mode.width;
  const y = (((row * 8 - (regs.scrollY & 0xff)) % TILEMAP_HEIGHT) + TILEMAP_HEIGHT) % TILEMAP_HEIGHT;
  const out: LayerRect[] = [];
  for (const [y1, y2] of wrapSpan(y, y + 7, TILEMAP_HEIGHT)) {
    for (const [x1, x2] of wrapSpan(x, x + 7, mode.width)) out.push({ x1, x2, y1, y2 });
  }
  return out;
}

/** Whether any part of a cell reaches the screen (inside the visible window). */
export function isCellVisible(regs: TilemapRegs, mode: TilemapMode, col: number, row: number): boolean {
  const clip = effectiveClip(regs, mode);
  return displayRectsOfCell(regs, mode, col, row).some(
    (r) => r.x1 <= clip.x2 && r.x2 >= clip.x1 && r.y1 <= clip.y2 && r.y2 >= clip.y1
  );
}
