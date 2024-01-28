const colorIntensity = [0x00, 0x25, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code
 */
export function getRgbPartsForPaletteCode (
  code: number
): [number, number, number] {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100) {
    b |= 0x01;
  }
  return [r, g, b];
}

/**
 * Get the 32-bit ABRG color for the specified palette code
 * @param code Palette code
 */
export function getAbrgForPaletteCode (code: number): number {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100) {
    b |= 0x01;
  }
  return (
    0xff000000 |
    (colorIntensity[b] << 16) |
    (colorIntensity[g] << 8) |
    colorIntensity[r]
  );
}

/**
 * Get the CSS string for the specified palette code
 * @param code Palette code
 */
export function getCssStringForPaletteCode (code: number): string {
  const r = (code >> 5) & 0x07;
  const g = (code >> 2) & 0x07;
  let b = (code & 0x03) << 1;
  if (code & 0x100) {
    b |= 0x01;
  }
  return `rgb(${colorIntensity[r]},${colorIntensity[g]},${colorIntensity[b]})`;
}
