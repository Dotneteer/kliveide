import { describe, expect, it } from "vitest";

import { ALL_CORES, type CoreName } from "../../harness/zxnext";
import { colours, fillScreen, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * FLASH and the display file layout (catalogue ULA-004, ULA-005).
 *
 * Hardware (`_input/next-fpga/src/video/zxula.vhd`):
 * - ~453-462: flash_cnt (5 bits) counts once per frame, at hc = 0 / vc = 0; ~451:
 *   pixel_en = shift_reg(15) xor (attr(7) and flash_cnt(4) ...), so a FLASH cell swaps ink and paper
 *   every 16 frames - a 32-frame period. The counter has no reset value, so only the period is checked.
 * - ~222-223: pixel address = "0" & py(7:6) & py(2:0) & py(5:3) & column,
 *   attribute address = "110" & py(7:3) & column (bank 5 offsets, i.e. + $4000).
 */

const PALETTE: Array<[number, number]> = [[0, 0x00], [7, 0xb6], [16, 0x00], [23, 0xb6], [2, 0xe0], [16 + 4, 0x1c]];

describe.each(ALL_CORES)("ULA FLASH and layout - %s core", (core: CoreName) => {
  it("ULA-004: a FLASH cell swaps ink and paper every 16 frames; a steady cell never does", async () => {
    const s = await parkedSession(core);
    writePalette(s, [[2, 0xe0], [20, 0x1c], [3, 0x03], [21, 0xfc]]);
    s.setNextReg(0x14, 0x00).setNextReg(0x4a, 0x00);
    fillScreen(s, 0x00, 0x00);
    // --- bitmap $F0 in cells (0,0) and (0,1): (0,0) FLASH INK 2 PAPER 4, (0,1) INK 3 PAPER 5 steady
    for (let line = 0; line < 8; line++) s.poke(0x4000 + (line << 8), [0xf0, 0xf0]);
    s.poke(0x5800, [0x80 | (4 << 3) | 2, (5 << 3) | 3]);
    s.runFrames(2);
    const flashLeft: string[] = [];
    const steadyLeft = new Set<string>();
    for (let f = 0; f < 72; f++) {
      s.runFrames(1);
      flashLeft.push(colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP, PAPER_TOP + 7]));
      steadyLeft.add(colours(s, [PAPER_LEFT + 16, PAPER_LEFT + 23], [PAPER_TOP, PAPER_TOP + 7]));
    }
    expect([...steadyLeft], "steady cell").toEqual([hex8(0x03)]);
    expect(new Set(flashLeft), "flash cell shows ink or paper only").toEqual(new Set([hex8(0xe0), hex8(0x1c)]));
    // --- lengths of the runs of one state, without the first (it may be partial) and the last
    const runs: number[] = [];
    let len = 1;
    for (let i = 1; i < flashLeft.length; i++) {
      if (flashLeft[i] === flashLeft[i - 1]) len++;
      else {
        runs.push(len);
        len = 1;
      }
    }
    expect(runs.length, JSON.stringify(runs)).toBeGreaterThanOrEqual(4);
    expect(runs.slice(1).every((r) => r === 16), JSON.stringify(runs)).toBe(true);
  });

  it("ULA-005: display file and attribute bytes appear at the VHDL-computed positions", async () => {
    const s = await parkedSession(core);
    writePalette(s, PALETTE);
    s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
    fillScreen(s, 0x00, 0x38); // --- PAPER 7, INK 0, blank bitmap
    s.out(0xfe, 0);
    /** zxula.vhd ~222: the display file offset of pixel row py, column byte col */
    const pixelOffset = (py: number, col: number) =>
      (((py >> 6) & 3) << 11) | ((py & 7) << 8) | (((py >> 3) & 7) << 5) | col;
    // --- a byte $80 (leftmost pixel) at these addresses; the row/column they must land on
    const bytes = [0x4000, 0x47ff, 0x57ff, 0x4820, 0x4a45, 0x5000 + 0x0321];
    const expected = bytes.map((addr) => {
      for (let py = 0; py < 192; py++) for (let col = 0; col < 32; col++) if (pixelOffset(py, col) === addr - 0x4000) return { py, col };
      throw new Error(`no row for ${addr.toString(16)}`);
    });
    expect(expected.slice(0, 3)).toEqual([{ py: 0, col: 0 }, { py: 63, col: 31 }, { py: 191, col: 31 }]);
    for (const addr of bytes) s.poke(addr, 0x80);
    // --- attribute $5AFF: last cell (char row 23, column 31) PAPER 4 (green)
    s.poke(0x5aff, 4 << 3);
    s.runFrames(2);

    // --- every ink pixel on screen, as paper (row, x)
    const found: string[] = [];
    for (let py = 0; py < 192; py++) {
      for (let x = 0; x < 256; x++) {
        if (s.pixel(PAPER_LEFT + 2 * x, PAPER_TOP + py) === hex8(0x00)) found.push(`${py}:${x}`);
      }
    }
    expect(found.sort()).toEqual(expected.map(({ py, col }) => `${py}:${col * 8}`).sort());
    // --- ~223: attribute $5AFF colours char row 23, column 31: paper rows 184-191, x 248-255
    expect(colours(s, [PAPER_LEFT + 2 * 248 + 2, PAPER_LEFT + 2 * 255 + 1], [PAPER_TOP + 184, PAPER_TOP + 191])).toBe(hex8(0x1c));
    expect(colours(s, [PAPER_LEFT + 2 * 240, PAPER_LEFT + 2 * 247 + 1], [PAPER_TOP + 184, PAPER_TOP + 191]), "cell to the left").toBe(hex8(0xb6));
    expect(colours(s, [PAPER_LEFT + 2 * 248, PAPER_LEFT + 2 * 255 + 1], [PAPER_TOP + 176, PAPER_TOP + 183]), "cell above").not.toContain(hex8(0x1c));
  });
});
