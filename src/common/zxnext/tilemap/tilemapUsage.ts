/*
 * Which cells use which tile, and which cells changed (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.1). Pure.
 */
import type { DecodedCell } from "./tilemapDecode";

export type TileUsage = {
  /** Tile -> the indices (row * columns + col) of the cells that show it, in map order */
  cellsByTile: Map<number, number[]>;
  /** The highest tile any cell uses, -1 for an empty map */
  maxTile: number;
};

export function tileUsage(cells: readonly DecodedCell[]): TileUsage {
  const cellsByTile = new Map<number, number[]>();
  let maxTile = -1;
  cells.forEach((cell, i) => {
    const list = cellsByTile.get(cell.tile);
    if (list) list.push(i);
    else cellsByTile.set(cell.tile, [i]);
    if (cell.tile > maxTile) maxTile = cell.tile;
  });
  return { cellsByTile, maxTile };
}

/** How many cells show `tile`. */
export function usageCount(usage: TileUsage, tile: number): number {
  return usage.cellsByTile.get(tile)?.length ?? 0;
}

/**
 * The palette offset of the first cell that shows each tile (the Tiles view's *From map*), or
 * `fallback` for an unreferenced tile.
 */
export function paletteOffsetFromMap(
  cells: readonly DecodedCell[],
  usage: TileUsage,
  tile: number,
  fallback: number
): number {
  const first = usage.cellsByTile.get(tile)?.[0];
  return first === undefined ? fallback : cells[first].paletteOffset;
}

/** A cell's identity for "changed since the last stop": its tile and the attribute in effect. */
export function cellKeys(cells: readonly DecodedCell[]): Uint32Array {
  const keys = new Uint32Array(cells.length);
  cells.forEach((c, i) => (keys[i] = (c.tile << 8) | (c.attr & 0xff)));
  return keys;
}

/**
 * The cells whose tile or attribute differs from the baseline. A baseline of another length (the
 * column mode changed) or none marks nothing.
 */
export function changedCells(baseline: Uint32Array | undefined, current: Uint32Array): Set<number> {
  const changed = new Set<number>();
  if (!baseline || baseline.length !== current.length) return changed;
  for (let i = 0; i < current.length; i++) if (baseline[i] !== current[i]) changed.add(i);
  return changed;
}
