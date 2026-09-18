import { describe, expect, it } from "vitest";

import { ALL_CORES, rgb333ToHex, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { colours, fillScreen, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, pokeCell, writePalette } from "./_ula-helpers";

/*
 * ULA transparency and stencil mode (catalogue ULA-018, ULA-019).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~7046-7049: ula_transparent when ula_rgb(8:1) = $14 (the palette *output*, compared as RGB, so two
 *   palette indices holding the same colour are both transparent), when clipped, or when $68 bit 7
 *   disables the ULA. The border is a ULA pixel too.
 * - ~7061-7062: without stencil, the tilemap pixel wins where it is opaque and above the ULA.
 * - ~7058-7059, ~7076-7078: with $68 bit 0 and both the ULA and the tilemap enabled, the combined pixel
 *   is ula_rgb AND tm_rgb, and transparent when *either* is transparent.
 * - ~7065-7068: Layer 2 transparent when its RGB equals $14. A pixel with no opaque layer shows $4A.
 * - $15 bits 4-2 = 100 (~7139): ULA above sprites above Layer 2.
 */

const FALLBACK = 0x03;
const TRANSPARENT = 0x6d;

describe.each(ALL_CORES)("ULA transparency and stencil - %s core", (core: CoreName) => {
  it("ULA-018: a ULA colour equal to $14 (by RGB, from any index) shows Layer 2 underneath", async () => {
    const s = await parkedSession(core);
    const L2 = 0xfc;
    // --- ULA: ink 1 and ink 3 both hold the $14 colour; paper 2 opaque; border 5 holds the $14 colour
    writePalette(s, [[1, TRANSPARENT], [3, TRANSPARENT], [16 + 2, 0xe0], [16 + 5, TRANSPARENT]]);
    writePalette(s, [[1, L2]], 0x10); // --- first Layer 2 palette: index 1
    s.setNextReg(0x43, 0x00).setNextReg(0x14, TRANSPARENT).setNextReg(0x4a, FALLBACK);
    fillScreen(s, 0xf0, (2 << 3) | 1); // --- INK 1 (left half of each cell), PAPER 2
    for (let col = 16; col < 32; col++) for (let row = 0; row < 24; row++) s.poke(0x5800 + row * 32 + col, (2 << 3) | 3);
    // --- Layer 2 256x192 in 16K banks 8-10 ($12 reset value 8 = 8K pages 16-21): all pixel index 1
    for (let page = 16; page < 22; page++) s.setNextReg(0x56, page).poke(0xc000, new Array(0x2000).fill(1));
    s.setNextReg(0x56, 0x00).setNextReg(0x15, 0x10).out(0x123b, 0x02).out(0xfe, 5);
    s.runFrames(2);
    expect({
      ink1: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [48, 239]),
      ink3: colours(s, [PAPER_LEFT + 256, PAPER_LEFT + 263], [48, 239]),
      paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [48, 239]),
      border: colours(s, [0, 95], [48, 239])
    }).toEqual({ ink1: hex8(L2), ink3: hex8(L2), paper: hex8(0xe0), border: hex8(FALLBACK) });
    // --- with $14 changed, the same ink is opaque again
    s.setNextReg(0x14, 0xe3).runFrames(1);
    expect(colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [48, 239]), "$14 no longer matches").toBe(hex8(TRANSPARENT));
  });

  /*
   * Tilemap 40x32 (tile row r = paper row 8r - 32, tile column c = paper x 8c - 32): tile rows 4-11
   * (paper rows 0-63) hold opaque tile 1 in columns 4-19 (paper x 0-127) and transparent tile 0 elsewhere.
   * ULA paper is opaque on character rows 0-3 (paper rows 0-31) and equal to $14 on rows 4-7 (32-63).
   */
  async function stencilScreen(stencil: boolean): Promise<NextTestSession> {
    const s = await parkedSession(core);
    writePalette(s, [[16 + 6, 0xf3], [16 + 3, TRANSPARENT]]); // --- ULA PAPER 6 = $F3, PAPER 3 = $14
    writePalette(s, [[1, 0x5e]], 0x30); // --- first tilemap palette: index 1 = $5E
    s.setNextReg(0x43, 0x00).setNextReg(0x14, TRANSPARENT).setNextReg(0x4a, FALLBACK);
    fillScreen(s, 0x00, 6 << 3);
    for (let row = 4; row < 8; row++) for (let col = 0; col < 32; col++) pokeCell(s, row, col, 0x00, 3 << 3);
    // --- tile definitions at $7000: tile 0 all pixel 0, tile 1 all pixel 1; tilemap at $6000
    s.poke(0x7000, new Array(32).fill(0x00)).poke(0x7020, new Array(32).fill(0x11));
    s.poke(0x6000, new Array(2 * 40 * 32).fill(0));
    for (let row = 4; row < 12; row++) for (let col = 4; col < 20; col++) s.poke(0x6000 + row * 80 + col * 2, 1);
    s.setNextReg(0x4c, 0x00).setNextReg(0x6e, 0x20).setNextReg(0x6f, 0x30).setNextReg(0x6b, 0x80);
    s.setNextReg(0x68, stencil ? 0x01 : 0x00).out(0xfe, 6);
    return s.runFrames(2);
  }

  const quadrants = (s: NextTestSession) => {
    const q = (x: [number, number], y: [number, number]) =>
      colours(s, [PAPER_LEFT + 2 * x[0], PAPER_LEFT + 2 * x[1] + 1], [PAPER_TOP + y[0], PAPER_TOP + y[1]]);
    return {
      bothOpaque: q([0, 127], [0, 31]),
      tilemapTransparent: q([128, 255], [0, 31]),
      ulaTransparent: q([0, 127], [32, 63]),
      bothTransparent: q([128, 255], [32, 63])
    };
  };

  it("ULA-019: stencil mode shows ULA AND tilemap, transparent where either is", async () => {
    const s = await stencilScreen(true);
    // --- $F3 = 111 100 11(1), $5E = 010 111 10(1): AND = 010 100 101
    expect(quadrants(s)).toEqual({
      bothOpaque: rgb333ToHex(2, 4, 5),
      tilemapTransparent: hex8(FALLBACK),
      ulaTransparent: hex8(FALLBACK),
      bothTransparent: hex8(FALLBACK)
    });
  });

  it("ULA-019: without stencil mode the same screen merges normally", async () => {
    const s = await stencilScreen(false);
    expect(quadrants(s)).toEqual({
      bothOpaque: hex8(0x5e),
      tilemapTransparent: hex8(0xf3),
      ulaTransparent: hex8(0x5e),
      bothTransparent: hex8(FALLBACK)
    });
  });
});
