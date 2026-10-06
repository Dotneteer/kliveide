/*
 * Where Layer 2 lands (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.1, T3, T4, T8). Pure.
 *
 * Coordinates are layer pixels of the resolution (`layer2Decode.ts`). The scroll rules copy
 * `zxnext-ula.c` (`zxnextUlaLayer2WrappedY`, `zxnextUlaLayer2WideWrappedX`), the clip goes through the
 * shared `clipWindows.ts`. X and Y map independently, so the display is a product of a column map and
 * a row map, which is how the visible window is found.
 */
import { layer2ClipWindow, type LayerRect } from "../video/clipWindows";
import { LAYER2_NO_PIXEL, layer2Index, layer2Size, type Layer2Regs } from "./layer2Decode";

export type { LayerRect } from "../video/clipWindows";

/**
 * 256 x 192: the scrolled row folds back once it reaches 192 by adding one to bits 7-6 (`layer2.vhd`),
 * so rows 192-255 land on 0-63, 256-319 on 64-127, ... - not a plain modulo.
 */
export function wrappedY256(y: number): number {
  if (y >= 192) return ((((y >> 6) + 1) & 0x03) << 6) | (y & 0x3f);
  return y & 0xff;
}

/**
 * The wide modes' scrolled X, in 320-wide units (T4): past 319, bits 8-6 gain 3, which wraps 320-511
 * to 0-191 but 512 and up somewhere else - not a modulo of 320.
 */
export function wideWrappedX(x: number): number {
  x &= 0x3ff;
  if (x >= 320) x = ((((x >> 6) & 0x07) + 3) << 6) | (x & 0x3f);
  return x & 0x1ff;
}

/** The source column (layer pixel) the display shows at column `dx`. */
export function sourceColumn(regs: Pick<Layer2Regs, "resolution" | "scrollX">, dx: number): number {
  const size = layer2Size(regs.resolution);
  if (!size.wide) return (dx + regs.scrollX) & 0xff;
  if (!size.nibbles) return wideWrappedX(dx + (regs.scrollX & 0x1ff));
  return (wideWrappedX((dx >> 1) + (regs.scrollX & 0x1ff)) << 1) | (dx & 1);
}

/** The source row the display shows at row `dy`. */
export function sourceRow(regs: Pick<Layer2Regs, "resolution" | "scrollY">, dy: number): number {
  return layer2Size(regs.resolution).wide ? (dy + regs.scrollY) & 0xff : wrappedY256(dy + (regs.scrollY & 0xff));
}

/** The source pixel shown at display pixel (dx, dy), scroll applied, clip not. */
export function sourceOfDisplay(regs: Layer2Regs, dx: number, dy: number): { x: number; y: number } {
  return { x: sourceColumn(regs, dx), y: sourceRow(regs, dy) };
}

/**
 * The `$18` clip window in layer pixels of the resolution (T8): paper-relative at 256 x 192, X doubled
 * in the wide modes (and doubled again at 640 x 256). Not cut to the layer.
 */
export function effectiveClip(regs: Pick<Layer2Regs, "resolution" | "clip">): LayerRect {
  const size = layer2Size(regs.resolution);
  const r = layer2ClipWindow(regs.clip, size.wide);
  if (!size.wide) return { x1: r.x1 - 32, x2: r.x2 - 32, y1: r.y1 - 32, y2: r.y2 - 32 };
  if (size.nibbles) return { x1: r.x1 * 2, x2: r.x2 * 2 + 1, y1: r.y1, y2: r.y2 };
  return r;
}

/** The clip window cut to the layer, or undefined when nothing of the layer is inside it. */
export function clipOnLayer(regs: Pick<Layer2Regs, "resolution" | "clip">): LayerRect | undefined {
  const { width, height } = layer2Size(regs.resolution);
  const c = effectiveClip(regs);
  const r = { x1: Math.max(0, c.x1), y1: Math.max(0, c.y1), x2: Math.min(width - 1, c.x2), y2: Math.min(height - 1, c.y2) };
  return r.x1 <= r.x2 && r.y1 <= r.y2 ? r : undefined;
}

