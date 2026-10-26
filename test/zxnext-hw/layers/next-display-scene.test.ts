import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createSession, pixelHex, type Frame, type NextTestSession } from "../../harness/zxnext";

/*
 * The scene of figure 4 of "ZX Spectrum Next: The Big Picture"
 * (docs/content/en/under-the-hood/emulator-internals/next-display/overview.mdx): one game-like
 * frame drawn on every layer (`next-display-scene.z80asm`), then each layer alone, through the same
 * layer debug view the IDE's Layers strip uses.
 *
 * The test checks that each layer contributes what the article says it does. With
 * NEXT_DISPLAY_SHOTS=<dir> it also writes the figure's six pictures,
 * `<dir>/en/under-the-hood/next-display/overview/layers-<name>.webp` (the docs' `public/images` is the
 * usual <dir>), only after the pictures were checked by eye. They are the 720 x 288 buffer as it is,
 * lossless; the page shows them at the 5:4 aspect Klive displays them with (half width).
 */

const SCENE = readFileSync(join(__dirname, "next-display-scene.z80asm"), "utf8");

// --- Buffer coordinates: 720 x 288, two pixels per 7 MHz dot; the paper at (96, 48), the wide area at (32, 16)
const paper = (x: number, y: number): [number, number] => [96 + 2 * x, 48 + y];
const wide = (x: number, y: number): [number, number] => [32 + 2 * x, 16 + y];

const SKY = "#496DFF"; // the fallback $4F: RGB333 2,3,7
const HILL = "#B64900"; // Layer 2 $A8: 5,2,0
const TILE_TOP = "#00FF00"; // tilemap entry 1, $1C: 0,7,0
const SPRITE = "#B600FF"; // sprite $A3: 5,0,7
const PANEL = "#B6B600"; // ULA yellow paper: 5,5,0
const BORDER = "#000000";

const POINTS = {
  sky: paper(10, 30),
  hill: paper(128, 110),
  ground: wide(4, 200),
  sprite: wide(186, 92),
  panel: paper(100, 8),
  border: wide(4, 100)
};

async function drawScene(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(SCENE);
  // --- The Layer 2 fill takes about seven frames at 28 MHz; the program then idles in `jr $`
  s.runFrames(30);
  return s;
}

/** The paused picture with one layer alone over the checker, or with every layer hidden */
function layerPicture(s: NextTestSession, solo?: "ula" | "tm" | "l2" | "spr"): Frame {
  s.setLayerCapture(true);
  s.runFrames(2);
  s.setLayerDebug(solo ? { solo } : { hide: ["ula", "tm", "l2", "spr"] });
  const { status, frame } = s.recomposeLayers();
  expect(status.exact).toBe(true);
  s.setLayerDebug();
  return frame;
}

const at = (frame: Frame, [x, y]: [number, number]) => pixelHex(frame, x, y);
const isChecker = (hex: string) => hex === "#494949" || hex === "#6D6D6D";

describe("next-display overview: the layered scene", () => {
  it("composes the five sources into one picture in SLU order", async () => {
    const s = await drawScene();
    const picture = s.screen();
    expect(at(picture, POINTS.sky)).toBe(SKY);
    expect(at(picture, POINTS.hill)).toBe(HILL);
    expect(at(picture, POINTS.ground)).toBe(TILE_TOP);
    expect(at(picture, POINTS.sprite)).toBe(SPRITE);
    expect(at(picture, POINTS.panel)).toBe(PANEL);
    expect(at(picture, POINTS.border)).toBe(BORDER);
  });

  it("gives each layer only its own part of the picture", async () => {
    const s = await drawScene();
    const ula = layerPicture(s, "ula");
    expect(at(ula, POINTS.panel)).toBe(PANEL);
    expect(at(ula, POINTS.border)).toBe(BORDER);
    expect(isChecker(at(ula, POINTS.sky))).toBe(true); // clipped: transparent

    const tm = layerPicture(s, "tm");
    expect(at(tm, POINTS.ground)).toBe(TILE_TOP);
    expect(isChecker(at(tm, POINTS.sky))).toBe(true);

    const l2 = layerPicture(s, "l2");
    expect(at(l2, POINTS.hill)).toBe(HILL);
    expect(isChecker(at(l2, POINTS.sky))).toBe(true); // $E3: transparent

    const spr = layerPicture(s, "spr");
    expect(at(spr, POINTS.sprite)).toBe(SPRITE);
    expect(isChecker(at(spr, POINTS.hill))).toBe(true);

    const none = layerPicture(s);
    expect(at(none, POINTS.hill)).toBe(SKY);
    expect(at(none, POINTS.border)).toBe(SKY);

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      const pictures = { ula, tm, l2, spr, fallback: none, picture: s.screen() };
      for (const [name, frame] of Object.entries(pictures)) {
        await writeWebp(join(out, `en/under-the-hood/next-display/overview/layers-${name}.webp`), frame);
      }
    }
  });
});

