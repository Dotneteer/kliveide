import { describe, it, expect } from "vitest";
import {
  SPRITE_DIM,
  SPRITE_SIZE,
  clampToSprite,
  drawEllipse,
  drawLine,
  drawRectangle,
  flipHorizontal,
  flipVertical,
  floodFill,
  getPixel,
  isInside,
  rotateClockwise,
  rotateCounterClockwise,
  setPixel
} from "@renderer/features/sprite-editor/sprite-raster";

const BG = 0x00;
const PEN = 0x1f;
const FILL = 0x2a;

const blank = (fill = BG) => new Uint8Array(SPRITE_SIZE).fill(fill);
const at = (map: Uint8Array, row: number, col: number) => map[row * SPRITE_DIM + col];
const painted = (map: Uint8Array, bg = BG) => [...map].filter((v) => v !== bg).length;

/** Render a map as 16 strings, "." for background - far easier to read in a failure message. */
const rows = (map: Uint8Array, bg = BG) =>
  Array.from({ length: SPRITE_DIM }, (_, r) =>
    Array.from({ length: SPRITE_DIM }, (_, c) => (at(map, r, c) === bg ? "." : "#")).join("")
  );

describe("sprite-raster: bounds", () => {
  it("never writes outside the sprite, whatever it is given", () => {
    // The pencil used to do `map[row * 16 + col] = color` with no check at all, so col === -1
    // wrapped into the previous row's last pixel.
    const wild = setPixel(blank(), { row: 5, col: -1 }, PEN);
    expect(painted(wild)).toBe(0);
    expect(at(wild, 4, 15)).toBe(BG); // the pixel the old wrap would have hit

    expect(painted(setPixel(blank(), { row: -1, col: 0 }, PEN))).toBe(0);
    expect(painted(setPixel(blank(), { row: 16, col: 0 }, PEN))).toBe(0);
    expect(painted(setPixel(blank(), { row: 0, col: 16 }, PEN))).toBe(0);
  });

  it("clamps a drag position onto the sprite", () => {
    expect(clampToSprite({ row: -4, col: 99 })).toEqual({ row: 0, col: 15 });
    expect(clampToSprite({ row: 7.4, col: 2.6 })).toEqual({ row: 7, col: 3 });
  });

  it("reports what is inside", () => {
    expect(isInside({ row: 0, col: 0 })).toBe(true);
    expect(isInside({ row: 15, col: 15 })).toBe(true);
    expect(isInside({ row: 16, col: 15 })).toBe(false);
    expect(getPixel(blank(PEN), { row: 99, col: 0 })).toBeUndefined();
  });
});

describe("sprite-raster: drawLine", () => {
  it("draws a horizontal run inclusive of both ends", () => {
    const map = drawLine(blank(), { row: 3, col: 2 }, { row: 3, col: 6 }, PEN);
    expect(painted(map)).toBe(5);
    expect(rows(map)[3]).toBe("..#####.........");
  });

  it("clips a line whose endpoints are off the sprite, without wrapping", () => {
    const map = drawLine(blank(), { row: 8, col: -20 }, { row: 8, col: 40 }, PEN);
    expect(rows(map)[8]).toBe("################");
    expect(painted(map)).toBe(16); // row 8 only - nothing leaked into 7 or 9
  });

  it("survives a non-finite coordinate", () => {
    expect(() =>
      drawLine(blank(), { row: 0, col: 0 }, { row: NaN, col: Infinity }, PEN)
    ).not.toThrow();
  });
});

describe("sprite-raster: drawRectangle", () => {
  it("outlines, and leaves the interior alone when no fill is given", () => {
    const map = drawRectangle(blank(), { row: 2, col: 2 }, { row: 5, col: 6 }, PEN);
    expect(rows(map).slice(2, 6)).toEqual([
      "..#####.........",
      "..#...#.........",
      "..#...#.........",
      "..#####........."
    ]);
  });

  it("fills the interior with the fill colour", () => {
    const map = drawRectangle(blank(), { row: 2, col: 2 }, { row: 5, col: 6 }, PEN, FILL);
    expect(at(map, 3, 3)).toBe(FILL);
    expect(at(map, 2, 2)).toBe(PEN);
  });

  it("accepts its corners in any order", () => {
    const a = drawRectangle(blank(), { row: 5, col: 6 }, { row: 2, col: 2 }, PEN);
    const b = drawRectangle(blank(), { row: 2, col: 2 }, { row: 5, col: 6 }, PEN);
    expect([...a]).toEqual([...b]);
  });

  it("clips rather than shrinking when dragged off the edge", () => {
    const map = drawRectangle(blank(), { row: -5, col: -5 }, { row: 5, col: 5 }, PEN, FILL);
    // The top and left edges are off-sprite, so they must NOT be redrawn at row/col 0.
    expect(rows(map)[0]).toBe("######..........");
    expect(at(map, 0, 0)).toBe(FILL);
    expect(at(map, 5, 5)).toBe(PEN);
  });
});

