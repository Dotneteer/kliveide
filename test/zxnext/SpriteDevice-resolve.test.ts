import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { SpriteDevice } from "@emu/machines/zxNext/SpriteDevice";

/**
 * Unit tests for SpriteDevice.resolveRelativeSprites() — D1 fix
 *
 * resolveRelativeSprites() composites relative sprites onto their anchor's
 * position and transforms, mirroring MAME's update_sprites_cache() algorithm.
 *
 * Tests cover:
 * - Non-relative anchors are copied as-is
 * - Invisible anchors produce invisible resolved sprites
 * - Relative sprites inherit anchor position (uniform and composite rel_type)
 * - Palette offset composition (attributeFlag1)
 * - Pattern index composition (patternRelative)
 * - 4-bit mode inheritance from anchor
 * - Scale inheritance in composite mode
 * - Sign-extended negative offsets
 * - Rotate-swapped offsets (composite mode)
 * - Dirty-flag driven re-resolve on attribute change
 */

describe("SpriteDevice - resolveRelativeSprites (D1)", () => {
  let machine: IZxNextMachine;
  let sd: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    sd = machine.spriteDevice;
  });

  // ─── helpers ─────────────────────────────────────────────────────────────

  /** Write a 5-byte anchor sprite (colorMode = 0). */
  function anchor(
    idx: number,
    x: number,
    y: number,
    opts: {
      palette?: number;
      mirrorX?: boolean;
      mirrorY?: boolean;
      rotate?: boolean;
      attributeFlag1?: boolean;
      pattern?: number;
      visible?: boolean;
      is4Bit?: boolean;
      scaleX?: number;
      scaleY?: number;
      attributeFlag2?: boolean; // rel_type bit (bit 5 of attr4)
    } = {}
  ): void {
    const o = {
      palette: 0, mirrorX: false, mirrorY: false, rotate: false,
      attributeFlag1: false, pattern: 0, visible: true,
      is4Bit: false, scaleX: 0, scaleY: 0, attributeFlag2: false, ...opts
    };
    sd.writeIndexedSpriteAttribute(idx, 0, x & 0xff);
    sd.writeIndexedSpriteAttribute(idx, 1, y & 0xff);
    const a2 =
      (o.palette << 4) | (o.mirrorX ? 0x08 : 0) | (o.mirrorY ? 0x04 : 0) |
      (o.rotate ? 0x02 : 0) | (o.attributeFlag1 ? 0x01 : 0);
    sd.writeIndexedSpriteAttribute(idx, 2, a2);
    const a3 = (o.visible ? 0x80 : 0) | 0x40 | (o.pattern & 0x3f);
    sd.writeIndexedSpriteAttribute(idx, 3, a3);
    let a4 = 0;
    if (o.is4Bit) a4 |= 0x80;          // bit 7 = is4BitPattern
    if (o.attributeFlag2) a4 |= 0x20;  // bit 5 = rel_type for anchor
    a4 |= (o.scaleX & 3) << 3;
    a4 |= (o.scaleY & 3) << 1;
    a4 |= (x >> 8) & 0x01;             // X MSB in bit 0
    sd.writeIndexedSpriteAttribute(idx, 4, a4);
  }

  /** Write a 5-byte relative sprite (colorMode = 0b01 = 0x40 in bits 7:6 of attr4). */
  function relative(
    idx: number,
    offsetX: number,
    offsetY: number,
    opts: {
      palette?: number;
      mirrorX?: boolean;
      mirrorY?: boolean;
      rotate?: boolean;
      attributeFlag1?: boolean; // "use anchor + relative palette"
      pattern?: number;
      visible?: boolean;
      attributeFlag2?: boolean; // N6 bit (bit 5 of attr4)
      patternRelative?: boolean; // bit 0 of attr4
    } = {}
  ): void {
    const o = {
      palette: 0, mirrorX: false, mirrorY: false, rotate: false,
      attributeFlag1: false, pattern: 0, visible: true,
      attributeFlag2: false, patternRelative: false, ...opts
    };
    sd.writeIndexedSpriteAttribute(idx, 0, offsetX & 0xff);
    sd.writeIndexedSpriteAttribute(idx, 1, offsetY & 0xff);
    const a2 =
      (o.palette << 4) | (o.mirrorX ? 0x08 : 0) | (o.mirrorY ? 0x04 : 0) |
      (o.rotate ? 0x02 : 0) | (o.attributeFlag1 ? 0x01 : 0);
    sd.writeIndexedSpriteAttribute(idx, 2, a2);
    const a3 = (o.visible ? 0x80 : 0) | 0x40 | (o.pattern & 0x3f);
    sd.writeIndexedSpriteAttribute(idx, 3, a3);
    let a4 = 0x40;                      // colorMode = 0b01 (relative)
    if (o.attributeFlag2) a4 |= 0x20;  // N6
    if (o.patternRelative) a4 |= 0x01;
    sd.writeIndexedSpriteAttribute(idx, 4, a4);
  }

  // ─── Non-relative anchor ─────────────────────────────────────────────────

  it("non-relative anchor is copied as-is after resolve", () => {
    anchor(0, 50, 100, { palette: 2, mirrorX: true, pattern: 7 });
    sd.resolveRelativeSprites();

    const r = sd.resolvedAttributes[0];
    expect(r.visible).toBe(true);
    expect(r.x).toBe(50);
    expect(r.y).toBe(100);
    expect(r.paletteOffset).toBe(2);
    expect(r.mirrorX).toBe(true);
    expect(r.patternIndex).toBe(7);
  });

  it("invisible anchor resolves to visible=false", () => {
    anchor(0, 50, 100, { visible: false });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[0].visible).toBe(false);
  });

  // ─── Relative sprite — position compositing ──────────────────────────────

  it("relative sprite with visible anchor: position = anchor + offset (uniform)", () => {
    anchor(0, 100, 80);
    relative(1, 10, 8);
    sd.resolveRelativeSprites();

    const r = sd.resolvedAttributes[1];
    expect(r.visible).toBe(true);
    expect(r.x).toBe(110); // 100 + 10
    expect(r.y).toBe(88);  // 80  + 8
  });

  it("relative sprite with invisible anchor resolves to visible=false", () => {
    anchor(0, 100, 80, { visible: false });
    relative(1, 10, 8);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].visible).toBe(false);
  });

  it("relative sprite's own visible=false makes it invisible regardless of anchor", () => {
    anchor(0, 100, 80);
    relative(1, 10, 8, { visible: false });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].visible).toBe(false);
  });

  it("relative sprite wraps 9-bit position back to 0 correctly", () => {
    // Anchor at x=600 (> 0x1ff will wrap to 88), but anchor X is stored 9-bit
    // Use anchor at x=510, relative offsetX=10 → (510+10) & 0x1ff = 520 & 511 = 8
    anchor(0, 510, 0); // 510 stored in 9-bit: write low=510&0xff=0xfe, X MSB=1 via attr4
    // Actually writeIndexedSpriteAttribute(0, 0, 0xfe) sets x_low=0xfe=254
    // attr4 bit 0 sets X MSB: attr4 = (510>>8)&1 = 1 → x = (1<<8)|0xfe = 510 ✓
    relative(1, 10, 0);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].x).toBe((510 + 10) & 0x1ff); // 520 & 511 = 8
  });

  // ─── Negative (sign-extended) offset ────────────────────────────────────

  it("negative offset via sign extension (raw byte 0xF8 = -8)", () => {
    // rawX = 0xF8 = 248; sign-extent to 9-bit: 248 | 0x100 = 504; no scale
    // x3 = (100 + 504) & 0x1ff = 604 & 511 = 92
    anchor(0, 100, 50);
    relative(1, 0xf8, 0); // offsetX = -8 in signed 8-bit
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].x).toBe(92); // 100 + (-8) = 92
  });

  it("negative Y offset via sign extension (raw byte 0xF0 = -16)", () => {
    // rawY = 0xF0 = 240; sign-extend: 240 | 0x100 = 496; 50 + 496 = 546 & 511 = 34
    anchor(0, 0, 50);
    relative(1, 0, 0xf0);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].y).toBe((50 + 496) & 0x1ff); // 34
  });

  // ─── Palette offset composition (attributeFlag1) ─────────────────────────

  it("palette = anchor + relative when attributeFlag1=true", () => {
    anchor(0, 0, 0, { palette: 3 });
    relative(1, 0, 0, { palette: 4, attributeFlag1: true });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].paletteOffset).toBe(7); // (3+4)&0x0f
  });

  it("palette offset wraps at 4-bit boundary when sum overflows", () => {
    anchor(0, 0, 0, { palette: 14 });
    relative(1, 0, 0, { palette: 5, attributeFlag1: true });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].paletteOffset).toBe((14 + 5) & 0x0f); // 3
  });

  it("palette = own palette when attributeFlag1=false", () => {
    anchor(0, 0, 0, { palette: 3 });
    relative(1, 0, 0, { palette: 5, attributeFlag1: false });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].paletteOffset).toBe(5); // own only
  });

  // ─── Pattern relative (patternRelative) ─────────────────────────────────

  it("resolvedPat7 = (relPat7 + anchorPat7) & 0x7f when patternRelative=true", () => {
    // Anchor: patternIndex=10 (8-bit, anchorN6=false) → anchorPat7 = 10<<1 = 20
    // Relative: patternIndex=5, patternRelative=true → relPat7 = 5<<1 = 10
    // resolvedPat7 = (10 + 20) & 0x7f = 30
    // patternVariantIndex = ((30>>1)<<3)|0 = (15<<3) = 120
    anchor(0, 0, 0, { pattern: 10 });
    relative(1, 0, 0, { pattern: 5, patternRelative: true });
    sd.resolveRelativeSprites();

    const r = sd.resolvedAttributes[1];
    expect(r.pattern7Bit).toBe(30);
    expect(r.patternVariantIndex).toBe(120);
  });

  it("pattern wraps at 7-bit boundary when sum overflows", () => {
    // anchorPat7 = 60<<1 = 120; relPat7 = 10<<1 = 20; (120+20)&0x7f = 140&0x7f = 12
    anchor(0, 0, 0, { pattern: 60 });
    relative(1, 0, 0, { pattern: 10, patternRelative: true });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].pattern7Bit).toBe((120 + 20) & 0x7f); // 12
  });

  it("pattern = own when patternRelative=false", () => {
    // relPat7 = 5<<1 = 10; anchorPat7 = 10<<1 = 20 (not added)
    anchor(0, 0, 0, { pattern: 10 });
    relative(1, 0, 0, { pattern: 5, patternRelative: false });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].pattern7Bit).toBe(10); // 5<<1|0
  });

  // ─── 4-bit mode inheritance ───────────────────────────────────────────────

  it("is4BitPattern is always inherited from anchor", () => {
    // Anchor with is4Bit=true (attr4 bit 7 = 0x80). colorMode=2 (bits 7:6 = 0b10)
    anchor(0, 0, 0, { is4Bit: true });
    relative(1, 0, 0);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].is4BitPattern).toBe(true);
  });

  it("is4BitPattern stays false when anchor is not 4-bit", () => {
    anchor(0, 0, 0, { is4Bit: false });
    relative(1, 0, 0);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].is4BitPattern).toBe(false);
  });

  // ─── Composite rel_type (anchor.attributeFlag2 = true) ───────────────────

  it("composite: final rotate = anchor.rotate XOR relative.rotate", () => {
    // anchor rotated, composite, relative not rotated → true XOR false = true
    anchor(0, 100, 80, { rotate: true, attributeFlag2: true });
    relative(1, 0, 0, { rotate: false });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].rotate).toBe(true);
  });

  it("composite: XOR cancels identical rotate flags", () => {
    anchor(0, 100, 80, { rotate: true, attributeFlag2: true });
    relative(1, 0, 0, { rotate: true });
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].rotate).toBe(false); // true XOR true = false
  });

  it("composite: mirrorX = anchor.mirrorX XOR effective relative mirrorX", () => {
    anchor(0, 100, 80, { mirrorX: true, attributeFlag2: true });
    relative(1, 0, 0, { mirrorX: false });
    sd.resolveRelativeSprites();

    // anchor.mirrorX=true, relative effective mirrorX=false → true XOR false = true
    expect(sd.resolvedAttributes[1].mirrorX).toBe(true);
  });

  it("composite: scaleX is inherited from anchor", () => {
    anchor(0, 100, 80, { scaleX: 2, attributeFlag2: true });
    relative(1, 0, 0); // own scaleX=0
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].scaleX).toBe(2);
    expect(sd.resolvedAttributes[1].width).toBe(64); // 16 << 2
  });

  it("uniform (attributeFlag2=false): relative uses own transforms, not anchor's", () => {
    // anchor has mirrorX=true, rotate=true, attributeFlag2=false → uniform type
    anchor(0, 100, 80, { rotate: true, mirrorX: true, attributeFlag2: false });
    relative(1, 0, 0, { rotate: false, mirrorX: false });
    sd.resolveRelativeSprites();

    // Uniform: transforms come from relative sprite only
    expect(sd.resolvedAttributes[1].rotate).toBe(false);
    expect(sd.resolvedAttributes[1].mirrorX).toBe(false);
  });

  it("uniform: scaleX from relative sprite, not anchor", () => {
    anchor(0, 100, 80, { scaleX: 3, attributeFlag2: false });
    relative(1, 0, 0); // own scaleX=0
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].scaleX).toBe(0); // own (not 3)
    expect(sd.resolvedAttributes[1].width).toBe(16);
  });

  // ─── Composite rotate-based offset swap ─────────────────────────────────

  it("composite rotate: X offset becomes Y delta, Y offset becomes X delta", () => {
    // anchor: rotate=true, no mirror, no scale, composite (attributeFlag2=true)
    // relative offsetX=10, offsetY=0
    // aRotate=true → x0=rawY=0, y0=rawX=10
    // x1 = negate(x0) = negate(0)=0; y1=10
    // x3 = anchor.x + 0 = 100; y3 = anchor.y + 10 = 90
    anchor(0, 100, 80, { rotate: true, attributeFlag2: true });
    relative(1, 10, 0);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].x).toBe(100); // no X delta
    expect(sd.resolvedAttributes[1].y).toBe(90);  // Y gets the 10
  });

  // ─── Scale applied to offset ─────────────────────────────────────────────

  it("composite: offset scaled by anchor.scaleX/scaleY", () => {
    // anchor: scaleX=1 (2x), composite
    // relative offsetX=5 → x2 = 5 << 1 = 10 → x3 = 100+10 = 110
    anchor(0, 100, 80, { scaleX: 1, attributeFlag2: true });
    relative(1, 5, 0);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].x).toBe(110); // 100 + (5<<1)
  });

  // ─── Multiple anchors in sequence ────────────────────────────────────────

  it("multiple anchors: relative sprites follow their nearest preceding anchor", () => {
    anchor(0, 10, 20);  // first anchor
    relative(1, 5, 5);  // follows anchor 0 → x=15, y=25
    anchor(2, 50, 60);  // second anchor
    relative(3, 3, 3);  // follows anchor 2 → x=53, y=63
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[1].x).toBe(15);
    expect(sd.resolvedAttributes[1].y).toBe(25);
    expect(sd.resolvedAttributes[3].x).toBe(53);
    expect(sd.resolvedAttributes[3].y).toBe(63);
  });

  it("relative sprite before any anchor resolves to invisible", () => {
    // Sprite 0 is relative (no anchor before it)
    relative(0, 10, 10);
    sd.resolveRelativeSprites();

    expect(sd.resolvedAttributes[0].visible).toBe(false);
  });

  // ─── Dirty-flag driven re-resolve ────────────────────────────────────────

  it("re-resolve after attribute change produces updated result", () => {
    anchor(0, 50, 100);
    sd.resolveRelativeSprites();
    expect(sd.resolvedAttributes[0].x).toBe(50);

    // Update anchor X → dirty flag set automatically by writeIndexedSpriteAttribute
    anchor(0, 80, 100);
    sd.resolveRelativeSprites(); // must re-resolve since dirty
    expect(sd.resolvedAttributes[0].x).toBe(80);
  });

  it("second consecutive resolve without attr change uses cached result", () => {
    anchor(0, 50, 100);
    relative(1, 10, 0);
    sd.resolveRelativeSprites();

    // Mutate raw attribute directly without going through writeIndexedSpriteAttribute
    // (bypasses dirty flag) — second resolve should return cached values
    sd.attributes[0].x = 999;
    sd.resolveRelativeSprites(); // should NOT re-resolve (not dirty)

    // resolved[0].x should still be 50 (cached), not 999
    expect(sd.resolvedAttributes[0].x).toBe(50);
  });

  it("transformVariant caches (rotate|mirrorX|mirrorY) correctly for resolved sprite", () => {
    // anchor: rotate=true, mirrorX=false, mirrorY=false, composite (attributeFlag2=true)
    // relative: rotate=false, mirrorX=false, mirrorY=false
    // composite path:
    //   relXm = aRotate(true) ? (src.mirrorY(false) XOR src.rotate(false)) : src.mirrorX = false
    //   relYm = aRotate(true) ? (src.mirrorX(false) XOR src.rotate(false)) : src.mirrorY = false
    //   finalMirrorX = aMirrorX(false) XOR relXm(false) = false
    //   finalMirrorY = aMirrorY(false) XOR relYm(false) = false
    //   finalRotate  = aRotate(true) XOR src.rotate(false) = true
    //   transformVariant = (rotate:4) | (mirrorX:0) | (mirrorY:0) = 4
    anchor(0, 0, 0, { rotate: true, mirrorX: false, attributeFlag2: true });
    relative(1, 0, 0, { rotate: false, mirrorX: false });
    sd.resolveRelativeSprites();

    const r = sd.resolvedAttributes[1];
    expect(r.rotate).toBe(true);
    expect(r.mirrorX).toBe(false);
    expect(r.transformVariant).toBe(4); // rotate only
  });
});
