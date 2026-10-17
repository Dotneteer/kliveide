import type { NextTilemapState } from "@common/messaging/EmuApi";
import { t } from "@common/i18n/i18n";
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
 * document turns a snapshot into this once per version and renders from it. The text it returns is
 * translated when the functions run, which is at render time.
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
  return `${a.bankText} · ${a.z80Text ?? t("panels.graphics.inspector.notMapped")}`;
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
  const notMapped = t("panels.graphics.inspector.notMapped");
  const items: GlobalItem[] = [
    ...model.diagnostics.map((d) => ({ key: d.id, value: d.chip, title: d.sentence, flag: d.level })),
    {
      // --- The layer's hardware name, kept as the Next documentation spells it
      key: "Tilemap",
      value: r.enabled ? t("panels.graphics.inspector.on") : t("panels.graphics.inspector.off"),
      primary: true,
      title: `$6B = ${hex(r.control, 2)}`
    },
    { key: t("panels.tilemap.global.size"), value: `${mode.columns}×32`, primary: true, title: "$6B bit 6" },
    {
      key: t("panels.tilemap.global.entries"),
      value: mode.attributeLess
        ? t("panels.tilemap.global.entries1", { attr: hex(r.defaultAttr, 2) })
        : t("panels.tilemap.global.entries2"),
      primary: true,
      title: mode.attributeLess
        ? t("panels.tilemap.global.entries1Title")
        : t("panels.tilemap.global.entries2Title")
    },
    {
      key: t("panels.tilemap.global.tiles"),
      value: mode.textMode
        ? t("panels.tilemap.global.tilesText", { count: model.tileCount })
        : t("panels.tilemap.global.tiles4bit", { count: model.tileCount }),
      primary: true,
      title: [
        mode.tiles512 ? t("panels.tilemap.global.tiles512Title") : t("panels.tilemap.global.tiles256Title"),
        mode.textMode ? t("panels.tilemap.global.textModeTitle") : t("panels.tilemap.global.bytes32Title")
      ].join("\n")
    },
    {
      key: t("panels.tilemap.global.map"),
      value: map.bankText,
      primary: true,
      title: t("panels.tilemap.global.whereTitle", {
        reg: "6E",
        value: hex((r.mapBank7 ? 0x80 : 0) | r.mapMsb, 2),
        physical: map.physicalText,
        z80: map.z80Text ?? notMapped
      })
    },
    {
      key: t("panels.tilemap.global.defs"),
      value: defs.bankText,
      primary: true,
      title: t("panels.tilemap.global.whereTitle", {
        reg: "6F",
        value: hex((r.defBank7 ? 0x80 : 0) | r.defMsb, 2),
        physical: defs.physicalText,
        z80: defs.z80Text ?? notMapped
      })
    },
    {
      key: t("panels.graphics.inspector.globalScroll"),
      value: `${r.scrollX},${r.scrollY}`,
      title: t("panels.tilemap.global.scrollTitle")
    },
    {
      key: t("panels.graphics.inspector.globalClip"),
      value: r.clip.join(","),
      title: t("panels.graphics.inspector.clipTitle", {
        reg: "1B",
        next: ["x1", "x2", "y1", "y2"][r.clipIndex & 3],
        x1: clip.x1,
        x2: clip.x2,
        y1: clip.y1,
        y2: clip.y2
      })
    },
    mode.textMode
      ? {
          key: "$14",
          value: hex(r.globalTransparency, 2),
          title: t("panels.tilemap.global.textTransparencyTitle")
        }
      : { key: "$4C", value: hex(r.transparencyIndex, 1), title: t("panels.tilemap.global.nibbleTitle") },
    { key: t("panels.tilemap.global.priority"), value: priorityText(model), title: priorityTitle(mode) },
    {
      key: t("panels.graphics.inspector.globalPalette"),
      value: mode.secondPalette ? t("panels.tilemap.global.paletteSecond") : t("panels.tilemap.global.paletteFirst"),
      title: "$6B bit 4"
    }
  ];
  if (state.copperRunning) {
    items.push({
      // --- The Next's display co-processor, by its hardware name
      key: "Copper",
      value: t("panels.graphics.inspector.copperGlobalValue"),
      title: t("panels.graphics.inspector.copperGlobalTitle")
    });
  }
  return items;
}

function priorityText(model: TilemapModel): string {
  const { mode, cells } = model;
  if (mode.forceOnTop) return t("panels.tilemap.overUla");
  if (mode.tiles512) return t("panels.tilemap.belowUla");
  const below = cells.filter((c) => c.below).length;
  return below === 0
    ? t("panels.tilemap.overUla")
    : below === cells.length
      ? t("panels.tilemap.belowUla")
      : t("panels.tilemap.global.cellsBelow", { count: below });
}

