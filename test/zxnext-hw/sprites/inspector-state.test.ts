import { describe, expect, it } from "vitest";

import { decodeResolvedSprites } from "@common/zxnext/sprites/spriteAttributes";
import { transformPattern } from "@common/zxnext/sprites/spriteGeometry";
import { patternPixels } from "@common/zxnext/sprites/spritePatterns";
import { type NextTestSession } from "../../harness/zxnext";
import { hex8, parkedSession, writePalette } from "../ula/_ula-helpers";
import { qualifySprites, rng, type SpriteAttrs } from "./_sprite-model";

/*
 * What the Sprite Inspector reads (`.plans/SPRITE_INSPECTOR_PLAN.md` Phase 2): the snapshot must be
 * what a program uploaded, the core's resolve must be what the engine draws, and reading must never
 * change the machine.
 */

/** Uploads 16K of patterns through one `$303B` select and auto-incremented `$5B` writes. */
function uploadPatterns(s: NextTestSession, patterns: Uint8Array): NextTestSession {
  s.out(0x303b, 0x00);
  for (const b of patterns) s.out(0x005b, b);
  return s;
}

/** Uploads attributes through `$57`, 4 or 5 bytes per sprite as attr3 bit 6 says. */
function uploadAttrs(s: NextTestSession, attrs: SpriteAttrs[]): NextTestSession {
  s.out(0x303b, 0x00);
  for (const a of attrs) {
    for (let k = 0; k < 4; k++) s.out(0x0057, a[k]);
    if (a[3] & 0x40) s.out(0x0057, a[4]);
  }
  return s;
}

/** 128 random slots: 4- and 5-byte anchors, composite and unified relatives, 4- and 8-bit patterns. */
function randomAttrs(seed: number): SpriteAttrs[] {
  const r = rng(seed);
  const byte = () => Math.floor(r() * 256);
  const attrs: SpriteAttrs[] = [];
  for (let i = 0; i < 128; i++) {
    const visible = r() < 0.8 ? 0x80 : 0;
    const five = r() < 0.6;
    if (five && r() < 0.35) {
      // --- A relative: attr4 bits 7:6 = 01
      attrs.push([byte(), byte(), byte(), visible | 0x40 | (byte() & 0x3f), 0x40 | (byte() & 0x3f)]);
    } else {
      const attr4 = five ? byte() & 0xbf : byte(); // --- never 01 in bits 7:6 for an anchor
      attrs.push([byte(), byte(), byte(), visible | (five ? 0x40 : 0) | (byte() & 0x3f), attr4]);
    }
  }
  return attrs;
}

