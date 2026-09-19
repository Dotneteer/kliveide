import { describe, expect, it } from "vitest";

import { type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, writePalette } from "../ula/_ula-helpers";
import {
  control6B,
  randomBank5,
  TM_DEFAULT,
  tilemapBelow,
  tilemapIndex,
  tilemapMismatches,
  tilemapScreen,
  type TM
} from "./_tilemap-helpers";

/*
 * Tilemap (catalogue TM-001 - TM-025; TM-018 / TM-019 are in nextreg/tilemap-base-address). The picture
 * tests compare every pixel with the transcription of tilemap.vhd in `_tilemap-helpers.ts`; bank 5 holds
 * random bytes, so map entries, attributes (every mirror / rotate / offset) and tile data vary.
 *
 * zxnext.vhd: ~5437-5450 $6B enable + control, $6C default attribute, $6E / $6F bases (reset $2C / $0C);
 * ~4996 $4C resets to $F; ~4954-4957 the $1B clip resets to 0, $9F, 0, $FF (the whole 320 x 256);
 * ~6772 $6B bit 4 picks the tilemap palette; ~7055 a tilemap pixel is transparent when it is not valid
 * (tilemap.vhd: outside, or a standard nibble equal to $4C) or, *text mode only*, when its RGB equals $14;
 * ~7061-7062 it is drawn over the ULA unless it is marked below and the ULA pixel is opaque.
 */

const NONE = hex8(0xe3);
const BANK = randomBank5(5);

/** Sets the tilemap registers for `p` and enables it. */
function apply(s: NextTestSession, p: TM, onTop = false, palette2 = false): NextTestSession {
  s.setNextReg(0x6e, p.mapBase).setNextReg(0x6f, p.tileBase).setNextReg(0x6c, p.defaultAttr).setNextReg(0x4c, p.transparentIndex);
  s.setNextReg(0x2f, p.sx >> 8).setNextReg(0x30, p.sx & 0xff).setNextReg(0x31, p.sy);
  s.setNextReg(0x1c, 0x08).setNextReg(0x1b, p.clip[0]).setNextReg(0x1b, p.clip[1]).setNextReg(0x1b, p.clip[2]).setNextReg(0x1b, p.clip[3]);
  return s.setNextReg(0x6b, control6B(p, onTop, palette2));
}

async function check(p: TM, onTop = false): Promise<string[]> {
  const s = await tilemapScreen(BANK);
  apply(s, p, onTop).runFrames(2);
  return tilemapMismatches(s, BANK, p, NONE);
}

