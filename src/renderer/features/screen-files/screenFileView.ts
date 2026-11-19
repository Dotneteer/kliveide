import { useEffect, useState } from "react";

import { FLASH_FRAMES } from "@common/screenFiles/zxScreen";
import type { Layer2Resolution } from "@common/zxnext/layer2/layer2Decode";

/*
 * The screen file viewer's view state and the pure helpers its frame and formats share
 * (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`).
 */

export type ScreenZoom = "fit" | 1 | 2 | 3 | 4;
export const SCREEN_ZOOMS: ScreenZoom[] = ["fit", 1, 2, 3, 4];

/** What a screen file document remembers (D11): kept per document by the document hub */
export type ScreenFileViewState = {
  scrollPosition?: number;
  /** "fit" on first open (D4), then what the user chose */
  zoom?: ScreenZoom;
  /** The SCR attribute grid, or Layer 2's bank outlines */
  grid?: boolean;
  /** Layer 2 before this viewer: its bank outlines */
  banks?: boolean;
  /** Draw FLASH cells as the machine shows them (D9) */
  blink?: boolean;
  /** A hi-res picture's ink, 0-7 (D13) */
  ink?: number;
  /** The palette a LoRes picture is drawn with (D14): the Next's ULA palette or RGB332 */
  loresPalette?: "ula" | "rgb332";
  /** An 80K Layer 2 file: 320 x 256 or 640 x 256 */
  resolution?: Layer2Resolution;
  /** A highlighted colour (index), or the FLASH cells (D8) */
  highlight?: number | "flash";
  /** The pinned pixel */
  pin?: [number, number];
  /** Inspector sections the user folded */
  collapsed?: string[];
};

/** The largest whole zoom (1-8) at which a picture fits a stage, with room for the padding */
export function fitZoom(width: number, height: number, stageWidth: number, stageHeight: number): number {
  if (stageWidth <= 0 || stageHeight <= 0) return 2;
  const pad = 32;
  return Math.max(1, Math.min(8, Math.floor(Math.min((stageWidth - pad) / width, (stageHeight - pad) / height))));
}

/** A picture's RGBA bytes at a zoom, for a PNG: ABGR words are R, G, B, A in memory order */
export function pictureRgba(
  picture: { width: number; height: number; pixels: Int16Array; abgr: Uint32Array },
  zoomX: number,
  zoomY: number
): { width: number; height: number; rgba: Uint8ClampedArray } {
  const width = picture.width * zoomX;
  const height = picture.height * zoomY;
  const words = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / zoomY) * picture.width;
    for (let x = 0; x < width; x++) {
      const value = picture.pixels[row + Math.floor(x / zoomX)];
      words[y * width + x] = value < 0 ? 0 : picture.abgr[value & 0xff];
    }
  }
  return { width, height, rgba: new Uint8ClampedArray(words.buffer) };
}

/** The pixels to dim while some pixels are highlighted: 1 where `hit` is false */
export function dimMask(length: number, hit: (p: number) => boolean): Uint8Array {
  const dim = new Uint8Array(length);
  for (let p = 0; p < length; p++) dim[p] = hit(p) ? 0 : 1;
  return dim;
}

/**
 * The FLASH phase while blinking is on (D9): it flips every 16 frames of 50 Hz (0.32 s), as the ULA
 * swaps INK and PAPER, and stops while the window is hidden.
 */
export function useFlashPhase(enabled: boolean): boolean {
  const [phase, setPhase] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setPhase(false);
      return undefined;
    }
    const id = setInterval(() => {
      if (document.visibilityState !== "hidden") setPhase((p) => !p);
    }, (FLASH_FRAMES * 1000) / 50);
    return () => clearInterval(id);
  }, [enabled]);
  return phase;
}
