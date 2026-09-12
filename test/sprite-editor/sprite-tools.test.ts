import { describe, it, expect } from "vitest";
import { applyTool, toolDraws } from "@renderer/features/sprite-editor/sprite-tools";
import { SPRITE_DIM, SPRITE_SIZE } from "@renderer/features/sprite-editor/sprite-raster";
import { SpriteTools } from "@renderer/features/sprite-editor/sprite-common";

const BG = 0x00;
const PEN = 0x1f;
const FILL = 0x2a;
const blank = () => new Uint8Array(SPRITE_SIZE).fill(BG);
const at = (m: Uint8Array, r: number, c: number) => m[r * SPRITE_DIM + c];
const painted = (m: Uint8Array) => [...m].filter((v) => v !== BG).length;

const DRAWING: SpriteTools[] = [
  "pencil",
  "line",
  "rectangle",
  "rectangle-filled",
  "circle",
  "circle-filled",
  "paint"
];

describe("sprite-tools", () => {
  it("the select tool marks rather than draws", () => {
    expect(applyTool(blank(), "select", { row: 1, col: 1 }, { row: 5, col: 5 }, PEN, FILL))
      .toBeUndefined();
    expect(toolDraws("select")).toBe(false);
  });

  /*
   * The `default` branch returning `undefined` rather than a map is what stops a tool added without
   * a case here from propagating a null into the sprite list - which the original did, *before* its
   * own null check, storing it and then calling `sprites.set(null, offset)`.
   */
  it("returns undefined for an unknown tool rather than a null map", () => {
    const result = applyTool(blank(), "lasso" as SpriteTools, { row: 0, col: 0 }, { row: 1, col: 1 }, PEN, FILL);
    expect(result).toBeUndefined();
  });

  it("every drawing tool marks the canvas", () => {
    for (const tool of DRAWING) {
      const result = applyTool(blank(), tool, { row: 3, col: 3 }, { row: 9, col: 9 }, PEN, FILL);
      expect(result, tool).toBeDefined();
      expect(painted(result!.map), tool).toBeGreaterThan(0);
    }
  });

  /*
   * A key press is a click: `from === to`. Each tool has to do something sensible with a degenerate
   * gesture, because that is exactly what a single click with the mouse produces too.
   */
  it("draws a single pixel when from and to are the same point", () => {
    for (const tool of ["pencil", "line", "rectangle", "circle"] as SpriteTools[]) {
      const result = applyTool(blank(), tool, { row: 7, col: 7 }, { row: 7, col: 7 }, PEN, FILL);
      expect(painted(result!.map), tool).toBe(1);
      expect(at(result!.map, 7, 7), tool).toBe(PEN);
    }
  });

  it("accumulates for freehand tools and replaces for shapes", () => {
    const accumulating = (tool: SpriteTools) =>
      applyTool(blank(), tool, { row: 1, col: 1 }, { row: 4, col: 4 }, PEN, FILL)!.accumulate;
    expect(accumulating("pencil")).toBe(true);
    expect(accumulating("paint")).toBe(true);
    // Shapes redraw from the gesture's anchor, so a rubber band replaces itself instead of smearing.
    expect(accumulating("line")).toBe(false);
    expect(accumulating("rectangle")).toBe(false);
    expect(accumulating("circle-filled")).toBe(false);
  });

  it("uses the fill colour only for the filled variants", () => {
    const outline = applyTool(blank(), "rectangle", { row: 2, col: 2 }, { row: 8, col: 8 }, PEN, FILL)!;
    expect(at(outline.map, 5, 5)).toBe(BG);
    const filled = applyTool(blank(), "rectangle-filled", { row: 2, col: 2 }, { row: 8, col: 8 }, PEN, FILL)!;
    expect(at(filled.map, 5, 5)).toBe(FILL);
    expect(at(filled.map, 2, 2)).toBe(PEN);
  });

  it("never mutates the map it is given", () => {
    const start = blank();
    const snapshot = [...start];
    for (const tool of DRAWING) applyTool(start, tool, { row: 0, col: 0 }, { row: 9, col: 9 }, PEN, FILL);
    expect([...start]).toEqual(snapshot);
  });
});
