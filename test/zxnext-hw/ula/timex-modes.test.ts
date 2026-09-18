import { describe, expect, it } from "vitest";

import { ALL_CORES, displayFileAddress, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { colours, DISTINCT_32, fillScreen, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * Timex screen modes, port $FF bits 5-0 (catalogue TMX-001 - TMX-005, TMX-010, TMX-011, TMX-013).
 *
 * Hardware (`_input/next-fpga/src/video/zxula.vhd`):
 * - ~191: screen_mode = port $FF bits 2-0 (forced to 000 while the 128K shadow screen is displayed).
 * - ~230-250: the pixel byte address is  screen_mode(0) & pixel offset  ($4000, or $6000 with bit 0);
 *   the attribute byte address is  '1' & pixel offset  ($6000 + pixel offset: 8x1 HiColor attributes)
 *   when screen_mode(1) = 1, otherwise  screen_mode(0) & "110" & row & column  ($5800 or $7800).
 *   So mode 1 takes pixels from $6000 *and* attributes from $7800; mode 2 pixels from $4000 and
 *   attributes from $6000; mode 3 both from $6000 (the same byte).
 * - ~391-395: with screen_mode(2) (HiRes) the 32-bit shift word is  pixel(n) & attr(n) & pixel(n+1) &
 *   attr(n+1)  with no pixel doubling: each bit is one 14 MHz pixel (one buffer pixel), the $4000 byte
 *   first, then the $6000 byte (mode 6: attribute fetch = '1' & pixel offset).
 * - ~431-437: in HiRes attr_reg is border_clr_tmx = "01" & not ink & ink with ink = port $FF bits 5-3,
 *   in the paper *and* in the border: ink is BRIGHT ink n (palette 8 + n), paper and border BRIGHT
 *   paper 7 - n (palette 24 + 7 - n).
 * - ~198, ~397: the scroll shifts the 32-bit word by  scroll_x(2:0) & fine  half pixels and the column
 *   by scroll_x(7:3): screen hires x (q + 2 * $26 + fine) mod 512 shows at display hires x q.
 */

async function screen(core: CoreName, mode: number): Promise<NextTestSession> {
  const s = await parkedSession(core);
  writePalette(s, DISTINCT_32.map((v, i) => [i, v]));
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3);
  fillScreen(s, 0x00, 0x38);
  s.poke(0x6000, new Array(0x1800).fill(0x00)).poke(0x7800, new Array(0x300).fill(0x38));
  return s.out(0xfe, 1).out(0x00ff, mode);
}

const ink = (n: number, bright = false) => hex8(DISTINCT_32[(bright ? 8 : 0) + n]);
const paper = (n: number, bright = false) => hex8(DISTINCT_32[16 + (bright ? 8 : 0) + n]);

/** Colours of the left (x 0-3) and right (x 4-7) halves of cell (row 0, col 0) on paper line `line`. */
function halves(s: NextTestSession, line: number): string {
  const y: [number, number] = [PAPER_TOP + line, PAPER_TOP + line];
  return `${colours(s, [PAPER_LEFT, PAPER_LEFT + 7], y)} | ${colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], y)}`;
}

/** Buffer x of every pixel of colour `c` on paper line `line`. */
function xsOf(s: NextTestSession, line: number, c: string): number[] {
  const xs: number[] = [];
  for (let x = PAPER_LEFT; x < PAPER_LEFT + 512; x++) if (s.pixel(x, PAPER_TOP + line) === c) xs.push(x);
  return xs;
}

describe.each(ALL_CORES)("Timex screen modes - %s core", (core: CoreName) => {
  /** Distinct contents in all four areas: which one a mode shows is visible in cell (0, 0). */
  async function fourAreas(mode: number): Promise<NextTestSession> {
    const s = await screen(core, mode);
    for (let line = 0; line < 8; line++) {
      s.poke(displayFileAddress(line, 0), 0xf0); // --- $4000: ink left
      s.poke(displayFileAddress(line, 0) + 0x2000, 0x0f); // --- $6000: ink right
    }
    s.poke(0x5800, (2 << 3) | 1).poke(0x7800, (4 << 3) | 3);
    return s.runFrames(2);
  }

  it("TMX-001: mode 0 shows pixels from $4000 and attributes from $5800", async () => {
    const s = await fourAreas(0);
    expect(halves(s, 0)).toBe(`${ink(1)} | ${paper(2)}`);
    expect(colours(s, [0, 95], [48, 239]), "border").toBe(paper(1));
  });

  it("TMX-002: mode 1 shows pixels from $6000 and attributes from $7800", async () => {
    const s = await fourAreas(1);
    expect(halves(s, 0)).toBe(`${paper(4)} | ${ink(3)}`);
    expect(colours(s, [0, 95], [48, 239]), "border").toBe(paper(1));
  });

  it("TMX-003: mode 2 (HiColor) shows pixels from $4000 with one attribute per line from $6000", async () => {
    const s = await fourAreas(2);
    // --- 8x1 attributes of cell (0, 0): line k ink 7 - k, paper k; the $5800 / $7800 bytes are ignored
    for (let line = 0; line < 8; line++) s.poke(displayFileAddress(line, 0) + 0x2000, (line << 3) | (7 - line));
    s.runFrames(1);
    const seen = [0, 1, 2, 3, 4, 5, 6, 7].map((line) => halves(s, line));
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((line) => `${ink(7 - line)} | ${paper(line)}`));
    // --- a line lower in the screen: pixel row 100 uses the attribute at $6000 + its pixel offset
    s.poke(displayFileAddress(100, 3), 0xf0).poke(displayFileAddress(100, 3) + 0x2000, 0x40 | (5 << 3) | 6).runFrames(1);
    const y: [number, number] = [PAPER_TOP + 100, PAPER_TOP + 100];
    expect(`${colours(s, [PAPER_LEFT + 48, PAPER_LEFT + 55], y)} | ${colours(s, [PAPER_LEFT + 56, PAPER_LEFT + 63], y)}`).toBe(
      `${ink(6, true)} | ${paper(5, true)}`
    );
    expect(colours(s, [0, 95], [48, 239]), "border").toBe(paper(1));
  });

  it("TMX-013: mode 3 takes pixels and attributes from the same $6000 byte", async () => {
    const s = await fourAreas(3);
    // --- $6000 cell (0, 0) = $0F: as pixels, ink right; as attribute INK 7, PAPER 1
    expect(halves(s, 0)).toBe(`${paper(1)} | ${ink(7)}`);
  });

  it("TMX-004: mode 6 (HiRes) shows the $4000 and $6000 bytes of each column side by side, one buffer pixel per bit", async () => {
    const s = await screen(core, 6);
    s.poke(displayFileAddress(0, 0), 0x80).poke(displayFileAddress(0, 0) + 0x2000, 0x01);
    s.poke(displayFileAddress(0, 5), 0x10).poke(displayFileAddress(0, 5) + 0x2000, 0x40);
    s.poke(displayFileAddress(100, 31), 0x01).poke(displayFileAddress(100, 31) + 0x2000, 0x80);
    s.runFrames(2);
    // --- ink 0 (port $FF bits 5-3 = 0): BRIGHT ink 0
    expect(xsOf(s, 0, ink(0, true)), "line 0").toEqual([96, 111, 96 + 80 + 3, 96 + 80 + 8 + 1]);
    expect(xsOf(s, 100, ink(0, true)), "line 100").toEqual([96 + 496 + 7, 96 + 496 + 8]);
    expect(xsOf(s, 1, ink(0, true)), "line 1 is empty").toEqual([]);
  });

  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
    it(`TMX-005: mode 6 with ink ${n}: ink is BRIGHT ink ${n}, paper and border BRIGHT paper ${7 - n}`, async () => {
      const s = await screen(core, 6 | (n << 3));
      s.poke(displayFileAddress(0, 0), 0xff);
      s.runFrames(2);
      expect({
        ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP, PAPER_TOP]),
        paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 511], [PAPER_TOP, PAPER_TOP + 191]),
        border: colours(s, [0, 95], [0, 287]) + " " + colours(s, [608, 719], [0, 287])
      }).toEqual({ ink: ink(n, true), paper: paper(7 - n, true), border: `${paper(7 - n, true)} ${paper(7 - n, true)}` });
    });
  }

  it("TMX-005: HiRes ink and paper follow palette writes made after the mode was set", async () => {
    const s = await screen(core, 6 | (2 << 3)); // --- ink 2: palette 10 ink, 29 paper
    s.poke(displayFileAddress(0, 0), 0xff);
    writePalette(s, [[10, 0x1c], [29, 0xe0]]);
    s.runFrames(2);
    expect({
      ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP, PAPER_TOP]),
      paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [PAPER_TOP, PAPER_TOP]),
      border: colours(s, [0, 95], [48, 239])
    }).toEqual({ ink: hex8(0x1c), paper: hex8(0xe0), border: hex8(0xe0) });
  });

  // --- zxula.vhd ~230-250 for the undocumented HiRes modes: the pixel byte from $4000 / $6000 (bit 0),
  // --- the second byte from the attribute address ($5800 / $7800, or $6000 + pixel offset with bit 1)
  for (const [mode, second] of [[4, 0x5800], [5, 0x7800], [7, 0x6000]] as const) {
    it(`TMX-013: mode ${mode} (HiRes) shows the ${mode & 1 ? "$6000" : "$4000"} byte, then the ${second.toString(16).toUpperCase()} byte`, async () => {
      const s = await screen(core, mode);
      s.poke(0x5800, new Array(0x300).fill(0x00)).poke(0x7800, new Array(0x300).fill(0x00)); // --- no stray ink
      s.poke(displayFileAddress(0, 0), 0x80).poke(displayFileAddress(0, 0) + 0x2000, 0x40);
      if (second !== 0x6000) s.poke(second, 0x01);
      s.runFrames(2);
      const first = mode & 1 ? 97 : 96; // --- $6000 byte $40: bit 6; $4000 byte $80: bit 7
      const secondX = second === 0x6000 ? 96 + 8 + 1 : 96 + 15; // --- $6000 byte again, or the $x800 byte $01
      expect(xsOf(s, 0, ink(0, true))).toEqual([first, secondX]);
    });
  }

  for (const [scroll, fine] of [[0, 0], [1, 0], [3, 0], [8, 0], [255, 0], [0, 1], [1, 1]] as const) {
    it(`TMX-010: HiRes with $26 = ${scroll}${fine ? " and the half-pixel scroll" : ""} moves ${2 * scroll + fine} hires pixels`, async () => {
      const s = await screen(core, 6);
      // --- screen hires x: 0 ($4000 col 0 bit 7), 15 ($6000 col 0 bit 0), 100 ($4000 col 6 bit 4), 505 ($6000 col 31 bit 1)
      s.poke(displayFileAddress(0, 0), 0x80).poke(displayFileAddress(0, 0) + 0x2000, 0x01);
      s.poke(displayFileAddress(0, 6), 0x08).poke(displayFileAddress(0, 31) + 0x2000, 0x40);
      s.setNextReg(0x26, scroll).setNextReg(0x68, fine ? 0x04 : 0x00).runFrames(2);
      const at = (hx: number) => PAPER_LEFT + ((hx - 2 * scroll - fine + 1024) % 512);
      expect(xsOf(s, 0, ink(0, true))).toEqual([0, 15, 100, 505].map(at).sort((a, b) => a - b));
      expect(colours(s, [0, 95], [0, 287]), "border").toBe(paper(7, true));
    });
  }

  it("TMX-010: HiColor with the half-pixel scroll moves one buffer pixel left", async () => {
    const s = await screen(core, 2);
    s.poke(displayFileAddress(10, 12), 0x08).poke(displayFileAddress(10, 12) + 0x2000, 0x38); // --- screen x 100
    s.runFrames(2);
    expect(xsOf(s, 10, ink(0)), "no fine scroll").toEqual([296, 297]);
    s.setNextReg(0x68, 0x04).runFrames(1);
    expect(xsOf(s, 10, ink(0)), "fine scroll").toEqual([295, 296]);
  });

  it("TMX-011: HiColor attributes go through the ULANext format", async () => {
    const s = await screen(core, 2);
    // --- format $07: ink = attr & 7, paper = $80 | attr >> 3; line 0 attr $5B -> ink 3, paper $8B;
    // --- line 1 attr $A7 -> ink 7, paper $94
    writePalette(s, [[3, 0xe0], [0x8b, 0x1c], [7, 0xfc], [0x94, 0x1f]]);
    s.poke(displayFileAddress(0, 0), 0xf0).poke(displayFileAddress(1, 0), 0xf0);
    s.poke(displayFileAddress(0, 0) + 0x2000, 0x5b).poke(displayFileAddress(1, 0) + 0x2000, 0xa7);
    s.setNextReg(0x42, 0x07).setNextReg(0x43, 0x01).runFrames(2);
    expect([halves(s, 0), halves(s, 1)]).toEqual([`${hex8(0xe0)} | ${hex8(0x1c)}`, `${hex8(0xfc)} | ${hex8(0x1f)}`]);
  });

  it("TMX-013: the 128K shadow screen forces mode 0 (bank 7 has no second display file)", async () => {
    const s = await screen(core, 1);
    // --- bank 7 at $C000: its cell (0, 0) ink left, attribute INK 5 PAPER 6
    s.out(0x7ffd, 0x07);
    for (let line = 0; line < 8; line++) s.poke(displayFileAddress(line, 0) + 0x8000, 0xf0);
    s.poke(0xd800, (6 << 3) | 5);
    s.out(0x7ffd, 0x0f).runFrames(2); // --- display bank 7
    expect(halves(s, 0)).toBe(`${ink(5)} | ${paper(6)}`);
  });
});
