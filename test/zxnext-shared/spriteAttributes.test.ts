import { describe, expect, it } from "vitest";

import {
  decodeResolvedSprites,
  decodeSpriteSlot,
  decodeSpriteSlots,
  findAnchor,
  formatSpritePattern,
  formatSpriteType,
  patternSlotOf,
  relativeTypeOf
} from "@common/zxnext/sprites/spriteAttributes";

// --- SPRITE_INSPECTOR_PLAN §4.1: one slot's own bytes, in both readings (T6)

const slotsOf = (...raws: number[][]) => {
  const bytes = new Uint8Array(640);
  raws.forEach((raw, i) => bytes.set(raw, i * 5));
  return decodeSpriteSlots(bytes);
};

describe("decodeSpriteSlot: anchors", () => {
  it("decodes a 4-byte anchor and ignores its attr4 (T4)", () => {
    // --- X8 set, palette 3, X mirror, rotate; visible, pattern 5; a stale attr4 of $FF
    const s = decodeSpriteSlot(7, [0x20, 0x40, 0x3b, 0x85, 0xff]);
    expect(s.kind).toBe("anchor4");
    expect(s.attr4Ignored).toBe(true);
    expect(s.staleAttr4Matters).toBe(true);
    expect(s.x).toBe(0x120);
    // --- The stale attr4's Y8 bit is never read
    expect(s.y).toBe(0x40);
    expect(s.fourBit).toBe(false);
    expect(s.n6).toBe(false);
    expect(s.scaleX).toBe(0);
    expect(s.scaleY).toBe(0);
    expect(s.paletteOffset).toBe(3);
    expect(s.xmirror).toBe(true);
    expect(s.ymirror).toBe(false);
    expect(s.rotate).toBe(true);
    expect(s.visibleBit).toBe(true);
    expect(s.pattern6).toBe(5);
    expect(s.pattern7).toBe(10);
    expect(s.dx).toBeUndefined();
  });

  it("does not flag a 4-byte slot whose stale attr4 is zero", () => {
    expect(decodeSpriteSlot(0, [0, 0, 0, 0x80, 0]).staleAttr4Matters).toBe(false);
  });

  it("decodes a 5-byte 8-bit anchor: Y8, scale and the T bit", () => {
    // --- attr4 = 0 0 1 10 01 1: T, XX=2, YY=1, Y8
    const s = decodeSpriteSlot(0, [0x10, 0x20, 0x04, 0xc1, 0b0011_0011]);
    expect(s.kind).toBe("anchor5");
    expect(s.attr4Ignored).toBe(false);
    expect(s.staleAttr4Matters).toBe(false);
    expect(s.y).toBe(0x120);
    expect(s.x).toBe(0x10);
    expect(s.ymirror).toBe(true);
    expect(s.scaleX).toBe(2);
    expect(s.scaleY).toBe(1);
    expect(s.relType).toBe("unified");
    expect(s.fourBit).toBe(false);
    expect(s.pattern7).toBe(2);
  });

  it("decodes a 4-bit anchor with N6", () => {
    // --- attr4 = 1 1 0 00 00 0: H, N6
    const s = decodeSpriteSlot(0, [0, 0, 0, 0xc0 | 40, 0xc0]);
    expect(s.fourBit).toBe(true);
    expect(s.n6).toBe(true);
    expect(s.pattern7).toBe(81);
    expect(s.relType).toBe("composite");
  });

  it("ignores N6 on an 8-bit anchor", () => {
    // --- attr4 bits 7:6 = 11 is a 4-bit anchor; 00 with bit 6 alone would be a relative
    const s = decodeSpriteSlot(0, [0, 0, 0, 0xc0 | 40, 0x80]);
    expect(s.fourBit).toBe(true);
    expect(s.n6).toBe(false);
    expect(s.pattern7).toBe(80);
  });
});

