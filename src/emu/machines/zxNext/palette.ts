import { toHexa6 } from "@renderer/appIde/services/ide-commands";
import { zxNextRgb333Codes } from "./PaletteDevice";

/**
 * The 3-bit component -> 8-bit expansion.
 *
 * The hardware replicates the three bits across the byte (`001` -> `00100100` = `0x24`), which is
 * what both of the emulator's own lookup tables encode — `zxNextBgra`, which paints the machine's
 * screen, and `zxNextRgb333Codes`, which `getCssStringForPaletteCode` reads. This array carried
 * `0x25` at level 1, so `getAbrgForPaletteCode` — the path `Layer2Screen` and `SpriteImage` draw
 * through — rendered that one level a step brighter than the emulator displayed the same colour.
 * `palette-codec.test.ts` pins the three tables together.
 */
const colorIntensity = [0x00, 0x24, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];

/*
 * ---------------------------------------------------------------------------------------------
 * Two bit layouts, and which one these functions speak
 * ---------------------------------------------------------------------------------------------
 *
 * The Next holds a 9-bit RGB333 colour, and the app moves it around in **two different packings**.
 * Every function below takes the *register* one. That is not arbitrary: it is the only layout that
 * survives a round trip through the hardware registers, and it is what every persisted and edited
 * palette in the app already carries.
 *
 * - **Register layout (what these functions take).** `RRRGGGBB` in bits 7..0 with the low blue bit
 *   parked in bit 8 — the shape of a Next Reg $41 write followed by the second $44 write. It is
 *   what `PaletteEditor.updateColorValue` composes, what a `.nex`/`.pal` file yields, and what
 *   `SpriteEditor`'s default ramp (`0..255`) is. Bit 15 may additionally carry the priority flag,
 *   which only the editors use.
 *
 * - **Device layout.** A straight `RRRGGGBB B` — red in bits 8..6, green in 5..3, blue in 2..0 —
 *   which is how `PaletteDevice` stores every entry (see `defaultUlaColors`, whose comments spell
 *   the grouping out, and `nextReg41Value`, which is literally `stored >> 1`).
 *
 * The two are a one-bit rotation apart, which is exactly why mixing them is so quiet: a grey stays
 * grey and white stays white, so the palette still *looks* like a palette. Only saturated colours
 * move, and they move to a plausible-looking wrong colour — ULA blue `$005` (`000_000_101`,
 * `#0000b6`) renders as `#002449`, a dark teal, if a device value is fed in here unconverted.
 *
 * Anything holding device-layout values converts once, at its boundary, with
 * `paletteCodeFromDeviceValue`. Do not add a second overload that "detects" the layout: the two
 * ranges overlap completely and no value can be classified by inspection.
 */

/**
 * Convert a value as `PaletteDevice` stores it (straight 9-bit RGB333) into the register layout
 * every function in this module expects.
 *
 * The inverse of the rotation `getCssStringForPaletteCode` undoes.
 * @param value A stored device palette entry, 0..511
 */
export function paletteCodeFromDeviceValue(value: number): number {
  return ((value >> 1) & 0xff) | ((value & 0x01) << 8);
}

/**
 * Split a palette code into its three 0..7 RGB components.
 * @param code Palette code, in the **register** layout described above
 */
export function getRgbPartsForPaletteCode(code: number): [number, number, number] {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  const b = ((code & 0x03) << 1) | ((code >> 8) & 0x01);
  return [r, g, b];
}

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code, in the **register** layout described above
 */
export function getAbrgForPaletteCode(code: number, a = 0xff): number {
  const [r, g, b] = getRgbPartsForPaletteCode(code);
  return (a << 24) | (colorIntensity[b] << 16) | (colorIntensity[g] << 8) | colorIntensity[r];
}

/**
 * Get the CSS string for the specified palette code
 * @param code Palette code, in the **register** layout described above
 */
export function getCssStringForPaletteCode(code: number): string {
  let index = (code << 1) & 0x1ff;
  if (code & 0x100) {
    index |= 0x01;
  }
  return `#${toHexa6(zxNextRgb333Codes[index])}`;
}

/**
 * Relative luminance of a palette code, on the 0..7 component scale (so 0..7, not 0..1).
 *
 * Used to choose a mark that stays visible on the swatch it is drawn over; the call sites compare
 * against 3.5, the midpoint.
 * @param code Palette code, in the **register** layout described above
 */
export function getLuminanceForPaletteCode(code: number): number {
  const [r, g, b] = getRgbPartsForPaletteCode(code);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
