import { createTimexSession, SPECTRUM_COLORS, type TimexTestSession } from "../harness/timex";

/** The display file address of pixel row `line` (0-191), column `col` (0-31), from $4000 */
export function displayFileAddress(line: number, col: number): number {
  return 0x4000 | ((line & 0xc0) << 5) | ((line & 0x07) << 8) | ((line & 0x38) << 2) | (col & 0x1f);
}

export const ink = (n: number, bright = false): number => SPECTRUM_COLORS[(bright ? 8 : 0) + n];
export const paper = ink;

/**
 * A booted TC2048 with both display files blank (pixels 0, attributes white paper / black ink), the
 * border blue, and port $FF set to `mode`
 */
export async function scldScreen(mode: number): Promise<TimexTestSession> {
  const s = await createTimexSession();
  s.bootToBasic();
  s.machine.iff1 = false;
  s.poke(0x4000, new Array(0x1800).fill(0x00)).poke(0x5800, new Array(0x300).fill(0x38));
  s.poke(0x6000, new Array(0x1800).fill(0x00)).poke(0x7800, new Array(0x300).fill(0x38));
  return s.out(0x00fe, 1).out(0x00ff, mode).renderNow();
}

/**
 * The colours of a run of grid pixels (the 512-wide paper grid), collapsed: one value when they are
 * all the same, otherwise every distinct colour in order of appearance
 */
export function colours(s: TimexTestSession, x: [number, number], y: [number, number]): string {
  const seen: number[] = [];
  for (let yy = y[0]; yy <= y[1]; yy++) {
    for (let xx = x[0]; xx <= x[1]; xx++) {
      const c = s.paperPixel(xx, yy);
      if (!seen.includes(c)) seen.push(c);
    }
  }
  return seen.map(hex).join(",");
}

export const hex = (c: number): string => (c >>> 0).toString(16).padStart(8, "0");

/** The grid x of every pixel of colour `c` on paper line `line` */
export function xsOf(s: TimexTestSession, line: number, c: number): number[] {
  const xs: number[] = [];
  for (let x = 0; x < 512; x++) if (s.paperPixel(x, line) === c) xs.push(x);
  return xs;
}
