import { describe, expect, it } from "vitest";

import { ALL_CORES, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { colours, fillScreen, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * ULA clip window (catalogue ULA-013, ULA-014).
 *
 * Hardware:
 * - zxula.vhd ~567: o_ula_clipped = 0 when (phc >= x1 and phc <= x2 and vc >= y1 and vc <= y2) or
 *   border_active: the window is inclusive, in ULA pixel / paper row coordinates, and never clips the
 *   border. zxnext.vhd ~7046-7049: a clipped ULA pixel is transparent, so the fallback $4A shows when
 *   no other layer is on.
 * - zxnext.vhd ~6726-6730: a y2 of $C0-$FF acts as $BF.
 * - zxnext.vhd ~5238-5244: $1A writes x1, x2, y1, y2 in turn (2-bit index, wraps after four);
 *   ~5910-5914: reading $1A returns the entry at the index; ~5926: $1C reads the four indexes
 *   (tilemap 7-6, ULA 5-4, sprites 3-2, Layer 2 1-0); ~5255-5266: $1C bit 2 resets the ULA index.
 *   Reset values (~4949-4953): 0, $FF, 0, $BF.
 */

const PAPER = 0x1c;
const BORDER = 0xe0;
const FALLBACK = 0x03;

async function screen(core: CoreName): Promise<NextTestSession> {
  const s = await parkedSession(core);
  writePalette(s, [[16 + 4, PAPER], [16 + 2, BORDER]]);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, FALLBACK);
  fillScreen(s, 0x00, 4 << 3); // --- PAPER 4 everywhere, no ink
  return s.out(0xfe, 2);
}

/** Buffer rectangle of paper x x0..x1, rows y0..y1 (inclusive, ULA pixels). */
const paper = (s: NextTestSession, x: [number, number], y: [number, number]) =>
  colours(s, [PAPER_LEFT + 2 * x[0], PAPER_LEFT + 2 * x[1] + 1], [PAPER_TOP + y[0], PAPER_TOP + y[1]]);

const clip = (s: NextTestSession, x1: number, x2: number, y1: number, y2: number) =>
  s.setNextReg(0x1c, 0x04).setNextReg(0x1a, x1).setNextReg(0x1a, x2).setNextReg(0x1a, y1).setNextReg(0x1a, y2);

describe.each(ALL_CORES)("ULA clip window - %s core", (core: CoreName) => {
  it("ULA-013: outside the inclusive window the ULA is transparent; the border is never clipped", async () => {
    const s = await screen(core);
    clip(s, 16, 47, 8, 23).runFrames(2);
    expect({
      inside: paper(s, [16, 47], [8, 23]),
      left: paper(s, [0, 15], [0, 191]),
      right: paper(s, [48, 255], [0, 191]),
      above: paper(s, [16, 47], [0, 7]),
      below: paper(s, [16, 47], [24, 191]),
      border: [colours(s, [0, 719], [0, 47]), colours(s, [0, 95], [48, 239]), colours(s, [608, 719], [48, 239]), colours(s, [0, 719], [240, 287])].join(" ")
    }).toEqual({
      inside: hex8(PAPER),
      left: hex8(FALLBACK),
      right: hex8(FALLBACK),
      above: hex8(FALLBACK),
      below: hex8(FALLBACK),
      border: Array(4).fill(hex8(BORDER)).join(" ")
    });
  });

  it("ULA-013: a y2 of $C0-$FF acts as $BF; x2 < x1 clips every paper pixel", async () => {
    const s = await screen(core);
    clip(s, 0, 255, 100, 0xff).runFrames(2);
    expect({ top: paper(s, [0, 255], [0, 99]), bottom: paper(s, [0, 255], [100, 191]) }).toEqual({
      top: hex8(FALLBACK),
      bottom: hex8(PAPER)
    });
    clip(s, 200, 100, 0, 191).runFrames(1);
    expect(paper(s, [0, 255], [0, 191])).toBe(hex8(FALLBACK));
    expect(colours(s, [0, 95], [48, 239]), "border").toBe(hex8(BORDER));
  });

  it("ULA-014: $1A writes cycle x1, x2, y1, y2 and wrap; $1C bit 2 resets the index", async () => {
    const s = await parkedSession(core);
    expect(s.readNextReg(0x1c) & 0x30, "index after reset").toBe(0x00);
    // --- reset values, read by walking the index with writes of the same value
    const values: number[] = [];
    for (let i = 0; i < 4; i++) {
      values.push(s.readNextReg(0x1a));
      s.setNextReg(0x1a, values[i]);
    }
    expect(values, "reset values x1, x2, y1, y2").toEqual([0x00, 0xff, 0x00, 0xbf]);
    s.setNextReg(0x1a, 0x11).setNextReg(0x1a, 0x22).setNextReg(0x1a, 0x33);
    expect(s.readNextReg(0x1c) & 0x30, "index after 3 writes").toBe(0x30);
    expect(s.readNextReg(0x1a), "reads y2 at index 3").toBe(0xbf);
    s.setNextReg(0x1a, 0x44);
    expect(s.readNextReg(0x1c) & 0x30, "index wrapped").toBe(0x00);
    s.setNextReg(0x1a, 0x55); // --- fifth write: x1 again
    expect(s.readNextReg(0x1c) & 0x30).toBe(0x10);
    expect(s.readNextReg(0x1a), "x2 at index 1").toBe(0x22);
    s.setNextReg(0x1c, 0x04);
    expect(s.readNextReg(0x1c) & 0x30, "$1C bit 2 resets").toBe(0x00);
    expect(s.readNextReg(0x1a), "x1 overwritten by the fifth write").toBe(0x55);
    // --- the other bits of $1C leave the ULA index alone
    s.setNextReg(0x1a, 0x55);
    s.setNextReg(0x1c, 0x0b);
    expect(s.readNextReg(0x1c) & 0x30, "$1C bits 0, 1, 3").toBe(0x10);
  });
});
