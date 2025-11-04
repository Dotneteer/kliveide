import { toHexa6 } from "../../../common/utils/conversions";
import { zxNext9BitColorCodes } from "./PaletteDevice";

const colorIntensity = [0x00, 0x25, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code
 */
export function getRgbPartsForPaletteCode(code: number): [number, number, number] {
  const r = (code >> 6) & 0x07;
  const g = (code >> 3) & 0x07;
  const b = code & 0x07;
  return [r, g, b];
}

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code
 */
export function getAbrgForPaletteCode(code: number, a = 0xff): number {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  const b = ((code & 0x03) << 1) | ((code >> 8) & 0x01);
  return (a << 24) | (colorIntensity[b] << 16) | (colorIntensity[g] << 8) | colorIntensity[r];
}

/**
 * Get the CSS string for the specified palette code
 * @param code Palette code
 */
export function getCssStringForPaletteCode(code: number): string {
  let index = (code << 1) & 0x1ff;
  if (code & 0x100) {
    index |= 0x01;
  }
  return `#${toHexa6(zxNext9BitColorCodes[index])}`;
}

export function getLuminanceForPaletteCode(code: number): number {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100) {
    b |= 0x01;
  }
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
