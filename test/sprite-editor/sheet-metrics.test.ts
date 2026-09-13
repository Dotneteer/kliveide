import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHEET_HEIGHT,
  MIN_SHEET_HEIGHT,
  SHEET_ROW_HEIGHT,
  clampSheetHeight,
  maxSheetHeight,
  sheetHeightForRows
} from "@renderer/features/sprite-editor/sheet-metrics";

describe("sheet-metrics", () => {
  it("measures one row the way the DOM does", () => {
    // 48px thumbnail + 4px cell padding + 1px gap + 10px caption, measured at 63px in the app.
    expect(SHEET_ROW_HEIGHT).toBe(63);
  });

  it("defaults to exactly two rows", () => {
    expect(DEFAULT_SHEET_HEIGHT).toBe(sheetHeightForRows(2));
    // header 26 + padding 16 + two 63px rows + one 8px gap
    expect(DEFAULT_SHEET_HEIGHT).toBe(176);
  });

  it("never goes below one whole row", () => {
    // A clipped row plus a scrollbar reads as broken rather than as scrollable - which is exactly
    // what a stale `max-height: 42%` used to produce.
    expect(MIN_SHEET_HEIGHT).toBe(sheetHeightForRows(1));
    expect(clampSheetHeight(10, 900)).toBe(MIN_SHEET_HEIGHT);
    expect(MIN_SHEET_HEIGHT).toBeGreaterThan(SHEET_ROW_HEIGHT);
  });

  it("leaves the canvas its floor when dragged tall", () => {
    // 900 - 27 of toolbar - 140 of stage minimum
    expect(maxSheetHeight(900)).toBe(733);
    expect(clampSheetHeight(5000, 900)).toBe(733);
  });

  it("still yields one row in an editor too short for the arithmetic", () => {
    // maxSheetHeight would go negative; the minimum has to win rather than producing a 0px pane.
    expect(clampSheetHeight(300, 120)).toBe(MIN_SHEET_HEIGHT);
  });

  it("rounds, so the grid track never lands on a fractional pixel", () => {
    expect(clampSheetHeight(200.4, 900)).toBe(200);
  });
});
