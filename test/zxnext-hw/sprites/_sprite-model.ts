/*
 * A transcription of the line engine of `_input/next-fpga/src/video/sprites.vhd` (LOAD SPRITE LINE):
 * for display line V (0-255, sprite coordinates: 32 lines above the paper) it walks sprites 0-127 in order
 * and writes their opaque pixels into a 320-pixel line buffer, as S_QUALIFY / S_PROCESS do.
 *
 * - Relative sprites (attr 3 bit 6, attr 4 bits 7-6 = 01) take position, palette, visibility, 4-bit
 *   mode and - for a unified anchor (anchor attr 4 bit 5) - mirror / rotate / scale from the last
 *   non-relative sprite (the anchor). Anchor visibility is cleared at the start of each line; the rest
 *   persists, so a relative sprite 0 uses the previous line's last anchor but is invisible.
 * - Y: offset = (V - y) mod 512, arithmetic-shifted by the Y scale; drawn when offset(8:4) = 0.
 * - X: 16 << scale pixels from x (mod 512); the pattern address moves by +1 / -1 / +16 / -16 (mirror /
 *   rotate) every 1 << scale pixels; the sprite stops at the first pixel at x >= 320 unless x(8:4)
 *   is in the wrap-around zone (x_wrap).
 * - 8-bit patterns: transparent when the byte equals $4B; index = (byte(7:4) + palette offset) & byte(3:0).
 *   4-bit patterns (attr 4 bit 7): byte = pattern(13:8) & N6 & address(7:1), nibble by address bit 0;
 *   transparent when the nibble equals $4B(3:0); index = palette offset & nibble.
 * - A later sprite overwrites an earlier one; with zero-on-top ($15 bit 6) it does not. Writing an opaque
 *   pixel onto an opaque one sets the collision flag, whether it is overwritten or not.
 */

export type SpriteAttrs = [number, number, number, number, number];

export type LineResult = {
  /** 320 entries: the palette index, or -1 */
  pixels: Int16Array;
  collision: boolean;
  /** 28 MHz clocks the line takes: one per sprite qualified, one per pixel processed */
  cost: number;
  /** 320 entries: the sprite that drew the pixel, or -1 (for diagnostics) */
  owner: Int16Array;
};

type Anchor = {
  relType: boolean;
  h: boolean;
  vis: boolean;
  x: number;
  y: number;
  pattern: number;
  paloff: number;
  rotate: boolean;
  xm: boolean;
  ym: boolean;
  xscale: number;
  yscale: number;
};

const sx8 = (v: number) => (v & 0x80 ? (v | ~0xff) : v & 0xff);