/** Whether display pixel (dx, dy) is inside the clip window. */
export function isInsideClip(regs: Pick<Layer2Regs, "resolution" | "clip">, dx: number, dy: number): boolean {
  const c = effectiveClip(regs);
  return dx >= c.x1 && dx <= c.x2 && dy >= c.y1 && dy <= c.y2;
}

/** Sorted values to inclusive runs. */
function runs(values: Iterable<number>): [number, number][] {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
}

/**
 * The part of the unscrolled layer that reaches the screen: the source columns and rows the clipped
 * display reads, as rectangles (a product of column runs and row runs, so several where the scroll
 * wraps; T4). Empty when the clip window is empty. A rectangle can lie past the layer's width or
 * height (`readsPastLayer`); a view cuts it to the image.
 */
export function visibleWindow(regs: Layer2Regs): LayerRect[] {
  const clip = clipOnLayer(regs);
  if (!clip) return [];
  const cols: number[] = [];
  for (let x = clip.x1; x <= clip.x2; x++) cols.push(sourceColumn(regs, x));
  const rows: number[] = [];
  for (let y = clip.y1; y <= clip.y2; y++) rows.push(sourceRow(regs, y));
  const out: LayerRect[] = [];
  for (const [y1, y2] of runs(rows)) for (const [x1, x2] of runs(cols)) out.push({ x1, x2, y1, y2 });
  return out;
}

/**
 * The layer as it reaches the mixer (D5): every display pixel decoded from its scrolled source pixel,
 * `LAYER2_NO_PIXEL` outside the clip window or past 2 MB (with `bank16`). It decodes from the bytes
 * rather than from the whole-layer image because a scroll can read past the layer's own banks
 * (`readsPastLayer`); `data` must hold `LAYER2_READ_BYTES` for that.
 */
export function displayedImage(regs: Layer2Regs, data: Uint8Array, bank16?: number): Int16Array {
  const { width, height } = layer2Size(regs.resolution);
  const out = new Int16Array(width * height).fill(LAYER2_NO_PIXEL);
  const clip = clipOnLayer(regs);
  if (!clip) return out;
  const cols = new Int32Array(width);
  for (let x = clip.x1; x <= clip.x2; x++) cols[x] = sourceColumn(regs, x);
  for (let y = clip.y1; y <= clip.y2; y++) {
    const sy = sourceRow(regs, y);
    for (let x = clip.x1; x <= clip.x2; x++) {
      out[y * width + x] =
        layer2Index(regs.resolution, data, cols[x], sy, regs.paletteOffset, bank16) ?? LAYER2_NO_PIXEL;
    }
  }
  return out;
}

/**
 * Whether the clipped, scrolled display reads source pixels outside the layer (T4): wide columns
 * 320-511, which live in banks +5 to +7, or 256 x 192 rows 192-254, which live in bank +3. The
 * hardware does it; it is almost never what a program meant.
 */
export function readsPastLayer(regs: Layer2Regs): boolean {
  const { width, height } = layer2Size(regs.resolution);
  return visibleWindow(regs).some((r) => r.x2 >= width || r.y2 >= height);
}

/** The 16K banks as regions of the unscrolled layer (T3): 64-row bands at 256 x 192, 64-column ones wide. */
export function bankRegions(resolution: number): { index: number; rect: LayerRect }[] {
  const size = layer2Size(resolution);
  return Array.from({ length: size.banks }, (_, index) => {
    if (!size.wide) return { index, rect: { x1: 0, x2: 255, y1: index * 64, y2: index * 64 + 63 } };
    const w = size.nibbles ? 128 : 64;
    return { index, rect: { x1: index * w, x2: index * w + w - 1, y1: 0, y2: 255 } };
  });
}

/** Which bank of the set (0-4) holds layer pixel (x, y). */
export function bankIndexAt(resolution: number, x: number, y: number): number {
  const size = layer2Size(resolution);
  if (!size.wide) return y >> 6;
  return size.nibbles ? x >> 7 : x >> 6;
}
