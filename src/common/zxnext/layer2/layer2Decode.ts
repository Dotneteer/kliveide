/*
 * The ZX Spectrum Next's Layer 2, decoded (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.1, D3). Pure: a pixel
 * is a function of one byte and three registers, so the inspector decodes it here rather than asking
 * the core. Every rule copies the Layer 2 passes and `zxnextUlaReadLayer2Pixel` in `zxnext-ula.c`
 * and `zxnextMemoryResolveLayer2Offset` in `zxnext-memory.c`, which follow `layer2.vhd` and
 * `zxnext.vhd`; a harness test (`test/zxnext-hw/layer2/inspector-state.test.ts`) compares the image
 * with both the core and the VHDL-derived model in `_layer2-helpers.ts`.
 *
 * Coordinates are **layer pixels** of the resolution: 256 x 192, 320 x 256 or 640 x 256, (0, 0) the
 * layer's top left. A "set" is the 80K of five consecutive 16K banks from `$12` (or `$13`).
 */

/** Layer 2's registers, as the Layer 2 Inspector's snapshot carries them. */
export type Layer2Regs = {
  /** `$123B` bit 1 or `$69` bit 7 */
  enabled: boolean;
  /** `$12`: the first 16K bank of the displayed layer (7 bits) */
  activeBank: number;
  /** `$13`: the first 16K bank of the shadow layer (7 bits) */
  shadowBank: number;
  /** Port `$123B` as a read returns it, peeked without a port access (T1, D8) */
  port123B: number;
  /** The bank offset a `$123B` write with bit 4 set stores (3 bits) */
  bankOffset: number;
  /** `$70` bits 5-4: 0 = 256 x 192, 1 = 320 x 256, 2 or 3 = 640 x 256 (`layer2.vhd`: "1X") */
  resolution: number;
  /** `$70` bits 3-0 */
  paletteOffset: number;
  /** `$16` with `$71` bit 0 (9 bits) */
  scrollX: number;
  /** `$17` */
  scrollY: number;
  /** `$18`: x1, x2, y1, y2 */
  clip: [number, number, number, number];
  /** Which `$18` value the next write sets */
  clipIndex: number;
  /** `$14`, the global transparency colour (T6) */
  globalTransparency: number;
  /** `$43` bit 2: Layer 2 draws with its second palette */
  secondPalette: boolean;
};

export type Layer2Resolution = 0 | 1 | 2;

export type Layer2Size = {
  resolution: Layer2Resolution;
  width: 256 | 320 | 640;
  height: 192 | 256;
  /** The bytes the layer reads: 48K or 80K */
  bytes: number;
  /** 16K banks the layer spans (T3) */
  banks: 3 | 5;
  /** 320 x 256 and 640 x 256: column-major, X clip doubled (T2, T8) */
  wide: boolean;
  /** 640 x 256: two 4-bit pixels per byte, high nibble first */
  nibbles: boolean;
};

/** The physical address of 16K bank 0 of RAM, where Layer 2's bank numbers count from */
export const LAYER2_RAM_PHYSICAL = 0x040000;
/** A 16K bank at or past this is past the 2 MB SRAM: the display has no pixel there (T5) */
export const LAYER2_BANK_LIMIT = 112;
/** Five 16K banks: the most a resolution displays unscrolled (T3) */
export const LAYER2_SET_BYTES = 5 * 0x4000;
/**
 * Eight 16K banks: what the snapshot copies per set. A scroll can make the display read past the
 * layer's own banks - the wide modes' X wrap reaches source columns 320-511 (banks +5 to +7, T4), the
 * 256 x 192 fold-back rows 192-254 (bank +3) - so the copy covers every byte a scroll can reach.
 */
export const LAYER2_READ_BYTES = 8 * 0x4000;
/** The value of a pixel with no byte behind it: its bank is past 2 MB (T5) */
export const LAYER2_NO_PIXEL = -1;

/** `$70` bits 5-4 to a resolution: `1X` is 640 x 256. */
export function layer2Resolution(value: number): Layer2Resolution {
  const r = value & 0x03;
  return r === 0 ? 0 : r === 1 ? 1 : 2;
}

