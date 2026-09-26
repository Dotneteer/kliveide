import { describe, expect, it } from "vitest";

import { runBasic, type Run } from "./run-kit";

/** PLOT, DRAW and CIRCLE on the 48K (graphics.kz80.asm): (0,0) is the bottom left, 192 rows. */
function pixel(r: Run, x: number, y: number): boolean {
  const row = 191 - y;
  const address = 0x4000 | ((row & 0xc0) << 5) | ((row & 7) << 8) | ((row & 0x38) << 2) | (x >> 3);
  return (r.session.peek(address) & (0x80 >> (x & 7))) !== 0;
}

function lit(r: Run): string[] {
  const out: string[] = [];
  for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) if (pixel(r, x, y)) out.push(`${x},${y}`);
  return out;
}

describe("graphics", () => {
  it("plots at the bottom left and at the top right, with COORDS and the cell's colour", async () => {
    const r = await runBasic("CLS\nPLOT 0, 0\nPLOT INK 2; 255, 191\n");
    expect(lit(r)).toEqual(["0,0", "255,191"]);
    expect([r.session.peek(0x5c7d), r.session.peek(0x5c7e)]).toEqual([255, 191]);
    expect(r.session.peek(0x5800 + 31) & 7, "the top right cell's INK").toBe(2);
    expect(r.session.peek(0x5800 + 23 * 32) & 7, "PLOT's INK lasted only for its statement").not.toBe(2);
  });

  it("draws lines in every direction, each point once and the start left alone", async () => {
    const r = await runBasic("CLS\nPLOT 10, 10\nDRAW 5, 0\nDRAW 0, -3\nDRAW -2, 2\n");
    expect(lit(r).sort()).toEqual(["10,10", "11,10", "12,10", "13,10", "14,10", "15,10", "15,9", "15,8", "15,7", "14,8", "13,9"].sort());
  });

  it("draws a shallow line as Bresenham does", async () => {
    const r = await runBasic("CLS\nPLOT 0, 0\nDRAW 4, 2\n");
    expect(lit(r).sort()).toEqual(["0,0", "1,0", "2,1", "3,1", "4,2"].sort());
  });

  it("draws a circle through the four compass points, symmetric, each point once", async () => {
    const r = await runBasic("CLS\nOVER 1\nCIRCLE 100, 80, 10\n");
    const points = new Set(lit(r));
    for (const p of ["110,80", "90,80", "100,90", "100,70"]) expect(points.has(p), p).toBe(true);
    for (const p of points) {
      const [x, y] = p.split(",").map(Number);
      // --- With OVER 1 a point plotted twice would vanish: symmetry shows none did
      expect(points.has(`${200 - x},${y}`) && points.has(`${x},${160 - y}`) && points.has(`${100 + (y - 80)},${80 + (x - 100)}`), p).toBe(true);
    }
    expect(points.size).toBeGreaterThan(40);
  });

  it("stops with B Integer out of range off the screen", async () => {
    const r = await runBasic("CLS\nPLOT 10, 10\nDRAW 0, 190\n", { expectEnd: false, frames: 100 });
    expect(r.session.screenLine(23)).toMatch(/^B Integer out of range/);
  });

  it("unplots with INVERSE and flips with OVER", async () => {
    const r = await runBasic("CLS\nPLOT 5, 5\nPLOT INVERSE 1; 5, 5\nPLOT 6, 6\nPLOT OVER 1; 6, 6\nPLOT OVER 1; 7, 7\n");
    expect(lit(r)).toEqual(["7,7"]);
  });
});

describe("BEEP", () => {
  it("times the tone from the duration and pitch, and takes about as long as asked", async () => {
    const quick = await runBasic("BEEP 0.01, 0\n");
    const framesQuick = quick.session.frames;
    const r = await runBasic("BEEP 0.5, 0\n");
    // --- Middle C: 1750000 / 261.63 T-states a half cycle, less the loop's 120, in 26s
    expect(r.session.peekWord(r.program.symbol("core.BeepDelay"))).toBe(252);
    const elapsed = (r.session.frames - framesQuick) / 50;
    expect(elapsed).toBeGreaterThan(0.4);
    expect(elapsed).toBeLessThan(0.6);
  });

  it("halves the delay an octave up", async () => {
    const r = await runBasic("BEEP 0.01, 12\n");
    expect(r.session.peekWord(r.program.symbol("core.BeepDelay"))).toBe(124);
  });
});
