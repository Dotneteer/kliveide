import { describe, expect, it } from "vitest";

import { decodeResolvedSprites, decodeSpriteSlots } from "@common/zxnext/sprites/spriteAttributes";
import { spriteDiagnostics, type SpriteDiagnosticContext } from "@common/zxnext/sprites/spriteDiagnostics";
import { PAPER_RECT } from "@common/zxnext/sprites/spriteGeometry";

type R = { visible?: boolean; x?: number; y?: number; fourBit?: boolean; pattern7?: number };

function ctxOf(raws: number[][], resolved: R[], extra: Partial<SpriteDiagnosticContext> = {}): SpriteDiagnosticContext {
  const attrs = new Uint8Array(640);
  raws.forEach((raw, i) => attrs.set(raw, i * 5));
  const buf = new Uint8Array(128 * 8);
  resolved.forEach((r, i) => {
    const x = r.x ?? 100;
    const y = r.y ?? 100;
    buf.set([(r.visible ? 1 : 0) | (r.fourBit ? 0x10 : 0), x & 0xff, x >> 8, y & 0xff, y >> 8, 0, 0, r.pattern7 ?? 0], i * 8);
  });
  return {
    slots: decodeSpriteSlots(attrs),
    resolved: decodeResolvedSprites(buf),
    spritesEnabled: true,
    clip: PAPER_RECT,
    transparencyIndex: 0xe3,
    ...extra
  };
}

const codes = (index: number, ctx: SpriteDiagnosticContext) => spriteDiagnostics(index, ctx).map((d) => d.code);

describe("spriteDiagnostics", () => {
  it("says nothing about an all-zero slot", () => {
    expect(codes(0, ctxOf([[0, 0, 0, 0, 0]], [{}]))).toEqual([]);
  });

  it("explains a clear visible bit", () => {
    expect(codes(0, ctxOf([[1, 0, 0, 0, 0]], [{}]))).toEqual(["visibleBitClear"]);
  });

  it("names the invisible anchor of a hidden relative (T5)", () => {
    const ctx = ctxOf([[0, 0, 0, 0x40, 0], [0, 0, 0, 0xc0, 0x40]], [{}, {}]);
    const [d] = spriteDiagnostics(1, ctx);
    expect(d.code).toBe("anchorHidden");
    expect(d.chip).toBe("hidden: anchor #0 not visible");
  });

  it("explains a relative with no anchor", () => {
    expect(codes(0, ctxOf([[0, 0, 0, 0xc0, 0x40]], [{}]))).toEqual(["noAnchor"]);
  });

  it("reports the sprite layer being off", () => {
    expect(codes(0, ctxOf([[100, 100, 0, 0x80, 0]], [{ visible: true }], { spritesEnabled: false }))).toContain(
      "spritesDisabled"
    );
  });

  it("reports off screen, outside the clip window and partly clipped (T8)", () => {
    expect(codes(0, ctxOf([[0, 0, 0, 0x80, 0]], [{ visible: true, x: 320 }]))).toEqual(["offScreen"]);
    expect(codes(0, ctxOf([[0, 0, 0, 0x80, 0]], [{ visible: true, x: 0, y: 0 }]))).toEqual(["outsideClip"]);
    expect(codes(0, ctxOf([[0, 0, 0, 0x80, 0]], [{ visible: true, x: 24 }]))).toEqual(["partlyClipped"]);
  });

  it("reports an all-transparent pattern and a solid one", () => {
    const patterns = new Uint8Array(0x4000).fill(0xe3);
    patterns.fill(0x11, 256, 512);
    expect(codes(0, ctxOf([[0, 0, 0, 0x80, 0]], [{ visible: true }], { patterns }))).toEqual(["patternTransparent"]);
    expect(codes(0, ctxOf([[0, 0, 0, 0x81, 0]], [{ visible: true, pattern7: 2 }], { patterns }))).toEqual([
      "patternBlank"
    ]);
  });

  it("flags a 4-byte slot whose stale attr4 would matter, at info level (T4, D13)", () => {
    const [d] = spriteDiagnostics(0, ctxOf([[100, 100, 0, 0x80, 0x0a]], [{ visible: true }]));
    expect(d.code).toBe("staleAttr4");
    expect(d.level).toBe("info");
    expect(d.sentence).toContain("$0A");
  });
});
