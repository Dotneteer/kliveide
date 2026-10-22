import { describe, expect, it } from "vitest";

import {
  drawPictureScaled,
  isSimpleRatio,
  needsSharpScaling,
  prescaleFactors
} from "@renderer/features/emulator/sharpScale";

/*
 * The emulator canvas's scaling (`sharpScale.ts`): plain nearest-neighbour for pixel aspects that
 * land on whole canvas pixels, sharp bilinear (a whole nearest-neighbour step, then a smoothed
 * fraction) for the rest - today the HT-1080Z's 7 / 10.644.
 */

describe("sharp scaling: which pictures need it", () => {
  it("leaves square, half-width and whole-multiple pixels alone", () => {
    for (const ratio of [1, 0.5, 0.25, 2, 3]) expect(isSimpleRatio(ratio), String(ratio)).toBe(true);
    expect(needsSharpScaling(1, 1)).toBe(false);
    expect(needsSharpScaling(0.5, 1)).toBe(false);
  });

  it("takes any other aspect, such as the HT-1080Z's", () => {
    expect(isSimpleRatio(7 / 10.644)).toBe(false);
    expect(isSimpleRatio(2 / 3)).toBe(false);
    expect(needsSharpScaling(7 / 10.644, 1)).toBe(true);
    expect(needsSharpScaling(1, 0.75)).toBe(true);
  });
});

describe("sharp scaling: the whole step", () => {
  it("is the smallest whole factor at or above the final scale, per axis", () => {
    // --- 528 x 288 shown at 2x with dots 0.658 wide: 695 x 576
    expect(prescaleFactors(528, 288, 695, 576)).toEqual([2, 2]);
    expect(prescaleFactors(528, 288, 347, 288)).toEqual([1, 1]);
    expect(prescaleFactors(528, 288, 1042, 864)).toEqual([2, 3]);
  });

  it("is exact on an axis whose scale is whole, so the smoothed step leaves it 1:1", () => {
    expect(prescaleFactors(100, 50, 300, 150)).toEqual([3, 3]);
  });
});

/** A 2D context that records what is drawn and how */
function recordingContext() {
  const calls: { source: unknown; w: number; h: number; smoothing: boolean }[] = [];
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "low",
    globalCompositeOperation: "source-over",
    drawImage(source: unknown, _x: number, _y: number, w: number, h: number) {
      calls.push({ source, w, h, smoothing: this.imageSmoothingEnabled });
    }
  };
  return { ctx, calls };
}

describe("sharp scaling: drawing", () => {
  const source = { width: 528, height: 288 } as HTMLCanvasElement;

  it("draws once without smoothing when sharp scaling is off", () => {
    const { ctx, calls } = recordingContext();
    drawPictureScaled(ctx as unknown as CanvasRenderingContext2D, source, 695, 576, false, {});
    expect(calls).toEqual([{ source, w: 695, h: 576, smoothing: false }]);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it("scales up by whole factors unsmoothed, then smooths only the last fraction", () => {
    const { ctx: scratchCtx, calls: scratchCalls } = recordingContext();
    const scratchCanvas = { width: 0, height: 0, getContext: () => scratchCtx } as unknown as HTMLCanvasElement;
    const { ctx, calls } = recordingContext();
    const scratch = { canvas: scratchCanvas };
    drawPictureScaled(ctx as unknown as CanvasRenderingContext2D, source, 695, 576, true, scratch);
    expect([scratchCanvas.width, scratchCanvas.height]).toEqual([1056, 576]);
    expect(scratchCalls).toEqual([{ source, w: 1056, h: 576, smoothing: false }]);
    expect(calls).toEqual([{ source: scratchCanvas, w: 695, h: 576, smoothing: true }]);
    // --- Smoothing is left off for whoever draws next
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});
