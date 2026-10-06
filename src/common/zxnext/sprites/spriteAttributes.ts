/*
 * ZX Spectrum Next sprite attribute slots, decoded (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.1, D3).
 *
 * Pure: no React, no Node. The Sprite Inspector reads the raw 5 x 128 attribute bytes from the core
 * and decodes them here; the raw bytes stay the truth, these are derived.
 *
 * This module decodes only what **one slot's own bytes** say. Composing a relative sprite onto its
 * anchor (inherited transforms, rotated and mirrored offsets, pattern and palette add-ons) is done
 * by the core, which resolves into a buffer that `decodeResolvedSprites` reads (D4). A second
 * implementation here would drift.
 *
 * The bit layout follows `_input/next-fpga/src/video/sprites.vhd` and the C engine
 * (`zxnext-sprites.c`, `zxnextUlaResolveSpritesInto` in `zxnext-ula.c`):
 *
 * - attr0: X bits 7..0 (anchor) or a signed X offset (relative)
 * - attr1: Y bits 7..0 (anchor) or a signed Y offset (relative)
 * - attr2: `PPPP XM YM R X8` - the palette offset, the mirrors, rotate, and X bit 8 for an anchor
 *   but "the palette offset is relative" for a relative (trap T6)
 * - attr3: `V E N5..N0` - visible, "attr4 is used" (a 5-byte sprite), the pattern number
 * - attr4, only when attr3 bit 6 is set (trap T4):
 *   - an anchor: `H N6 T XX YY Y8` - 4-bit patterns, the 7th pattern bit, the relative type,
 *     scale, Y bit 8
 *   - a relative (bits 7..6 = `01`): `0 1 N6 XX YY PR` - N6, scale, "the pattern is relative"
 */

/**
 * - `anchor4`: a 4-byte sprite (attr3 bit 6 clear); its attr4 is stale and ignored.
 * - `anchor5`: a 5-byte anchor.
 * - `relative`: a 5-byte slot with attr4 bits 7..6 = `01`. Whether it is composite or unified is
 *   the anchor's T bit; see `relativeTypeOf`.
 */
export type SpriteSlotKind = "anchor4" | "anchor5" | "relative";

export type SpriteRelativeType = "composite" | "unified";

export type SpriteRaw = [number, number, number, number, number];

export type DecodedSpriteSlot = {
  index: number;
  raw: SpriteRaw;
  kind: SpriteSlotKind;
  /** A 4-byte slot: attr4 is never written by port `$57` and is ignored by the engine (T4) */
  attr4Ignored: boolean;
  /** A 4-byte slot whose stale attr4 would change something if attr3 bit 6 were set (D13) */
  staleAttr4Matters: boolean;
  /** attr3 bit 7: the slot's own visible bit (a relative is also hidden by its anchor) */
  visibleBit: boolean;
  /** attr3 bits 5..0 */
  pattern6: number;
  /** attr2 bits 7..4 */
  paletteOffset: number;
  xmirror: boolean;
  ymirror: boolean;
  rotate: boolean;
  /** The slot's own scale bits, `0..3` (always 0 for a 4-byte slot) */
  scaleX: number;
  scaleY: number;
  /** attr4 bit 6 on a 4-bit anchor, attr4 bit 5 on a relative */
  n6: boolean;

  // --- The anchor reading (T6)
  /** 9-bit X, `0..511` */
  x?: number;
  /** 9-bit Y, `0..511` (bit 8 only for a 5-byte anchor) */
  y?: number;
  /** attr4 bit 7 on a 5-byte anchor */
  fourBit?: boolean;
  /** attr4 bit 5 on a 5-byte anchor: how the relatives after it compose */
  relType?: SpriteRelativeType;
  /** The 7-bit pattern number this anchor shows */
  pattern7?: number;

  // --- The relative reading (T6)
  /** The signed 8-bit offsets from the anchor */
  dx?: number;
  dy?: number;
  /** attr2 bit 0: the palette offset is added to the anchor's */
  paletteRelative?: boolean;
  /** attr4 bit 0: the anchor's pattern number is added to this one */
  patternRelative?: boolean;
};

const signed8 = (value: number) => ((value & 0xff) ^ 0x80) - 0x80;

/** Decodes one slot's own five bytes. */
export function decodeSpriteSlot(index: number, raw: ArrayLike<number>): DecodedSpriteSlot {
  const a0 = raw[0] & 0xff;
  const a1 = raw[1] & 0xff;
  const a2 = raw[2] & 0xff;
  const a3 = raw[3] & 0xff;
  const a4 = raw[4] & 0xff;
  const has5 = (a3 & 0x40) !== 0;
  const relative = has5 && ((a4 >> 6) & 0x03) === 0x01;
  const common = {
    index,
    raw: [a0, a1, a2, a3, a4] as SpriteRaw,
    attr4Ignored: !has5,
    // --- With attr4 = 0 a 5-byte anchor reads exactly as a 4-byte one; any other bit changes it
    staleAttr4Matters: !has5 && a4 !== 0,
    visibleBit: (a3 & 0x80) !== 0,
    pattern6: a3 & 0x3f,
    paletteOffset: a2 >> 4,
    xmirror: (a2 & 0x08) !== 0,
    ymirror: (a2 & 0x04) !== 0,
    rotate: (a2 & 0x02) !== 0,
    scaleX: has5 ? (a4 >> 3) & 0x03 : 0,
    scaleY: has5 ? (a4 >> 1) & 0x03 : 0
  };

  if (relative) {
    return {
      ...common,
      kind: "relative",
      n6: (a4 & 0x20) !== 0,
      dx: signed8(a0),
      dy: signed8(a1),
      paletteRelative: (a2 & 0x01) !== 0,
      patternRelative: (a4 & 0x01) !== 0
    };
  }

  const fourBit = has5 && (a4 & 0x80) !== 0;
  const n6 = fourBit && (a4 & 0x40) !== 0;
  return {
    ...common,
    kind: has5 ? "anchor5" : "anchor4",
    n6,
    x: ((a2 & 0x01) << 8) | a0,
    y: ((has5 ? a4 & 0x01 : 0) << 8) | a1,
    fourBit,
    relType: has5 && (a4 & 0x20) !== 0 ? "unified" : "composite",
    pattern7: (common.pattern6 << 1) | (n6 ? 1 : 0)
  };
}

