import type { LayerRect } from "@common/zxnext/tilemap/tilemapGeometry";
import {
  displayRectsOfCell,
  effectiveClip,
  layerPixelOfCell,
  visibleWindow
} from "@common/zxnext/tilemap/tilemapGeometry";
import type { TilemapModel } from "./tilemapViewModel";

/*
 * What the Map and Tiles views draw over their images (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.5),
 * as a list of shapes in image pixels. Pure, so the overlay model is tested without a canvas; the
 * views scale it by the zoom and paint it with the `--color-tilemap-*` tokens.
 */

export type OverlayRole = "grid" | "clip" | "visible" | "selected" | "user" | "changed" | "index";

export type OverlayShape =
  | { kind: "rect"; role: Exclude<OverlayRole, "grid" | "changed" | "index">; rect: LayerRect; dashed?: boolean }
  | { kind: "grid"; cellW: number; cellH: number; width: number; height: number }
  | { kind: "dot"; role: "changed"; x: number; y: number }
  /** Text at a cell's top left, or tucked into its bottom right corner (`corner`) */
  | { kind: "text"; role: "index"; x: number; y: number; text: string; corner?: boolean };

export type MapOverlayOptions = {
  asDisplayed: boolean;
  grid: boolean;
  indices: boolean;
  /** The cell or the selected tile's users, as cell indices */
  selected: number[];
  /** Whether `selected` is one selected cell (strong) or a tile's users (light) */
  selectedIsCell: boolean;
  changed: Set<number>;
};

/** A cell's rectangles in the view: on the unscrolled map, or where the display shows it. */
function cellRects(model: TilemapModel, index: number, asDisplayed: boolean): LayerRect[] {
  const col = index % model.mode.columns;
  const row = Math.floor(index / model.mode.columns);
  return asDisplayed ? displayRectsOfCell(model.state.regs, model.mode, col, row) : [layerPixelOfCell(col, row)];
}

export function mapOverlay(model: TilemapModel, o: MapOverlayOptions): OverlayShape[] {
  const { mode, state } = model;
  const shapes: OverlayShape[] = [];
  if (o.grid) shapes.push({ kind: "grid", cellW: 8, cellH: 8, width: mode.width, height: 256 });
  if (o.asDisplayed) {
    shapes.push({ kind: "rect", role: "clip", rect: effectiveClip(state.regs, mode) });
  } else {
    for (const rect of visibleWindow(state.regs, mode)) shapes.push({ kind: "rect", role: "visible", rect, dashed: true });
  }
  for (const index of o.changed) {
    for (const r of cellRects(model, index, o.asDisplayed)) shapes.push({ kind: "dot", role: "changed", x: r.x2 - 1, y: r.y1 + 1 });
  }
  if (o.indices) {
    model.cells.forEach((cell, index) => {
      const [r] = cellRects(model, index, o.asDisplayed);
      shapes.push({ kind: "text", role: "index", x: r.x1, y: r.y1, text: String(cell.tile) });
    });
  }
  for (const index of o.selected) {
    for (const rect of cellRects(model, index, o.asDisplayed)) {
      shapes.push({ kind: "rect", role: o.selectedIsCell ? "selected" : "user", rect });
    }
  }
  return shapes;
}

/** The Tiles view: tile `n` at column `n % perRow`. */
export function tileRect(tile: number, perRow: number): LayerRect {
  const x = (tile % perRow) * 8;
  const y = Math.floor(tile / perRow) * 8;
  return { x1: x, y1: y, x2: x + 7, y2: y + 7 };
}

export function tileAtPixel(x: number, y: number, perRow: number, count: number): number | undefined {
  const tile = Math.floor(y / 8) * perRow + Math.floor(x / 8);
  return x >= 0 && y >= 0 && x < perRow * 8 && tile < count ? tile : undefined;
}

export function tilesOverlay(
  model: TilemapModel,
  perRow: number,
  o: { grid: boolean; selectedTile?: number; counts: boolean }
): OverlayShape[] {
  const rows = Math.ceil(model.tileCount / perRow);
  const shapes: OverlayShape[] = [];
  if (o.grid) shapes.push({ kind: "grid", cellW: 8, cellH: 8, width: perRow * 8, height: rows * 8 });
  if (o.counts) {
    for (const [tile, cells] of model.usage.cellsByTile) {
      const r = tileRect(tile, perRow);
      shapes.push({ kind: "text", role: "index", x: r.x2 + 1, y: r.y2 + 1, text: String(cells.length), corner: true });
    }
  }
  if (o.selectedTile !== undefined && o.selectedTile < model.tileCount) {
    shapes.push({ kind: "rect", role: "selected", rect: tileRect(o.selectedTile, perRow) });
  }
  return shapes;
}

/** Unreferenced tiles dimmed (§4.5.2): a mask the size of the sheet. */
export function unusedTileMask(model: TilemapModel, perRow: number): Uint8Array {
  const width = perRow * 8;
  const rows = Math.ceil(model.tileCount / perRow);
  const mask = new Uint8Array(width * rows * 8);
  for (let tile = 0; tile < model.tileCount; tile++) {
    if (model.usage.cellsByTile.has(tile)) continue;
    const r = tileRect(tile, perRow);
    for (let y = r.y1; y <= r.y2; y++) mask.fill(1, y * width + r.x1, y * width + r.x2 + 1);
  }
  return mask;
}
