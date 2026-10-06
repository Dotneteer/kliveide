import { describe, expect, it } from "vitest";

import {
  decodeCell,
  isTextModeTransparent,
  pixelIndex,
  renderTilemapImage,
  renderTileSheet,
  TILE_TRANSPARENT,
  tileOffset,
  tilePixels,
  tilemapMode,
  transformTile,
  vramOffset
} from "@common/zxnext/tilemap/tilemapDecode";
import { emptyBanks, regs } from "./tilemapFixtures";

describe("tilemapMode (T2, T3, T4)", () => {
  it("knows the four entry formats' map lengths", () => {
    expect(tilemapMode({ control: 0x80 }).mapLength).toBe(2560);
    expect(tilemapMode({ control: 0xa0 }).mapLength).toBe(1280);
    expect(tilemapMode({ control: 0xc0 }).mapLength).toBe(5120);
    expect(tilemapMode({ control: 0xe0 }).mapLength).toBe(2560);
  });

  it("sizes the definitions: 256/512 tiles, 32/8 bytes", () => {
    expect(tilemapMode({ control: 0x80 }).defLength).toBe(8192);
    expect(tilemapMode({ control: 0x82 }).defLength).toBe(16384);
    expect(tilemapMode({ control: 0x88 })).toMatchObject({ tileBytes: 8, defLength: 2048 });
    expect(tilemapMode({ control: 0x8a }).defLength).toBe(4096);
  });

  it("reads the flags and the width", () => {
    expect(tilemapMode({ control: 0xd1 })).toMatchObject({
      columns: 80,
      width: 640,
      secondPalette: true,
      forceOnTop: true,
      attributeLess: false
    });
  });
});

describe("vramOffset (T1)", () => {
  it("adds the MSB to the address's high byte within bank 5, wrapping at 16K", () => {
    expect(vramOffset(false, 0x2c, 0)).toBe(0x2c00);
    expect(vramOffset(false, 0x2c, 0x1401)).toBe(0x0001);
  });

  it("masks the MSB to 5 bits in bank 7 and wraps at 8K", () => {
    expect(vramOffset(true, 0x2c, 0)).toBe(0x0c00);
    expect(vramOffset(true, 0x1f, 0x0100)).toBe(0x0000);
  });
});

describe("decodeCell", () => {
  it("decodes a 2-byte entry: tile, palette offset, mirrors, rotate, ULA on top", () => {
    const b = emptyBanks();
    b.bank5[0x2c00 + 2 * 41] = 7;
    b.bank5[0x2c00 + 2 * 41 + 1] = 0x5f;
    const r = regs();
    const cell = decodeCell(tilemapMode(r), r, b, 1, 1);
    expect(cell).toMatchObject({
      entryOffset: 0x2c00 + 82,
      raw: [7, 0x5f],
      tile: 7,
      paletteOffset: 5,
      xmirror: true,
      ymirror: true,
      rotate: true,
      ulaOnTop: true,
      below: true
    });
  });

  it("uses $6C in attribute-less mode, one byte per entry (T2)", () => {
    const b = emptyBanks();
    b.bank5[0x2c00 + 41] = 9;
    const r = regs({ control: 0xa0, defaultAttr: 0x30 });
    const cell = decodeCell(tilemapMode(r), r, b, 1, 1);
    expect(cell).toMatchObject({ entryOffset: 0x2c00 + 41, raw: [9], tile: 9, attr: 0x30, paletteOffset: 3 });
  });

  it("takes tile bit 8 from attribute bit 0 in 512-tile mode, and puts the cell below the ULA (T3)", () => {
    const b = emptyBanks();
    b.bank5[0x2c00] = 44;
    b.bank5[0x2c01] = 0x01;
    const r = regs({ control: 0x82 });
    const cell = decodeCell(tilemapMode(r), r, b, 0, 0);
    expect(cell.tile).toBe(300);
    expect(cell.ulaOnTop).toBeUndefined();
    expect(cell.below).toBe(true);
    b.bank5[0x2c01] = 0x00;
    expect(decodeCell(tilemapMode(r), r, b, 0, 0)).toMatchObject({ tile: 44, below: true });
    const onTop = regs({ control: 0x83 });
    expect(decodeCell(tilemapMode(onTop), onTop, b, 0, 0).below).toBe(false);
  });

  it("reads a 7-bit palette offset and no transform in text mode (T4)", () => {
    const b = emptyBanks();
    b.bank5[0x2c01] = 0xfe;
    const r = regs({ control: 0x88 });
    expect(decodeCell(tilemapMode(r), r, b, 0, 0)).toMatchObject({
      paletteOffset: 0x7f,
      xmirror: false,
      ymirror: false,
      rotate: false
    });
  });

  it("reads the map from bank 7 when $6E bit 7 is set", () => {
    const b = emptyBanks();
    b.bank7[0x0c00] = 3;
    const r = regs({ mapBank7: true });
    expect(decodeCell(tilemapMode(r), r, b, 0, 0).tile).toBe(3);
  });
});

