import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { TILE_SNAPSHOT_VIEWER } from "@common/state/common-ids";
import {
  isTextModeTransparent,
  pixelIndex,
  TILE_TRANSPARENT,
  tilemapMode,
  tilePixels,
  transformTile,
  type DecodedCell
} from "@common/zxnext/tilemap/tilemapDecode";
import { tileAddress, type TilemapModel } from "./tilemapViewModel";

/*
 * A tilemap tile popped out of the Tilemap Inspector into a read-only tile viewer: the tile's
 * definition bytes, frozen when taken, with what is needed to draw it as the hardware does - the
 * format, the palette offset, the transparency rule and, when it was taken from a cell, that cell's
 * rotate and mirrors (`.plans/TILEMAP_INSPECTOR_PLAN.md`, after §9).
 *
 * The document holds the 32 (or, in text mode, 8) definition bytes as its contents and the rest in
 * its view state. The tilemap palette is frozen with it (the bank the tilemap drew with, or the pinned
 * one), so the snapshot keeps its colours after the program changes them or the machine stops.
 */

export type TileSnapshotInfo = {
  tile: number;
  textMode: boolean;
  /** 4-bit, or the 7-bit text-mode offset */
  paletteOffset: number;
  /** `$4C`: the transparent nibble (standard tiles) */
  transparencyIndex: number;
  /** `$14`: the transparent colour (text mode) */
  globalTransparency: number;
  /** The cell it was taken from, with that cell's transform */
  cell?: { col: number; row: number; rotate: boolean; xmirror: boolean; ymirror: boolean };
  /** `5:$2100`, where the bytes were */
  address: string;
  takenAt: string;
  /** The tilemap palette when taken: 256 device values (9-bit RRRGGGBBB) */
  palette: number[];
  /** Which tilemap palette it was: 0 first, 1 second */
  paletteBank: 0 | 1;
};

export type TileSnapshotViewState = {
  snapshot: TileSnapshotInfo;
  /** Show the tile as the cell shows it (transformed), or as stored */
  asShown?: boolean;
  cellSize?: number;
  showGrid?: boolean;
  checker?: boolean;
};

/** The snapshot of a tile, from a cell (its palette offset and transform) or from the sheet. */
export function tileSnapshotOf(
  model: TilemapModel,
  tile: number,
  palette: { deviceValues: number[]; bank: 0 | 1 },
  options: { cell?: DecodedCell; paletteOffset?: number; takenAt?: Date } = {}
): { bytes: Uint8Array; info: TileSnapshotInfo } {
  const { mode, state } = model;
  const bytes = new Uint8Array(mode.tileBytes);
  // --- Read through the decoder's addressing, so the bank-7 8K wrap is honoured byte by byte
  const pixels = tilePixels(mode, state.regs, state, tile);
  if (mode.textMode) {
    for (let y = 0; y < 8; y++) {
      let b = 0;
      for (let x = 0; x < 8; x++) b |= (pixels[y * 8 + x] & 1) << (7 - x);
      bytes[y] = b;
    }
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = (pixels[i * 2] << 4) | pixels[i * 2 + 1];
  }
  const at = options.takenAt ?? new Date();
  const c = options.cell;
  return {
    bytes,
    info: {
      tile,
      textMode: mode.textMode,
      paletteOffset: c ? c.paletteOffset : (options.paletteOffset ?? 0),
      transparencyIndex: state.regs.transparencyIndex & 0x0f,
      globalTransparency: state.regs.globalTransparency & 0xff,
      cell: c ? { col: c.col, row: c.row, rotate: c.rotate, xmirror: c.xmirror, ymirror: c.ymirror } : undefined,
      address: tileAddress(model, tile).bankText,
      takenAt: at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      palette: palette.deviceValues.slice(0, 256),
      paletteBank: palette.bank
    }
  };
}