function priorityTitle(mode: TilemapMode): string {
  if (mode.forceOnTop) return t("panels.tilemap.global.forceOnTopTitle");
  if (mode.tiles512) return t("panels.tilemap.global.tiles512PriorityTitle");
  return t("panels.tilemap.global.attrPriorityTitle");
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

export type InspectorField = {
  /** A stable identity: React keys and tests use it, never the (translated) name */
  id: string;
  name: string;
  value: string;
  title?: string;
  muted?: boolean;
};

/** A tile's rotate and mirrors as a list of words, or `undefined` for none */
export function transformText(c: { rotate: boolean; xmirror: boolean; ymirror: boolean }): string | undefined {
  const words = [
    c.rotate && t("panels.tilemap.transform.rotate"),
    c.xmirror && t("panels.tilemap.transform.xMirror"),
    c.ymirror && t("panels.tilemap.transform.yMirror")
  ].filter(Boolean);
  return words.length ? words.join(", ") : undefined;
}

export function cellFields(model: TilemapModel, cell: DecodedCell): InspectorField[] {
  const { mode, state } = model;
  const a = addressOf(state, state.regs.mapBank7, cell.entryOffset);
  const fields: InspectorField[] = [
    {
      id: "raw",
      name: t("panels.tilemap.field.raw"),
      value: cell.raw.map((b) => hex(b, 2)).join(" "),
      title: mode.attributeLess ? t("panels.tilemap.field.rawAttrLessTitle") : t("panels.tilemap.field.rawTitle")
    },
    {
      id: "tile",
      name: t("panels.tilemap.field.tile"),
      value: mode.tiles512 && cell.tile & 0x100 ? t("panels.tilemap.field.tileBit8", { tile: cell.tile }) : String(cell.tile),
      title: mode.tiles512 ? t("panels.tilemap.field.tile512Title") : undefined
    },
    {
      id: "attribute",
      name: t("panels.tilemap.field.attribute"),
      value: mode.attributeLess
        ? t("panels.tilemap.field.attributeDefault", { attr: hex(cell.attr, 2) })
        : hex(cell.attr, 2)
    },
    {
      id: "paletteOffset",
      name: t("panels.tilemap.field.paletteOffset"),
      value: String(cell.paletteOffset),
      title: mode.textMode ? t("panels.tilemap.field.paletteOffsetText") : t("panels.tilemap.field.paletteOffset4bit")
    }
  ];
  if (!mode.textMode) {
    const transform = transformText(cell);
    fields.push({
      id: "transform",
      name: t("panels.tilemap.field.transform"),
      value: transform ?? t("panels.graphics.inspector.none"),
      muted: !transform
    });
  }
  fields.push({
    id: "priority",
    name: t("panels.tilemap.global.priority"),
    value: mode.tiles512
      ? mode.forceOnTop
        ? t("panels.tilemap.field.overUlaForced")
        : t("panels.tilemap.field.belowUla512")
      : cell.below
        ? t("panels.tilemap.field.belowUlaBit")
        : mode.forceOnTop && cell.ulaOnTop
          ? t("panels.tilemap.field.overUlaForced")
          : t("panels.tilemap.overUla")
  });
  fields.push(
    { id: "entry", name: t("panels.tilemap.field.entry"), value: a.bankText, title: t("panels.tilemap.field.entryTitle") },
    { id: "physical", name: t("panels.graphics.inspector.physical"), value: a.physicalText },
    {
      id: "z80",
      name: "Z80",
      value: a.z80Text ?? t("panels.graphics.inspector.notMapped"),
      muted: a.z80 === undefined,
      title: t("panels.tilemap.field.z80Title")
    }
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
  if (!state.regs.enabled) reasons.push(t("panels.tilemap.reason.disabled"));
  if (!isCellVisible(state.regs, mode, cell.col, cell.row)) {
    reasons.push(t("panels.tilemap.reason.outside"));
  }
  if (indices.every((i) => i === TILE_TRANSPARENT)) {
    reasons.push(
      mode.textMode
        ? t("panels.tilemap.reason.transparentText")
        : t("panels.tilemap.reason.transparentNibble", { nibble: hex(state.regs.transparencyIndex, 1) })
    );
  }
  if (cell.below && !state.regs.ulaDisabled) {
    reasons.push(t("panels.tilemap.reason.belowUla"));
  }
  return reasons;
}

/** One line for the inspector's header. */
export function cellSummary(model: TilemapModel, cell: DecodedCell): string {
  const users = usageCount(model.usage, cell.tile);
  return t("panels.tilemap.pane.cellSummary", { col: cell.col, row: cell.row, tile: cell.tile, users });
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
