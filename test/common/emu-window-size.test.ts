import { describe, expect, it } from "vitest";
import {
  EMU_MIN_CONTENT_WIDTH,
  emuContentSizeForPicture,
  emuWindowSizeForContent,
  isValidSize,
  placeWithinWorkArea,
  sameSize
} from "@common/utils/emu-window-size";

/*
 * Issue #1377: the emulator window was fixed at a 640x480 minimum, far taller than a Z88's 640x64
 * LCD needs. Its minimum, its "fit" size and each machine's saved size now follow the picture.
 */
describe("emuContentSizeForPicture", () => {
  it("keeps the measured chrome and swaps the available room for the picture", () => {
    // --- 1024x768 viewport, 900x600 of it available to the picture: 124x168 of chrome
    const size = emuContentSizeForPicture(
      { width: 1024, height: 768 },
      { width: 900, height: 600 },
      { width: 640, height: 64 }
    );
    expect(size).toEqual({ width: 764, height: 232 });
  });

  it("never goes narrower than the toolbar's minimum width", () => {
    const size = emuContentSizeForPicture(
      { width: 1024, height: 768 },
      { width: 1000, height: 600 },
      { width: 352, height: 296 }
    );
    expect(size.width).toBe(EMU_MIN_CONTENT_WIDTH);
    expect(size.height).toBe(464);
  });

  it("rounds fractional layouts up, so the picture is never a pixel short", () => {
    const size = emuContentSizeForPicture(
      { width: 800, height: 600 },
      { width: 700.4, height: 500.5 },
      { width: 640, height: 64 },
      0
    );
    expect(size).toEqual({ width: 740, height: 164 });
  });
});

describe("emuWindowSizeForContent", () => {
  it("scales content by the page zoom and adds the frame", () => {
    expect(emuWindowSizeForContent({ width: 700, height: 200 }, 1.5, { width: 0, height: 28 })).toEqual(
      { width: 1050, height: 328 }
    );
  });

  it("treats a missing or invalid zoom as 1", () => {
    expect(emuWindowSizeForContent({ width: 700, height: 200 }, 0, { width: 2, height: 30 })).toEqual({
      width: 702,
      height: 230
    });
    expect(emuWindowSizeForContent({ width: 700, height: 200 }, NaN, { width: -4, height: 0 })).toEqual(
      { width: 700, height: 200 }
    );
  });
});

describe("placeWithinWorkArea", () => {
  const workArea = { x: 0, y: 25, width: 1440, height: 875 };

  it("leaves a window that fits where it is", () => {
    const bounds = { x: 100, y: 100, width: 700, height: 400 };
    expect(placeWithinWorkArea(bounds, workArea)).toEqual(bounds);
  });

  it("moves a window that would reach past the bottom or right edge", () => {
    expect(placeWithinWorkArea({ x: 1000, y: 700, width: 700, height: 400 }, workArea)).toEqual({
      x: 740,
      y: 500,
      width: 700,
      height: 400
    });
  });

  it("moves a window above or left of the work area back in", () => {
    expect(placeWithinWorkArea({ x: -50, y: 0, width: 700, height: 400 }, workArea)).toEqual({
      x: 0,
      y: 25,
      width: 700,
      height: 400
    });
  });

  it("shrinks a window only when it is larger than the work area", () => {
    expect(placeWithinWorkArea({ x: 10, y: 30, width: 2000, height: 1000 }, workArea)).toEqual({
      x: 0,
      y: 25,
      width: 1440,
      height: 875
    });
  });
});

describe("isValidSize and sameSize", () => {
  it("accepts only finite, positive sizes", () => {
    expect(isValidSize({ width: 1, height: 1 })).toBe(true);
    expect(isValidSize({ width: 0, height: 1 })).toBe(false);
    expect(isValidSize({ width: NaN, height: 1 })).toBe(false);
    expect(isValidSize(undefined)).toBe(false);
    expect(isValidSize({ width: "700", height: 1 } as any)).toBe(false);
  });

  it("compares both axes", () => {
    expect(sameSize({ width: 1, height: 2 }, { width: 1, height: 2 })).toBe(true);
    expect(sameSize({ width: 1, height: 2 }, { width: 1, height: 3 })).toBe(false);
    expect(sameSize(undefined, { width: 1, height: 2 })).toBe(false);
  });
});
