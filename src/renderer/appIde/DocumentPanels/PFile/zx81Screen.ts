import { ZX81_SCREEN_COLUMNS, ZX81_SCREEN_ROWS } from "./pFileView";

/*
 * The ZX81's picture from a display file, for the `.P` viewer: 24 rows of 32 characters, each an 8x8
 * glyph from the ROM's character set ($1E00, 64 glyphs of 8 bytes), bit 7 of the code inverting it.
 * Rows a 1K machine collapsed are paper after their last character, as on the screen.
 *
 * The glyphs come from the ROM file Klive ships, not from a table here: the ROM is the source.
 */

export const ZX81_SCREEN_WIDTH = ZX81_SCREEN_COLUMNS * 8;
export const ZX81_SCREEN_HEIGHT = ZX81_SCREEN_ROWS * 8;

/** Where the character set is in the 8K ROM, and its size */
export const ZX81_FONT_OFFSET = 0x1e00;
export const ZX81_FONT_LENGTH = 0x200;

/** Paper and ink, as the canvas takes them (0xAABBGGRR): the television's white and black */
export const ZX81_SCREEN_PALETTE = [0xffffffff, 0xff000000];

/** The character set out of an 8K ZX81 ROM image; undefined when the image is too short */
export function zx81FontFromRom(rom: Uint8Array | undefined): Uint8Array | undefined {
  if (!rom || rom.length < ZX81_FONT_OFFSET + ZX81_FONT_LENGTH) return undefined;
  return rom.slice(ZX81_FONT_OFFSET, ZX81_FONT_OFFSET + ZX81_FONT_LENGTH);
}

/**
 * Draws the rows into `target` (256 x 192 pixels, one palette entry each). A code with bit 6 set is
 * not a character (no display file holds one) and is drawn as paper.
 */
export function drawZx81Screen(
  rows: number[][],
  font: Uint8Array,
  palette: number[],
  target: Uint32Array
): void {
  const [paper, ink] = palette;
  target.fill(paper, 0, ZX81_SCREEN_WIDTH * ZX81_SCREEN_HEIGHT);
  rows.slice(0, ZX81_SCREEN_ROWS).forEach((row, rowIndex) => {
    row.slice(0, ZX81_SCREEN_COLUMNS).forEach((code, column) => {
      if (code & 0x40) return;
      const glyph = (code & 0x3f) * 8;
      const invert = (code & 0x80) !== 0;
      for (let line = 0; line < 8; line++) {
        let bits = font[glyph + line];
        if (invert) bits ^= 0xff;
        const base = (rowIndex * 8 + line) * ZX81_SCREEN_WIDTH + column * 8;
        for (let x = 0; x < 8; x++) {
          if (bits & (0x80 >> x)) target[base + x] = ink;
        }
      }
    });
  });
}
