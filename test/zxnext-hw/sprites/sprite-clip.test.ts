import { describe, expect, it } from "vitest";

import { type NextTestSession } from "../../harness/zxnext";
import { hex8, parkedSession, writePalette } from "../ula/_ula-helpers";

/*
 * Sprite clip window edges. Replaces the hardware-visible cases of test/zxnext/SpriteDevice-clip.test.ts
 * (D2), which read SpriteDevice boundary fields; SPR-011 - SPR-013 in sprites.test.ts check whole random
 * scenes against the window, these pin the exact edges and the corner cases.
 *
 * `_input/next-fpga/src/video/sprites.vhd` ~1061-1085:
 * - over the border ($15 bit 1), no border clip ($15 bit 5 = 0): x 0-319, y 0-255 (~1063-1066);
 * - over the border with border clip: x1*2 .. x2*2+1, y1 .. y2 (~1068-1071);
 * - not over the border: each value + 32 (bits 7-5 + 1, ~1074-1077) whatever $15 bit 5 says, and
 *   y < 224 (~1085).
 * zxnext.vhd ~4943-4946: the reset window is 0, 255, 0, 191.
 *
 * One 5-byte sprite, pattern 0 solid, scaled 8x in X and Y: 128 x 128 from (8, 8), so every window
 * below lies inside it. Sprite x is buffer x 32 + 2x, y is buffer row 16 + y.
 */

const SPRITE = 0x1c;
const NONE = 0xe0;

async function bigSprite(): Promise<NextTestSession> {
  const s = await parkedSession();
  writePalette(s, [[1, SPRITE]], 0x20);
  s.setNextReg(0x43, 0x00).setNextReg(0x4a, NONE).setNextReg(0x68, 0x80).setNextReg(0x4b, 0xe3);
  s.out(0x303b, 0x00);
  for (let i = 0; i < 256; i++) s.out(0x005b, 0x01);
  s.out(0x303b, 0x00);
  for (let i = 0; i < 128 * 4; i++) s.out(0x0057, 0x00);
  s.out(0x303b, 0x00);
  for (const b of [8, 8, 0x00, 0xc0, 0x1e]) s.out(0x0057, b); // --- attr4 $1E: X 8x, Y 8x
  return s;
}

/** Sets the four $19 values from index 0. */
function clip(s: NextTestSession, x1: number, x2: number, y1: number, y2: number): NextTestSession {
  return s.setNextReg(0x1c, 0x02).setNextReg(0x19, x1).setNextReg(0x19, x2).setNextReg(0x19, y1).setNextReg(0x19, y2);
}

/** Whether the sprite pixel at sprite-space (x, y) shows (both buffer pixels). */
function shows(s: NextTestSession, x: number, y: number): boolean {
  const a = s.pixel(32 + 2 * x, 16 + y);
  const b = s.pixel(33 + 2 * x, 16 + y);
  if (a !== b) throw new Error(`(${x},${y}) half-pixels differ: ${a} ${b}`);
  if (a !== hex8(SPRITE) && a !== hex8(NONE)) throw new Error(`(${x},${y}) unexpected ${a}`);
  return a === hex8(SPRITE);
}

/** The window edges seen along row `y` and column `x`: first/last shown x and y. */
function edges(s: NextTestSession, row: number, col: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = 0; x < 320; x++) if (shows(s, x, row)) xs.push(x);
  for (let y = 0; y < 256; y++) if (shows(s, col, y)) ys.push(y);
  return { x: xs.length ? [xs[0], xs[xs.length - 1]] : [], y: ys.length ? [ys[0], ys[ys.length - 1]] : [] };
}

describe("sprite clip window edges", () => {
  it("over the border, border clip: x from x1*2 to x2*2+1, y from y1 to y2", async () => {
    const s = await bigSprite();
    clip(s, 20, 40, 30, 90).setNextReg(0x15, 0x23).runFrames(2);
    expect(edges(s, 60, 60)).toEqual({ x: [40, 81], y: [30, 90] });
  });

  it("over the border, no border clip: the window registers do not apply", async () => {
    const s = await bigSprite();
    clip(s, 20, 40, 30, 90).setNextReg(0x15, 0x03).runFrames(2);
    expect(edges(s, 60, 60)).toEqual({ x: [8, 135], y: [8, 135] });
  });

  it("not over the border: the window + 32, and $15 bit 5 changes nothing", async () => {
    const s = await bigSprite();
    clip(s, 10, 40, 20, 60).setNextReg(0x15, 0x01).runFrames(2);
    expect(edges(s, 70, 60), "$15 = $01").toEqual({ x: [42, 72], y: [52, 92] });
    s.setNextReg(0x15, 0x21).runFrames(1);
    expect(edges(s, 70, 60), "$15 = $21").toEqual({ x: [42, 72], y: [52, 92] });
  });

  it("not over the border: an all-zero window leaves the single pixel (32, 32)", async () => {
    const s = await bigSprite();
    clip(s, 0, 0, 0, 0).setNextReg(0x15, 0x01).runFrames(2);
    expect(edges(s, 32, 32)).toEqual({ x: [32, 32], y: [32, 32] });
  });

  it("over the border, border clip: an all-$FF x2 / y2 reaches x 319 and y 255", async () => {
    const s = await bigSprite();
    // --- a sprite at the bottom right: (200, 136), 128 x 128 (clipped by the 320 x 256 area)
    s.out(0x303b, 0x00);
    for (const b of [200, 136, 0x00, 0xc0, 0x1e]) s.out(0x0057, b);
    clip(s, 0, 255, 0, 255).setNextReg(0x15, 0x23).runFrames(2);
    expect(edges(s, 200, 250)).toEqual({ x: [200, 319], y: [136, 255] });
  });
});
