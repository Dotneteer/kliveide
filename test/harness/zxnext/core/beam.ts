/**
 * Hardware beam coordinates -> Klive pixel-buffer coordinates.
 *
 * Hardware (see .plans/COPPER_VISUAL_TEST_HARNESS_PLAN.md "Hardware facts"):
 * - The copper line `cvc` is reloaded with NextReg $64 at the first paper line and wraps after
 *   310 (+3/128K 50Hz timing, 311 lines), so paper row r has cvc = (r + $64) mod 311.
 *   zxula_timing.vhd, cvc process.
 * - WAIT fires when hc_ula >= H*8+12, and hc_ula = paper x + 12, so at paper x = 8H.
 *   copper.vhd WAIT branch; zxula_timing.vhd ula_min_hactive = c_min_hactive - 12.
 *
 * Klive buffer (720x288, calibrated by case C00 and T00):
 * - paper row 0 is buffer row 48; rows above it are the top border (paper rows -48..-1).
 * - paper x 0 is buffer x 96, and every ULA pixel is two buffer pixels wide.
 */
export const COPPER_LINES = 311;
export const PAPER_TOP = 48;
export const PAPER_LEFT = 96;
export const X_SCALE = 2;

/** The buffer row on which copper line `cvc` is displayed, or undefined when it is not visible. */
export function copperLineToBufferRow(cvc: number, lineOffset = 0): number | undefined {
  let paperRow = (((cvc - lineOffset) % COPPER_LINES) + COPPER_LINES) % COPPER_LINES;
  if (paperRow >= COPPER_LINES - PAPER_TOP) paperRow -= COPPER_LINES; // bottom of the count = top border
  const row = PAPER_TOP + paperRow;
  return row >= 0 && row < 288 ? row : undefined;
}

/** The buffer x at which a WAIT with horizontal field `h` fires (hardware position). */
export function waitHToBufferX(h: number): number {
  return PAPER_LEFT + 8 * h * X_SCALE;
}

export function paperXToBufferX(x: number): number {
  return PAPER_LEFT + x * X_SCALE;
}

/**
 * The ZX Spectrum display-file address of a pixel row and column byte. Not linear:
 * `$4000 | third<<11 | scanline<<8 | charRow<<5 | column` (ROM PIXEL-ADD; zxula.vhd addr_p_spc_12_5).
 */
export function displayFileAddress(pixelRow: number, columnByte: number): number {
  return 0x4000 | ((pixelRow & 0xc0) << 5) | ((pixelRow & 0x07) << 8) | ((pixelRow & 0x38) << 2) | columnByte;
}
