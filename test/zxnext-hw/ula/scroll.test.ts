import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, displayFileAddress, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";
import { colours, fillScreen, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * ULA hardware scrolling (catalogue ULA-010 - ULA-012).
 *
 * Hardware (`_input/next-fpga/src/video/zxula.vhd`):
 * - ~196-208: py = (vc + scroll_y) with py_s >= 192 folded back (the three branches amount to
 *   (vc + scroll_y) mod 192 for every 8-bit scroll_y, including 192-255), so screen row
 *   (r + scroll_y) mod 192 is shown on paper row r; attributes follow py(7:3) (~223).
 * - ~198: px = fine & (hc(7:3) + scroll_x(7:3)) & scroll_x(2:0): the column wraps at 32 bytes;
 *   ~397-399: the shift register is loaded shifted left by scroll_x(2:0) & fine (in 14 MHz half
 *   pixels), so paper x p shows screen x (p + scroll_x) mod 256, and $68 bit 2 (fine,
 *   nr_68_ula_fine_scroll_x) moves the picture one more half pixel (one buffer pixel) left.
 * - ~408-419: the border is loaded from border_clr, not from the shifted bytes, and ~451 masks pixels
 *   with border_active_d: scrolling never moves anything into the border.
 * - zxnext.vhd ~5281-5284, ~5944-5947: $26 / $27 read back as written; ~6039: $68 bit 2 reads the fine bit.
 */

const INK = 0x00;
const PAPER = 0xb6;
const MARK = 0x1c; // --- green paper of one attribute cell
const BORDER = 0xe0;

async function screen(core: CoreName): Promise<NextTestSession> {
  const s = await parkedSession(core);
  writePalette(s, [[0, INK], [23, PAPER], [20, MARK], [18, BORDER]]);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
  fillScreen(s, 0x00, 0x38); // --- INK 0, PAPER 7
  return s.out(0xfe, 2);
}

/** Paper x of every ink pixel on paper row `row` (ULA pixel resolution, sampled at the left half). */
function inkXs(s: NextTestSession, row: number): number[] {
  const xs: number[] = [];
  for (let x = 0; x < 256; x++) if (s.pixel(PAPER_LEFT + 2 * x, PAPER_TOP + row) === hex8(INK)) xs.push(x);
  return xs;
}

/** Paper x of every MARK-coloured paper pixel on paper row `row`. */
function markXs(s: NextTestSession, row: number): number[] {
  const xs: number[] = [];
  for (let x = 0; x < 256; x++) if (s.pixel(PAPER_LEFT + 2 * x, PAPER_TOP + row) === hex8(MARK)) xs.push(x);
  return xs;
}

const borderOk = (s: NextTestSession) => ({
  left: colours(s, [0, 95], [0, 287]),
  right: colours(s, [608, 719], [0, 287]),
  top: colours(s, [0, 719], [0, 47]),
  bottom: colours(s, [0, 719], [240, 287])
});
const allBorder = { left: hex8(BORDER), right: hex8(BORDER), top: hex8(BORDER), bottom: hex8(BORDER) };

describe.each(ALL_CORES)("ULA scroll - %s core", (core: CoreName) => {
  for (const scroll of [0, 1, 7, 8, 100, 255]) {
    it(`ULA-010: $26 = ${scroll} shows screen x (p + ${scroll}) mod 256 at paper x p, border unaffected`, async () => {
      const s = await screen(core);
      // --- row 10: single pixels at screen x 0 and 100; row 11 all ink bytes in column 31 (x 248-255)
      s.poke(displayFileAddress(10, 0), 0x80).poke(displayFileAddress(10, 12), 0x08);
      // --- character row 3 (paper rows 24-31): column 0 green paper
      s.poke(0x5800 + 3 * 32, 4 << 3);
      s.setNextReg(0x26, scroll).runFrames(2);
      expect(s.readNextReg(0x26), "$26 readback").toBe(scroll);
      const at = (screenX: number) => (screenX - scroll + 256) % 256;
      expect(inkXs(s, 10), "row 10 ink").toEqual([at(0), at(100)].sort((a, b) => a - b));
      expect(markXs(s, 26), "attribute cell of column 0").toEqual(
        [0, 1, 2, 3, 4, 5, 6, 7].map(at).sort((a, b) => a - b)
      );
      expect(borderOk(s)).toEqual(allBorder);
    });
  }

  for (const scroll of [0, 1, 191, 192, 200, 255]) {
    it(`ULA-011: $27 = ${scroll} shows screen row (r + ${scroll}) mod 192 on paper row r`, async () => {
      const s = await screen(core);
      // --- one pixel per marked screen row, in a column that identifies it
      const rows: Array<[number, number]> = [[0, 1], [1, 2], [7, 3], [100, 4], [191, 5]];
      for (const [row, col] of rows) s.poke(displayFileAddress(row, col), 0x80);
      // --- character row 23 (screen rows 184-191): column 9 green paper
      s.poke(0x5800 + 23 * 32 + 9, 4 << 3);
      s.setNextReg(0x27, scroll).runFrames(2);
      expect(s.readNextReg(0x27), "$27 readback").toBe(scroll);
      const seen: string[] = [];
      for (let r = 0; r < 192; r++) for (const x of inkXs(s, r)) seen.push(`${r}:${x}`);
      const want = rows.map(([row, col]) => `${(row - (scroll % 192) + 192) % 192}:${col * 8}`);
      expect(seen.sort()).toEqual(want.sort());
      const markRows: number[] = [];
      for (let r = 0; r < 192; r++) if (markXs(s, r).length) markRows.push(r);
      expect(markRows, "attributes scroll with the pixels").toEqual(
        [184, 185, 186, 187, 188, 189, 190, 191].map((row) => (row - (scroll % 192) + 192) % 192).sort((a, b) => a - b)
      );
      expect(borderOk(s)).toEqual(allBorder);
    });
  }

  it("ULA-012: $68 bit 2 shifts the picture one half pixel (one buffer pixel) left", async () => {
    const s = await screen(core);
    s.poke(displayFileAddress(10, 12), 0x08); // --- screen x 100: buffer x 296-297
    s.runFrames(2);
    const run = () => {
      const xs: number[] = [];
      for (let x = 280; x < 320; x++) if (s.pixel(x, PAPER_TOP + 10) === hex8(INK)) xs.push(x);
      return xs;
    };
    expect(run(), "no fine scroll").toEqual([296, 297]);
    s.setNextReg(0x68, 0x04).runFrames(1);
    expect(s.readNextReg(0x68) & 0x04, "$68 bit 2 readback").toBe(0x04);
    expect(run(), "fine scroll").toEqual([295, 296]);
    s.setNextReg(0x26, 1).runFrames(1);
    expect(run(), "fine scroll + $26 = 1").toEqual([293, 294]);
    expect(borderOk(s)).toEqual(allBorder);
  });

  /*
   * ULA-010 with the Copper: a $26 write takes effect at the next 8-pixel cell (zxula.vhd ~198, px loads
   * at hc(3:0) = 3 / B), but a palette write acts per pixel. Every paper cell has one ink pixel at its
   * left edge (bitmap $80); after `nextreg $26,4` it moves 4 pixels right from the latch cell L on. The
   * Copper recolours PAPER 7 at x = C on the same line. Wherever the scroll write lands - even between a
   * cell start and C, with its latch after C - the recoloured paper starts at C.
   */
  it("ULA-010: a Copper palette write between a $26 write and its cell latch shows at once", async () => {
    const LINE = 100; // --- paper row 100 = buffer row 148
    const ROW = 48 + LINE;
    const H = 8; // --- WAIT at paper x 64 = buffer x 224
    const NOPS = 16; // --- the palette write lands inside that cell
    const RECOLOURED = 0x03;

    async function row(d: number): Promise<{ c: number; l: number }> {
      const s = await createSession(core);
      await s.loadCode(" .org $8000\n di\n jr $");
      writePalette(s, [[0, INK], [23, PAPER], [18, BORDER]]);
      s.setNextReg(0x14, 0xe3).setNextReg(0x03, 0xb0).out(0xfe, 2);
      fillScreen(s, 0x80, 0x38);
      const list = [
        0x40, 23, 0x41, PAPER,
        0x80 | (H << 1) | (LINE >> 8), LINE & 0xff,
        ...Array(2 * NOPS).fill(0x00),
        0x40, 23, 0x41, RECOLOURED,
        0xff, 0xff
      ];
      s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
      for (const b of list) s.setNextReg(0x60, b);
      s.setNextReg(0x61, 0x00).setNextReg(0x62, 0xc0).runFrames(3);
      await s.loadCode(`
        .org $8000
Start:  di
${delay(d)}
        nextreg $26,4
        nextreg $7f,$a5
        jr $
      `, { entry: "Start" });
      s.setNextReg(0x7f, 0).runUntilReady({ maxFrames: 5 });
      let c = -1;
      let l = -1;
      for (let x = PAPER_LEFT; x < PAPER_LEFT + 512; x++) {
        if (c < 0 && s.pixel(x, ROW) === hex8(RECOLOURED)) c = x;
        // --- an ink pixel 4 ULA pixels into a cell: the scroll has been latched
        if (l < 0 && (x - PAPER_LEFT) % 16 === 8 && s.pixel(x, ROW) === hex8(INK)) l = x - 8;
      }
      return { c, l };
    }

    const sweep: Array<{ d: number; c: number; l: number }> = [];
    for (let d = 37440; d <= 37490; d++) sweep.push({ d, ...(await row(d)) });
    const c = sweep[0].c;
    expect(c % 16, `C = ${c}`).toBeGreaterThanOrEqual(8);
    expect(sweep.filter((r) => r.c !== c), "the recoloured paper always starts at C").toEqual([]);
    // --- the interesting case is in the sweep: a latch cell that starts before C and ends after it
    expect(sweep.some((r) => r.l >= 0 && r.l < c && r.l + 16 > c), JSON.stringify(sweep)).toBe(true);
  });
});