describe("tiles", () => {
  it("reads 4-bit tiles high nibble first", () => {
    const b = emptyBanks();
    b.bank5[0x0c00 + 32] = 0x12;
    const r = regs();
    const p = tilePixels(tilemapMode(r), r, b, 1);
    expect([p[0], p[1]]).toEqual([1, 2]);
    expect(tileOffset(tilemapMode(r), r, 1)).toBe(0x0c20);
  });

  it("reads text-mode tiles as 8 bytes of bits (T4)", () => {
    const b = emptyBanks();
    b.bank5[0x0c00 + 8] = 0x81;
    const r = regs({ control: 0x88 });
    expect(Array.from(tilePixels(tilemapMode(r), r, b, 1).slice(0, 8))).toEqual([1, 0, 0, 0, 0, 0, 0, 1]);
  });

  // --- T5: zxnextUlaTilemapTransform, transcribed independently
  it("applies all 8 transforms as the core does: rotate first, then the mirrors", () => {
    const src = Uint8Array.from({ length: 64 }, (_, i) => i);
    for (let t = 0; t < 8; t++) {
      const rot = (t & 4) !== 0;
      const xm = (t & 2) !== 0;
      const ym = (t & 1) !== 0;
      const out = transformTile(src, rot, xm, ym);
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          let ex = x;
          let ey = y;
          if (xm !== rot) ex = 7 - ex;
          if (ym) ey = 7 - ey;
          const [tx, ty] = rot ? [ey, ex] : [ex, ey];
          expect(out[y * 8 + x]).toBe(ty * 8 + tx);
        }
      }
    }
    // --- rotate alone turns the top row into the right column, read top down
    const r = transformTile(src, true, false, false);
    expect([r[0 * 8 + 7], r[1 * 8 + 7], r[7 * 8 + 7]]).toEqual([0, 1, 7]);
  });
});

describe("pixelIndex and transparency (T8)", () => {
  const std = tilemapMode({ control: 0x80 });
  const txt = tilemapMode({ control: 0x88 });

  it("compares a standard nibble with $4C and adds the palette offset", () => {
    expect(pixelIndex(std, { transparencyIndex: 0x0f }, 0x30, 0x0f)).toBe(TILE_TRANSPARENT);
    expect(pixelIndex(std, { transparencyIndex: 0x0f }, 0x30, 0x02)).toBe(0x32);
  });

  it("builds a text-mode index from attr(7:1) and the bit; transparency is by colour", () => {
    expect(pixelIndex(txt, { transparencyIndex: 0 }, 0x31, 1)).toBe(0x31);
    expect(pixelIndex(txt, { transparencyIndex: 0 }, 0x30, 0)).toBe(0x30);
    expect(pixelIndex(txt, { transparencyIndex: 0 }, 0x30, 0, (i) => i === 0x30)).toBe(TILE_TRANSPARENT);
    expect(isTextModeTransparent(0xe3 << 1, 0xe3)).toBe(true);
    expect(isTextModeTransparent((0xe3 << 1) | 1, 0xe3)).toBe(true);
    expect(isTextModeTransparent(0x1c6 ^ 0x02, 0xe3)).toBe(false);
  });
});

describe("renderTilemapImage", () => {
  // --- Map: every cell shows tile 1 (solid colour 2) except cell (0, 0) = tile 0 (transparent)
  function scene() {
    const b = emptyBanks();
    b.bank5.fill(0xff, 0x0c00, 0x0c20);
    b.bank5.fill(0x22, 0x0c20, 0x0c40);
    for (let i = 0; i < 40 * 32; i++) b.bank5[0x2c00 + 2 * i] = 1;
    b.bank5[0x2c00] = 0;
    return b;
  }

  it("draws the whole map unscrolled in *Whole map* mode", () => {
    const r = regs({ scrollX: 8, scrollY: 8, clip: [10, 20, 10, 20] });
    const img = renderTilemapImage(tilemapMode(r), r, scene(), { asDisplayed: false });
    expect([img.width, img.height]).toEqual([320, 256]);
    expect(img.pixels[0]).toBe(TILE_TRANSPARENT);
    expect(img.pixels[8]).toBe(2);
    expect(img.pixels[255 * 320 + 319]).toBe(2);
  });

  it("scrolls and clips in *As displayed* mode", () => {
    const r = regs({ scrollX: 312, scrollY: 248, clip: [0, 159, 0, 254] });
    const img = renderTilemapImage(tilemapMode(r), r, scene(), { asDisplayed: true });
    // --- display (8, 8) shows map (0, 0), the transparent tile
    expect(img.pixels[8 * 320 + 8]).toBe(TILE_TRANSPARENT);
    expect(img.pixels[0]).toBe(2);
    // --- row 255 is clipped
    expect(img.pixels[255 * 320]).toBe(TILE_TRANSPARENT);
  });

  it("clips 80-column pixels by x >> 1 against the doubled $1B (T6)", () => {
    const b = emptyBanks();
    b.bank5.fill(0x22, 0x0c00, 0x0c20);
    const r = regs({ control: 0xc0, clip: [1, 2, 0, 255] });
    const img = renderTilemapImage(tilemapMode(r), r, b, { asDisplayed: true });
    expect(img.width).toBe(640);
    const row = Array.from(img.pixels.slice(0, 16)).map((v) => (v === TILE_TRANSPARENT ? "." : "x")).join("");
    // --- hc 2..5 visible -> x 4..11
    expect(row).toBe("....xxxxxxxx....");
  });
});

describe("renderTileSheet", () => {
  it("lays out 256 tiles with each tile's palette offset", () => {
    const b = emptyBanks();
    b.bank5.fill(0x11, 0x0c20, 0x0c40);
    const r = regs();
    const sheet = renderTileSheet(tilemapMode(r), r, b, 16, (t) => (t === 1 ? 3 : 0));
    expect([sheet.width, sheet.height]).toEqual([128, 128]);
    expect(sheet.pixels[8]).toBe(0x31);
  });
});
