import { describe, expect, it } from "vitest";

import { tilemapMode } from "@common/zxnext/tilemap/tilemapDecode";
import {
  cellAtLayerPixel,
  displayRectsOfCell,
  effectiveClip,
  isCellVisible,
  visibleWindow
} from "@common/zxnext/tilemap/tilemapGeometry";
import { layer2ClipWindow, tilemapClipWindow, ulaClipWindow } from "@common/zxnext/video/clipWindows";
import { regs } from "./tilemapFixtures";

describe("clipWindows", () => {
  it("doubles the tilemap's X; reset covers the whole layer", () => {
    expect(tilemapClipWindow([0, 159, 0, 255])).toEqual({ x1: 0, x2: 319, y1: 0, y2: 255 });
  });

  it("puts the ULA and 256-wide Layer 2 windows on the paper", () => {
    expect(ulaClipWindow([0, 255, 0, 191])).toEqual({ x1: 32, x2: 287, y1: 32, y2: 223 });
    expect(layer2ClipWindow([0, 255, 0, 255], false).y2).toBe(223);
    expect(layer2ClipWindow([1, 2, 3, 4], true)).toEqual({ x1: 2, x2: 5, y1: 3, y2: 4 });
  });
});

describe("tilemap geometry (T6)", () => {
  it("scales the clip window to 640 layer pixels at 80 columns", () => {
    const r = regs({ clip: [1, 2, 3, 4] });
    expect(effectiveClip(r, tilemapMode({ control: 0x80 }))).toEqual({ x1: 2, x2: 5, y1: 3, y2: 4 });
    expect(effectiveClip(r, tilemapMode({ control: 0xc0 }))).toEqual({ x1: 4, x2: 11, y1: 3, y2: 4 });
  });

  it("is the whole map when nothing scrolls or clips", () => {
    const r = regs();
    expect(visibleWindow(r, tilemapMode(r))).toEqual([{ x1: 0, x2: 319, y1: 0, y2: 255 }]);
  });

  it("wraps the visible window both ways", () => {
    const r = regs({ scrollX: 300, scrollY: 250, clip: [0, 15, 0, 15] });
    expect(visibleWindow(r, tilemapMode(r))).toEqual([
      { x1: 300, x2: 319, y1: 250, y2: 255 },
      { x1: 0, x2: 11, y1: 250, y2: 255 },
      { x1: 300, x2: 319, y1: 0, y2: 9 },
      { x1: 0, x2: 11, y1: 0, y2: 9 }
    ]);
  });

  it("wraps scroll X at 640 at 80 columns", () => {
    const r = regs({ control: 0xc0, scrollX: 630 });
    const mode = tilemapMode(r);
    expect(cellAtLayerPixel(r, mode, 10, 0, true)).toEqual({ col: 0, row: 0 });
    expect(cellAtLayerPixel(r, mode, 0, 0, true)).toEqual({ col: 78, row: 0 });
    expect(cellAtLayerPixel(r, mode, 0, 0, false)).toEqual({ col: 0, row: 0 });
  });

  it("places a cell on the display and knows whether it is visible", () => {
    const r = regs({ scrollX: 4, clip: [0, 7, 0, 255] });
    const mode = tilemapMode(r);
    expect(displayRectsOfCell(r, mode, 0, 0)).toEqual([
      { x1: 316, x2: 319, y1: 0, y2: 7 },
      { x1: 0, x2: 3, y1: 0, y2: 7 }
    ]);
    expect(isCellVisible(r, mode, 0, 0)).toBe(true);
    expect(isCellVisible(r, mode, 5, 0)).toBe(false);
  });
});
