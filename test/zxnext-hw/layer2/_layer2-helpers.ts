import { hex8, parkedSession, writePalette } from "../ula/_ula-helpers";
import type { CoreName, NextTestSession } from "../../harness/zxnext";

/*
 * A transcription of `_input/next-fpga/src/video/layer2.vhd` and a screen set up to check it pixel by
 * pixel.
 *
 * - 256x192 (`$70` bits 5-4 = 00): display pixel (x, y) of the paper; x = x + scroll_x (the address
 *   takes x(7:0): wrap at 256), y = y + scroll_y folded back once it reaches 192 (y(7:6) + 1); address
 *   y & x(7:0). Valid inside the 256x192 paper.
 * - 320x256 / 640x256 (01 / 1x): "wide" coordinates, x 0-319 from buffer x 32, y 0-255 from buffer row
 *   16; x = x + the 9-bit scroll with x(8:6) + 3 once x_pre >= 320 (wrap at 320), y = y + scroll_y
 *   (8 bits: wrap at 256); address x & y (column-major). 640x256: each byte is two pixels, the high
 *   nibble first, and the pixel is "0000" & nibble.
 * - Pixel index = (pixel(7:4) + palette offset) & pixel(3:0).
 * - Clip: 256 mode x1..x2 on the display x; wide modes x1 & '0' .. x2 & '1' (doubled); y1..y2.
 * - SRAM bank = $12 + 16 + address(16:14) in 16K units; bit 21 of the address (bank >= 128) disables the
 *   pixel.
 */

export type L2 = {
  resolution: 0 | 1 | 2;
  bank: number;
  offset: number;
  sx: number;
  sy: number;
  clip: [number, number, number, number];
};

export const L2_DEFAULT: L2 = { resolution: 0, bank: 8, offset: 0, sx: 0, sy: 0, clip: [0, 255, 0, 191] };

/** The palette index at display pixel (x, y) (see above for the coordinates), or -1: no pixel. */
export function layer2Index(mem: Map<number, Uint8Array>, p: L2, dx: number, dy: number): number {
  const wide = p.resolution !== 0;
  const hc = wide && p.resolution === 2 ? dx >> 1 : dx; // --- 640 mode: two pixels per wide x
  // --- clip and range (layer2.vhd hc_valid / vc_valid / layer2_clip_en)
  const [x1, x2, y1, y2] = p.clip;
  const cx1 = wide ? x1 << 1 : x1;
  const cx2 = wide ? (x2 << 1) | 1 : x2;
  if (hc < cx1 || hc > cx2 || dy < y1 || dy > y2) return -1;
  if (wide ? hc >= 320 || dy >= 256 : hc >= 256 || dy >= 192) return -1;
  let addr: number;
  if (!wide) {
    const x = (hc + (p.sx & 0xff)) & 0xff;
    const yPre = dy + p.sy;
    const y = yPre >= 192 ? ((((yPre >> 6) & 3) + 1) & 3) << 6 | (yPre & 0x3f) : yPre;
    addr = (y << 8) | x;
  } else {
    const xPre = hc + (p.sx & 0x1ff);
    let x = xPre & 0x1ff;
    if (xPre >= 512 || ((xPre & 0x100) !== 0 && (xPre & 0xc0) !== 0)) x = ((((xPre >> 6) & 7) + 3) & 7) << 6 | (xPre & 0x3f);
    const y = (dy + p.sy) & 0xff;
    addr = (x << 8) | y;
  }
  const bank = p.bank + (addr >> 14);
  if (bank + 16 >= 128) return -1;
  const byte = mem.get(bank)?.[addr & 0x3fff] ?? 0;
  const pixel = p.resolution === 2 ? (dx & 1 ? byte & 0x0f : byte >> 4) : byte;
  return ((((pixel >> 4) + p.offset) & 0x0f) << 4) | (pixel & 0x0f);
}

/** Writes `data` (16K) into 16K bank `bank` through MMU slot 6, then restores slot 6 to page 0. */
export function pokeBank(s: NextTestSession, bank: number, data: ArrayLike<number>): void {
  s.setNextReg(0x56, bank * 2).poke(0xc000, Array.from(data).slice(0, 0x2000));
  s.setNextReg(0x56, bank * 2 + 1).poke(0xc000, Array.from(data).slice(0x2000, 0x4000));
  s.setNextReg(0x56, 0x00);
}

/** A pseudo-random 16K bank, different for every `seed`. */
export function randomBank(seed: number): Uint8Array {
  const out = new Uint8Array(0x4000);
  let v = seed * 7919 + 1;
  for (let i = 0; i < out.length; i++) {
    v = (v * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (v >> 16) & 0xff;
  }
  return out;
}

/**
 * A parked session with banks `first` .. `first + count - 1` filled with random data, the first Layer 2
 * palette holding colour i at index i, the ULA off ($68 bit 7) and the fallback / global transparency both
 * $E3 - so an index-$E3 pixel is transparent and shows the same colour.
 */
export async function layer2Screen(core: CoreName, first = 8, count = 5): Promise<{ s: NextTestSession; mem: Map<number, Uint8Array> }> {
  const s = await parkedSession(core);
  const mem = new Map<number, Uint8Array>();
  for (let b = first; b < first + count; b++) {
    mem.set(b, randomBank(b));
    pokeBank(s, b, mem.get(b)!);
  }
  writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i] as [number, number]), 0x10);
  s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x68, 0x80);
  return { s, mem };
}

/** Buffer position of display pixel (x, y) and its width in buffer pixels, per resolution. */
function geometry(resolution: number, x: number, y: number): { bx: number; by: number; w: number } {
  if (resolution === 0) return { bx: 96 + 2 * x, by: 48 + y, w: 2 };
  if (resolution === 1) return { bx: 32 + 2 * x, by: 16 + y, w: 2 };
  return { bx: 32 + x, by: 16 + y, w: 1 };
}

/**
 * Every pixel of the Layer 2 area that differs from the model (at most 8 reported). `none` is the colour
 * expected where the model has no pixel; rows limits the check to [first, last] display rows.
 */
export function layer2Mismatches(
  s: NextTestSession,
  mem: Map<number, Uint8Array>,
  p: L2,
  none: string,
  rows?: [number, number]
): string[] {
  const width = p.resolution === 0 ? 256 : p.resolution === 1 ? 320 : 640;
  const height = p.resolution === 0 ? 192 : 256;
  const [r0, r1] = rows ?? [0, height - 1];
  const bad: string[] = [];
  for (let y = r0; y <= r1 && bad.length < 8; y++) {
    for (let x = 0; x < width && bad.length < 8; x++) {
      const i = layer2Index(mem, p, x, y);
      const want = i < 0 ? none : hex8(i);
      const { bx, by, w } = geometry(p.resolution, x, y);
      for (let k = 0; k < w; k++) {
        const got = s.pixel(bx + k, by);
        if (got !== want) {
          bad.push(`(${x},${y})+${k}: ${got} != ${want} (index ${i})`);
          break;
        }
      }
    }
  }
  return bad;
}