/** The stored pixel values (nibbles, or bits in text mode) of the snapshot's bytes. */
export function snapshotValues(bytes: Uint8Array, textMode: boolean): Uint8Array {
  const out = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      out[y * 8 + x] = textMode ? (bytes[y] >> (7 - x)) & 1 : (bytes[y * 4 + (x >> 1)] >> (x & 1 ? 0 : 4)) & 0x0f;
    }
  }
  return out;
}

export type SnapshotPixel = {
  /** The stored value: a nibble, or a bit in text mode */
  value: number;
  /** The palette index drawn, or `TILE_TRANSPARENT` */
  index: number;
};

/**
 * The 64 pixels to draw: as stored, or as the cell shows them (rotated, then mirrored, T5), with
 * the palette offset applied and the transparency rule of the format (T4, T8). The frozen palette's
 * 9-bit entries decide text-mode transparency against `$14`.
 */
export function snapshotPixels(bytes: Uint8Array, info: TileSnapshotInfo, asShown: boolean): SnapshotPixel[] {
  const deviceValues = info.palette;
  let values = snapshotValues(bytes, info.textMode);
  if (asShown && info.cell) values = transformTile(values, info.cell.rotate, info.cell.xmirror, info.cell.ymirror);
  const mode = tilemapMode({ control: info.textMode ? 0x88 : 0x80 });
  const attr = info.textMode ? (info.paletteOffset << 1) & 0xfe : (info.paletteOffset << 4) & 0xf0;
  const textTransparent = deviceValues?.length
    ? (index: number) => isTextModeTransparent(deviceValues[index & 0xff] ?? 0, info.globalTransparency)
    : undefined;
  return Array.from(values, (value) => ({
    value,
    index: pixelIndex(mode, { transparencyIndex: info.transparencyIndex }, attr, value, textTransparent)
  }));
}

export const isTransparent = (p: SnapshotPixel) => p.index === TILE_TRANSPARENT;

/** The read-only bar's text. */
export function tileSnapshotTitle(info: TileSnapshotInfo): { title: string; detail: string } {
  const c = info.cell;
  const transform = c ? [c.rotate && "rotate", c.xmirror && "X mirror", c.ymirror && "Y mirror"].filter(Boolean) : [];
  const facts = [
    c ? `as cell (${c.col}, ${c.row}) shows it` : undefined,
    `palette ${info.paletteBank + 1}, offset ${info.paletteOffset}`,
    transform.length ? transform.join(", ") : undefined,
    info.address,
    `taken ${info.takenAt}`
  ].filter(Boolean);
  return { title: `Tile ${info.tile} · ${info.textMode ? "text 1-bit" : "4-bit"}`, detail: facts.join(" · ") };
}

/** The tile's bytes as `.db` source. */
export function tileSnapshotAsDb(bytes: Uint8Array, info: TileSnapshotInfo): string {
  const hex = (b: number) => `$${b.toString(16).toUpperCase().padStart(2, "0")}`;
  const perLine = info.textMode ? 8 : 4;
  const lines = [`; tile ${info.tile}${info.textMode ? " (text mode)" : ""}`];
  for (let i = 0; i < bytes.length; i += perLine) {
    lines.push(`    .db ${Array.from(bytes.subarray(i, i + perLine), hex).join(", ")}`);
  }
  return lines.join("\n");
}

export const tileSnapshotId = (tile: number) => `tileSnapshot-${tile}`;

/** Opens (or retakes, when that tile's snapshot is already open) a read-only tile snapshot. */
export async function openTileSnapshot(
  hub: IDocumentHubService,
  snapshot: { bytes: Uint8Array; info: TileSnapshotInfo }
): Promise<void> {
  const id = tileSnapshotId(snapshot.info.tile);
  if (hub.isOpen(id)) await hub.closeDocument(id);
  const viewState: TileSnapshotViewState = { snapshot: snapshot.info, asShown: !!snapshot.info.cell };
  await hub.openDocument(
    {
      id,
      name: `Tile ${snapshot.info.tile} (snapshot)`,
      type: TILE_SNAPSHOT_VIEWER,
      iconName: "tilemap",
      contents: snapshot.bytes
    },
    viewState,
    false
  );
}