describe("Sprite Inspector state", () => {
  it("T2: the raw 16K pattern RAM is what $5B uploaded, including the 4-bit nibble order", async () => {
    const r = rng(11);
    const patterns = Uint8Array.from({ length: 0x4000 }, () => Math.floor(r() * 256));
    const s = uploadPatterns(await parkedSession(), patterns);
    const state = s.spriteState();
    expect(state.patterns.length).toBe(0x4000);
    expect(Array.from(state.patterns)).toEqual(Array.from(patterns));
    // --- The 4-bit decode of the snapshot equals the core's own 4-bit pattern memory
    for (const p of [0, 1, 80, 81, 127]) {
      const decoded = patternPixels(state.patterns, p, { format: "4bit", offset: 0, transparencyIndex: 0xe3 });
      const core = Array.from(s.spritePatternVariant(p, 0, { fourBit: true }), (n) => (n === 3 ? -1 : n));
      expect(Array.from(decoded), `4-bit pattern ${p}`).toEqual(core);
    }
  });

  it("D4: the resolved table is what the engine qualifies, for all 128 slots", async () => {
    for (const seed of [1, 2, 3]) {
      const attrs = randomAttrs(seed);
      const s = uploadAttrs(await parkedSession(), attrs);
      const state = s.spriteState();
      // --- A 4-byte slot keeps its stale attr4: $57 never writes it (T4)
      const stored = attrs.map((a, i) => (a[3] & 0x40 ? a : ([a[0], a[1], a[2], a[3], 0] as SpriteAttrs)));
      expect(Array.from(state.attributes)).toEqual(stored.flat());
      const resolved = decodeResolvedSprites(state.resolved).map(({ index: _, ...rest }) => rest);
      expect(resolved, `seed ${seed}`).toEqual(qualifySprites(stored));
    }
  });

  it("D4: the NextReg mirrors ($75-$79) give the same resolve, and the screen agrees", async () => {
    const s = await parkedSession();
    writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i] as [number, number]), 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x68, 0x80);
    s.setNextReg(0x4b, 0xe3);
    const patterns = new Uint8Array(0x4000).fill(0xe3);
    patterns.fill(0x24, 0, 256); // --- pattern 0: solid $24
    uploadPatterns(s, patterns);
    // --- Sprite 0: a unified anchor at (100, 60), scale 2x; sprite 1: a relative at +8, +4
    // --- $35-$38 write attr0-3 of the mirror's sprite; $79 writes attr4 and moves to the next one
    const mirror = (attrs: number[]) => {
      attrs.slice(0, 4).forEach((b, k) => s.setNextReg(0x35 + k, b));
      s.setNextReg(0x79, attrs[4]);
    };
    s.setNextReg(0x34, 0);
    mirror([100, 60, 0x00, 0xc0, 0x20 | (1 << 3) | (1 << 1)]);
    mirror([8, 4, 0x00, 0xc0, 0x40]);
    s.setNextReg(0x15, 0x03).runFrames(2);

    const state = s.spriteState();
    const [anchor, relative] = decodeResolvedSprites(state.resolved);
    expect(anchor).toMatchObject({ visible: true, x: 100, y: 60, scaleX: 1, scaleY: 1 });
    // --- The unified anchor scales the offset too: (8, 4) << 1
    expect(relative).toMatchObject({ visible: true, x: 116, y: 68, scaleX: 1, scaleY: 1 });
    // --- The sprite area starts at buffer (32, 16) with 2 buffer pixels per sprite pixel
    expect(s.pixel(32 + 2 * 116, 16 + 68)).toBe(hex8(0x24));
    expect(s.pixel(32 + 2 * 115, 16 + 59)).toBe(hex8(0xe3));
    expect(s.pixel(32 + 2 * (116 + 31), 16 + 68 + 31)).toBe(hex8(0x24));
  });

  it("T1: two snapshots in a row leave the collision flag set", async () => {
    const s = await parkedSession();
    s.setNextReg(0x4b, 0xe3);
    uploadPatterns(s, new Uint8Array(0x4000).fill(0x05));
    s.out(0x303b, 0x00);
    for (const b of [100, 100, 0x00, 0x80, 108, 104, 0x00, 0x80]) s.out(0x0057, b);
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(s.spriteState().status.collision).toBe(true);
    expect(s.spriteState().status.collision).toBe(true);
    expect(s.in(0x303b) & 0x01, "the program still sees it").toBe(0x01);
    expect(s.spriteState().status.collision).toBe(false);
  });

  it("T10: transformPattern equals all 8 core variants", async () => {
    const r = rng(5);
    const patterns = Uint8Array.from({ length: 0x4000 }, () => Math.floor(r() * 256));
    const s = uploadPatterns(await parkedSession(), patterns);
    const pixels = patternPixels(patterns, 9, { format: "8bit", offset: 0, transparencyIndex: 0xe3 });
    for (let variant = 0; variant < 8; variant++) {
      const ours = transformPattern(pixels, (variant & 4) !== 0, (variant & 2) !== 0, (variant & 1) !== 0);
      const core = Array.from(s.spritePatternVariant(9, variant), (b) => (b === 0xe3 ? -1 : b));
      expect(Array.from(ours), `variant ${variant}`).toEqual(core);
    }
  });

  it("T11: the 8-bit palette offset matches the drawn pixels", async () => {
    const s = await parkedSession();
    writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i] as [number, number]), 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x68, 0x80);
    s.setNextReg(0x4b, 0xe3);
    const patterns = new Uint8Array(0x4000).fill(0xe3);
    for (let i = 0; i < 256; i++) patterns[i] = i === 0xe3 ? 0 : i;
    uploadPatterns(s, patterns);
    s.out(0x303b, 0x00);
    // --- Palette offset 11, 8-bit pattern 0, at (100, 100)
    for (const b of [100, 100, 0xb0, 0x80]) s.out(0x0057, b);
    s.setNextReg(0x15, 0x03).runFrames(2);
    const state = s.spriteState();
    const pixels = patternPixels(state.patterns, 0, {
      format: "8bit",
      offset: 0,
      paletteOffset: 11,
      transparencyIndex: state.transparencyIndex
    });
    for (const p of [0x00, 0x12, 0x5f, 0xf0, 0xff]) {
      expect(s.pixel(32 + 2 * (100 + (p & 15)), 16 + 100 + (p >> 4)), `pixel $${p.toString(16)}`).toBe(hex8(pixels[p]));
    }
  });

  it("T3: reading the snapshot does not change the machine state image", async () => {
    const attrs = randomAttrs(4);
    const s = uploadAttrs(await parkedSession(), attrs);
    s.setNextReg(0x15, 0x03).runFrames(1);
    const before = s.machine.saveMachineState().image;
    s.spriteState();
    const after = s.machine.saveMachineState().image;
    expect(Buffer.compare(Buffer.from(before), Buffer.from(after))).toBe(0);
  });

  it("T12: the globals: $15, $19, $4B and the upload pointers, tied by $09 bit 4", async () => {
    const s = await parkedSession();
    s.setNextReg(0x15, 0x63).setNextReg(0x4b, 0x0e);
    s.setNextReg(0x1c, 0x02); // --- reset the sprite clip index
    s.setNextReg(0x19, 10).setNextReg(0x19, 200).setNextReg(0x19, 20).setNextReg(0x19, 180).setNextReg(0x19, 11);
    s.out(0x303b, 0x85).out(0x0057, 1).out(0x0057, 2).out(0x005b, 0);
    let state = s.spriteState();
    expect(state.control).toBe(0x63);
    expect(state.transparencyIndex).toBe(0x0e);
    expect(state.clip).toEqual([11, 200, 20, 180]);
    expect(state.clipIndex).toBe(1);
    expect(state.upload).toMatchObject({ spriteIndex: 5, spriteSub: 2, patternIndex: 5, patternSub: 0x81, tied: false });
    s.setNextReg(0x09, 0x10).setNextReg(0x34, 0x22);
    state = s.spriteState();
    expect(state.upload).toMatchObject({ tied: true, mirrorIndex: 0x22, spriteIndex: 0x22, spriteSub: 0 });
  });
});
