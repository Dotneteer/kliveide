import { getAbrgForPaletteCode } from "@emu/machines/zxNext/palette";

/*
 * Palette codes to the canvas's pixel format, for the sprite pattern sheets (the NEX bank Sprites
 * view and the Sprite Inspector, `.plans/SPRITE_INSPECTOR_PLAN.md` §4.6).
 */

/** 256 palette codes (register layout) as ABGR words for `ImageData`. */
export function toAbgrTable(palette: number[]): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) table[i] = getAbrgForPaletteCode(palette[i] ?? i) >>> 0;
  return table;
}

/** An ABGR word as a CSS colour. */
export function abgrToCss(value: number): string {
  return `rgb(${value & 0xff}, ${(value >>> 8) & 0xff}, ${(value >>> 16) & 0xff})`;
}
