/*
 * `.sl2` and `.nxi` files: a Layer 2 picture as raw bytes (`.plans/LAYER2_INSPECTOR_PLAN.md`
 * Phase 7, Q4). Pure.
 *
 * The bytes are the layer as it sits in its banks, in the order `layer2Decode.ts` reads them. The size
 * says the resolution - 49,152 bytes is 256 x 192, 81,920 is 320 x 256 or 640 x 256, which the size
 * alone cannot tell apart - and a file 512 bytes longer starts with a palette: 256 entries of two bytes,
 * `RRRGGGBB` then `0000000B`, the order NextReg `$44` takes them. Without one the picture uses the
 * Next's default Layer 2 palette, and the viewer says so.
 */
import type { Layer2Resolution } from "./layer2Decode";

export const LAYER2_FILE_SMALL = 0xc000;
export const LAYER2_FILE_WIDE = 0x14000;
export const LAYER2_FILE_PALETTE = 512;

export type Layer2File = {
  /** The pixel bytes, without the palette */
  data: Uint8Array;
  /** The resolutions the size allows: [0], or [1, 2] (320 x 256 first) */
  resolutions: Layer2Resolution[];
  /** 256 9-bit RRRGGGBBB entries, from the file or the default */
  palette: number[];
  paletteFromFile: boolean;
};

/** The Next's Layer 2 palette after power-on (`zxnextPaletteHardReset`): index i is RGB332 i. */
export function defaultLayer2Palette(): number[] {
  return Array.from({ length: 256 }, (_, i) => (i << 1) | (i & 0x02 ? 1 : 0));
}

/** Reads a 512-byte palette block into 9-bit entries. */
export function readPaletteBlock(bytes: Uint8Array): number[] {
  return Array.from({ length: 256 }, (_, i) => ((bytes[i * 2] & 0xff) << 1) | (bytes[i * 2 + 1] & 0x01));
}

export function parseLayer2File(contents: Uint8Array): { file?: Layer2File; error?: string } {
  const sizes: [number, Layer2Resolution[]][] = [
    [LAYER2_FILE_SMALL, [0]],
    [LAYER2_FILE_WIDE, [1, 2]]
  ];
  for (const [size, resolutions] of sizes) {
    if (contents.length === size) {
      return { file: { data: contents, resolutions, palette: defaultLayer2Palette(), paletteFromFile: false } };
    }
    if (contents.length === size + LAYER2_FILE_PALETTE) {
      return {
        file: {
          data: contents.subarray(LAYER2_FILE_PALETTE),
          resolutions,
          palette: readPaletteBlock(contents.subarray(0, LAYER2_FILE_PALETTE)),
          paletteFromFile: true
        }
      };
    }
  }
  return {
    error:
      `Invalid file size (${contents.length} bytes): a Layer 2 picture is 49,152 bytes (256×192) or ` +
      `81,920 bytes (320×256 or 640×256), optionally after a 512-byte palette.`
  };
}
