/*
 * The ZX Spectrum Next tilemap, decoded (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.1, D3). Pure: a cell
 * is a function of its one or two map bytes and six registers, so the inspector decodes it here
 * rather than asking the core. Every rule copies `zxnextUlaRenderTilemapScreen` and
 * `zxnextUlaReadTilemapVram` in `zxnext-ula.c`, which follow `tilemap.vhd`; a harness test
 * (`test/zxnext-hw/tilemap/inspector-state.test.ts`) compares the image with both the core and the
 * VHDL-derived model in `_tilemap-helpers.ts`.
 */

/** The tilemap's registers, as the Tilemap Inspector's snapshot carries them. */
export type TilemapRegs = {
  /** `$6B` bit 7 */
  enabled: boolean;
  /** `$6B`, bit 7 and bit 4 (the second tilemap palette) re-ORed by the core export */
  control: number;
  /** `$6C` */
  defaultAttr: number;
  /** `$6E`: bank 7 flag and the MSB within the bank */
  mapBank7: boolean;
  mapMsb: number;
  /** `$6F`: bank 7 flag and the MSB within the bank */
  defBank7: boolean;
  defMsb: number;
  /** `$2F`/`$30` (10 bits) and `$31` */
  scrollX: number;
  scrollY: number;
  /** `$4C`, 4 bits */
  transparencyIndex: number;
  /** `$14`, the global transparency colour (text mode only, T4) */
  globalTransparency: number;
  /** `$1B`: x1, x2, y1, y2 */
  clip: [number, number, number, number];
  /** Which `$1B` value the next write sets */
  clipIndex: number;
  /** `$68` bit 7: the ULA is off (T7) */
  ulaDisabled: boolean;
};

export type TilemapMode = {
  columns: 40 | 80;
  /** `$6B` bit 5: one byte per entry, every attribute is `$6C` (T2) */
  attributeLess: boolean;
  /** `$6B` bit 3: 1 bit per pixel, 8 bytes per tile (T4) */
  textMode: boolean;
  /** `$6B` bit 1: attribute bit 0 is tile bit 8 (T3) */
  tiles512: boolean;
  /** `$6B` bit 0 */
  forceOnTop: boolean;
  /** `$6B` bit 4 */
  secondPalette: boolean;
  entryBytes: 1 | 2;
  tileBytes: 8 | 32;
  /** The map's length in bytes */
  mapLength: number;
  /** The whole definitions table's length in bytes (256 or 512 tiles) */
  defLength: number;
  /** The layer's width in layer pixels: 320 or 640 (T6) */
  width: 320 | 640;
};

export const TILEMAP_ROWS = 32;
export const TILEMAP_HEIGHT = 256;

/** Physical addresses of the two banks the tilemap reads (`zxnext-memory.c`) */
export const BANK5_PHYSICAL = 0x054000;
export const BANK7_PHYSICAL = 0x05c000;

/** A pixel the tilemap leaves transparent */
export const TILE_TRANSPARENT = -1;

export function tilemapMode(regs: Pick<TilemapRegs, "control">): TilemapMode {
  const c = regs.control & 0xff;
  const columns = c & 0x40 ? 80 : 40;
  const attributeLess = (c & 0x20) !== 0;
  const textMode = (c & 0x08) !== 0;
  const tiles512 = (c & 0x02) !== 0;
  const entryBytes = attributeLess ? 1 : 2;
  const tileBytes = textMode ? 8 : 32;
  return {
    columns,
    attributeLess,
    textMode,
    tiles512,
    forceOnTop: (c & 0x01) !== 0,
    secondPalette: (c & 0x10) !== 0,
    entryBytes,
    tileBytes,
    mapLength: columns * TILEMAP_ROWS * entryBytes,
    defLength: (tiles512 ? 512 : 256) * tileBytes,
    width: columns === 80 ? 640 : 320
  };
}

/** The bytes of the tilemap's two banks */
export type TilemapBanks = { bank5: Uint8Array; bank7: Uint8Array };

/**
 * The offset within the bank of tilemap address `address` from base MSB `msb` (T1). Bank 7 masks the
 * MSB to 5 bits and wraps at 8K; bank 5 wraps at 16K (`zxnextUlaReadTilemapVram`).
 */
export function vramOffset(useBank7: boolean, msb: number, address: number): number {
  const offsetMask = useBank7 ? 0x1f : 0x3f;
  const highByte = ((msb & offsetMask) + ((address >> 8) & 0x3f)) & 0x3f;
  return ((highByte << 8) | (address & 0xff)) & (useBank7 ? 0x1fff : 0x3fff);
}

/** The byte the tilemap reads at `address` from base `msb` in bank 5 or 7. */
export function readVram(banks: TilemapBanks, useBank7: boolean, msb: number, address: number): number {
  const bank = useBank7 ? banks.bank7 : banks.bank5;
  return bank[vramOffset(useBank7, msb, address)] ?? 0;
}

