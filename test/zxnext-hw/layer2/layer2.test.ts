import { describe, expect, it } from "vitest";

import { type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, parkedSession, writePalette } from "../ula/_ula-helpers";
import { L2_DEFAULT, layer2Index, layer2Mismatches, layer2Screen, pokeBank, type L2 } from "./_layer2-helpers";

/*
 * Layer 2 (catalogue L2-001 - L2-024). The picture tests compare every pixel with the transcription of
 * layer2.vhd in `_layer2-helpers.ts`; the rest cite zxnext.vhd:
 * - ~3884-3913: $123B bit 1 enables the display (also $69 bit 7, ~3904), bit 3 selects the shadow bank
 *   for *paging* only; ~2924 / ~4203: the display always uses $12. ~4921: $12 resets to 8, $13 to 11;
 *   ~5196-5200: both are 7 bits.
 * - ~5452-5457: $70 bits 5-4 resolution, 3-0 palette offset; $71 bit 0 is scroll X bit 8.
 * - ~6995: bit 9 of a Layer 2 palette entry ($44 second byte bit 7) is the priority bit;
 *   ~7065-7068: Layer 2 is transparent when rgb(8:1) = $14 (8 bits: the blue LSB is not compared);
 *   ~7139-7230: in every $15 order a priority pixel is on top.
 * - layer2.vhd samples the enable, resolution, scroll and offset every pixel clock (i_CLK_7).
 */

const NONE = hex8(0xe3); // --- no Layer 2 pixel: the fallback, which has the transparent index's colour
const WIDE_CLIP: [number, number, number, number] = [0, 255, 0, 255];
/** $18 = x1, x2, y1, y2 (the reset window is 0, 255, 0, 191 - it clips the wide modes' bottom 64 rows) */
const clip18 = (s: NextTestSession, c: [number, number, number, number]) =>
  s.setNextReg(0x1c, 0x01).setNextReg(0x18, c[0]).setNextReg(0x18, c[1]).setNextReg(0x18, c[2]).setNextReg(0x18, c[3]);
const readL2 = (s: NextTestSession) => s.in(0x123b);

