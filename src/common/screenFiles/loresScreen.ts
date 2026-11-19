/*
 * The ZX Spectrum Next's LoRes screen as a file (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, §3). Pure.
 * 128 x 96, one byte (a ULA palette index) per pixel, row-major: rows 0-47 at $4000, rows 48-95 at
 * $6000 (`zxnextLoResStandardAddress` in `zxnext-layer2.c`), so a `.slr` is the two 6,144-byte halves
 * in order.
 */

export const LORES_WIDTH = 128;
export const LORES_HEIGHT = 96;
/** The size of a `.slr` */
export const LORES_FILE_BYTES = LORES_WIDTH * LORES_HEIGHT;
/** The rows in each half */
export const LORES_HALF_ROWS = 48;

/** A LoRes screen as a picture: the palette index of every pixel */
export function slrPicture(file: Uint8Array): { width: number; height: number; pixels: Int16Array } {
  const pixels = new Int16Array(LORES_FILE_BYTES);
  for (let i = 0; i < LORES_FILE_BYTES; i++) pixels[i] = file[i] ?? 0;
  return { width: LORES_WIDTH, height: LORES_HEIGHT, pixels };
}

/** What a `.slr` says about one pixel. The offset counts from the start of the file (after a header). */
export type SlrProbe = {
  x: number;
  y: number;
  offset: number;
  /** The address the byte has on the machine: $4000 + offset, or $6000 + (offset - 6,144) */
  address: number;
  /** The pixel is in the bottom half ($6000) */
  bottom: boolean;
  index: number;
};

export function slrProbe(file: Uint8Array, x: number, y: number): SlrProbe {
  const offset = y * LORES_WIDTH + x;
  const bottom = y >= LORES_HALF_ROWS;
  const address = bottom ? 0x6000 + offset - LORES_HALF_ROWS * LORES_WIDTH : 0x4000 + offset;
  return { x, y, offset, address, bottom, index: file[offset] ?? 0 };
}

/**
 * The ULA palette as the Next resets it, 9-bit `RRRGGGBBB`: the eight colours and their BRIGHT
 * versions, repeated in every block of 16, entry 11 (BRIGHT red) `$1CF` rather than `$1C7`
 * (`zxnextPaletteHardReset` in `zxnext-palette.c`). LoRes indexes this palette; NextZXOS leaves it as
 * it is when `LAYER 1,0` turns LoRes on (checked in the harness), so a `.slr` loaded from NextBASIC
 * shows its pixels' low nibbles in these 16 colours.
 */
export const NEXT_DEFAULT_ULA_COLOURS = [
  0x000, 0x005, 0x140, 0x145, 0x028, 0x02d, 0x168, 0x16d, 0x000, 0x007, 0x1c0, 0x1cf, 0x038, 0x03f, 0x1f8, 0x1ff
];

/** The whole 256-entry default ULA palette (9-bit values) */
export function nextDefaultUlaPalette(): number[] {
  return Array.from({ length: 256 }, (_, i) => NEXT_DEFAULT_ULA_COLOURS[i & 0x0f]);
}