/** Renders sprite line V. `attrs` has 128 entries (attr 4 is ignored unless attr 3 bit 6 is set). */
export function spriteLine(
  attrs: SpriteAttrs[],
  patterns: Uint8Array,
  v: number,
  transparent: number,
  zeroOnTop: boolean,
  anchorIn?: Anchor
): LineResult & { anchor: Anchor } {
  const buf = new Int16Array(320).fill(-1);
  const owner = new Int16Array(320).fill(-1);
  let collision = false;
  let cost = 0;
  const a: Anchor = anchorIn
    ? { ...anchorIn, vis: false }
    : { relType: false, h: false, vis: false, x: 0, y: 0, pattern: 0, paloff: 0, rotate: false, xm: false, ym: false, xscale: 0, yscale: 0 };

  for (let i = 0; i < 128; i++) {
    cost++;
    const [s0, s1, s2, s3, s4raw] = attrs[i];
    const five = (s3 & 0x40) !== 0;
    const s4 = five ? s4raw : 0;
    const relative = five && (s4 & 0xc0) === 0x40;
    let c0 = s0, c1 = s1, c2 = s2, c3 = s3, c4 = s4;
    if (relative) {
      const x0 = a.rotate ? s1 : s0;
      const y0 = a.rotate ? s0 : s1;
      const x1 = a.rotate !== a.xm ? -x0 & 0xff : x0;
      const y1 = a.ym ? -y0 & 0xff : y0;
      const scale = (v8: number, sc: number) =>
        sc === 0 ? sx8(v8) & 0x1ff : sc === 1 ? (v8 << 1) & 0x1ff : sc === 2 ? ((v8 & 0x7f) << 2) & 0x1ff : ((v8 & 0x3f) << 3) & 0x1ff;
      const x3 = (a.x + scale(x1, a.xscale)) & 0x1ff;
      const y3 = (a.y + scale(y1, a.yscale)) & 0x1ff;
      const paloff = s2 & 0x01 ? (a.paloff + (s2 >> 4)) & 0x0f : s2 >> 4;
      const relXm = a.rotate ? ((s2 >> 2) ^ (s2 >> 1)) & 1 : (s2 >> 3) & 1;
      const relYm = a.rotate ? ((s2 >> 3) ^ (s2 >> 1)) & 1 : (s2 >> 2) & 1;
      c0 = x3 & 0xff;
      c1 = y3 & 0xff;
      c2 = !a.relType
        ? (paloff << 4) | (s2 & 0x0e) | (x3 >> 8)
        : (paloff << 4) | (((a.xm ? 1 : 0) ^ relXm) << 3) | (((a.ym ? 1 : 0) ^ relYm) << 2) | (((a.rotate ? 1 : 0) ^ ((s2 >> 1) & 1)) << 1) | (x3 >> 8);
      c3 = ((a.vis && s3 & 0x80 ? 1 : 0) << 7) | 0x40 | (s3 & 0x3f);
      c4 = !a.relType
        ? ((a.h ? 1 : 0) << 7) | (((s4 >> 5) & 1) << 6) | (s4 & 0x1e) | (y3 >> 8)
        : ((a.h ? 1 : 0) << 7) | (((s4 >> 5) & 1) << 6) | (a.xscale << 3) | (a.yscale << 1) | (y3 >> 8);
    }
    const y8 = five ? c4 & 1 : 0;
    const y = (y8 << 8) | c1;
    const x = ((c2 & 1) << 8) | c0;
    const h = five && (c4 & 0x80) !== 0;
    const n6 = h && (c4 & 0x40) !== 0 ? 1 : 0;
    let pattern = ((s3 & 0x3f) << 1) | n6;
    if (relative && (s4 & 0x01) !== 0) pattern = (pattern + a.pattern) & 0x7f;
    const yscale = five ? (c4 >> 1) & 3 : 0;
    const xscale = five ? (c4 >> 3) & 3 : 0;
    const raw = (v - y) & 0x1ff;
    const yoff = (raw & 0x100 ? raw | ~0x1ff : raw) >> yscale; // --- arithmetic shift of the 9-bit value
    const visible = (c3 & 0x80) !== 0;
    if (!relative) {
      a.relType = five && (s4 & 0x20) !== 0;
      a.h = h;
      a.vis = visible;
      a.x = x;
      a.y = y;
      a.pattern = pattern;
      a.paloff = s2 >> 4;
      const unified = five && (s4 & 0x20) !== 0;
      a.rotate = unified && (s2 & 0x02) !== 0;
      a.xm = unified && (s2 & 0x08) !== 0;
      a.ym = unified && (s2 & 0x04) !== 0;
      a.xscale = unified ? (s4 >> 3) & 3 : 0;
      a.yscale = unified ? (s4 >> 1) & 3 : 0;
    }
    if (!visible || ((yoff >> 4) & 0x1f) !== 0) continue;
    // --- draw
    const rotate = (c2 & 0x02) !== 0;
    const xMirrEff = ((c2 >> 3) ^ (c2 >> 1)) & 1;
    const yIndex = (c2 & 0x04 ? ~yoff : yoff) & 0x0f;
    const xIndex = xMirrEff ? 0x0f : 0x00;
    let addr = ((pattern >> 1) << 8) | (rotate ? (xIndex << 4) | yIndex : (yIndex << 4) | xIndex);
    const delta = xMirrEff ? (rotate ? -16 : -1) : rotate ? 16 : 1;
    const width = 16 << xscale;
    const wrap = [0x1f, 0x1e, 0x1c, 0x18][xscale];
    const paloff = c2 >> 4;
    for (let k = 0; k < width; k++) {
      cost++;
      const pos = (x + k) & 0x1ff;
      if (pos >= 320 && ((pos >> 4) & wrap) !== wrap) break;
      if (pos < 320) {
        let index: number;
        let opaque: boolean;
        if (!h) {
          const b = patterns[addr & 0x3fff];
          opaque = b !== transparent;
          index = ((((b >> 4) + paloff) & 0x0f) << 4) | (b & 0x0f);
        } else {
          // --- spr_cur_4bit(0) is bit 0 of the pattern number after the relative add (N6)
          const b = patterns[((addr & 0x3f00) | ((pattern & 1) << 7) | ((addr & 0xff) >> 1)) & 0x3fff];
          const nib = addr & 1 ? b & 0x0f : b >> 4;
          opaque = nib !== (transparent & 0x0f);
          index = (paloff << 4) | nib;
        }
        if (opaque) {
          if (buf[pos] >= 0) collision = true;
          if (!zeroOnTop || buf[pos] < 0) {
            buf[pos] = index;
            owner[pos] = i;
          }
        }
      }
      if (((k + 1) & ((1 << xscale) - 1)) === 0) addr = (addr + delta) & 0x3fff;
    }
  }
  return { pixels: buf, collision, cost, owner, anchor: a };
}

/** All 256 lines; the anchor state entering line 0 is the one a full pass leaves (it is line-independent). */
export function spriteFrame(attrs: SpriteAttrs[], patterns: Uint8Array, transparent: number, zeroOnTop: boolean) {
  const warm = spriteLine(attrs, patterns, 0, transparent, zeroOnTop).anchor;
  const lines: LineResult[] = [];
  let anchor = warm;
  for (let v = 0; v < 256; v++) {
    const r = spriteLine(attrs, patterns, v, transparent, zeroOnTop, anchor);
    lines.push(r);
    anchor = r.anchor;
  }
  return lines;
}

/** A seeded generator. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x80000000;
  };
}