export type DecodedCell = {
  col: number;
  row: number;
  /** The entry's offset within its bank (T1) */
  entryOffset: number;
  /** The map bytes: the tile byte, then the attribute (absent in attribute-less mode, T2) */
  raw: [number] | [number, number];
  /** The attribute in effect: the map's, or `$6C` */
  attr: number;
  /** 0-511: bit 8 comes from attribute bit 0 in 512-tile mode (T3) */
  tile: number;
  /** Attribute bits 7-4, or bits 7-1 in text mode (T4) */
  paletteOffset: number;
  xmirror: boolean;
  ymirror: boolean;
  rotate: boolean;
  /** Attribute bit 0, "ULA over tilemap"; absent in 512-tile mode, where it is tile bit 8 (T3) */
  ulaOnTop?: boolean;
  /** The cell's pixels sit below the ULA: (bit 0 or 512-tile mode) and not `$6B` bit 0 */
  below: boolean;
};

/** One map entry, decoded. */
export function decodeCell(
  mode: TilemapMode,
  regs: TilemapRegs,
  banks: TilemapBanks,
  col: number,
  row: number
): DecodedCell {
  const entry = row * mode.columns + col;
  const address = mode.attributeLess ? entry : entry << 1;
  const tileByte = readVram(banks, regs.mapBank7, regs.mapMsb, address);
  const attrByte = mode.attributeLess ? undefined : readVram(banks, regs.mapBank7, regs.mapMsb, address | 1);
  const attr = attrByte ?? regs.defaultAttr & 0xff;
  const tile = mode.tiles512 && attr & 0x01 ? tileByte | 0x100 : tileByte;
  const transforms = !mode.textMode;
  return {
    col,
    row,
    entryOffset: vramOffset(regs.mapBank7, regs.mapMsb, address),
    raw: attrByte === undefined ? [tileByte] : [tileByte, attrByte],
    attr,
    tile,
    paletteOffset: mode.textMode ? attr >> 1 : attr >> 4,
    xmirror: transforms && (attr & 0x08) !== 0,
    ymirror: transforms && (attr & 0x04) !== 0,
    rotate: transforms && (attr & 0x02) !== 0,
    ulaOnTop: mode.tiles512 ? undefined : (attr & 0x01) !== 0,
    below: ((attr & 0x01) !== 0 || mode.tiles512) && !mode.forceOnTop
  };
}

/** Every map entry, row by row. */
export function decodeMap(mode: TilemapMode, regs: TilemapRegs, banks: TilemapBanks): DecodedCell[] {
  const cells: DecodedCell[] = [];
  for (let row = 0; row < TILEMAP_ROWS; row++) {
    for (let col = 0; col < mode.columns; col++) cells.push(decodeCell(mode, regs, banks, col, row));
  }
  return cells;
}

/** The offset within its bank of tile `tile`'s first definition byte. */
export function tileOffset(mode: TilemapMode, regs: TilemapRegs, tile: number): number {
  return vramOffset(regs.defBank7, regs.defMsb, tile * mode.tileBytes);
}

/**
 * Tile `tile` as stored: 64 pixel values, row by row, untransformed. A standard tile's value is its
 * 4-bit nibble (high nibble first); a text-mode tile's is its bit, 0 or 1 (T4).
 */
export function tilePixels(mode: TilemapMode, regs: TilemapRegs, banks: TilemapBanks, tile: number): Uint8Array {
  const out = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    if (mode.textMode) {
      const bits = readVram(banks, regs.defBank7, regs.defMsb, (tile << 3) | y);
      for (let x = 0; x < 8; x++) out[y * 8 + x] = (bits >> (7 - x)) & 1;
    } else {
      for (let x = 0; x < 8; x += 2) {
        const byte = readVram(banks, regs.defBank7, regs.defMsb, (tile << 5) | (y << 2) | (x >> 1));
        out[y * 8 + x] = byte >> 4;
        out[y * 8 + x + 1] = byte & 0x0f;
      }
    }
  }
  return out;
}

/**
 * A tile as shown: rotation first, then the mirrors in screen space (T5,
 * `zxnextUlaTilemapTransform`). Output pixel (x, y) is source pixel (tx, ty).
 */
export function transformTile(pixels: ArrayLike<number>, rotate: boolean, xm: boolean, ym: boolean): Uint8Array {
  const out = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const ex = xm !== rotate ? 7 - x : x;
      const ey = ym ? 7 - y : y;
      const [tx, ty] = rotate ? [ey, ex] : [ex, ey];
      out[y * 8 + x] = pixels[ty * 8 + tx];
    }
  }
  return out;
}

/**
 * Whether a text-mode palette entry is transparent: its RGB equals `$14` (T4, T8). `entry` is the
 * device's 9-bit RRRGGGBBB value; the compare ignores the low blue bit.
 */
export function isTextModeTransparent(entry: number, globalTransparency: number): boolean {
  return (entry & 0x1fe) === ((globalTransparency & 0xff) << 1);
}