describe("next-display overview: clip windows and scrolling", () => {
  it("shows Layer 2 only inside its clip window, which does not move the picture", async () => {
    const s = await drawScene();
    const before = s.screen();
    // --- Layer 2's window: X 64-191, Y 40-150 of the display area (NextReg $18, after resetting its index)
    s.setNextReg(0x1c, 0x01);
    for (const v of [64, 191, 40, 150]) s.setNextReg(0x18, v);
    s.runFrames(2);
    const clipped = s.screen();
    expect(at(before, paper(10, 110))).toBe(HILL);
    expect(at(clipped, paper(10, 110))).toBe(SKY); // left of the window: the layer below shows
    expect(at(clipped, paper(128, 110))).toBe(HILL); // inside: the same dot as before
    expect(at(clipped, paper(128, 60))).toBe(at(before, paper(128, 60)));
    expect(at(clipped, POINTS.panel)).toBe(PANEL);

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      await writeWebp(join(out, "en/under-the-hood/next-display/overview/clip-off.webp"), before);
      await writeWebp(join(out, "en/under-the-hood/next-display/overview/clip-on.webp"), clipped);
    }
  });

  it("scrolls Layer 2 and the tilemap by their own offsets, with wrap-around", async () => {
    const s = await drawScene();
    const frames: Frame[] = [];
    // --- Layer 2 by 0, 16, 32 dots ($16); the tilemap three times as fast, 0, 48, 96 ($2F/$30)
    for (const step of [0, 1, 2]) {
      s.setNextReg(0x16, 16 * step);
      s.setNextReg(0x2f, 0);
      s.setNextReg(0x30, 48 * step);
      s.runFrames(2);
      frames.push(s.screen());
    }
    // --- The hill's edge at the left of the paper moves left: x 0 shows the hill at y 60 unscrolled,
    // --- sky when the picture is moved by 16 (its top there is then y 72)
    expect(at(frames[0], paper(0, 60))).toBe(HILL);
    expect(at(frames[1], paper(0, 60))).toBe(SKY);
    // --- The left platform (columns 8-14, x 64-119 of the wide area) moves 48 dots left
    expect(at(frames[0], wide(20, 152))).toBe(BORDER);
    expect(at(frames[1], wide(20, 152))).toBe(TILE_TOP);
    // --- What leaves on the left comes back on the right: the platform from columns 26-32 is at
    // --- x 208-263 - 96 = 112-167 in the last frame, and the ground has no gap
    expect(at(frames[2], wide(140, 152))).toBe(TILE_TOP);
    expect(at(frames[2], wide(316, 200))).toBe(TILE_TOP);
    // --- The ULA panel and the sprites did not move
    for (const f of frames) {
      expect(at(f, POINTS.panel)).toBe(PANEL);
      expect(at(f, POINTS.sprite)).toBe(SPRITE);
    }

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      for (const [i, f] of frames.entries()) {
        await writeWebp(join(out, `en/under-the-hood/next-display/overview/scroll-${i}.webp`), f);
      }
    }
  });
});

/** One picture as lossless WebP, alpha forced opaque */
async function writeWebp(path: string, frame: Frame): Promise<void> {
  const opaque = new Uint8Array(frame.rgba);
  for (let k = 3; k < opaque.length; k += 4) opaque[k] = 0xff;
  const webp = await sharp(Buffer.from(opaque.buffer), { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .webp({ lossless: true })
    .toBuffer();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, webp);
}