export function layer2Size(resolution: number): Layer2Size {
  const res = layer2Resolution(resolution);
  if (res === 0) return { resolution: 0, width: 256, height: 192, bytes: 0xc000, banks: 3, wide: false, nibbles: false };
  return {
    resolution: res,
    width: res === 1 ? 320 : 640,
    height: 256,
    bytes: 0x14000,
    banks: 5,
    wide: true,
    nibbles: res === 2
  };
}

/** Whether a 16K bank is past the 2 MB SRAM (T5). */
export const isOutsideRam = (bank16: number) => bank16 >= LAYER2_BANK_LIMIT;

/**
 * The byte behind layer pixel (x, y), as an offset into the 80K set (T2): row-major at 256 x 192
 * (`y << 8 | x`), column-major in the wide modes (`x << 8 | y`), two pixels per byte at 640 x 256,
 * the high nibble the left one.
 */
export function layer2ByteOffset(
  resolution: number,
  x: number,
  y: number
): { offset: number; nibble?: "hi" | "lo" } {
  const size = layer2Size(resolution);
  if (!size.wide) return { offset: ((y & 0xff) << 8) | (x & 0xff) };
  if (!size.nibbles) return { offset: ((x & 0x1ff) << 8) | (y & 0xff) };
  return { offset: (((x >> 1) & 0x1ff) << 8) | (y & 0xff), nibble: x & 1 ? "lo" : "hi" };
}

/**
 * The palette index a stored pixel draws with (T7): the palette offset is added to the high nibble of
 * an 8-bit pixel; at 640 x 256 the 4-bit pixel *is* the low nibble and the offset becomes the high one
 * (`zxnextUlaRenderLayer2_640x256Screen`, `layer2.vhd`: pixel = "0000" & nibble).
 */
export function layer2PaletteIndex(resolution: number, pixel: number, paletteOffset: number): number {
  const off = paletteOffset & 0x0f;
  if (layer2Size(resolution).nibbles) return (off << 4) | (pixel & 0x0f);
  return ((((pixel >> 4) + off) & 0x0f) << 4) | (pixel & 0x0f);
}

/** The stored pixel at layer pixel (x, y): the byte, or its nibble at 640 x 256. */
export function layer2StoredPixel(resolution: number, data: Uint8Array, x: number, y: number): number {
  const { offset, nibble } = layer2ByteOffset(resolution, x, y);
  const byte = data[offset] ?? 0;
  return nibble === undefined ? byte : nibble === "hi" ? byte >> 4 : byte & 0x0f;
}

/**
 * The palette index at layer pixel (x, y) of a set, or undefined where the pixel's bank is past 2 MB
 * (T5; only when `bank16`, the set's first bank, is given).
 */
export function layer2Index(
  resolution: number,
  data: Uint8Array,
  x: number,
  y: number,
  paletteOffset: number,
  bank16?: number
): number | undefined {
  const { offset } = layer2ByteOffset(resolution, x, y);
  if (bank16 !== undefined && isOutsideRam(bank16 + (offset >> 14))) return undefined;
  return layer2PaletteIndex(resolution, layer2StoredPixel(resolution, data, x, y), paletteOffset);
}

/**
 * The whole layer, unscrolled and unclipped: one palette index per layer pixel, row by row,
 * `LAYER2_NO_PIXEL` where the bank is past 2 MB (with `bank16`).
 */
export function layer2Image(
  resolution: number,
  data: Uint8Array,
  paletteOffset: number,
  bank16?: number
): Int16Array {
  const { width, height } = layer2Size(resolution);
  const out = new Int16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = layer2Index(resolution, data, x, y, paletteOffset, bank16) ?? LAYER2_NO_PIXEL;
    }
  }
  return out;
}

export type Layer2PixelAddress = {
  /** The 16K bank holding the byte */
  bank16: number;
  /** The byte's offset in that bank */
  offset: number;
  /** The byte's offset in the set (`layer2ByteOffset`) */
  setOffset: number;
  /** The 8K page holding the byte */
  page8k: number;
  /** The byte's physical address */
  physical: number;
  /** 640 x 256: which nibble of the byte is the pixel */
  nibble?: "hi" | "lo";
  /** The bank is past 2 MB: the display has no pixel here (T5) */
  outsideRam: boolean;
};

/** Where the byte of layer pixel (x, y) of the set starting at 16K bank `bank16` lives (D6). */
export function pixelAddress(resolution: number, bank16: number, x: number, y: number): Layer2PixelAddress {
  const { offset: setOffset, nibble } = layer2ByteOffset(resolution, x, y);
  return byteAddress(bank16, setOffset, nibble);
}