/** Decodes all 128 slots from the core's 640 contiguous attribute bytes. */
export function decodeSpriteSlots(attributes: ArrayLike<number>): DecodedSpriteSlot[] {
  const slots: DecodedSpriteSlot[] = [];
  for (let i = 0; i < 128; i++) {
    const base = i * 5;
    slots.push(
      decodeSpriteSlot(i, [
        attributes[base] ?? 0,
        attributes[base + 1] ?? 0,
        attributes[base + 2] ?? 0,
        attributes[base + 3] ?? 0,
        attributes[base + 4] ?? 0
      ])
    );
  }
  return slots;
}

/**
 * The anchor of a relative slot: the nearest **preceding** non-relative slot, visible or not (T5).
 * `undefined` for a non-relative slot, and for a relative with no anchor before it (slot 0, or one
 * after only relatives), which composes onto an all-zero, invisible anchor.
 */
export function findAnchor(slots: DecodedSpriteSlot[], index: number): number | undefined {
  if (slots[index]?.kind !== "relative") return undefined;
  for (let i = index - 1; i >= 0; i--) {
    if (slots[i].kind !== "relative") return i;
  }
  return undefined;
}

/** How a relative composes: its anchor's T bit. `undefined` for a non-relative slot. */
export function relativeTypeOf(slots: DecodedSpriteSlot[], index: number): SpriteRelativeType | undefined {
  if (slots[index]?.kind !== "relative") return undefined;
  const anchor = findAnchor(slots, index);
  return anchor === undefined ? "composite" : slots[anchor].relType;
}

/**
 * A 7-bit pattern number in the numbering of its format (T7):
 * - an 8-bit sprite shows 256-byte pattern `pattern7 >> 1`: `40`;
 * - a 4-bit sprite shows 128-byte pattern `pattern7`, the high or low half of 256-byte slot
 *   `pattern7 >> 1`: `81 (40·hi)`.
 */
export function formatSpritePattern(fourBit: boolean, pattern7: number): string {
  const p = pattern7 & 0x7f;
  if (!fourBit) return String(p >> 1);
  return `${p} (${p >> 1}·${p & 1 ? "hi" : "lo"})`;
}

/** The sprite type as the table shows it: `anchor`, `anchor·4B`, `rel·composite`, `rel·unified`. */
export function formatSpriteType(slots: DecodedSpriteSlot[], index: number): string {
  const slot = slots[index];
  if (slot.kind === "anchor4") return "anchor·4B";
  if (slot.kind === "anchor5") return "anchor";
  return `rel·${relativeTypeOf(slots, index)}`;
}

// --- The core's resolved table (D4)

/** Bytes per sprite in the core's IDE resolve buffer (`zxnextResolveSpritesForIde`). */
export const RESOLVED_SPRITE_SIZE = 8;

/** One sprite as the engine draws it: a relative composed onto its anchor. */
export type ResolvedSprite = {
  index: number;
  visible: boolean;
  /** 9-bit, `0..511`; above 319 wraps to negative on screen */
  x: number;
  /** 9-bit, `0..511`; above 255 wraps to negative on screen */
  y: number;
  xmirror: boolean;
  ymirror: boolean;
  rotate: boolean;
  fourBit: boolean;
  paletteOffset: number;
  scaleX: number;
  scaleY: number;
  /** The 7-bit pattern number: a 4-bit pattern, or `>> 1` an 8-bit one */
  pattern7: number;
};

/**
 * Decodes the core's resolve buffer, 8 bytes per sprite: flags (bit 0 visible, 1 xmirror,
 * 2 ymirror, 3 rotate, 4 four-bit), X and Y little-endian, the palette offset, `scaleX << 2 |
 * scaleY`, `pattern7`. The layout is documented beside `zxnextIdeResolvedSprites` in `zxnext.c`.
 */
export function decodeResolvedSprites(buffer: ArrayLike<number>): ResolvedSprite[] {
  const sprites: ResolvedSprite[] = [];
  const count = Math.floor(buffer.length / RESOLVED_SPRITE_SIZE);
  for (let i = 0; i < count; i++) {
    const o = i * RESOLVED_SPRITE_SIZE;
    const flags = buffer[o];
    sprites.push({
      index: i,
      visible: (flags & 0x01) !== 0,
      xmirror: (flags & 0x02) !== 0,
      ymirror: (flags & 0x04) !== 0,
      rotate: (flags & 0x08) !== 0,
      fourBit: (flags & 0x10) !== 0,
      x: (buffer[o + 1] | (buffer[o + 2] << 8)) & 0x1ff,
      y: (buffer[o + 3] | (buffer[o + 4] << 8)) & 0x1ff,
      paletteOffset: buffer[o + 5] & 0x0f,
      scaleX: (buffer[o + 6] >> 2) & 0x03,
      scaleY: buffer[o + 6] & 0x03,
      pattern7: buffer[o + 7] & 0x7f
    });
  }
  return sprites;
}

/** The 256-byte pattern-RAM slot a resolved sprite reads (`0..63`). */
export function patternSlotOf(sprite: Pick<ResolvedSprite, "pattern7">): number {
  return (sprite.pattern7 & 0x7f) >> 1;
}
