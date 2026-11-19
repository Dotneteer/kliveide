/*
 * The ZX Spectrum screen layout, decoded (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, D2). Pure.
 *
 * A screen is 6,144 bytes of pixels in the ULA's interleaved order, then 768 attribute bytes, one per
 * 8x8 cell: bits 0-2 INK, 3-5 PAPER, 6 BRIGHT, 7 FLASH. The Timex hi-colour and hi-res modes
 * (`timexScreen.ts`) reuse the pixel order. Pictures are palette indices 0-15: the eight colours,
 * then the eight BRIGHT ones, as `SPECTRUM_48_COLORS` orders them.
 */

/** The size of the pixel area */
export const SCR_PIXEL_BYTES = 0x1800;
/** The size of a `.scr` screen: pixels, then 768 attributes */
export const SCR_FILE_BYTES = 0x1b00;
export const SCR_WIDTH = 256;
export const SCR_HEIGHT = 192;
/** The address the screen sits at in the Spectrum's memory */
export const SCREEN_ADDRESS = 0x4000;
/** The ULA swaps INK and PAPER in a FLASH cell every 16 frames */
export const FLASH_FRAMES = 16;

/** The offset in the pixel area of the byte holding pixel (x, y): the ULA's third/row/line order */
export function scrPixelOffset(x: number, y: number): number {
  return ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((x >> 3) & 0x1f);
}

/** The offset in a `.scr` of the attribute byte of the cell holding pixel (x, y) */
export function scrAttrOffset(x: number, y: number): number {
  return SCR_PIXEL_BYTES + (y >> 3) * 32 + (x >> 3);
}

/** Whether pixel (x, y) is set (INK) in a pixel area laid out as the ULA reads it */
export function pixelBit(pixels: Uint8Array, x: number, y: number, base = 0): boolean {
  return ((pixels[base + scrPixelOffset(x, y)] ?? 0) & (0x80 >> (x & 7))) !== 0;
}

/** An attribute's INK as a colour index 0-15 (8-15 with BRIGHT) */
export const attrInk = (attr: number) => (attr & 0x07) | ((attr & 0x40) >> 3);
/** An attribute's PAPER as a colour index 0-15 (8-15 with BRIGHT) */
export const attrPaper = (attr: number) => ((attr >> 3) & 0x07) | ((attr & 0x40) >> 3);

/** An attribute byte's fields */
export type DecodedAttr = { ink: number; paper: number; bright: boolean; flash: boolean };

export function decodeAttr(attr: number): DecodedAttr {
  return { ink: attr & 0x07, paper: (attr >> 3) & 0x07, bright: (attr & 0x40) !== 0, flash: (attr & 0x80) !== 0 };
}

/**
 * A decoded attribute picture: colour indices 0-15, and per pixel the INK and PAPER of its attribute
 * and whether it flashes, so a viewer can highlight by colour or by FLASH.
 */
export type AttrPicture = {
  width: number;
  height: number;
  pixels: Int16Array;
  ink: Uint8Array;
  paper: Uint8Array;
  flash: Uint8Array;
};

/**
 * Draws a picture whose pixel bits are in the ULA's order and whose attribute for pixel (x, y) is
 * `attrOf(x, y)`. `flashPhase` true draws FLASH cells with INK and PAPER swapped, as the second half
 * of the ULA's 32-frame FLASH cycle shows them.
 */
export function attrPicture(
  pixels: Uint8Array,
  attrOf: (x: number, y: number) => number,
  flashPhase: boolean
): AttrPicture {
  const size = SCR_WIDTH * SCR_HEIGHT;
  const out: AttrPicture = {
    width: SCR_WIDTH,
    height: SCR_HEIGHT,
    pixels: new Int16Array(size),
    ink: new Uint8Array(size),
    paper: new Uint8Array(size),
    flash: new Uint8Array(size)
  };
  for (let y = 0; y < SCR_HEIGHT; y++) {
    for (let x = 0; x < SCR_WIDTH; x++) {
      const p = y * SCR_WIDTH + x;
      const attr = attrOf(x, y);
      const ink = attrInk(attr);
      const paper = attrPaper(attr);
      const flashes = (attr & 0x80) !== 0;
      let on = pixelBit(pixels, x, y);
      if (flashes && flashPhase) on = !on;
      out.pixels[p] = on ? ink : paper;
      out.ink[p] = ink;
      out.paper[p] = paper;
      out.flash[p] = flashes ? 1 : 0;
    }
  }
  return out;
}

/** A `.scr` screen (6,912 bytes) as a picture */
export function scrPicture(screen: Uint8Array, flashPhase = false): AttrPicture {
  return attrPicture(screen, (x, y) => screen[scrAttrOffset(x, y)] ?? 0, flashPhase);
}

/** How a set of attributes uses the 16 colours */
export type AttrUsage = {
  /** Per colour index 0-15: the attributes that use it as INK */
  ink: number[];
  /** Per colour index 0-15: the attributes that use it as PAPER */
  paper: number[];
  bright: number;
  flash: number;
};

export function attrUsage(attrs: ArrayLike<number>): AttrUsage {
  const usage: AttrUsage = { ink: new Array(16).fill(0), paper: new Array(16).fill(0), bright: 0, flash: 0 };
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i];
    usage.ink[attrInk(a)]++;
    usage.paper[attrPaper(a)]++;
    if (a & 0x40) usage.bright++;
    if (a & 0x80) usage.flash++;
  }
  return usage;
}

/** What a `.scr` says about one pixel. Offsets count from the start of the screen (after a header). */
export type ScrProbe = {
  x: number;
  y: number;
  cellColumn: number;
  cellRow: number;
  pixelOffset: number;
  /** The bit in the pixel byte, 7 the leftmost */
  bit: number;
  /** The pixel is INK (its bit is set) */
  ink: boolean;
  attrOffset: number;
  attr: number;
};

export function scrProbe(screen: Uint8Array, x: number, y: number): ScrProbe {
  const pixelOffset = scrPixelOffset(x, y);
  const attrOffset = scrAttrOffset(x, y);
  return {
    x,
    y,
    cellColumn: x >> 3,
    cellRow: y >> 3,
    pixelOffset,
    bit: 7 - (x & 7),
    ink: pixelBit(screen, x, y),
    attrOffset,
    attr: screen[attrOffset] ?? 0
  };
}

/**
 * Draws a 6,912-byte screen dump into `target` as ABGR words of `palette` (the 16 colours), for
 * `ScreenCanvas`: the tape, disk, file-manager and snapshot previews.
 */
export function createScrPixelData(data: Uint8Array, palette: number[], target: Uint32Array): void {
  const picture = scrPicture(data);
  for (let p = 0; p < picture.pixels.length; p++) target[p] = palette[picture.pixels[p]];
}
