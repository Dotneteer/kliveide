/**
 * The ZX Spectrum 48K's sixteen colours, as the renderer consumes them.
 *
 * **These are ABGR, not ARGB.** Every copy of this table in the codebase was headed "ARGB colors",
 * and that comment was wrong wherever it appeared. The values reach the screen through a
 * `Uint32Array` whose bytes are handed to `ImageData`, which is **RGBA byte order** — so on a
 * little-endian host the word `0xffaa0000` arrives as bytes `00 00 aa ff`: R=0, G=0, B=0xaa, i.e.
 * *blue*, exactly as its label says. Written as a 32-bit word that byte order spells ABGR, which is
 * the name this repo already uses for the same convention (`controls/data/index.tsx`,
 * `getAbrgForPaletteCode`).
 *
 * The labels were never wrong; only the word above them was. Checking one entry is enough to see
 * it: `0xff0000aa` is labelled Red, and R is the *low* byte.
 *
 * It lives here rather than inside `CommonScreenDevice` because the `.SCR` viewer had a
 * byte-identical private copy — carrying the same wrong comment — and a palette that two files
 * state independently is a palette that will eventually disagree with itself.
 */
export const SPECTRUM_48_COLORS: number[] = [
  0xff000000, // Black
  0xffaa0000, // Blue
  0xff0000aa, // Red
  0xffaa00aa, // Magenta
  0xff00aa00, // Green
  0xffaaaa00, // Cyan
  0xff00aaaa, // Yellow
  0xffaaaaaa, // White
  0xff000000, // Bright Black
  0xffff0000, // Bright Blue
  0xff0000ff, // Bright Red
  0xffff00ff, // Bright Magenta
  0xff00ff00, // Bright Green
  0xffffff00, // Bright Cyan
  0xff00ffff, // Bright Yellow
  0xffffffff // Bright White
];

/** The size of a `.SCR` screen file: 6144 bytes of pixel data plus 768 of attributes. */
export const SCR_FILE_LENGTH = 0x1b00;
