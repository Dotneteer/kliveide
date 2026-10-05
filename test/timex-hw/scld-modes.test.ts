import { describe, expect, it } from "vitest";

import { colours, displayFileAddress, hex, ink, paper, scldScreen, xsOf } from "./_timex-helpers";
import type { TimexTestSession } from "../harness/timex";

/*
 * The SCLD's screen modes on the TC2048 (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a, §8).
 *
 * Documented (TS2068 Technical Manual 2.1.13.1, 5.2): mode 0 the primary display file, 1 the second
 * file at $6000, 2 extended colour (an attribute per 8 x 1 pixels at $6000 + the pixel offset), 6 the
 * 64-column mode (even columns from $4000, odd from $6000, ink from bits 3-5, paper its complement,
 * the border the paper colour). The TC2048's 64-column colours are BRIGHT (WoS Timex FAQ).
 *
 * The cases mirror the Next's (`test/zxnext-hw/ula/timex-modes.test.ts`, TMX-001 - TMX-005, TMX-013),
 * the cross-check P7 asks for: the same writes give the same picture, in a grid where one Spectrum
 * pixel is two buffer pixels. The undocumented modes (3, 4, 5, 7) follow the Next's decoding.
 */

/** Distinct contents in all four areas: which one a mode shows is visible in cell (0, 0) */
async function fourAreas(mode: number): Promise<TimexTestSession> {
  const s = await scldScreen(mode);
  for (let line = 0; line < 8; line++) {
    s.poke(displayFileAddress(line, 0), 0xf0); // --- $4000: ink left
    s.poke(displayFileAddress(line, 0) + 0x2000, 0x0f); // --- $6000: ink right
  }
  s.poke(0x5800, (2 << 3) | 1).poke(0x7800, (4 << 3) | 3);
  return s.renderNow();
}

/** The colours of the left (Spectrum x 0-3) and right (x 4-7) halves of cell (0, 0) on paper line `line` */
function halves(s: TimexTestSession, line: number): string {
  return `${colours(s, [0, 7], [line, line])} | ${colours(s, [8, 15], [line, line])}`;
}

const h = (c: number) => hex(c);