describe("Tilemap", () => {
  it("TM-001 / TM-003: 40x32 with attributes, the reset bases and clip; registers read back", async () => {
    const s = await tilemapScreen(BANK);
    expect([s.readNextReg(0x6e), s.readNextReg(0x6f), s.readNextReg(0x4c), s.readNextReg(0x6b)], "reset $6E $6F $4C $6B").toEqual([0x2c, 0x0c, 0x0f, 0x00]);
    s.setNextReg(0x6b, 0x80).runFrames(2);
    expect(s.readNextReg(0x6b)).toBe(0x80);
    expect(tilemapMismatches(s, BANK, TM_DEFAULT, NONE)).toEqual([]);
  });

  it("TM-002: 80x32 - tiles 8 buffer pixels wide, 640 across", async () => {
    expect(await check({ ...TM_DEFAULT, cols80: true })).toEqual([]);
  });

  for (const defaultAttr of [0x00, 0x5a, 0xa1]) {
    it(`TM-004 / TM-021: $6B bit 5 - one byte a tile, attribute $6C = $${defaultAttr.toString(16).padStart(2, "0")}`, async () => {
      const s = await tilemapScreen(BANK);
      const p = { ...TM_DEFAULT, noAttr: true, defaultAttr };
      apply(s, p).runFrames(2);
      expect(s.readNextReg(0x6c), "$6C").toBe(defaultAttr);
      expect(tilemapMismatches(s, BANK, p, NONE)).toEqual([]);
    });
  }

  it("TM-005 - TM-008: palette offset, X / Y mirror and rotate - one asymmetric tile in all 8 orientations", async () => {
    // --- tile 1: nibble (x + 3y) mod 15 + ... avoid $F (the transparent index): values 0-14
    const bank = new Uint8Array(0x4000);
    const tile = 0x0c00 + 32; // --- tile base $4C00, tile 1
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) bank[tile + y * 4 + x / 2] = (((x + 3 * y) % 15) << 4) | ((x + 1 + 3 * y) % 15);
    // --- map row 0, columns 0-7: tile 1 with orientation bits 3-1 = column, palette offset column + 1
    for (let c = 0; c < 8; c++) {
      bank[0x2c00 + 2 * c] = 1;
      bank[0x2c00 + 2 * c + 1] = ((c + 1) << 4) | (c << 1);
    }
    const s = await tilemapScreen(bank);
    apply(s, TM_DEFAULT).runFrames(2);
    expect(tilemapMismatches(s, bank, TM_DEFAULT, NONE, [0, 7])).toEqual([]);
    // --- the orientations really differ (the test would pass on a core that ignored the bits otherwise)
    const firstRow = (c: number) => Array.from({ length: 8 }, (_, x) => tilemapIndex(bank, TM_DEFAULT, c * 8 + x, 0) & 0x0f).join(",");
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(firstRow)).size).toBeGreaterThanOrEqual(4);
  });

  it("TM-009 / TM-022: attribute bit 0 puts a tile below the ULA; the ULA shows where the tilemap is transparent", async () => {
    const s = await tilemapScreen(BANK);
    // --- ULA on: blank bitmap, PAPER 2 everywhere, border 5 (ULA palette)
    s.poke(0x4000, new Array(0x1800).fill(0x00)).poke(0x5800, new Array(768).fill(2 << 3));
    writePalette(s, [[18, 0x49], [21, 0x92]]);
    s.setNextReg(0x68, 0x00).out(0xfe, 5);
    // --- re-poke the tilemap: the ULA bitmap / attributes overwrote $4000-$5AFF (tiles at $4C00 are there)
    s.poke(0x5b00, BANK.slice(0x1b00));
    const bank = BANK.slice();
    bank.fill(0x00, 0, 0x1800);
    bank.fill(2 << 3, 0x1800, 0x1b00);
    apply(s, TM_DEFAULT).runFrames(2);
    const bad: string[] = [];
    for (let y = 0; y < 256 && bad.length < 8; y++) {
      for (let x = 0; x < 320 && bad.length < 8; x++) {
        const i = tilemapIndex(bank, TM_DEFAULT, x, y);
        const paper = x >= 32 && x < 288 && y >= 32 && y < 224;
        const ula = hex8(paper ? 0x49 : 0x92);
        const want = i >= 0 && !tilemapBelow(bank, { ...TM_DEFAULT, onTop: false }, x, y) ? hex8(i) : ula;
        if (s.pixel(32 + 2 * x, 16 + y) !== want) bad.push(`(${x},${y}) ${s.pixel(32 + 2 * x, 16 + y)} != ${want}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("TM-010: 512-tile mode takes tile bit 8 from attribute bit 0", async () => {
    expect(await check({ ...TM_DEFAULT, mode512: true, tileBase: 0x00 })).toEqual([]);
  });

  it("TM-010 / TM-012: in 512-tile mode every tile is below the ULA unless $6B bit 0 puts the tilemap on top", async () => {
    for (const onTop of [false, true]) {
      const s = await tilemapScreen(BANK);
      s.setNextReg(0x68, 0x00).out(0xfe, 5);
      writePalette(s, [[21, 0x92]]); // --- border 5; the paper area shows BANK as ULA data - check the border only
      const p = { ...TM_DEFAULT, mode512: true, tileBase: 0x00 };
      apply(s, p, onTop).runFrames(2);
      const bad: string[] = [];
      for (let y = 0; y < 256 && bad.length < 8; y++) {
        for (let x = 0; x < 320 && bad.length < 8; x++) {
          if (x >= 32 && x < 288 && y >= 32 && y < 224) continue;
          const i = tilemapIndex(BANK, p, x, y);
          const want = i >= 0 && onTop ? hex8(i) : hex8(0x92);
          if (s.pixel(32 + 2 * x, 16 + y) !== want) bad.push(`(${x},${y})`);
        }
      }
      expect(bad, `on top: ${onTop}`).toEqual([]);
    }
  });

  for (const [cols80, sx, sy] of [[false, 0, 0], [true, 0, 0], [false, 3, 5], [true, 5, 200]] as const) {
    it(`TM-011: text mode (1-bit tiles, attribute bits 7-1 the offset), ${cols80 ? 80 : 40} columns, scroll ${sx} / ${sy}`, async () => {
      expect(await check({ ...TM_DEFAULT, text: true, cols80, sx, sy })).toEqual([]);
    });
  }

  it("TM-010: without attributes, 512-tile mode takes tile bit 8 from $6C bit 0", async () => {
    expect(await check({ ...TM_DEFAULT, mode512: true, noAttr: true, defaultAttr: 0x31, tileBase: 0x00 })).toEqual([]);
  });

  it("TM-013: $4C compares the nibble before the offset; a standard pixel is not transparent by $14", async () => {
    const bank = new Uint8Array(0x4000);
    // --- tiles 1 and 2 all nibble 5 / 6; row 0: tile 1 attr $30 (index $35), tile 2 attr $30 (index $36)
    bank.fill(0x55, 0x0c00 + 32, 0x0c00 + 64);
    bank.fill(0x66, 0x0c00 + 64, 0x0c00 + 96);
    bank.set([1, 0x30, 2, 0x30], 0x2c00);
    const s = await tilemapScreen(bank);
    s.setNextReg(0x14, 0x36).setNextReg(0x4a, 0xe0); // --- $14 = colour of index $36
    apply(s, { ...TM_DEFAULT, transparentIndex: 5 }).runFrames(2);
    expect({ nibble5: colours(s, [32, 47], [16, 23]), index36: colours(s, [48, 63], [16, 23]) }).toEqual({
      nibble5: hex8(0xe0),
      index36: hex8(0x36)
    });
  });

  it("TM-014: in text mode $4C does not apply; a pixel whose colour equals $14 is transparent", async () => {
    const bank = new Uint8Array(0x4000);
    // --- tile 1 all ones, tile 2 all zeros; attr $40: indices $41 (tile 1) and $40 (tile 2)
    bank.fill(0xff, 0x0c00 + 8, 0x0c00 + 16);
    bank.set([1, 0x40, 2, 0x40], 0x2c00);
    const s = await tilemapScreen(bank);
    s.setNextReg(0x14, 0x41).setNextReg(0x4a, 0xe0);
    apply(s, { ...TM_DEFAULT, text: true, transparentIndex: 0 }).runFrames(2);
    expect({ ones: colours(s, [32, 47], [16, 23]), zeros: colours(s, [48, 63], [16, 23]) }).toEqual({
      ones: hex8(0xe0),
      zeros: hex8(0x40)
    });
  });

  for (const [cols80, sx, sy] of [[false, 1, 0], [false, 7, 0], [false, 100, 0], [false, 319, 0], [false, 0, 1], [false, 0, 255], [false, 37, 99], [true, 1, 0], [true, 320, 0], [true, 639, 17]] as const) {
    it(`TM-015 / TM-016: ${cols80 ? 80 : 40} columns, scroll X ${sx}, Y ${sy}`, async () => {
      const s = await tilemapScreen(BANK);
      const p = { ...TM_DEFAULT, cols80, sx, sy };
      apply(s, p).runFrames(2);
      expect([s.readNextReg(0x2f), s.readNextReg(0x30), s.readNextReg(0x31)], "readback").toEqual([sx >> 8, sx & 0xff, sy]);
      expect(tilemapMismatches(s, BANK, p, NONE)).toEqual([]);
    });
  }

  for (const cols80 of [false, true]) {
    it(`TM-017: the $1B clip window (x doubled) in ${cols80 ? 80 : 40} columns`, async () => {
      expect(await check({ ...TM_DEFAULT, cols80, clip: [10, 100, 20, 200] })).toEqual([]);
    });
  }

  it("TM-020: $6B bit 4 selects the second tilemap palette", async () => {
    const s = await tilemapScreen(BANK);
    writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i ^ 0x96] as [number, number]), 0x70);
    s.setNextReg(0x43, 0x00);
    apply(s, TM_DEFAULT, false, true).runFrames(2);
    expect(tilemapMismatches(s, BANK, TM_DEFAULT, NONE, [0, 255], (i) => hex8(i ^ 0x96))).toEqual([]);
  });

  /** Runs `before` at line 250 and `after` at line 96 of every frame (paper rows; tilemap row = paper + 32). */
  const splitProgram = (before: string, after: string) => `
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
${before}
        ld a,96
        call WaitLine
${after}
        jr Frame
WaitLine:
        ld e,a
        ld bc,$243b
        ld a,$1f
        out (c),a
        ld bc,$253b
WaitUntil:
        in a,(c)
        cp e
        jr nz,WaitUntil
        ret
  `;

  it("TM-023: a scroll change in mid-frame splits the picture", async () => {
    const s = await tilemapScreen(BANK);
    await s.loadCode(splitProgram("        nextreg $30,0", "        nextreg $30,64"), { entry: "Start" });
    apply(s, TM_DEFAULT).runUntilReady().runFrames(3);
    expect(tilemapMismatches(s, BANK, TM_DEFAULT, NONE, [0, 127]), "above").toEqual([]);
    expect(tilemapMismatches(s, BANK, { ...TM_DEFAULT, sx: 64 }, NONE, [129, 255]), "below").toEqual([]);
  });

  it("TM-025: the tilemap enabled in mid-frame covers the rows drawn after it", async () => {
    const s = await tilemapScreen(BANK);
    await s.loadCode(splitProgram("        nextreg $6b,$00", "        nextreg $6b,$80"), { entry: "Start" });
    s.runUntilReady().runFrames(3);
    expect(colours(s, [32, 671], [16, 16 + 127]), "above").toBe(NONE);
    expect(tilemapMismatches(s, BANK, TM_DEFAULT, NONE, [129, 255]), "below").toEqual([]);
  });

  /*
   * TM-024: the map of tilemap rows 0-31, column 0, is rewritten every frame: tile 0 at line 250, tile 1 at
   * line 96 (tilemap row 128 = tile row 16), in row order. Tile 0 all nibble 1, tile 1 all nibble 2, attr 0.
   */
  it("TM-024: map memory written in mid-frame shows below the beam in the same frame", async () => {
    const bank = new Uint8Array(0x4000);
    bank.fill(0x11, 0x0c00, 0x0c00 + 32);
    bank.fill(0x22, 0x0c00 + 32, 0x0c00 + 64);
    const s = await tilemapScreen(bank);
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        xor a
        call Column0
        ld a,96
        call WaitLine
        ld a,1
        call Column0
        jr Frame
; --- A = tile for column 0 of all 32 map rows ($6C00 + row * 80)
Column0:
        ld hl,$6c00
        ld de,80
        ld b,32
Col:    ld (hl),a
        add hl,de
        djnz Col
        ret
WaitLine:
        ld e,a
        ld bc,$243b
        ld a,$1f
        out (c),a
        ld bc,$253b
WaitUntil:
        in a,(c)
        cp e
        jr nz,WaitUntil
        ret
    `, { entry: "Start" });
    apply(s, TM_DEFAULT).runUntilReady().runFrames(3);
    // --- rows 0-127 (tile rows 0-15) were drawn before the write at paper row 96 = tilemap row 128
    expect({ before: colours(s, [32, 47], [16, 16 + 127]), after: colours(s, [32, 47], [16 + 136, 16 + 255]) }).toEqual({
      before: hex8(0x01),
      after: hex8(0x02)
    });
  });
});