describe("decodeSpriteSlot: relatives (T6)", () => {
  it("reads attr2 bit 0 as 'palette relative', not X8", () => {
    // --- attr4 = 0 1 1 01 10 1: relative, N6, XX=1, YY=2, pattern relative
    const s = decodeSpriteSlot(3, [0xf0, 0x0c, 0x51, 0xc2, 0b0110_1101]);
    expect(s.kind).toBe("relative");
    expect(s.x).toBeUndefined();
    expect(s.y).toBeUndefined();
    expect(s.fourBit).toBeUndefined();
    expect(s.relType).toBeUndefined();
    expect(s.dx).toBe(-16);
    expect(s.dy).toBe(12);
    expect(s.paletteRelative).toBe(true);
    expect(s.patternRelative).toBe(true);
    expect(s.n6).toBe(true);
    expect(s.scaleX).toBe(1);
    expect(s.scaleY).toBe(2);
    expect(s.paletteOffset).toBe(5);
    expect(s.pattern6).toBe(2);
  });

  it("reads the clear bits as absolute", () => {
    const s = decodeSpriteSlot(3, [0x7f, 0x80, 0x00, 0xc0, 0x40]);
    expect(s.dx).toBe(127);
    expect(s.dy).toBe(-128);
    expect(s.paletteRelative).toBe(false);
    expect(s.patternRelative).toBe(false);
    expect(s.n6).toBe(false);
  });

  it("is a relative only with five bytes", () => {
    // --- attr3 bit 6 clear: attr4 = $40 is stale, the slot is a 4-byte anchor
    expect(decodeSpriteSlot(0, [0, 0, 0, 0x80, 0x40]).kind).toBe("anchor4");
  });
});

describe("findAnchor (T5)", () => {
  const rel = [0, 0, 0, 0xc0, 0x40];
  const anchor = (t: boolean) => [0, 0, 0, 0x40, t ? 0x20 : 0];

  it("finds the nearest preceding non-relative, visible or not", () => {
    const slots = slotsOf(anchor(false), [0, 0, 0, 0x00, 0], rel, rel);
    expect(findAnchor(slots, 2)).toBe(1);
    expect(findAnchor(slots, 3)).toBe(1);
  });

  it("returns undefined for a leading relative and after only relatives", () => {
    const slots = slotsOf(rel, rel, anchor(true), rel);
    expect(findAnchor(slots, 0)).toBeUndefined();
    expect(findAnchor(slots, 1)).toBeUndefined();
    expect(findAnchor(slots, 3)).toBe(2);
  });

  it("returns undefined for an anchor", () => {
    expect(findAnchor(slotsOf(anchor(false)), 0)).toBeUndefined();
  });

  it("takes the relative type from the anchor's T bit", () => {
    const slots = slotsOf(anchor(true), rel, anchor(false), rel, [0, 0, 0, 0, 0]);
    expect(relativeTypeOf(slots, 1)).toBe("unified");
    expect(relativeTypeOf(slots, 3)).toBe("composite");
    expect(relativeTypeOf(slots, 0)).toBeUndefined();
    expect(formatSpriteType(slots, 1)).toBe("rel·unified");
    expect(formatSpriteType(slots, 3)).toBe("rel·composite");
    expect(formatSpriteType(slots, 0)).toBe("anchor");
    expect(formatSpriteType(slots, 4)).toBe("anchor·4B");
  });
});

describe("formatSpritePattern (T7)", () => {
  it("numbers an 8-bit pattern by its 256-byte slot", () => {
    expect(formatSpritePattern(false, 80)).toBe("40");
    expect(formatSpritePattern(false, 81)).toBe("40");
  });

  it("numbers a 4-bit pattern by its 128-byte half", () => {
    expect(formatSpritePattern(true, 81)).toBe("81 (40·hi)");
    expect(formatSpritePattern(true, 80)).toBe("80 (40·lo)");
  });
});

describe("decodeResolvedSprites", () => {
  it("decodes the core's 8-byte layout", () => {
    const buf = new Uint8Array(16);
    buf.set([0x1f, 0x34, 0x01, 0xff, 0x01, 0x0c, 0b1001, 81], 8);
    const [first, second] = decodeResolvedSprites(buf);
    expect(first.visible).toBe(false);
    expect(second).toEqual({
      index: 1,
      visible: true,
      xmirror: true,
      ymirror: true,
      rotate: true,
      fourBit: true,
      x: 0x134,
      y: 0x1ff,
      paletteOffset: 12,
      scaleX: 2,
      scaleY: 1,
      pattern7: 81
    });
    expect(patternSlotOf(second)).toBe(40);
  });
});
