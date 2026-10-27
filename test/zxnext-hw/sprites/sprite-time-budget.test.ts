import { describe, expect, it } from "vitest";

import { pixelHex, type Frame, type NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * The sprite engine's time budget per line, at 128K/+3 timing (456 dots a line).
 *
 * Every expected result here is the simulated FPGA core's: `_input/next-fpga/src/video/sprites.vhd`
 * alone under nvc, fed the same sprite tables, with the pixels each sprite wrote into the line buffer
 * counted (2026-10-27). The rule they pin, in 28 MHz clocks from the line-buffer swap (wide counter
 * 511): sprite 0 is decided on clock 3; a sprite not on the line costs 1 clock; a sprite on the line
 * costs 1 + the positions it walks (its width, fewer when it runs off the right without wrapping); a
 * sprite decided in the last 4/8/16/32 dots before dot 320 (its own width's drawing time) is refused,
 * with every sprite after it; the next swap stops the engine, part-way through a sprite too.
 *
 * The tables: sprite k at X = 2k on line 100 (five attribute bytes, pattern 0, palette offset k mod 16),
 * so the dot at X = 2k shows sprite k exactly when the engine drew it, and differs from the dot at
 * X = 2k - 2 then (the neighbours' palette offsets differ).
 */

const LINE = 100;

interface Table {
  /** X scale per sprite (0-3: 1x-8x) */
  scale?: (k: number) => number;
  /** Sprites moved off line 100 (to line 200) */
  offLine?: (k: number) => boolean;
  /** X per sprite, when not 2k */
  x?: (k: number) => number;
}

async function spritesOnly(table: Table): Promise<NextTestSession> {
  const s = await parkedSession();
  s.setNextReg(0x68, 0x80); // --- the ULA off
  s.setNextReg(0x4a, 0x00); // --- fallback black
  s.setNextReg(0x4b, 0xe3);
  s.out(0x303b, 0x00);
  for (let i = 0; i < 256; i++) s.out(0x005b, 0x01); // --- pattern 0: index 1 everywhere, opaque
  s.out(0x303b, 0x00);
  for (let k = 0; k < 128; k++) {
    const x = table.x ? table.x(k) : 2 * k;
    const y = table.offLine?.(k) ? 200 : LINE;
    const scale = table.scale ? table.scale(k) : 0;
    s.out(0x0057, x & 0xff)
      .out(0x0057, y)
      .out(0x0057, ((k & 0x0f) << 4) | ((x >> 8) & 1))
      .out(0x0057, 0xc0)
      .out(0x0057, scale << 3);
  }
  s.setNextReg(0x15, 0x03); // --- sprites on, over the border, no clipping
  s.in(0x303b);
  s.runFrames(2);
  return s;
}

/** The dot at sprite-space (x, y): a 7 MHz dot is two pixels of the 640-wide picture */
const dot = (f: Frame, x: number, y: number) => pixelHex(f, 32 + 2 * x, 16 + y);

/** Which sprites the dots at X = 2k say were drawn on line 100 (only valid where X increases with k) */
function drawn(f: Frame, ks: number[]): boolean[] {
  return ks.map((k) => dot(f, 2 * k, LINE) !== "#000000" && (k === 0 || dot(f, 2 * k, LINE) !== dot(f, 2 * k - 2, LINE)));
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("sprite time budget (per line)", () => {
  it.each([
    [0, 75],
    [1, 38],
    [2, 19],
    [3, 9]
  ])("every sprite on the line at X scale %i: the first %i are drawn, then the window refuses one", async (scale, count) => {
    const s = await spritesOnly({ scale: () => scale });
    const f = s.screen();
    const all = range(0, 127);
    expect(drawn(f, all).map((d, k) => (d ? k : -1)).filter((k) => k >= 0)).toEqual(range(0, count - 1));
    expect(s.in(0x303b) & 0x02, "too many sprites on a line").toBe(0x02);
  });

  it("the window takes the scale of the sprite being decided: an 8x sprite is refused 32 dots before 320", async () => {
    // --- sprites 0-70 at 1x, then 8x: sprite 71 is decided at dot 301, inside the 8x window (288-319)
    const s = await spritesOnly({ scale: (k) => (k >= 71 ? 3 : 0) });
    const f = s.screen();
    expect(drawn(f, [69, 70, 71, 72])).toEqual([true, true, false, false]);
    expect(s.in(0x303b) & 0x02).toBe(0x02);
  });

  it("a window is not a deadline: sprites decided after dot 320 are drawn, with no flag", async () => {
    // --- sprites 74-99 are not on the line and take one clock each, so the checks step over the window
    const s = await spritesOnly({ offLine: (k) => k >= 74 && k <= 99 });
    const f = s.screen();
    expect(drawn(f, range(0, 73)).every(Boolean)).toBe(true);
    expect(drawn(f, range(100, 127)).every(Boolean), "102 sprites on one line").toBe(true);
    expect(s.in(0x303b) & 0x02).toBe(0x00);
  });

  it("the end of the line stops a sprite part-way: 79 of an 8x sprite's 128 dots", async () => {
    // --- as above, and sprite 127 is 8x at X 160 (dots 160-287): the next swap comes after 79 of them
    const s = await spritesOnly({
      offLine: (k) => k >= 74 && k <= 99,
      scale: (k) => (k === 127 ? 3 : 0),
      x: (k) => (k === 127 ? 160 : 2 * k)
    });
    const f = s.screen();
    const last = dot(f, 160, LINE);
    expect(range(160, 238).every((x) => dot(f, x, LINE) === last), "dots 160-238 are sprite 127's").toBe(true);
    expect(dot(f, 239, LINE), "dot 239 is sprite 119's again").not.toBe(last);
    expect(s.in(0x303b) & 0x02).toBe(0x02);
  });

  it("a sprite on the line but parked off the right costs two clocks and draws nothing", async () => {
    // --- sprites 0-59 at X 400: then sprites 60-127 all fit
    const s = await spritesOnly({ x: (k) => (k < 60 ? 400 : 2 * k) });
    const f = s.screen();
    expect(drawn(f, range(60, 127)).every(Boolean)).toBe(true);
    expect(s.in(0x303b) & 0x02).toBe(0x00);
  });
});
