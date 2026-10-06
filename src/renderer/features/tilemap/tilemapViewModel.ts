import type { NextTilemapState } from "@common/messaging/EmuApi";
import {
  BANK5_PHYSICAL,
  BANK7_PHYSICAL,
  decodeMap,
  isTextModeTransparent,
  pixelIndex,
  TILE_TRANSPARENT,
  tileOffset,
  tilePixels,
  tilemapMode,
  transformTile,
  vramOffset,
  type DecodedCell,
  type TilemapMode
} from "@common/zxnext/tilemap/tilemapDecode";
import { effectiveClip, isCellVisible } from "@common/zxnext/tilemap/tilemapGeometry";
import { tilemapDiagnostics, type TilemapDiagnostic } from "@common/zxnext/tilemap/tilemapDiagnostics";
import { paletteOffsetFromMap, tileUsage, usageCount, type TileUsage } from "@common/zxnext/tilemap/tilemapUsage";

/*
 * The Tilemap Inspector's view model (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.4-§4.5). Pure: the
 * document turns a snapshot into this once per version and renders from it.
 */

export type TilemapModel = {
  state: NextTilemapState;
  mode: TilemapMode;
  cells: DecodedCell[];
  usage: TileUsage;
  diagnostics: TilemapDiagnostic[];
  /** 256 or 512 */
  tileCount: number;
};

export function buildTilemapModel(state: NextTilemapState): TilemapModel {
  const mode = tilemapMode(state.regs);
  const cells = decodeMap(mode, state.regs, state);
  return {
    state,
    mode,
    cells,
    usage: tileUsage(cells),
    diagnostics: tilemapDiagnostics(mode, state.regs, cells),
    tileCount: mode.tiles512 ? 512 : 256
  };
}

