/*
 * Memory as monochrome bitmaps: the decoder behind the graphics finder
 * (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.2, G7.4).
 *
 * Pure: `(bytes, look) → pixels`, plus a map from every pixel back to the byte it came from, which
 * is what lets hover name an address and a click select bytes rather than pixels.
 *
 * Games store graphics in more than one order (G-T1), so a frame — one sprite, one character — can
 * be read four ways:
 *
 * - `linear`: row-major; each pixel row is `width` bytes, `height` rows make a frame.
 * - `cells`: 8×8 character cells of 8 bytes each, cells in reading order (left to right, then down).
 *   `height` is rounded up to whole cells.
 * - `columns`: column-major; one byte column top to bottom (`height` bytes), then the next.
 * - `screen`: the ZX Spectrum display file's own order, for `$4000-$57FF`: one 32×192 frame.
 *
 * A mask doubles a frame's bytes: `interleaved` puts a mask byte before each graphic byte,
 * `before`/`after` put a whole mask frame before or after the graphic frame.
 */

export type GraphicLayout = "linear" | "cells" | "columns" | "screen";
export type GraphicMask = "none" | "interleaved" | "before" | "after";

export const GRAPHIC_LAYOUTS: readonly GraphicLayout[] = ["linear", "cells", "columns", "screen"];
export const GRAPHIC_MASKS: readonly GraphicMask[] = ["none", "interleaved", "before", "after"];

export const MAX_GRAPHIC_WIDTH = 32;
export const MAX_GRAPHIC_HEIGHT = 256;
export const GRAPHIC_ZOOMS = [1, 2, 3, 4, 6, 8] as const;
export type GraphicZoom = (typeof GRAPHIC_ZOOMS)[number];

export type GraphicsLook = {
  /** Bytes per pixel row, 1..32. */
  width: number;
  /** Pixel rows per frame (cells/columns: the frame size; linear: the strip break), 1..256. */
  height: number;
  layout: GraphicLayout;
  mask: GraphicMask;
  /** Show the mask plane instead of the pixels. */
  showMask: boolean;
  invert: boolean;
  /** 0..15, the ZX colours with BRIGHT. */
  ink: number;
  paper: number;
  zoom: GraphicZoom;
  /** A 1-pixel gap between frames. */
  frameGap: boolean;
  /** Dim the bytes the CPU never read (needs a profile). */
  dimUnread: boolean;
  /** Frames side by side; 0 fits as many as the panel is wide. */
  columns: number;
};

/** Ink black on paper white, as a 48K shows `INK 0: PAPER 7`. */
export const DEFAULT_GRAPHICS_LOOK: GraphicsLook = {
  width: 1,
  height: 8,
  layout: "linear",
  mask: "none",
  showMask: false,
  invert: false,
  ink: 0,
  paper: 7,
  zoom: 4,
  frameGap: true,
  dimUnread: false,
  columns: 0
};

/** The pixel value of paper, ink, and a pixel nothing is drawn at. */
export const GRAPHIC_PAPER = 0;
export const GRAPHIC_INK = 1;
export const GRAPHIC_NONE = -1;

/** Clamp a look's numbers into range, and give `screen` its fixed shape. */
export function normalizeLook(look: GraphicsLook): GraphicsLook {
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : min)));
  const next: GraphicsLook = {
    ...look,
    width: clamp(look.width, 1, MAX_GRAPHIC_WIDTH),
    height: clamp(look.height, 1, MAX_GRAPHIC_HEIGHT),
    ink: clamp(look.ink, 0, 15),
    paper: clamp(look.paper, 0, 15),
    columns: clamp(look.columns, 0, 256),
    zoom: (GRAPHIC_ZOOMS as readonly number[]).includes(look.zoom) ? look.zoom : 4
  };
  if (next.layout === "screen") {
    next.width = 32;
    next.height = 192;
  } else if (next.layout === "cells") {
    next.height = Math.min(MAX_GRAPHIC_HEIGHT, Math.ceil(next.height / 8) * 8);
  }
  return next;
}

export type FrameGeometry = {
  /** Pixels across one frame. */
  widthPx: number;
  /** Pixel rows in one frame. */
  heightPx: number;
  /** The graphic bytes of one frame, without its mask. */
  graphicBytes: number;
  /** All the bytes one frame takes, mask included. */
  frameBytes: number;
};

export function frameGeometry(look: GraphicsLook): FrameGeometry {
  const l = normalizeLook(look);
  const graphicBytes = l.width * l.height;
  return {
    widthPx: l.width * 8,
    heightPx: l.height,
    graphicBytes,
    frameBytes: l.mask === "none" ? graphicBytes : graphicBytes * 2
  };
}

/**
 * Where the graphic byte at byte column `bx`, pixel row `y` of a frame sits, relative to the
 * frame's first *graphic* byte, before the mask is woven in.
 */
function graphicIndex(look: GraphicsLook, bx: number, y: number): number {
  switch (look.layout) {
    case "cells": {
      const cellRow = y >> 3;
      return (cellRow * look.width + bx) * 8 + (y & 7);
    }
    case "columns":
      return bx * look.height + y;
    case "screen":
      return ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | bx;
    default:
      return y * look.width + bx;
  }
}

/** The frame-relative offsets of the graphic byte and its mask byte at byte column `bx`, row `y`. */
export function byteOffsetsInFrame(
  look: GraphicsLook,
  bx: number,
  y: number
): { graphic: number; mask?: number } {
  const l = normalizeLook(look);
  const index = graphicIndex(l, bx, y);
  const total = l.width * l.height;
  switch (l.mask) {
    case "interleaved":
      return { mask: index * 2, graphic: index * 2 + 1 };
    case "before":
      return { mask: index, graphic: total + index };
    case "after":
      return { graphic: index, mask: total + index };
    default:
      return { graphic: index };
  }
}

