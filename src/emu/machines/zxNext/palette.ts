import { zxNext9BitColors } from "./PaletteDevice";

const colorIntensity = [0x00, 0x25, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code
 */
export function getRgbPartsForPaletteCode (
  code: number,
  use8Bit?: boolean
): [number, number, number] {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100 && !use8Bit) {
    b |= 0x01;
  }
  return [r, g, b];
}

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code
 */
export function getAbrgForPaletteCode (code: number, use8Bit?: boolean, a = 0xff): number {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100 && !use8Bit) {
    b |= 0x01;
  }
  return (
    (a << 24) |
    (colorIntensity[b] << 16) |
    (colorIntensity[g] << 8) |
    colorIntensity[r]
  );
}

/**
 * Get the CSS string for the specified palette code
 * @param code Palette code
 */
export function getCssStringForPaletteCode (
  code: number,
  use8Bit?: boolean
): string {
  let index = (code << 1) & 0x1ff;
  if (code & 0x100 && !use8Bit) {
    index |= 0x01;
  }
  return zxNext9BitColors[index];
}

export function getLuminanceForPaletteCode (
  code: number,
): number {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100) {
    b |= 0x01;
  }
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
