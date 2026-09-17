/*
 * A 16K NEX bank read as ZX Spectrum Next sprite patterns.
 *
 * Pure: bytes in, palette indices out. The Sprites view draws what this returns, and the tests pin
 * the layout without a canvas.
 *
 * The layout follows the hardware, not Klive's emulator. From `_input/next-fpga/src/video/sprites.vhd`:
 *
 * - **8-bit** pattern N is 256 bytes, one byte per pixel, row by row. A pixel is transparent when the
 *   whole byte equals the transparency index (Reg `$4B`).
 * - **4-bit** pattern P is **128 bytes**, two pixels per byte: the pattern address is the 8-bit pixel
 *   address shifted right by one, and the pixel takes the byte's **high nibble when x is even**, the
 *   low nibble when x is odd. A pixel is transparent when its nibble equals the low nibble of the
 *   transparency index; otherwise its palette index is `paletteOffset << 4 | nibble`.
 *
 * A bank carries its patterns from `offset`, not necessarily from `$0000`: sprite data often shares a
 * bank with code or starts after a small header.
 */

export type NexSpriteFormat = "8bit" | "4bit";

export const NEX_SPRITE_DIM = 16;
export const NEX_SPRITE_PIXELS = NEX_SPRITE_DIM * NEX_SPRITE_DIM;
export const NEX_SPRITE_BANK_SIZE = 0x4000;
export const NEX_DEFAULT_SPRITE_FORMAT: NexSpriteFormat = "8bit";
export const NEX_DEFAULT_SPRITE_TRANSPARENCY = 0xe3;

/** A pixel that is not drawn. */
export const NEX_SPRITE_TRANSPARENT = -1;

/** Bytes one pattern takes in the bank. */
export function patternSize(format: NexSpriteFormat): number {
  return format === "4bit" ? 128 : 256;
}

/** How many whole patterns fit from `offset` to the end of the bank. A partial last one is not one. */
export function patternCount(format: NexSpriteFormat, offset: number, bankSize = NEX_SPRITE_BANK_SIZE): number {
  if (offset < 0 || offset >= bankSize) return 0;
  return Math.floor((bankSize - offset) / patternSize(format));
}

/** The bank offset of a pattern's first byte. */
export function patternOffset(index: number, format: NexSpriteFormat, offset: number): number {
  return offset + index * patternSize(format);
}

/** The pattern holding a bank offset, or `undefined` before the first pattern or past the last. */
export function patternAt(
  bankOffset: number,
  format: NexSpriteFormat,
  offset: number,
  bankSize = NEX_SPRITE_BANK_SIZE
): number | undefined {
  if (bankOffset < offset) return undefined;
  const index = Math.floor((bankOffset - offset) / patternSize(format));
  return index < patternCount(format, offset, bankSize) ? index : undefined;
}

/** The inclusive bank-offset span covered by patterns `first..last`, in either order. */
export function patternSpan(
  first: number,
  last: number,
  format: NexSpriteFormat,
  offset: number
): { start: number; end: number } {
  const from = Math.min(first, last);
  const to = Math.max(first, last);
  return {
    start: patternOffset(from, format, offset),
    end: patternOffset(to, format, offset) + patternSize(format) - 1
  };
}

export type NexSpritePixelOptions = {
  format: NexSpriteFormat;
  offset: number;
  /** 4-bit only: the palette offset, `0..15`, placed in the index's high nibble. */
  paletteOffset?: number;
  transparencyIndex?: number;
};

/**
 * The 256 pixels of one pattern, row by row: a palette index `0..255`, or `NEX_SPRITE_TRANSPARENT`.
 *
 * Bytes past the end of `bytes` read as zero, so a short buffer never throws; the view never asks for
 * a pattern `patternCount` does not include.
 */
export function patternPixels(
  bytes: ArrayLike<number>,
  index: number,
  { format, offset, paletteOffset = 0, transparencyIndex = NEX_DEFAULT_SPRITE_TRANSPARENCY }: NexSpritePixelOptions
): Int16Array {
  const pixels = new Int16Array(NEX_SPRITE_PIXELS);
  const start = patternOffset(index, format, offset);
  const byteAt = (at: number) => (at < bytes.length ? bytes[at] & 0xff : 0);

  if (format === "8bit") {
    const transparent = transparencyIndex & 0xff;
    for (let p = 0; p < NEX_SPRITE_PIXELS; p++) {
      const value = byteAt(start + p);
      pixels[p] = value === transparent ? NEX_SPRITE_TRANSPARENT : value;
    }
    return pixels;
  }

  const transparentNibble = transparencyIndex & 0x0f;
  const high = (paletteOffset & 0x0f) << 4;
  for (let p = 0; p < NEX_SPRITE_PIXELS; p++) {
    const value = byteAt(start + (p >> 1));
    // --- x is the low four bits of the pixel address: even x is the high nibble.
    const nibble = (p & 1) === 0 ? value >> 4 : value & 0x0f;
    pixels[p] = nibble === transparentNibble ? NEX_SPRITE_TRANSPARENT : high | nibble;
  }
  return pixels;
}

/** Every pixel the same — all transparent, or all one colour. Drawn dimmed in the sheet. */
export function isBlankPattern(pixels: Int16Array): boolean {
  const first = pixels[0];
  for (let p = 1; p < pixels.length; p++) {
    if (pixels[p] !== first) return false;
  }
  return true;
}

export type NexPatternColourUse = { index: number; count: number };

/** The colours a pattern uses, most frequent first; transparency is `NEX_SPRITE_TRANSPARENT`. */
export function patternColours(pixels: Int16Array): NexPatternColourUse[] {
  const counts = new Map<number, number>();
  pixels.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([index, count]) => ({ index, count }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
}

/**
 * A pattern that uses this many distinct colours is more likely code or packed data than a sprite.
 *
 * A hint, not a rule: it only words the inspector's remark. Real 8-bit sprites rarely use more than a
 * few dozen colours, while 256 bytes of Z80 code routinely reach well past this.
 */
export const NEX_SPRITE_NOISE_COLOURS = 48;

export type NexPatternHint =
  | { kind: "blank"; transparent: boolean; index: number }
  | { kind: "noisy"; colours: number }
  | { kind: "sprite"; colours: number; transparent: number };

export function patternHint(pixels: Int16Array): NexPatternHint {
  const colours = patternColours(pixels);
  if (colours.length === 1) {
    const only = colours[0].index;
    return { kind: "blank", transparent: only === NEX_SPRITE_TRANSPARENT, index: only };
  }
  const transparent = colours.find((c) => c.index === NEX_SPRITE_TRANSPARENT)?.count ?? 0;
  const opaque = colours.filter((c) => c.index !== NEX_SPRITE_TRANSPARENT).length;
  if (opaque >= NEX_SPRITE_NOISE_COLOURS) return { kind: "noisy", colours: opaque };
  return { kind: "sprite", colours: opaque, transparent };
}