/** The address of byte `setOffset` of the set starting at 16K bank `bank16`. */
export function byteAddress(bank16: number, setOffset: number, nibble?: "hi" | "lo"): Layer2PixelAddress {
  const bank = bank16 + (setOffset >> 14);
  const offset = setOffset & 0x3fff;
  return {
    bank16: bank,
    offset,
    setOffset,
    page8k: bank * 2 + (offset >> 13),
    physical: LAYER2_RAM_PHYSICAL + bank * 0x4000 + offset,
    nibble,
    outsideRam: isOutsideRam(bank)
  };
}

// --- The $123B paging window (T1)

export type Layer2WindowSlice = {
  /** The Z80 range the slice maps, inclusive */
  z80Start: number;
  z80End: number;
  /** The 16K bank it lands in */
  bank16: number;
  /** The bank is past 2 MB: the write is dropped */
  outsideRam: boolean;
};

export type Layer2WriteTarget = {
  /** `$123B` bit 0 */
  mappedForWrites: boolean;
  /** `$123B` bit 2 */
  mappedForReads: boolean;
  /** `$123B` bit 3: the window maps `$13`'s banks, not `$12`'s */
  useShadow: boolean;
  /** `$123B` bits 7-6: 0-2 pick the 16K of the layer at `$0000-$3FFF`, 3 maps 48K at `$0000-$BFFF` */
  segment: number;
  /** The bank offset (`$123B` bit-4 writes) */
  bankOffset: number;
  /** The first bank of the set the window maps: `$12` or `$13` */
  baseBank: number;
  /** One slice, or three for segment 3 */
  slices: Layer2WindowSlice[];
};

/**
 * Where the `$123B` window sends a Z80 access, whatever enables it (T1). Copies
 * `zxnextMemoryResolveLayer2Offset`: the 16K bank is `(base + ((segment + offset) & 7)) & $7F`, and
 * a bank past 2 MB maps nothing. The low overlay (DivMMC, Multiface) wins over the window at
 * `$0000-$3FFF`; the inspector does not model it.
 */
export function writeTarget(regs: Pick<Layer2Regs, "port123B" | "bankOffset" | "activeBank" | "shadowBank">): Layer2WriteTarget {
  const p = regs.port123B & 0xff;
  const segment = (p >> 6) & 0x03;
  const useShadow = (p & 0x08) !== 0;
  const baseBank = (useShadow ? regs.shadowBank : regs.activeBank) & 0x7f;
  const bankOffset = regs.bankOffset & 0x07;
  const slice = (index: number, pre: number): Layer2WindowSlice => {
    const bank16 = (baseBank + ((pre + bankOffset) & 0x07)) & 0x7f;
    return {
      z80Start: index * 0x4000,
      z80End: index * 0x4000 + 0x3fff,
      bank16,
      outsideRam: isOutsideRam(bank16)
    };
  };
  return {
    mappedForWrites: (p & 0x01) !== 0,
    mappedForReads: (p & 0x04) !== 0,
    useShadow,
    segment,
    bankOffset,
    baseBank,
    slices: segment === 3 ? [0, 1, 2].map((i) => slice(i, i)) : [slice(0, segment)]
  };
}

/** The Z80 address the window maps a physical byte to, or undefined. */
export function windowZ80Address(target: Layer2WriteTarget, physical: number): number | undefined {
  for (const s of target.slices) {
    if (s.outsideRam) continue;
    const start = LAYER2_RAM_PHYSICAL + s.bank16 * 0x4000;
    if (physical >= start && physical < start + 0x4000) return s.z80Start + (physical - start);
  }
  return undefined;
}

// --- Palette (T6, D10)

/** Whether a Layer 2 palette entry (the core's 9-bit RRRGGGBBB word) is transparent: RGB(8:1) = `$14`. */
export const isTransparentEntry = (entry: number, globalTransparency: number) =>
  ((entry & 0x1ff) >> 1) === (globalTransparency & 0xff);

/** Whether a Layer 2 palette entry has the priority bit (`$44` second byte bit 7, bit 9 of the word). */
export const isPriorityEntry = (entry: number) => (entry & 0x200) !== 0;