describe("Layer 2", () => {
  // --- L2-001 / L2-005: the whole 256x192 picture, i.e. every pixel address
  it("L2-001 / L2-005: $123B bit 1 shows 256x192 from bank $12 (reset 8), every pixel at its address", async () => {
    const { s, mem } = await layer2Screen();
    expect([s.readNextReg(0x12), s.readNextReg(0x13)], "$12 / $13 reset values").toEqual([8, 11]);
    s.runFrames(1);
    expect(colours(s, [96, 607], [48, 239]), "off").toBe(NONE);
    s.out(0x123b, 0x02).runFrames(2);
    expect(readL2(s) & 0x02, "$123B bit 1").toBe(0x02);
    expect(layer2Mismatches(s, mem, L2_DEFAULT, NONE)).toEqual([]);
  });

  it("L2-002: $69 bit 7 enables it too, and each register reads the other's write", async () => {
    const { s, mem } = await layer2Screen();
    s.setNextReg(0x69, 0x80).runFrames(2);
    expect(readL2(s) & 0x02, "$123B after $69").toBe(0x02);
    expect(layer2Mismatches(s, mem, L2_DEFAULT, NONE)).toEqual([]);
    s.out(0x123b, 0x00);
    expect(s.readNextReg(0x69) & 0x80, "$69 after $123B").toBe(0x00);
    s.runFrames(1);
    expect(colours(s, [96, 607], [48, 239]), "off again").toBe(NONE);
  });

  it("L2-003: $12 moves the displayed bank; L2-004: $13 does not", async () => {
    const { s, mem } = await layer2Screen(8, 8); // --- banks 8-15
    s.setNextReg(0x12, 12).out(0x123b, 0x02).runFrames(2);
    expect(s.readNextReg(0x12)).toBe(12);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, bank: 12 }, NONE), "$12 = 12").toEqual([]);
    s.setNextReg(0x13, 8).out(0x123b, 0x0a).runFrames(1); // --- shadow bank for paging (bit 3)
    expect(s.readNextReg(0x13)).toBe(8);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, bank: 12 }, NONE), "$13 = 8, $123B bit 3").toEqual([]);
  });

  it("L2-006: 320x256 is column-major over five 16K banks and covers the side and top/bottom borders", async () => {
    const { s, mem } = await layer2Screen();
    s.setNextReg(0x70, 0x10).out(0x123b, 0x02).runFrames(2);
    expect(s.readNextReg(0x70)).toBe(0x10);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, resolution: 1 }, NONE), "reset clip: rows 192-255 clipped").toEqual([]);
    clip18(s, WIDE_CLIP).runFrames(1);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, resolution: 1, clip: WIDE_CLIP }, NONE), "full window").toEqual([]);
  });

  it("L2-007: 640x256 shows two 4-bit pixels per byte, the high nibble first", async () => {
    const { s, mem } = await layer2Screen();
    clip18(s, WIDE_CLIP).setNextReg(0x70, 0x20).out(0x123b, 0x02).runFrames(2);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, resolution: 2, clip: WIDE_CLIP }, NONE)).toEqual([]);
  });

  for (const [resolution, offset] of [[0, 3], [1, 9], [2, 5]] as const) {
    it(`L2-008: palette offset ${offset} in ${["256x192", "320x256", "640x256"][resolution]} is added to the high nibble`, async () => {
      const { s, mem } = await layer2Screen();
      if (resolution) clip18(s, WIDE_CLIP);
      s.setNextReg(0x70, (resolution << 4) | offset).out(0x123b, 0x02).runFrames(2);
      expect(s.readNextReg(0x70)).toBe((resolution << 4) | offset);
      const p: L2 = { ...L2_DEFAULT, resolution, offset, clip: [0, 255, 0, resolution ? 255 : 191] };
      expect(layer2Mismatches(s, mem, p, NONE)).toEqual([]);
    });
  }

  for (const [sx, sy] of [[1, 0], [255, 0], [0, 1], [0, 191], [0, 200], [100, 150]]) {
    it(`L2-009 / L2-010: 256x192 scroll $16 = ${sx}, $17 = ${sy}`, async () => {
      const { s, mem } = await layer2Screen();
      s.setNextReg(0x16, sx).setNextReg(0x17, sy).out(0x123b, 0x02).runFrames(2);
      expect([s.readNextReg(0x16), s.readNextReg(0x17)]).toEqual([sx, sy]);
      expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, sx, sy }, NONE)).toEqual([]);
    });
  }

  for (const [resolution, sx, sy] of [[1, 1, 0], [1, 255, 0], [1, 256, 0], [1, 319, 0], [1, 511, 0], [1, 0, 1], [1, 0, 255], [2, 300, 100], [2, 1, 0]] as const) {
    it(`L2-011 / L2-012: ${resolution === 1 ? "320x256" : "640x256"} scroll X ${sx} ($71 = ${sx >> 8}), Y ${sy}`, async () => {
      const { s, mem } = await layer2Screen();
      clip18(s, WIDE_CLIP).setNextReg(0x70, resolution << 4).setNextReg(0x16, sx & 0xff).setNextReg(0x71, sx >> 8).setNextReg(0x17, sy);
      s.out(0x123b, 0x02).runFrames(2);
      expect(s.readNextReg(0x71)).toBe(sx >> 8);
      expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, resolution, sx, sy, clip: [0, 255, 0, 255] }, NONE)).toEqual([]);
    });
  }

  it("L2-013: the clip window $18 in 256x192 (display pixels, inclusive); four writes cycle, $1C bit 0 resets", async () => {
    const { s, mem } = await layer2Screen();
    s.setNextReg(0x1c, 0x01).setNextReg(0x18, 16).setNextReg(0x18, 200).setNextReg(0x18, 10).setNextReg(0x18, 100);
    expect(s.readNextReg(0x1c) & 0x03, "$1C bits 1-0: index wrapped").toBe(0x00);
    expect(s.readNextReg(0x18), "x1 at index 0").toBe(16);
    s.out(0x123b, 0x02).runFrames(2);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, clip: [16, 200, 10, 100] }, NONE)).toEqual([]);
  });

  for (const resolution of [1, 2] as const) {
    it(`L2-014: in ${resolution === 1 ? "320x256" : "640x256"} the clip x values are doubled (x1*2 .. x2*2+1)`, async () => {
      const { s, mem } = await layer2Screen();
      s.setNextReg(0x70, resolution << 4);
      s.setNextReg(0x1c, 0x01).setNextReg(0x18, 10).setNextReg(0x18, 150).setNextReg(0x18, 20).setNextReg(0x18, 230);
      s.out(0x123b, 0x02).runFrames(2);
      expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, resolution, clip: [10, 150, 20, 230] }, NONE)).toEqual([]);
    });
  }

  it("L2-015: transparency compares 8 bits: entries differing only in the blue LSB are both transparent; after the offset", async () => {
    const s = await parkedSession();
    // --- raw pixels $01 / $02 / $03 in rows 0-63 / 64-127 / 128-191; palette offset 2 makes them $21 /
    // --- $22 / $23. $21 and $22 hold $6D with blue LSB 0 and 1; $23 holds $6D; the raw indices are green.
    pokeBank(s, 8, new Uint8Array(0x4000).fill(0x01));
    pokeBank(s, 9, new Uint8Array(0x4000).fill(0x02));
    pokeBank(s, 10, new Uint8Array(0x4000).fill(0x03));
    s.setNextReg(0x43, 0x10);
    for (const [index, lsb] of [[0x21, 0], [0x22, 1], [0x23, 0]]) s.setNextReg(0x40, index).setNextReg(0x44, 0x6d).setNextReg(0x44, lsb);
    for (const index of [0x01, 0x02, 0x03]) s.setNextReg(0x40, index).setNextReg(0x44, 0x1c).setNextReg(0x44, 0x00);
    s.setNextReg(0x43, 0x00).setNextReg(0x14, 0x6d).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80);
    s.setNextReg(0x70, 0x02).out(0x123b, 0x02).runFrames(2);
    expect({
      lsb0: colours(s, [96, 607], [48, 111]),
      lsb1: colours(s, [96, 607], [112, 175]),
      afterOffset: colours(s, [96, 607], [176, 239])
    }).toEqual({ lsb0: hex8(0xe0), lsb1: hex8(0xe0), afterOffset: hex8(0xe0) });
  });

  /*
   * L2-016: a sprite (colour S) and the ULA paper (colour U) cover cell rows 2-3 (paper y 16-31, x 16-31);
   * Layer 2 (colour L) everywhere. Without the priority bit the order decides; with it Layer 2 is on top
   * in every order.
   */
  for (const [order, name, top] of [[0, "SLU", "S"], [1, "LSU", "L"], [2, "SUL", "S"], [3, "LUS", "L"], [4, "USL", "U"], [5, "ULS", "U"]] as const) {
    it(`L2-016: $15 order ${name}: the priority bit puts Layer 2 on top (without it: ${top})`, async () => {
      const s = await parkedSession();
      const COL = { S: 0xe0, L: 0x1c, U: 0x03 };
      // --- ULA: paper 2 everywhere
      s.poke(0x4000, new Array(0x1800).fill(0)).poke(0x5800, new Array(768).fill(2 << 3));
      writePalette(s, [[16 + 2, COL.U]]);
      // --- Layer 2: index 5 everywhere, entry 5 = L (priority bit set or not below)
      for (const b of [8, 9, 10]) pokeBank(s, b, new Uint8Array(0x4000).fill(5));
      // --- sprite 0: 16x16 of index 1 at paper (16, 16); sprite palette entry 1 = S
      writePalette(s, [[1, COL.S]], 0x20);
      s.out(0x303b, 0x00);
      for (let i = 0; i < 256; i++) s.out(0x005b, 0x01);
      s.out(0x303b, 0x00).out(0x0057, 32 + 16).out(0x0057, 32 + 16).out(0x0057, 0x00).out(0x0057, 0x80);
      s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x15, (order << 2) | 0x01).out(0x123b, 0x02);
      const area = () => colours(s, [96 + 34, 96 + 60], [48 + 17, 48 + 30]);
      const setL = (priority: boolean) => s.setNextReg(0x43, 0x10).setNextReg(0x40, 5).setNextReg(0x44, COL.L).setNextReg(0x44, priority ? 0x80 : 0x00).setNextReg(0x43, 0x00);
      setL(false);
      s.runFrames(2);
      expect(area(), "no priority").toBe(hex8(COL[top]));
      setL(true);
      s.runFrames(1);
      expect(area(), "priority").toBe(hex8(COL.L));
    });
  }

  it("L2-017: $43 bit 2 selects the second Layer 2 palette", async () => {
    const { s, mem } = await layer2Screen();
    writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i ^ 0xa5] as [number, number]), 0x50); // --- second L2 palette
    s.setNextReg(0x43, 0x04).out(0x123b, 0x02).runFrames(2);
    const bad: string[] = [];
    for (let y = 0; y < 192 && bad.length < 8; y += 3) {
      for (let x = 0; x < 256 && bad.length < 8; x += 5) {
        const i = layer2Index(mem, L2_DEFAULT, x, y);
        const c = i ^ 0xa5;
        const want = hex8(c === 0xe3 ? 0xe3 : c);
        if (s.pixel(96 + 2 * x, 48 + y) !== want) bad.push(`(${x},${y})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("L2-018: 256x192 stays inside the paper; the border shows the ULA border", async () => {
    const { s } = await layer2Screen();
    writePalette(s, [[16 + 3, 0xfc]]);
    s.setNextReg(0x68, 0x00).out(0xfe, 3).out(0x123b, 0x02).runFrames(2);
    expect([colours(s, [0, 95], [0, 287]), colours(s, [608, 719], [0, 287]), colours(s, [0, 719], [0, 47]), colours(s, [0, 719], [240, 287])]).toEqual(
      Array(4).fill(hex8(0xfc))
    );
  });

  /** A program that runs `before` at line 250 and `after` at line 96 every frame. */
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

  it("L2-019: Layer 2 enabled in mid-frame covers the rows drawn after it", async () => {
    const { s, mem } = await layer2Screen();
    await s.loadCode(splitProgram("        nextreg $69,$00", "        nextreg $69,$80"), { entry: "Start" });
    s.runUntilReady().runFrames(3);
    expect(colours(s, [96, 607], [48, 48 + 95]), "rows 0-95").toBe(NONE);
    expect(layer2Mismatches(s, mem, L2_DEFAULT, NONE, [97, 191]), "rows 97-191").toEqual([]);
  });

  it("L2-020: a scroll change in mid-frame splits the picture", async () => {
    const { s, mem } = await layer2Screen();
    await s.loadCode(splitProgram("        nextreg $16,0", "        nextreg $16,64"), { entry: "Start" });
    s.out(0x123b, 0x02).runUntilReady().runFrames(3);
    expect(layer2Mismatches(s, mem, L2_DEFAULT, NONE, [0, 95]), "rows 0-95").toEqual([]);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, sx: 64 }, NONE, [97, 191]), "rows 97-191").toEqual([]);
  });

  it("L2-022: a resolution change in mid-frame applies from the rows drawn after it", async () => {
    const { s, mem } = await layer2Screen();
    await s.loadCode(splitProgram("        nextreg $70,$00", "        nextreg $70,$10"), { entry: "Start" });
    clip18(s, WIDE_CLIP).out(0x123b, 0x02).runUntilReady().runFrames(3);
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, clip: WIDE_CLIP }, NONE, [0, 95]), "256x192 above").toEqual([]);
    // --- paper rows 97-191 are wide rows 129-223
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, resolution: 1, clip: [0, 255, 0, 255] }, NONE, [129, 223]), "320x256 below").toEqual([]);
  });

  /*
   * L2-021: at line 250 the program clears column 0 of all 192 Layer 2 rows, at line 96 it writes $1C
   * there, in row order, through MMU slot 6 (46 T-states and a page switch per row: rows 0-95 are behind
   * the beam, rows from ~130 ahead of it).
   */
  it("L2-021: Layer 2 memory written in mid-frame shows below the beam in the same frame", async () => {
    const s = await parkedSession();
    for (const b of [8, 9, 10]) pokeBank(s, b, new Uint8Array(0x4000).fill(0x03));
    writePalette(s, [[0x03, 0x03], [0x1c, 0x1c]], 0x10);
    s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x68, 0x80);
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        ld a,$03
        call Column0
        ld a,96
        call WaitLine
        ld a,$1c
        call Column0
        jr Frame

; --- A = value for pixel (0, y) of every row y: page 16 + y / 32, offset (y mod 32) * 256
Column0:
        ld c,a
        ld d,16                  ; page
        ld b,6                   ; 6 pages of 32 rows
Page:   ld a,d
        nextreg $56,a
        ld hl,$c000
        ld e,32
Row:    ld (hl),c
        inc h
        dec e
        jr nz,Row
        inc d
        djnz Page
        nextreg $56,0
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
    s.out(0x123b, 0x02).runUntilReady().runFrames(3);
    expect({ before: colours(s, [96, 97], [48, 48 + 95]), after: colours(s, [96, 97], [48 + 140, 48 + 191]) }).toEqual({
      before: hex8(0x03),
      after: hex8(0x1c)
    });
  });

  it("L2-023: with $123B bits 0-1, writes to $0000 land in the displayed bank while reads still see the ROM", async () => {
    const { s } = await layer2Screen();
    pokeBank(s, 8, new Uint8Array(0x4000).fill(0x00));
    const rom0 = s.peek(0x0000);
    await s.loadCode(`
        .org $8000
Start:  di
        ld bc,$123b
        ld a,$03                 ; write mapping + display, segment 0
        out (c),a
        ld a,$1c
        ld ($0000),a             ; pixel (0, 0)
        ld ($00ff),a             ; pixel (255, 0)
        ld ($3f00),a             ; pixel (0, 63)
        ld a,($0000)
        ld (Read),a
        nextreg $7f,$a5
        jr $
Read:   .defb 0
    `, { entry: "Start" });
    s.runUntilReady().runFrames(1);
    expect(s.peek(s.symbol("Read")), "the read sees the ROM").toBe(rom0);
    expect([s.pixel(96, 48), s.pixel(96 + 510, 48), s.pixel(96, 48 + 63), s.pixel(98, 48)]).toEqual([hex8(0x1c), hex8(0x1c), hex8(0x1c), hex8(0x00)]);
  });

  it("L2-024: banks past the 2 MB SRAM (bank + 16 >= 128) show no pixel; $12 keeps 7 bits", async () => {
    const { s, mem } = await layer2Screen(110, 2); // --- banks 110, 111: the last two
    s.setNextReg(0x12, 0xee);
    expect(s.readNextReg(0x12), "7 bits").toBe(0x6e);
    s.out(0x123b, 0x02).runFrames(2);
    // --- rows 0-127 from banks 110-111; rows 128-191 would be bank 112: past the SRAM
    expect(layer2Mismatches(s, mem, { ...L2_DEFAULT, bank: 110 }, NONE)).toEqual([]);
    expect(colours(s, [96, 607], [48 + 128, 48 + 191]), "rows 128-191").toBe(NONE);
  });
});