export type SheetLayout = {
  columns: number;
  rows: number;
  /** Image pixels across and down the whole sheet. */
  width: number;
  height: number;
  gap: number;
};

/** How `frameCount` frames are laid out side by side, `columns` to a row. */
export function sheetLayout(look: GraphicsLook, frameCount: number, columns: number): SheetLayout {
  const { widthPx, heightPx } = frameGeometry(look);
  const gap = look.frameGap ? 1 : 0;
  const cols = Math.max(1, columns);
  const rows = Math.max(0, Math.ceil(frameCount / cols));
  return {
    columns: cols,
    rows,
    width: cols * widthPx + (cols - 1) * gap,
    height: rows > 0 ? rows * heightPx + (rows - 1) * gap : 0,
    gap
  };
}

/** How many frames fit across `availablePx` CSS pixels at the look's zoom. */
export function autoColumns(look: GraphicsLook, availablePx: number): number {
  const { widthPx } = frameGeometry(look);
  const gap = look.frameGap ? 1 : 0;
  const zoom = normalizeLook(look).zoom;
  return Math.max(1, Math.floor((availablePx / zoom + gap) / (widthPx + gap)));
}

export type DecodedGraphics = {
  pixels: Int16Array;
  width: number;
  height: number;
  /** The byte offset (in `bytes`) each pixel came from, or -1. */
  byteMap: Int32Array;
  /** Where each decoded frame sits in the image, and its first byte. */
  frames: { index: number; x: number; y: number; offset: number }[];
  sheet: SheetLayout;
};

/**
 * Decode `frameCount` frames starting at byte `start`, laid out `columns` to a row. Bytes past the
 * end of `bytes` are drawn as nothing.
 *
 * @param firstFrameIndex The index the first decoded frame is reported with
 */
export function decodeGraphics(
  bytes: ArrayLike<number>,
  look: GraphicsLook,
  start: number,
  frameCount: number,
  columns: number,
  firstFrameIndex = 0
): DecodedGraphics {
  const l = normalizeLook(look);
  const geometry = frameGeometry(l);
  const sheet = sheetLayout(l, frameCount, columns);
  const pixels = new Int16Array(sheet.width * sheet.height).fill(GRAPHIC_NONE);
  const byteMap = new Int32Array(sheet.width * sheet.height).fill(-1);
  const frames: DecodedGraphics["frames"] = [];
  const ink = l.invert ? GRAPHIC_PAPER : GRAPHIC_INK;
  const paper = l.invert ? GRAPHIC_INK : GRAPHIC_PAPER;

  // --- The frame-relative byte of every (column, row), computed once for all frames
  const relative = new Int32Array(l.width * l.height);
  for (let y = 0; y < l.height; y++) {
    for (let bx = 0; bx < l.width; bx++) {
      const offsets = byteOffsetsInFrame(l, bx, y);
      relative[y * l.width + bx] = l.showMask && offsets.mask !== undefined ? offsets.mask : offsets.graphic;
    }
  }

  for (let f = 0; f < frameCount; f++) {
    const frameStart = start + f * geometry.frameBytes;
    const fx = (f % sheet.columns) * (geometry.widthPx + sheet.gap);
    const fy = Math.floor(f / sheet.columns) * (geometry.heightPx + sheet.gap);
    frames.push({ index: firstFrameIndex + f, x: fx, y: fy, offset: frameStart });
    for (let y = 0; y < l.height; y++) {
      const rowBase = (fy + y) * sheet.width + fx;
      for (let bx = 0; bx < l.width; bx++) {
        const offset = frameStart + relative[y * l.width + bx];
        if (offset < 0 || offset >= bytes.length) continue;
        const value = bytes[offset];
        for (let bit = 0; bit < 8; bit++) {
          const p = rowBase + bx * 8 + bit;
          pixels[p] = value & (0x80 >> bit) ? ink : paper;
          byteMap[p] = offset;
        }
      }
    }
  }
  return { pixels, width: sheet.width, height: sheet.height, byteMap, frames, sheet };
}

/** A per-pixel dim mask from a per-byte "dim this byte" test. */
export function dimMaskFor(byteMap: Int32Array, dimByte: (offset: number) => boolean): Uint8Array {
  const dim = new Uint8Array(byteMap.length);
  for (let p = 0; p < byteMap.length; p++) {
    const offset = byteMap[p];
    if (offset >= 0 && dimByte(offset)) dim[p] = 1;
  }
  return dim;
}

/** A byte as a pixel picture: `#` for ink, `.` for paper, most significant bit first. */
export function bytePicture(value: number): string {
  let text = "";
  for (let bit = 7; bit >= 0; bit--) text += value & (1 << bit) ? "#" : ".";
  return text;
}

/** The preset looks the toolbar offers. */
export const GRAPHICS_PRESETS: readonly { id: string; label: string; look: Partial<GraphicsLook>; address?: number }[] = [
  // --- The 48K ROM's character set and the UDG area: where they are when the dump holds them
  { id: "font", label: "Font (8×8, 96 chars)", look: { width: 1, height: 8, layout: "cells", mask: "none" }, address: 0x3d00 },
  { id: "udg", label: "UDG (8×8, 21)", look: { width: 1, height: 8, layout: "cells", mask: "none" }, address: 0xff58 },
  { id: "screen", label: "Screen ($4000)", look: { layout: "screen", mask: "none", columns: 1 }, address: 0x4000 }
];
