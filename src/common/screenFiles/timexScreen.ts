import { attrPicture, pixelBit, scrPixelOffset, SCR_HEIGHT, SCR_PIXEL_BYTES, type AttrPicture } from "./zxScreen";

/*
 * The Timex screen modes as files (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, §3). Pure. Both files are
 * 12,288 bytes: the screen at $4000, then the second display file at $6000, each in the ULA's pixel
 * order (`zxula.vhd` ~236-250, `zxnextUlaRenderHiResScreen` in `zxnext-ula.c`).
 *
 * - Hi-colour (`.shc`): the pixels at $4000, and at $6000 an attribute for every 8x1 strip, at the
 *   same offset as its pixel byte.
 * - Hi-res (`.shr`): 512 x 192 in one colour pair. Each 16-pixel word is the byte at $4000 (left)
 *   then the byte at the same offset at $6000 (right). The colours are port $FF's, not the file's.
 */

/** The size of a Timex screen file: two 6,144-byte halves */
export const TIMEX_FILE_BYTES = 2 * SCR_PIXEL_BYTES;
/** The address of the second half */
export const TIMEX_SECOND_ADDRESS = 0x6000;
export const HIRES_WIDTH = 512;

/** A hi-colour screen as a picture */
export function shcPicture(file: Uint8Array, flashPhase = false): AttrPicture {
  return attrPicture(file, (x, y) => file[SCR_PIXEL_BYTES + scrPixelOffset(x, y)] ?? 0, flashPhase);
}

/** The 6,144 attributes of a hi-colour screen */
export function shcAttributes(file: Uint8Array): Uint8Array {
  return file.subarray(SCR_PIXEL_BYTES, 2 * SCR_PIXEL_BYTES);
}

/** What a `.shc` says about one pixel. Offsets count from the start of the file (after a header). */
export type ShcProbe = {
  x: number;
  y: number;
  /** The strip's column (0-31); its row is `y` */
  stripColumn: number;
  pixelOffset: number;
  bit: number;
  ink: boolean;
  attrOffset: number;
  attr: number;
};

export function shcProbe(file: Uint8Array, x: number, y: number): ShcProbe {
  const pixelOffset = scrPixelOffset(x, y);
  const attrOffset = SCR_PIXEL_BYTES + pixelOffset;
  return {
    x,
    y,
    stripColumn: x >> 3,
    pixelOffset,
    bit: 7 - (x & 7),
    ink: pixelBit(file, x, y),
    attrOffset,
    attr: file[attrOffset] ?? 0
  };
}

/** The file offset of the byte holding hi-res pixel (x, y), and which half it is in */
function hiresByte(x: number, y: number): { offset: number; right: boolean } {
  const byteColumn = (x >> 3) & 0x3f;
  const right = (byteColumn & 1) === 1;
  return { offset: (right ? SCR_PIXEL_BYTES : 0) + scrPixelOffset((byteColumn >> 1) << 3, y), right };
}

/** A hi-res screen as a picture: 1 where a pixel is INK, 0 where it is PAPER */
export function shrPicture(file: Uint8Array): { width: number; height: number; pixels: Int16Array } {
  const pixels = new Int16Array(HIRES_WIDTH * SCR_HEIGHT);
  for (let y = 0; y < SCR_HEIGHT; y++) {
    for (let x = 0; x < HIRES_WIDTH; x++) {
      const { offset } = hiresByte(x, y);
      pixels[y * HIRES_WIDTH + x] = (file[offset] ?? 0) & (0x80 >> (x & 7)) ? 1 : 0;
    }
  }
  return { width: HIRES_WIDTH, height: SCR_HEIGHT, pixels };
}

/** What a `.shr` says about one pixel. The offset counts from the start of the file (after a header). */
export type ShrProbe = {
  x: number;
  y: number;
  /** The 16-pixel word's column (0-31) */
  wordColumn: number;
  /** The byte is the word's right one, from the $6000 half */
  right: boolean;
  offset: number;
  byte: number;
  bit: number;
  ink: boolean;
};

export function shrProbe(file: Uint8Array, x: number, y: number): ShrProbe {
  const { offset, right } = hiresByte(x, y);
  const byte = file[offset] ?? 0;
  return { x, y, wordColumn: x >> 4, right, offset, byte, bit: 7 - (x & 7), ink: (byte & (0x80 >> (x & 7))) !== 0 };
}
