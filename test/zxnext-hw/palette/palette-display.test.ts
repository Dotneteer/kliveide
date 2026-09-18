import { describe, expect, it } from "vitest";

import { ALL_CORES, rgb333ToHex, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { pokeBank } from "../layer2/_layer2-helpers";
import { colours, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "../ula/_ula-helpers";

/*
 * What the palettes do to the picture (catalogue PAL-009, PAL-010, PAL-014 - PAL-016).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~6771-6774, ~6927, ~6979: the displayed palettes are $43 bit 1 (ULA and LoRes), bit 2 (Layer 2),
 *   bit 3 (sprites) and $6B bit 4 (tilemap); they are part of the pixel address and have nothing to do
 *   with the write select in $43 bits 6-4.
 * - ~6933, ~6948, ~6985-6997: the colour of a ULA, LoRes, tilemap or sprite pixel is RAM word bits 8-0.
 *   Only Layer 2 takes a priority bit (word bit 15 = bit 7 of the second $44 byte); bit 6 (word bit 14)
 *   is never displayed.
 * - ~7046, ~7055, ~7067: ULA (LoRes included), tilemap text-mode and Layer 2 pixels are transparent when
 *   colour(8:1) = $14 - the 8 upper bits of the 9-bit colour, so the blue LSB does not take part.
 * - A palette write is a RAM write the display reads on its next lookup: a change in mid-frame shows from
 *   the next pixel drawn.
 *
 * The screen is 720 x 288 buffer pixels (test/harness/zxnext/core/beam.ts): paper pixel (x, y) is buffer
 * (96 + 2x, 48 + y); tilemap / wide Layer 2 x from buffer x 32, y from row 16.
 */

/** Buffer colour of a 9-bit RRRGGGBBB colour. */
const hex9 = (v: number) => rgb333ToHex((v >> 6) & 7, (v >> 3) & 7, v & 7);

/** Writes 9-bit palette entries through $40/$44 into write select `sel`; `prio` goes to bits 7-6 of byte 2. */
function write9(s: NextTestSession, sel: number, entries: Array<[number, number]>, prio = 0): NextTestSession {
  s.setNextReg(0x43, sel << 4);
  for (const [index, v9] of entries) s.setNextReg(0x40, index).setNextReg(0x44, v9 >> 1).setNextReg(0x44, (v9 & 1) | prio);
  return s;
}

/** Paper columns [x0, x1] and rows [y0, y1] as buffer rectangles. */
const paper = (s: NextTestSession, x: [number, number], y: [number, number]) =>
  colours(s, [PAPER_LEFT + 2 * x[0], PAPER_LEFT + 2 * x[1] + 1], [PAPER_TOP + y[0], PAPER_TOP + y[1]]);

// ---------------------------------------------------------------------------------------------------
// PAL-009 / PAL-016: all four palettes on one screen
// ---------------------------------------------------------------------------------------------------

/*
 * Paper columns 0-63: Layer 2 (clipped by $18); 64-79 x rows 0-15: sprite 0; 128-191: tilemap (clipped
 * by $1B); 192-255: the ULA, which is under everything else. Every layer draws palette index 1.
 * Write selects: 0 ULA 1, 1 Layer 2 1, 2 sprites 1, 3 tilemap 1, 4-7 the second palettes.
 */
const INDEX1 = [0x1c1, 0x039, 0x007, 0x0b7, 0x1f9, 0x125, 0x16d, 0x093]; // --- 9-bit, by write select

async function fourLayers(core: CoreName, prio: number): Promise<NextTestSession> {
  const s = await parkedSession(core);
  for (let sel = 0; sel < 8; sel++) write9(s, sel, [[1, INDEX1[sel]]], sel === 1 || sel === 5 ? 0 : prio);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0x00).setNextReg(0x4b, 0xe3).setNextReg(0x4c, 0x0f);
  // --- ULA: every pixel ink 1
  s.poke(0x4000, new Array(0x1800).fill(0xff)).poke(0x5800, new Array(768).fill(0x01)).out(0xfe, 0);
  // --- Layer 2 256x192 from 16K banks 8-10, every pixel index 1, clip x 0-63
  for (const b of [8, 9, 10]) pokeBank(s, b, new Uint8Array(0x4000).fill(0x01));
  s.setNextReg(0x1c, 0x01).setNextReg(0x18, 0).setNextReg(0x18, 63).setNextReg(0x18, 0).setNextReg(0x18, 191);
  s.out(0x123b, 0x02);
  // --- sprite 0: pattern 0 all index 1, at paper (64, 0)
  s.out(0x303b, 0x00);
  for (let i = 0; i < 256; i++) s.out(0x5b, 0x01);
  s.out(0x303b, 0x00);
  for (const b of [96, 32, 0x00, 0x80]) s.out(0x57, b);
  // --- tilemap 40x32 with attributes: map $6C00 all tile 0 / attr 0; tile 0 at $6000 all nibble 1
  s.poke(0x6c00, new Array(40 * 32 * 2).fill(0x00)).poke(0x6000, new Array(32).fill(0x11));
  s.setNextReg(0x6e, 0x2c).setNextReg(0x6f, 0x20);
  s.setNextReg(0x1c, 0x08).setNextReg(0x1b, 80).setNextReg(0x1b, 111).setNextReg(0x1b, 32).setNextReg(0x1b, 223);
  return s.setNextReg(0x15, 0x01);
}

function regions(s: NextTestSession) {
  return {
    layer2: paper(s, [0, 63], [0, 191]),
    sprite: paper(s, [64, 79], [0, 15]),
    tilemap: paper(s, [128, 191], [0, 191]),
    ula: paper(s, [192, 255], [0, 191])
  };
}

function expected(ula2: number, l22: number, spr2: number, tm2: number) {
  return {
    layer2: hex9(INDEX1[1 + 4 * l22]),
    sprite: hex9(INDEX1[2 + 4 * spr2]),
    tilemap: hex9(INDEX1[3 + 4 * tm2]),
    ula: hex9(INDEX1[0 + 4 * ula2])
  };
}

describe.each(ALL_CORES)("palette display - %s core", (core: CoreName) => {
  it("PAL-009: $43 bits 3-1 and $6B bit 4 pick the displayed palettes, whatever the write select", async () => {
    const s = await fourLayers(core, 0);
    const bad: string[] = [];
    for (let combo = 0; combo < 16; combo++) {
      const [ula2, l22, spr2, tm2] = [combo & 1, (combo >> 1) & 1, (combo >> 2) & 1, (combo >> 3) & 1];
      const writeSelect = (combo * 3) & 7;
      s.setNextReg(0x43, (writeSelect << 4) | (spr2 << 3) | (l22 << 2) | (ula2 << 1));
      s.setNextReg(0x6b, 0x80 | (tm2 << 4)).runFrames(2);
      const got = regions(s);
      const want = expected(ula2, l22, spr2, tm2);
      if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`combo ${combo}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
    expect(bad).toEqual([]);
  });

  it("PAL-016: bits 7-6 of the second $44 byte do not change a ULA, sprite or tilemap colour", async () => {
    const s = await fourLayers(core, 0xc0);
    for (const combo of [0, 15]) {
      const b = combo ? 1 : 0;
      s.setNextReg(0x43, (b << 3) | (b << 2) | (b << 1)).setNextReg(0x6b, 0x80 | (b << 4)).runFrames(2);
      expect(regions(s), `${combo ? "second" : "first"} palettes`).toEqual(expected(b, b, b, b));
    }
  });

  // -------------------------------------------------------------------------------------------------
  // PAL-010: the $14 compare uses colour bits 8-1
  // -------------------------------------------------------------------------------------------------

  // --- T: the transparent colour; T9A / T9B: both 9-bit colours with T in bits 8-1; NEAR: bit 1 differs
  const T = 0x6d;
  const T9A = T << 1;
  const T9B = (T << 1) | 1;
  const NEAR = ((T ^ 1) << 1) | 1;
  const FALLBACK = 0x03;

  for (const prio of [0x00, 0xc0]) {
    const tag = prio ? " (priority bits set on the entries)" : "";

    it(`PAL-010: ULA - both 9-bit colours with $14 in bits 8-1 are transparent, one differing in bit 1 is not${tag}`, async () => {
      const s = await parkedSession(core);
      write9(s, 0, [[1, T9A], [16 + 2, T9B], [3, NEAR], [16 + 5, 0x1ff]], prio);
      s.setNextReg(0x43, 0x00).setNextReg(0x14, T).setNextReg(0x4a, FALLBACK);
      // --- bitmap $F0: ink on the left half of every cell; columns 0-15 ink 1, 16-31 ink 3, paper 2
      s.poke(0x4000, new Array(0x1800).fill(0xf0));
      for (let row = 0; row < 24; row++) {
        for (let col = 0; col < 32; col++) s.poke(0x5800 + row * 32 + col, (2 << 3) | (col < 16 ? 1 : 3));
      }
      s.out(0xfe, 5).runFrames(2);
      expect({
        left: paper(s, [0, 127], [0, 191]),
        rightInk: colours(s, [PAPER_LEFT + 256, PAPER_LEFT + 263], [PAPER_TOP, PAPER_TOP + 191]),
        rightPaper: colours(s, [PAPER_LEFT + 264, PAPER_LEFT + 271], [PAPER_TOP, PAPER_TOP + 191])
      }).toEqual({ left: hex8(FALLBACK), rightInk: hex9(NEAR), rightPaper: hex8(FALLBACK) });
    });

    it(`PAL-010: LoRes - the same 8-bit compare${tag}`, async () => {
      const s = await parkedSession(core);
      write9(s, 0, [[1, T9A], [2, T9B], [3, NEAR]], prio);
      s.setNextReg(0x43, 0x00).setNextReg(0x14, T).setNextReg(0x4a, FALLBACK);
      // --- 128 bytes a LoRes row: x 0-41 index 1, 42-83 index 2, 84-127 index 3 (rows 0-47 from $4000)
      const row = Array.from({ length: 128 }, (_, x) => (x < 42 ? 1 : x < 84 ? 2 : 3));
      for (let y = 0; y < 48; y++) s.poke(0x4000 + y * 128, row);
      s.setNextReg(0x6a, 0x00).setNextReg(0x15, 0x80).runFrames(2);
      expect({
        index1: paper(s, [0, 83], [0, 95]),
        index2: paper(s, [84, 167], [0, 95]),
        index3: paper(s, [168, 255], [0, 95])
      }).toEqual({ index1: hex8(FALLBACK), index2: hex8(FALLBACK), index3: hex9(NEAR) });
    });

    it(`PAL-010: tilemap text mode - the same 8-bit compare${tag}`, async () => {
      const s = await parkedSession(core);
      // --- attribute 0: bit 1 -> index 1, bit 0 -> index 0; attribute 2: bit 1 -> index 3, bit 0 -> index 2
      write9(s, 3, [[0, T9A], [1, T9B], [2, T9A], [3, NEAR]], prio);
      s.setNextReg(0x43, 0x00).setNextReg(0x14, T).setNextReg(0x4a, FALLBACK).setNextReg(0x68, 0x80);
      const map: number[] = [];
      for (let r = 0; r < 32; r++) for (let c = 0; c < 40; c++) map.push(0, c & 1 ? 2 : 0);
      s.poke(0x6c00, map).poke(0x6000, new Array(8).fill(0xf0)); // --- tile 0: left 4 pixels set
      s.setNextReg(0x6e, 0x2c).setNextReg(0x6f, 0x20).setNextReg(0x6b, 0x88).runFrames(2);
      // --- column c covers buffer x 32 + 16c .. 47 + 16c; rows 16-271
      const col = (c: number, half: 0 | 1) => colours(s, [32 + 16 * c + 8 * half, 39 + 16 * c + 8 * half], [16, 271]);
      expect({
        even: [col(0, 0), col(0, 1), col(38, 0), col(38, 1)],
        odd: [col(1, 0), col(1, 1), col(39, 0), col(39, 1)]
      }).toEqual({
        even: new Array(4).fill(hex8(FALLBACK)),
        odd: [hex9(NEAR), hex8(FALLBACK), hex9(NEAR), hex8(FALLBACK)]
      });
    });
  }

  // -------------------------------------------------------------------------------------------------
  // PAL-014: a palette entry changed in mid-frame
  // -------------------------------------------------------------------------------------------------

  it("PAL-014: a ULA palette entry rewritten from the CPU at line 96 recolours the rows drawn after it", async () => {
    const s = await parkedSession(core);
    writePalette(s, [[1, 0xe0]]);
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0x00);
    s.poke(0x4000, new Array(0x1800).fill(0xff)).poke(0x5800, new Array(768).fill(0x01));
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $43,$00
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        nextreg $40,1
        nextreg $41,$e0
        ld a,96
        call WaitLine
        nextreg $40,1
        nextreg $44,$0e
        nextreg $44,$01
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
      `,
      { entry: "Start" }
    );
    s.runUntilReady().runFrames(3);
    expect({ above: paper(s, [0, 255], [0, 95]), below: paper(s, [0, 255], [97, 191]) }).toEqual({
      above: hex8(0xe0),
      below: hex9(0x1d)
    });
  });

  // -------------------------------------------------------------------------------------------------
  // PAL-015: all 512 colours
  // -------------------------------------------------------------------------------------------------

  it("PAL-015: each of the 512 9-bit colours shows as its 3-to-8 bit expansion", async () => {
    const s = await parkedSession(core);
    // --- Layer 2 256x192: pixel (x, y) = index x; palette 1 entry i = colour i, palette 2 entry i = 256 + i
    const bank = new Uint8Array(0x4000).map((_, a) => a & 0xff);
    for (const b of [8, 9, 10]) pokeBank(s, b, bank);
    for (const sel of [1, 5]) {
      write9(s, sel, Array.from({ length: 256 }, (_, i) => [i, (sel === 5 ? 256 : 0) + i] as [number, number]));
    }
    s.setNextReg(0x68, 0x80).out(0x123b, 0x02);
    const bad: string[] = [];
    // --- no colour of the palette on show has $14 in bits 8-1: palette 1 is below $100, palette 2 above $FF
    for (const [second, transparent] of [[0, 0xff], [1, 0x00]]) {
      s.setNextReg(0x43, second << 2).setNextReg(0x14, transparent).runFrames(2);
      for (let x = 0; x < 256 && bad.length < 8; x++) {
        const want = hex9(second * 256 + x);
        for (const y of [0, 63, 100, 191]) {
          const got = [s.pixel(PAPER_LEFT + 2 * x, PAPER_TOP + y), s.pixel(PAPER_LEFT + 2 * x + 1, PAPER_TOP + y)];
          if (got[0] !== want || got[1] !== want) {
            bad.push(`colour $${(second * 256 + x).toString(16)} at (${x},${y}): ${got.join("/")} != ${want}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