describe("sprite-raster: drawEllipse", () => {
  it("draws an outline symmetric about its own axes", () => {
    // Corners (2,2)-(12,12): 11x11, so the axes are row 7 and col 7.
    const map = drawEllipse(blank(), { row: 2, col: 2 }, { row: 12, col: 12 }, PEN);
    expect(painted(map)).toBeGreaterThan(12);
    for (let r = 2; r <= 12; r++) {
      for (let c = 2; c <= 12; c++) {
        expect(at(map, r, c)).toBe(at(map, r, 14 - c));
        expect(at(map, r, c)).toBe(at(map, 14 - r, c));
      }
    }
  });

  it("falls back to a rectangle when thinner than three pixels", () => {
    const ellipse = drawEllipse(blank(), { row: 4, col: 4 }, { row: 5, col: 10 }, PEN);
    const rect = drawRectangle(blank(), { row: 4, col: 4 }, { row: 5, col: 10 }, PEN);
    expect([...ellipse]).toEqual([...rect]);
  });

  /*
   * The regression that matters. The original span fill was
   *     while (!pixels[row][col]) { plot(); col--; }
   * and out of bounds `pixels[row][col]` is `undefined`, so the loop never ended while `plotPixel`
   * silently dropped every write. Dragging a filled ellipse off the edge hung the renderer; if
   * `row` was out of range it threw on `pixels[row]` instead. Both directions are covered here.
   */
  it("terminates on a filled ellipse dragged off every edge", () => {
    const corners: Array<[number, number, number, number]> = [
      [-4, -4, 20, 20],
      [-30, 4, 8, 12],
      [4, -30, 12, 8],
      [4, 4, 40, 40],
      [-100, -100, 100, 100],
      [12, 12, -4, -4]
    ];
    for (const [r1, c1, r2, c2] of corners) {
      const map = drawEllipse(blank(), { row: r1, col: c1 }, { row: r2, col: c2 }, PEN, FILL);
      expect(map.length).toBe(SPRITE_SIZE);
    }
  });

  it("fills the interior it encloses", () => {
    const map = drawEllipse(blank(), { row: 3, col: 3 }, { row: 11, col: 11 }, PEN, FILL);
    expect(at(map, 7, 7)).toBe(FILL);
    expect(at(map, 0, 0)).toBe(BG); // outside stays untouched
  });
});

describe("sprite-raster: floodFill", () => {
  it("fills a bounded region and stops at the border", () => {
    let map = drawRectangle(blank(), { row: 2, col: 2 }, { row: 8, col: 8 }, PEN);
    map = floodFill(map, { row: 5, col: 5 }, FILL);
    expect(at(map, 5, 5)).toBe(FILL);
    expect(at(map, 3, 3)).toBe(FILL);
    expect(at(map, 2, 2)).toBe(PEN); // the border
    expect(at(map, 0, 0)).toBe(BG); // outside the shape
  });

  it("fills the whole sprite from any seed when nothing bounds it", () => {
    const map = floodFill(blank(), { row: 0, col: 0 }, FILL);
    expect([...map].every((v) => v === FILL)).toBe(true);
  });

  it("is a no-op for a seed outside the sprite, and never samples a wrapped pixel", () => {
    const start = blank();
    start[4 * SPRITE_DIM + 15] = PEN; // the pixel `col: -1` on row 5 used to read
    const map = floodFill(start, { row: 5, col: -1 }, FILL);
    expect([...map]).toEqual([...start]);
  });

  it("is a no-op when the seed already holds the fill colour", () => {
    const map = floodFill(blank(FILL), { row: 5, col: 5 }, FILL);
    expect([...map].every((v) => v === FILL)).toBe(true);
  });
});

describe("sprite-raster: transforms", () => {
  /** An asymmetric marker so every transform is distinguishable from every other. */
  const marked = () => {
    const map = blank();
    map[0 * SPRITE_DIM + 1] = PEN;
    map[2 * SPRITE_DIM + 0] = FILL;
    return map;
  };

  it("rotates counter-clockwise", () => {
    const map = rotateCounterClockwise(marked());
    expect(at(map, 14, 0)).toBe(PEN);
    expect(at(map, 15, 2)).toBe(FILL);
  });

  it("rotates clockwise", () => {
    const map = rotateClockwise(marked());
    expect(at(map, 1, 15)).toBe(PEN);
    expect(at(map, 0, 13)).toBe(FILL);
  });

  it("four counter-clockwise rotations are the identity", () => {
    const start = marked();
    let map = start;
    for (let i = 0; i < 4; i++) map = rotateCounterClockwise(map);
    expect([...map]).toEqual([...start]);
  });

  it("clockwise and counter-clockwise are inverses", () => {
    const start = marked();
    expect([...rotateClockwise(rotateCounterClockwise(start))]).toEqual([...start]);
  });

  it("flipHorizontal mirrors left-to-right", () => {
    const map = flipHorizontal(marked());
    expect(at(map, 0, 14)).toBe(PEN);
    expect(at(map, 2, 15)).toBe(FILL);
  });

  it("flipVertical mirrors top-to-bottom", () => {
    const map = flipVertical(marked());
    expect(at(map, 15, 1)).toBe(PEN);
    expect(at(map, 13, 0)).toBe(FILL);
  });

  it("every flip is its own inverse", () => {
    const start = marked();
    expect([...flipHorizontal(flipHorizontal(start))]).toEqual([...start]);
    expect([...flipVertical(flipVertical(start))]).toEqual([...start]);
  });
});

describe("sprite-raster: purity", () => {
  it("never mutates the map it is given", () => {
    const start = blank();
    const snapshot = [...start];
    setPixel(start, { row: 1, col: 1 }, PEN);
    drawLine(start, { row: 0, col: 0 }, { row: 9, col: 9 }, PEN);
    drawRectangle(start, { row: 1, col: 1 }, { row: 8, col: 8 }, PEN, FILL);
    drawEllipse(start, { row: 1, col: 1 }, { row: 9, col: 9 }, PEN, FILL);
    floodFill(start, { row: 4, col: 4 }, FILL);
    rotateClockwise(start);
    flipHorizontal(start);
    expect([...start]).toEqual(snapshot);
  });
});