/** FNV-1a over a byte array, continuing from `h`. */
export function hashBytes(bytes: ArrayLike<number>, h = 0x811c9dc5): number {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The hash that gates re-decoding (D9): the 32K, the registers, the paging and the Copper flag. */
export function tilemapStateHash(state: NextTilemapState): number {
  let h = hashBytes(state.bank5);
  h = hashBytes(state.bank7, h);
  const r = state.regs;
  const regBytes = [
    r.enabled ? 1 : 0,
    r.control,
    r.defaultAttr,
    r.mapBank7 ? 1 : 0,
    r.mapMsb,
    r.defBank7 ? 1 : 0,
    r.defMsb,
    r.scrollX & 0xff,
    r.scrollX >> 8,
    r.scrollY,
    r.transparencyIndex,
    r.globalTransparency,
    ...r.clip,
    r.clipIndex,
    r.ulaDisabled ? 1 : 0,
    state.copperRunning ? 1 : 0
  ];
  h = hashBytes(regBytes, h);
  for (const o of state.slotOffsets) h = hashBytes([o & 0xff, (o >> 8) & 0xff, (o >> 16) & 0xff, (o >>> 24) & 0xff], h);
  return h;
}

// --- Addresses (T1)

const hex = (v: number, digits: number) => `$${v.toString(16).toUpperCase().padStart(digits, "0")}`;

export type TilemapAddress = {
  bank: 5 | 7;
  offset: number;
  /** `5:$2C00` */
  bankText: string;
  physical: number;
  /** `$056C00` */
  physicalText: string;
  /** The Z80 address where the page is mapped now, or undefined */
  z80?: number;
  z80Text?: string;
};

/** A bank offset three ways: bank:offset, physical, and the Z80 address if its page is mapped now. */
export function addressOf(state: Pick<NextTilemapState, "slotOffsets">, bank7: boolean, offset: number): TilemapAddress {
  const bank = bank7 ? 7 : 5;
  const physical = (bank7 ? BANK7_PHYSICAL : BANK5_PHYSICAL) + offset;
  let z80: number | undefined;
  state.slotOffsets.forEach((start, slot) => {
    if (z80 === undefined && physical >= start && physical < start + 0x2000) z80 = slot * 0x2000 + (physical - start);
  });
  return {
    bank,
    offset,
    bankText: `${bank}:${hex(offset, 4)}`,
    physical,
    physicalText: hex(physical, 6),
    z80,
    z80Text: z80 === undefined ? undefined : hex(z80, 4)
  };
}

/** How an address reads in one line: `5:$2C00 · $6C00`, or `· not mapped`. */
export function addressLine(a: TilemapAddress): string {
  return `${a.bankText} · ${a.z80Text ?? "not mapped"}`;
}

// --- The globals strip (§4.4)

export type GlobalItem = {
  key: string;
  value: string;
  title?: string;
  /** Shown even when the strip is collapsed */
  primary?: boolean;
  /** A diagnostic chip */
  flag?: TilemapDiagnostic["level"];
};

export function globalsStrip(model: TilemapModel): GlobalItem[] {
  const { state, mode } = model;
  const r = state.regs;
  const map = addressOf(state, r.mapBank7, vramOffset(r.mapBank7, r.mapMsb, 0));
  const defs = addressOf(state, r.defBank7, vramOffset(r.defBank7, r.defMsb, 0));
  const clip = effectiveClip(r, mode);
  const items: GlobalItem[] = [
    ...model.diagnostics.map((d) => ({ key: d.id, value: d.chip, title: d.sentence, flag: d.level })),
    {
      key: "Tilemap",
      value: r.enabled ? "on" : "off",
      primary: true,
      title: `$6B = ${hex(r.control, 2)}`
    },
    { key: "Size", value: `${mode.columns}×32`, primary: true, title: "$6B bit 6" },
    {
      key: "Entries",
      value: mode.attributeLess ? `1-byte, $6C=${hex(r.defaultAttr, 2)}` : "2-byte",
      primary: true,
      title: mode.attributeLess
        ? "$6B bit 5: one byte per entry; every cell's attribute is $6C"
        : "Tile byte, then attribute byte"
    },
    {
      key: "Tiles",
      value: `${model.tileCount} · ${mode.textMode ? "text 1-bit" : "4-bit"}`,
      primary: true,
      title: [
        mode.tiles512 ? "$6B bit 1: 512 tiles, attribute bit 0 is tile bit 8" : "256 tiles",
        mode.textMode ? "$6B bit 3: text mode, 8 bytes per tile, 7-bit palette offset" : "32 bytes per tile"
      ].join("\n")
    },
    {
      key: "Map",
      value: map.bankText,
      primary: true,
      title: `$6E = ${hex((r.mapBank7 ? 0x80 : 0) | r.mapMsb, 2)}\nPhysical ${map.physicalText}\nZ80 ${map.z80Text ?? "not mapped"}`
    },
    {
      key: "Defs",
      value: defs.bankText,
      primary: true,
      title: `$6F = ${hex((r.defBank7 ? 0x80 : 0) | r.defMsb, 2)}\nPhysical ${defs.physicalText}\nZ80 ${defs.z80Text ?? "not mapped"}`
    },
    { key: "Scroll", value: `${r.scrollX},${r.scrollY}`, title: "$2F/$30 (X, 10 bits) and $31 (Y)" },
    {
      key: "Clip",
      value: r.clip.join(","),
      title: `$1B: x1, x2, y1, y2 (next write sets ${["x1", "x2", "y1", "y2"][r.clipIndex & 3]})\nIn layer pixels: x ${clip.x1}-${clip.x2}, y ${clip.y1}-${clip.y2}`
    },
    mode.textMode
      ? {
          key: "$14",
          value: hex(r.globalTransparency, 2),
          title: "Text mode: a pixel whose colour equals the global transparency colour $14 is transparent"
        }
      : { key: "$4C", value: hex(r.transparencyIndex, 1), title: "The transparent nibble" },
    { key: "Priority", value: priorityText(model), title: priorityTitle(mode) },
    { key: "Palette", value: mode.secondPalette ? "second" : "first", title: "$6B bit 4" }
  ];
  if (state.copperRunning) {
    items.push({
      key: "Copper",
      value: "running",
      title: "The Copper may change these registers per line; the values shown are the ones at the stop"
    });
  }
  return items;
}

function priorityText(model: TilemapModel): string {
  const { mode, cells } = model;
  if (mode.forceOnTop) return "over ULA";
  if (mode.tiles512) return "below ULA";
  const below = cells.filter((c) => c.below).length;
  return below === 0 ? "over ULA" : below === cells.length ? "below ULA" : `${below} cells below`;
}

function priorityTitle(mode: TilemapMode): string {
  if (mode.forceOnTop) return "$6B bit 0 forces the tilemap over the ULA";
  if (mode.tiles512) return "512-tile mode: attribute bit 0 is tile bit 8, so every cell is below the ULA (T3)";
  return "Attribute bit 0 puts a cell below the ULA";
}

/** Flags first, then the primary items, then the rest (the strip collapses to flags and primary). */
export function orderGlobals(items: GlobalItem[]): GlobalItem[] {
  const rank = (g: GlobalItem) => (g.flag === "warning" ? 0 : g.flag ? 1 : g.primary ? 2 : 3);
  return items.slice().sort((a, b) => rank(a) - rank(b));
}

// --- Selection

export type TilemapSelection = { kind: "cell"; col: number; row: number } | { kind: "tile"; tile: number };

export const cellIndex = (model: TilemapModel, col: number, row: number) => row * model.mode.columns + col;

/** The selection kept valid across a column-mode change (a cell past column 39 falls back to none). */
export function validSelection(model: TilemapModel, selection?: TilemapSelection): TilemapSelection | undefined {
  if (!selection) return undefined;
  if (selection.kind === "cell") {
    return selection.col < model.mode.columns && selection.row < 32 ? selection : undefined;
  }
  return selection.tile < model.tileCount ? selection : undefined;
}

/** The tile the selection is about: the selected tile, or the selected cell's. */
export function selectedTile(model: TilemapModel, selection?: TilemapSelection): number | undefined {
  if (!selection) return undefined;
  return selection.kind === "tile" ? selection.tile : model.cells[cellIndex(model, selection.col, selection.row)]?.tile;
}

/** The cells to highlight: the selected cell, or the users of the selected tile. */
export function highlightedCells(model: TilemapModel, selection?: TilemapSelection): number[] {
  if (!selection) return [];
  if (selection.kind === "cell") return [cellIndex(model, selection.col, selection.row)];
  return model.usage.cellsByTile.get(selection.tile) ?? [];
}

// --- Palette

/**
 * The text-mode transparency test for a palette (T4, T8): an index is transparent when its device RGB
 * equals `$14`. Undefined outside text mode or without a palette.
 */
export function textTransparency(
  model: TilemapModel,
  deviceValues: number[] | undefined
): ((index: number) => boolean) | undefined {
  if (!model.mode.textMode || !deviceValues) return undefined;
  const flags = deviceValues.map((v) => isTextModeTransparent(v, model.state.regs.globalTransparency));
  return (index) => flags[index & 0xff] ?? false;
}

/** The Tiles view's palette offset per tile: the first user's (*From map*) or a fixed one. */
export function tileSheetOffset(model: TilemapModel, choice: "fromMap" | number): (tile: number) => number {
  if (choice !== "fromMap") return () => choice;
  return (tile) => paletteOffsetFromMap(model.cells, model.usage, tile, 0);
}

// --- The inspector (§4.5.3)

export type InspectorField = { name: string; value: string; title?: string; muted?: boolean };

export function cellFields(model: TilemapModel, cell: DecodedCell): InspectorField[] {
  const { mode, state } = model;
  const a = addressOf(state, state.regs.mapBank7, cell.entryOffset);
  const fields: InspectorField[] = [
    {
      name: "Raw",
      value: cell.raw.map((b) => hex(b, 2)).join(" "),
      title: mode.attributeLess ? "Attribute-less mode: one byte, the attribute is $6C" : "Tile byte, attribute byte"
    },
    {
      name: "Tile",
      value: mode.tiles512 && cell.tile & 0x100 ? `${cell.tile} (bit 8 from attr)` : String(cell.tile),
      title: mode.tiles512 ? "512-tile mode: attribute bit 0 is tile bit 8" : undefined
    },
    {
      name: "Attribute",
      value: `${hex(cell.attr, 2)}${mode.attributeLess ? " ($6C)" : ""}`
    },
    {
      name: "Palette offset",
      value: String(cell.paletteOffset),
      title: mode.textMode ? "Text mode: attribute bits 7-1" : "Attribute bits 7-4"
    }
  ];
  if (!mode.textMode) {
    const t = [cell.rotate && "rotate", cell.xmirror && "X mirror", cell.ymirror && "Y mirror"].filter(Boolean);
    fields.push({ name: "Transform", value: t.length ? t.join(", ") : "none", muted: !t.length });
  }
  fields.push({
    name: "Priority",
    value: mode.tiles512
      ? mode.forceOnTop
        ? "over ULA ($6B bit 0)"
        : "below ULA (512-tile mode)"
      : cell.below
        ? "below ULA (bit 0)"
        : mode.forceOnTop && cell.ulaOnTop
          ? "over ULA ($6B bit 0)"
          : "over ULA"
  });
  fields.push(
    { name: "Entry", value: a.bankText, title: "The entry's bank and offset" },
    { name: "Physical", value: a.physicalText },
    { name: "Z80", value: a.z80Text ?? "not mapped", muted: a.z80 === undefined, title: "Where the entry's page is mapped now" }
  );
  return fields;
}

/** The tile's definition bytes: offset, three ways. */
export function tileAddress(model: TilemapModel, tile: number): TilemapAddress {
  const { mode, state } = model;
  return addressOf(state, state.regs.defBank7, tileOffset(mode, state.regs, tile));
}

/** The palette indices a cell shows, 64 entries, `TILE_TRANSPARENT` where transparent. */
export function cellShownIndices(
  model: TilemapModel,
  cell: DecodedCell,
  textTransparent?: (index: number) => boolean
): Int16Array {
  const { mode, state } = model;
  const shown = transformTile(tilePixels(mode, state.regs, state, cell.tile), cell.rotate, cell.xmirror, cell.ymirror);
  return Int16Array.from(shown, (v) => pixelIndex(mode, state.regs, cell.attr, v, textTransparent));
}

/** A tile as stored, drawn with `paletteOffset`. */
export function tileStoredIndices(
  model: TilemapModel,
  tile: number,
  paletteOffset: number,
  textTransparent?: (index: number) => boolean
): Int16Array {
  const { mode, state } = model;
  const attr = mode.textMode ? (paletteOffset << 1) & 0xfe : (paletteOffset << 4) & 0xf0;
  return Int16Array.from(tilePixels(mode, state.regs, state, tile), (v) =>
    pixelIndex(mode, state.regs, attr, v, textTransparent)
  );
}

/** The distinct palette indices a cell uses, in first-seen order. */
export function coloursUsed(indices: Int16Array): number[] {
  const seen: number[] = [];
  for (const i of indices) if (i !== TILE_TRANSPARENT && !seen.includes(i)) seen.push(i);
  return seen;
}

/**
 * Why a cell might not be on screen (T8), each a sentence; empty when it should show. `indices` is
 * `cellShownIndices`.
 */
export function invisibilityReasons(model: TilemapModel, cell: DecodedCell, indices: Int16Array): string[] {
  const { state, mode } = model;
  const reasons: string[] = [];
  if (!state.regs.enabled) reasons.push("The tilemap is disabled ($6B bit 7).");
  if (!isCellVisible(state.regs, mode, cell.col, cell.row)) {
    reasons.push("Outside the visible window: the scroll and the clip window ($1B) leave it off screen.");
  }
  if (indices.every((i) => i === TILE_TRANSPARENT)) {
    reasons.push(
      mode.textMode
        ? "Every pixel is transparent: its colour equals the global transparency colour $14."
        : `Every pixel is transparent: each nibble equals $4C (${hex(state.regs.transparencyIndex, 1)}).`
    );
  }
  if (cell.below && !state.regs.ulaDisabled) {
    reasons.push("Below the ULA: hidden wherever the ULA pixel is opaque.");
  }
  return reasons;
}

/** One line for the inspector's header. */
export function cellSummary(model: TilemapModel, cell: DecodedCell): string {
  const users = usageCount(model.usage, cell.tile);
  return `Cell (${cell.col}, ${cell.row}) · tile ${cell.tile} · ${users} cell${users === 1 ? "" : "s"} use it`;
}

/** The cells that use a tile, as `(col, row)` pairs. */
export function tileUsers(model: TilemapModel, tile: number): { col: number; row: number; index: number }[] {
  return (model.usage.cellsByTile.get(tile) ?? []).map((index) => ({
    col: index % model.mode.columns,
    row: Math.floor(index / model.mode.columns),
    index
  }));
}

/** The cell as `.db` source: its entry's bytes. */
export function cellAsDb(cell: DecodedCell): string {
  return `    .db ${cell.raw.map((b) => hex(b, 2)).join(", ")} ; cell (${cell.col}, ${cell.row})`;
}
