import { hex8, parkedSession, writePalette } from "../ula/_ula-helpers";
import type { NextTestSession } from "../../harness/zxnext";

/*
 * A transcription of `_input/next-fpga/src/video/tilemap.vhd` and a screen set up to check it pixel by
 * pixel. Coordinates are the tilemap's: x 0-319 from buffer x 32 (40 columns, 2 buffer pixels each) or
 * 0-639 (80 columns, 1 buffer pixel each), y 0-255 from buffer row 16.
 *
 * - tm_x_sum / tm_x_correction: tilemap x = (x + scroll_x) mod 320 (40 columns) or 640 (80 columns),
 *   for scroll values below the width; y = (y + scroll_y) mod 256.
 * - The map entry of (column, row) is at row * 40 (80) + column, times two with attributes ($6B bit 5
 *   clear: tile byte, then attribute); without them the attribute is $6C. 512-tile mode ($6B bit 1): tile
 *   index bit 8 = attribute bit 0.
 * - Standard tiles: 32 bytes, 4 bits a pixel. X mirror (attr bit 3) XOR rotate (bit 1) inverts x, Y mirror
 *   (bit 2) inverts y, rotate swaps them; byte = tile * 32 + y' * 4 + x' / 2, high nibble for even x'.
 *   Pixel index = attr(7:4) & nibble; transparent when the nibble equals $4C.
 * - Text mode ($6B bit 3): 8 bytes a tile, no transform; bit 7 - x of byte tile * 8 + y; index =
 *   attr(7:1) & bit. The $4C compare does not apply (zxnext.vhd ~7055 compares the RGB with $14 instead).
 * - Addresses: (address(13:8) + base(5:0)) & address(7:0), base = $6E (map) / $6F (tiles) bits 5-0;
 *   bank 5 here (bit 7 of the base would pick bank 7).
 * - Clip ($1B): x1 * 2 .. x2 * 2 + 1 and y1 .. y2 in 320 x 256 coordinates, for both widths.
 */

export type TM = {
  cols80: boolean;
  noAttr: boolean;
  text: boolean;
  mode512: boolean;
  defaultAttr: number;
  transparentIndex: number;
  sx: number;
  sy: number;
  clip: [number, number, number, number];
  mapBase: number;
  tileBase: number;
};

export const TM_DEFAULT: TM = {
  cols80: false,
  noAttr: false,
  text: false,
  mode512: false,
  defaultAttr: 0,
  transparentIndex: 0x0f,
  sx: 0,
  sy: 0,
  clip: [0, 159, 0, 255],
  mapBase: 0x2c,
  tileBase: 0x0c
};

/** Bank 5 byte at 14-bit address `sub` offset by `base` 256-byte units. */
const read = (bank5: Uint8Array, base: number, sub: number) => bank5[((((sub >> 8) + base) & 0x3f) << 8) | (sub & 0xff)];

/** The palette index of tilemap pixel (x, y), or -1 when transparent / outside. */
export function tilemapIndex(bank5: Uint8Array, p: TM, dx: number, dy: number): number {
  const width = p.cols80 ? 640 : 320;
  const hc = p.cols80 ? dx >> 1 : dx;
  const [x1, x2, y1, y2] = p.clip;
  if (hc >= 320 || dy >= 256 || hc < x1 * 2 || hc > x2 * 2 + 1 || dy < y1 || dy > y2) return -1;
  const x = (dx + p.sx) % width;
  const y = (dy + p.sy) & 0xff;
  const entry = (y >> 3) * (p.cols80 ? 80 : 40) + (x >> 3);
  const tile = p.noAttr ? read(bank5, p.mapBase, entry) : read(bank5, p.mapBase, entry * 2);
  const attr = p.noAttr ? p.defaultAttr : read(bank5, p.mapBase, entry * 2 + 1);
  const tile9 = (p.mode512 && attr & 0x01 ? 0x100 : 0) | tile;
  const px = x & 7;
  const py = y & 7;
  if (p.text) {
    const bits = read(bank5, p.tileBase, (tile9 << 3) | py);
    return (attr & 0xfe) | ((bits >> (7 - px)) & 1);
  }
  const ex = (attr & 0x08 ? 1 : 0) ^ (attr & 0x02 ? 1 : 0) ? 7 - px : px;
  const ey = attr & 0x04 ? 7 - py : py;
  const [tx, ty] = attr & 0x02 ? [ey, ex] : [ex, ey];
  const byte = read(bank5, p.tileBase, (tile9 << 5) | (ty << 2) | (tx >> 1));
  const nibble = tx & 1 ? byte & 0x0f : byte >> 4;
  if (nibble === (p.transparentIndex & 0x0f)) return -1;
  return (attr & 0xf0) | nibble;
}

/** Whether the pixel is marked "below the ULA": (attr bit 0 or 512-tile mode) and not $6B bit 0. */
export function tilemapBelow(bank5: Uint8Array, p: TM & { onTop: boolean }, dx: number, dy: number): boolean {
  const width = p.cols80 ? 640 : 320;
  const x = (dx + p.sx) % width;
  const y = (dy + p.sy) & 0xff;
  const entry = (y >> 3) * (p.cols80 ? 80 : 40) + (x >> 3);
  const attr = p.noAttr ? p.defaultAttr : read(bank5, p.mapBase, entry * 2 + 1);
  return ((attr & 0x01) !== 0 || p.mode512) && !p.onTop;
}

/** A pseudo-random bank 5 image. */
export function randomBank5(seed: number): Uint8Array {
  const out = new Uint8Array(0x4000);
  let v = seed * 7919 + 1;
  for (let i = 0; i < out.length; i++) {
    v = (v * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (v >> 16) & 0xff;
  }
  return out;
}

/**
 * A parked session with bank 5 = `bank5`, the first tilemap palette holding colour i at index i, the ULA
 * off, fallback and global transparency $E3 (an index-$E3 text pixel is transparent and shows the same
 * colour).
 */
export async function tilemapScreen(bank5: Uint8Array): Promise<NextTestSession> {
  const s = await parkedSession();
  s.poke(0x4000, bank5);
  writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i] as [number, number]), 0x30);
  return s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x68, 0x80);
}

/** $6B value for the parameters (enable bit 7 set). */
export function control6B(p: TM, onTop = false, palette2 = false): number {
  return 0x80 | (p.cols80 ? 0x40 : 0) | (p.noAttr ? 0x20 : 0) | (palette2 ? 0x10 : 0) | (p.text ? 0x08 : 0) | (p.mode512 ? 0x02 : 0) | (onTop ? 0x01 : 0);
}

/** Every tilemap pixel that differs from the model (at most 8); `colour` maps an index to the expected colour. */
export function tilemapMismatches(
  s: NextTestSession,
  bank5: Uint8Array,
  p: TM,
  none: string,
  rows: [number, number] = [0, 255],
  colour: (index: number) => string = hex8
): string[] {
  const width = p.cols80 ? 640 : 320;
  const bad: string[] = [];
  for (let y = rows[0]; y <= rows[1] && bad.length < 8; y++) {
    for (let x = 0; x < width && bad.length < 8; x++) {
      const i = tilemapIndex(bank5, p, x, y);
      const want = i < 0 ? none : colour(i);
      const w = p.cols80 ? 1 : 2;
      for (let k = 0; k < w; k++) {
        const got = s.pixel(32 + x * w + k, 16 + y);
        if (got !== want) {
          bad.push(`(${x},${y})+${k}: ${got} != ${want} (index ${i})`);
          break;
        }
      }
    }
  }
  return bad;
}