describe("TC2048 screen modes (port $FF bits 0-2)", () => {
  it("TMX-001: mode 0 shows pixels from $4000 and attributes from $5800", async () => {
    const s = await fourAreas(0);
    expect(halves(s, 0)).toBe(`${h(ink(1))} | ${h(paper(2))}`);
    expect(hex(s.borderPixel()), "border").toBe(h(paper(1)));
  });

  it("TMX-002: mode 1 shows pixels from $6000 and attributes from $7800", async () => {
    const s = await fourAreas(1);
    expect(halves(s, 0)).toBe(`${h(paper(4))} | ${h(ink(3))}`);
    expect(hex(s.borderPixel()), "border").toBe(h(paper(1)));
  });

  it("TMX-003: mode 2 (extended colour) takes one attribute per pixel line from $6000", async () => {
    const s = await fourAreas(2);
    for (let line = 0; line < 8; line++) s.poke(displayFileAddress(line, 0) + 0x2000, (line << 3) | (7 - line));
    s.renderNow();
    const seen = [0, 1, 2, 3, 4, 5, 6, 7].map((line) => halves(s, line));
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((line) => `${h(ink(7 - line))} | ${h(paper(line))}`));
    // --- Pixel row 100, column 3: the attribute at $6000 + its pixel offset, BRIGHT honoured
    s.poke(displayFileAddress(100, 3), 0xf0).poke(displayFileAddress(100, 3) + 0x2000, 0x40 | (5 << 3) | 6).renderNow();
    expect(`${colours(s, [48, 55], [100, 100])} | ${colours(s, [56, 63], [100, 100])}`).toBe(
      `${h(ink(6, true))} | ${h(paper(5, true))}`
    );
    expect(hex(s.borderPixel()), "border").toBe(h(paper(1)));
  });

  it("TMX-003: extended colour keeps FLASH", async () => {
    const s = await scldScreen(2);
    s.poke(displayFileAddress(0, 0), 0xff).poke(displayFileAddress(0, 0) + 0x2000, 0x80 | (2 << 3) | 5).renderNow();
    const first = s.paperPixel(0, 0);
    s.runFrames(16).renderNow();
    expect(new Set([first, s.paperPixel(0, 0)])).toEqual(new Set([ink(5), paper(2)]));
  });

  it("TMX-013: mode 3 takes pixels and attributes from the same $6000 byte", async () => {
    const s = await fourAreas(3);
    // --- $6000 cell (0, 0) = $0F: as pixels, ink right; as attribute INK 7, PAPER 1
    expect(halves(s, 0)).toBe(`${h(paper(1))} | ${h(ink(7))}`);
  });

  it("TMX-004: mode 6 (64 columns) shows the $4000 and $6000 bytes of each column side by side", async () => {
    const s = await scldScreen(6 | (2 << 3)); // --- ink 2 (red), paper 5 (cyan)
    s.poke(displayFileAddress(0, 0), 0x80).poke(displayFileAddress(0, 0) + 0x2000, 0x01);
    s.poke(displayFileAddress(0, 5), 0x10).poke(displayFileAddress(0, 5) + 0x2000, 0x40);
    s.poke(displayFileAddress(100, 31), 0x01).poke(displayFileAddress(100, 31) + 0x2000, 0x80);
    s.renderNow();
    const red = ink(2, true);
    expect(xsOf(s, 0, red), "line 0").toEqual([0, 15, 80 + 3, 80 + 8 + 1]);
    expect(xsOf(s, 100, red), "line 100").toEqual([496 + 7, 496 + 8]);
    expect(xsOf(s, 1, red), "line 1 is empty").toEqual([]);
  });

  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
    it(`TMX-005: mode 6 with ink ${n}: BRIGHT ink ${n}, paper and border BRIGHT ${7 - n}`, async () => {
      const s = await scldScreen(6 | (n << 3));
      s.poke(displayFileAddress(0, 0), 0xff).renderNow();
      expect({
        ink: colours(s, [0, 7], [0, 0]),
        paper: colours(s, [8, 511], [0, 191]),
        border: hex(s.borderPixel())
      }).toEqual({ ink: h(ink(n, true)), paper: h(paper(7 - n, true)), border: h(paper(7 - n, true)) });
    });
  }

  it("TMX-005: the 64-column mode ignores the attribute files and FLASH", async () => {
    const s = await scldScreen(6);
    s.poke(0x5800, new Array(0x300).fill(0xc2)).poke(0x7800, new Array(0x300).fill(0xc2));
    s.poke(displayFileAddress(0, 0), 0xff).renderNow();
    const before = colours(s, [0, 15], [0, 0]);
    s.runFrames(16).renderNow();
    expect(colours(s, [0, 15], [0, 0])).toBe(before);
    expect(colours(s, [0, 7], [0, 0])).toBe(h(ink(0, true)));
  });

  // --- The undocumented 64-column values, decoded bit by bit as the Next does (zx-spectrum-scld.c)
  for (const [mode, second] of [[4, 0x5800], [5, 0x7800], [7, 0x6000]] as const) {
    it(`TMX-013: mode ${mode} shows the ${mode & 1 ? "$6000" : "$4000"} byte, then the $${second.toString(16).toUpperCase()} byte`, async () => {
      const s = await scldScreen(mode | (2 << 3));
      s.poke(0x5800, new Array(0x300).fill(0x00)).poke(0x7800, new Array(0x300).fill(0x00));
      s.poke(displayFileAddress(0, 0), 0x80).poke(displayFileAddress(0, 0) + 0x2000, 0x40);
      if (second !== 0x6000) s.poke(second, 0x01);
      s.renderNow();
      const first = mode & 1 ? 1 : 0;
      const secondX = second === 0x6000 ? 8 + 1 : 15;
      expect(xsOf(s, 0, ink(2, true))).toEqual([first, secondX]);
    });
  }

  it("a mode change takes effect at the OUT, mid-frame", async () => {
    const s = await scldScreen(0);
    s.machine.iff1 = true;
    await s.loadCode(`
          .org $8000
      Main:
          ei
          halt
          ld bc,1250
      Wait:
          dec bc
          ld a,b
          or c
          jr nz,Wait
          ld a,$0e         ; mode 6, ink 1: the paper turns BRIGHT yellow
          out ($ff),a
          halt
          ret
    `);
    s.call("Main", { maxFrames: 5 });
    const rows = Array.from({ length: 192 }, (_, y) => s.paperPixel(100, y));
    const switchRow = rows.findIndex((c) => c === paper(6, true));
    expect(rows[0], "top: the attribute's white paper").toBe(paper(7));
    expect(switchRow).toBeGreaterThan(40);
    expect(switchRow).toBeLessThan(160);
    expect(rows.slice(switchRow + 1).every((c) => c === paper(6, true))).toBe(true);
    expect(rows.slice(0, switchRow).every((c) => c === paper(7))).toBe(true);
  });
});
