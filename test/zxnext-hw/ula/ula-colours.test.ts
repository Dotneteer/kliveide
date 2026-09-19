import { describe, expect, it } from "vitest";


import { colours, DISTINCT_32, fillScreen, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, pokeCell, writePalette } from "./_ula-helpers";

/*
 * Standard ULA colours (catalogue ULA-001 - ULA-003, ULA-016, ULA-017).
 *
 * Hardware (`_input/next-fpga/src/video/zxula.vhd` ~541-553, "Standard ULA"):
 *   ula_pixel = "000" & (not pixel_en) & attr(6) & (ink: attr(2:0) | paper: attr(5:3))
 * so ink is palette index 0-7, BRIGHT ink 8-15, paper 16-23, BRIGHT paper 24-31.
 * The border (~427, ~434) loads attr_reg with border_clr = "00" & border & border: BRIGHT 0, and
 * pixel_en is 0 in the border (~451), so border colour n is palette index 16 + n.
 * zxnext.vhd ~6771/~6927: the palette address is '0' & nr_43_active_ula_palette & ula_pixel, so $43
 * bit 1 picks which of the two ULA palettes is displayed; $43 bits 6-4 (~5367) pick the one written.
 *
 * FPGA palette RAM has no reset contents: every entry a test looks at is written first.
 */

/** Buffer rectangle of the ink (left half, bitmap $F0) or paper (right half) of a character cell. */
const half = (charRow: number, col: number, part: "ink" | "paper") => {
  const x0 = PAPER_LEFT + col * 16 + (part === "ink" ? 0 : 8);
  const y0 = PAPER_TOP + charRow * 8;
  return { x: [x0, x0 + 7] as [number, number], y: [y0, y0 + 7] as [number, number] };
};

describe("ULA colours", () => {
  it("ULA-001: border colour n shows palette entry 16 + n", async () => {
    const s = await parkedSession();
    writePalette(s, DISTINCT_32.map((v, i) => [i, v]));
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
    const seen: Record<number, string> = {};
    const want: Record<number, string> = {};
    for (let n = 0; n < 8; n++) {
      s.out(0xfe, n).runFrames(2);
      seen[n] = [colours(s, [0, 719], [0, 47]), colours(s, [0, 95], [48, 239]), colours(s, [608, 719], [48, 239])].join(" / ");
      const c = hex8(DISTINCT_32[16 + n]);
      want[n] = [c, c, c].join(" / ");
    }
    expect(seen).toEqual(want);
  });

  // --- ULA-002 / ULA-003: 16 character rows x 8 columns: ink = row & 7, paper = column,
  // --- BRIGHT from row 8. Bitmap $F0: the left 4 pixels of each cell are ink, the right 4 paper.
  it("ULA-002 / ULA-003: ink 0-7 x paper 0-7, with and without BRIGHT, use palette 0-31", async () => {
    const s = await parkedSession();
    writePalette(s, DISTINCT_32.map((v, i) => [i, v]));
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
    fillScreen(s, 0x00, 0x00);
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 8; col++) {
        pokeCell(s, row, col, 0xf0, (row >= 8 ? 0x40 : 0x00) | (col << 3) | (row & 7));
      }
    }
    s.runFrames(2);
    const seen: string[] = [];
    const want: string[] = [];
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 8; col++) {
        const bright = row >= 8 ? 8 : 0;
        const ink = half(row, col, "ink");
        const paper = half(row, col, "paper");
        seen.push(`r${row}c${col} ink ${colours(s, ink.x, ink.y)} paper ${colours(s, paper.x, paper.y)}`);
        want.push(`r${row}c${col} ink ${hex8(DISTINCT_32[bright + (row & 7)])} paper ${hex8(DISTINCT_32[16 + bright + col])}`);
      }
    }
    expect(seen).toEqual(want);
  });

  it("ULA-016: rewriting entries 16-23 changes paper and border, not ink", async () => {
    const s = await parkedSession();
    writePalette(s, DISTINCT_32.map((v, i) => [i, v]));
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
    fillScreen(s, 0xf0, 0x13); // --- PAPER 2, INK 3
    s.out(0xfe, 5).runFrames(2);
    const look = () => ({
      ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [48, 239]),
      paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [48, 239]),
      border: colours(s, [0, 95], [48, 239])
    });
    expect(look(), "before").toEqual({ ink: hex8(DISTINCT_32[3]), paper: hex8(DISTINCT_32[18]), border: hex8(DISTINCT_32[21]) });
    // --- new values, none among the first 32
    const fresh = [0x01, 0x02, 0x06, 0x0a, 0x0e, 0x12, 0x16, 0x1a].filter((v) => !DISTINCT_32.includes(v));
    expect(fresh.length).toBeGreaterThanOrEqual(6);
    writePalette(s, [[18, fresh[0]], [21, fresh[1]]]);
    s.runFrames(1);
    expect(look(), "after").toEqual({ ink: hex8(DISTINCT_32[3]), paper: hex8(fresh[0]), border: hex8(fresh[1]) });
  });

  it("ULA-017: $43 bit 1 shows the second ULA palette; bits 6-4 pick the one written", async () => {
    const s = await parkedSession();
    const first: Array<[number, number]> = [[3, 0xe0], [18, 0x1c], [21, 0x03]];
    const second: Array<[number, number]> = [[3, 0xfc], [18, 0x1f], [21, 0xa2]];
    writePalette(s, first, 0x00); // --- write the first ULA palette
    writePalette(s, second, 0x40); // --- write the second ULA palette ($43 bit 1 = 0: first displayed)
    s.setNextReg(0x14, 0x00).setNextReg(0x4a, 0x00);
    fillScreen(s, 0xf0, 0x13);
    s.out(0xfe, 5).runFrames(2);
    const look = () => ({
      ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [48, 239]),
      paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [48, 239]),
      border: colours(s, [0, 95], [48, 239])
    });
    expect(look(), "first palette").toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) });
    s.setNextReg(0x43, 0x02).runFrames(1);
    expect(look(), "second palette").toEqual({ ink: hex8(0xfc), paper: hex8(0x1f), border: hex8(0xa2) });
    s.setNextReg(0x43, 0x00).runFrames(1);
    expect(look(), "back to the first").toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) });
  });
});