/**
 * The palette index of a stored pixel value in a cell with attribute `attr`, or `TILE_TRANSPARENT`.
 * Standard tiles compare the nibble with `$4C`; text-mode pixels are transparent only by colour,
 * which `textTransparent` decides (T8). Without it, no text pixel is transparent.
 */
export function pixelIndex(
  mode: TilemapMode,
  regs: Pick<TilemapRegs, "transparencyIndex">,
  attr: number,
  value: number,
  textTransparent?: (index: number) => boolean
): number {
  if (mode.textMode) {
    const index = (attr & 0xfe) | (value & 1);
    return textTransparent?.(index) ? TILE_TRANSPARENT : index;
  }
  if ((value & 0x0f) === (regs.transparencyIndex & 0x0f)) return TILE_TRANSPARENT;
  return (attr & 0xf0) | (value & 0x0f);
}

export type TilemapImage = {
  width: number;
  height: number;
  /** Palette indices, `TILE_TRANSPARENT` where nothing is drawn */
  pixels: Int16Array;
};

export type TilemapImageOptions = {
  /**
   * `false` (*Whole map*, D4): the map unscrolled and unclipped, cell (c, r) at (8c, 8r).
   * `true` (*As displayed*): scrolled and clipped, as the layer reaches the mixer.
   */
  asDisplayed: boolean;
  textTransparent?: (index: number) => boolean;
};

/**
 * The tilemap as one image of layer pixels: 320 x 256, or 640 x 256 in 80-column mode (T6, T9).
 * *As displayed* copies the core: clip on `x` (or `x >> 1` at 80 columns) against the doubled `$1B`
 * X, then map x = (x + scroll X) mod width, y = (y + scroll Y) mod 256.
 */
export function renderTilemapImage(
  mode: TilemapMode,
  regs: TilemapRegs,
  banks: TilemapBanks,
  options: TilemapImageOptions
): TilemapImage {
  const { width, columns } = mode;
  const height = TILEMAP_HEIGHT;
  const pixels = new Int16Array(width * height).fill(TILE_TRANSPARENT);
  const cells = decodeMap(mode, regs, banks);
  // --- Each distinct (tile, transform) is decoded once
  const shown = new Map<number, Uint8Array>();
  const shownPixels = (cell: DecodedCell) => {
    const key = (cell.tile << 3) | (cell.rotate ? 4 : 0) | (cell.xmirror ? 2 : 0) | (cell.ymirror ? 1 : 0);
    let p = shown.get(key);
    if (!p) {
      p = transformTile(tilePixels(mode, regs, banks, cell.tile), cell.rotate, cell.xmirror, cell.ymirror);
      shown.set(key, p);
    }
    return p;
  };
  const [cx1, cx2, cy1, cy2] = regs.clip.map((v) => v & 0xff);
  const clipX1 = cx1 << 1;
  const clipX2 = (cx2 << 1) | 1;
  for (let y = 0; y < height; y++) {
    if (options.asDisplayed && (y < cy1 || y > cy2)) continue;
    const ay = options.asDisplayed ? (y + regs.scrollY) & 0xff : y;
    for (let x = 0; x < width; x++) {
      if (options.asDisplayed) {
        const hc = columns === 80 ? x >> 1 : x;
        if (hc < clipX1 || hc > clipX2) continue;
      }
      const ax = options.asDisplayed ? (x + regs.scrollX) % width : x;
      const cell = cells[(ay >> 3) * columns + (ax >> 3)];
      const value = shownPixels(cell)[(ay & 7) * 8 + (ax & 7)];
      pixels[y * width + x] = pixelIndex(mode, regs, cell.attr, value, options.textTransparent);
    }
  }
  return { width, height, pixels };
}

/**
 * The definitions as a sheet: `perRow` tiles across, each 8 x 8, drawn with palette offset
 * `paletteOffset(tile)` (a 4-bit offset for standard tiles, the 7-bit text-mode one otherwise).
 */
export function renderTileSheet(
  mode: TilemapMode,
  regs: TilemapRegs,
  banks: TilemapBanks,
  perRow: number,
  paletteOffset: (tile: number) => number,
  textTransparent?: (index: number) => boolean
): TilemapImage {
  const count = mode.tiles512 ? 512 : 256;
  const rows = Math.ceil(count / perRow);
  const width = perRow * 8;
  const height = rows * 8;
  const pixels = new Int16Array(width * height).fill(TILE_TRANSPARENT);
  for (let tile = 0; tile < count; tile++) {
    const p = tilePixels(mode, regs, banks, tile);
    const offset = paletteOffset(tile);
    const attr = mode.textMode ? (offset << 1) & 0xfe : (offset << 4) & 0xf0;
    const ox = (tile % perRow) * 8;
    const oy = Math.floor(tile / perRow) * 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        pixels[(oy + y) * width + ox + x] = pixelIndex(mode, regs, attr, p[y * 8 + x], textTransparent);
      }
    }
  }
  return { width, height, pixels };
}
