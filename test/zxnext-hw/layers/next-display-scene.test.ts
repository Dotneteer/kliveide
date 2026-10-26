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

describe("next-display timing: 50 and 60 Hz", () => {
  it("moves the picture up and shortens the frame at 60 Hz", async () => {
    const s = await drawScene();
    const hz50 = s.screen();
    // --- NextReg $05 bit 2: 60 Hz, taken at the end of the frame
    s.setNextReg(0x05, s.nextRegValue(0x05) | 0x04);
    s.runFrames(4);
    const hz60 = s.screen();
    // --- 50 Hz: the display area from window row 48, the tiles' ground on rows 216-271
    expect(at(hz50, [96 + 200, 48 + 8])).toBe(PANEL);
    expect(at(hz50, [40, 216])).toBe(TILE_TOP);
    expect(at(hz50, [40, 248])).toBe(TILE_TOP); // wide-area line 232: the top row of a tile
    // --- 60 Hz: the display area 24 lines lower in the frame, 24 rows higher in the window
    expect(at(hz60, [96 + 200, 24 + 8])).toBe(PANEL);
    expect(at(hz60, [40, 192])).toBe(TILE_TOP);
    // --- below the frame's last line (window row 248 on) there is nothing: black
    expect(at(hz60, [40, 248])).toBe("#000000");
    expect(at(hz60, [400, 280])).toBe("#000000");

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      await writeWebp(join(out, "en/under-the-hood/next-display/timing/hz50.webp"), hz50);
      await writeWebp(join(out, "en/under-the-hood/next-display/timing/hz60.webp"), hz60);
    }
  });
});

describe("next-display timing: line numbers", () => {
  /** Sets the $64 offset, waits twice for the active line ($1F, then $1E) to read 0, then writes $A5 to $7F */
  const lineZero = (offset: number) => `
    .model Next
    .org $8000
    di
    nextreg $64,${offset}
    ld bc,$243B
    call Zero
    call Zero
    nextreg $7F,$A5
    jr $
Zero:
Skip:
    ld a,$1F
    out (c),a
    inc b
    in a,(c)
    dec b
    or a
    jr z,Skip
Wait:
    ld a,$1F            ; the low byte first: the other way round, a line that moves on from 255 to
    out (c),a           ; 256 between the reads reads as 0 (this way it can read 511, which is not 0)
    inc b
    in d,(c)
    dec b
    ld a,$1E
    out (c),a
    inc b
    in a,(c)
    dec b
    or d
    jr nz,Wait
    ret
`;

  it("numbers from the display area, or from the wide area with an offset of 32", async () => {
    const lineOfZero = async (offset: number) => {
      const s = await createSession();
      await s.loadCode(lineZero(offset));
      s.runToNextRegWrite(0x7f, 0xa5, { maxFrames: 4 });
      return s.beamPosition().line;
    };
    expect(await lineOfZero(0)).toBe(64); // 128K timing at 50 Hz: the display area's first line
    expect(await lineOfZero(32)).toBe(32); // the wide area's first line
  });
});

describe("next-display palettes: one bitmap, four pictures", () => {
  /** The scene with some NextRegs written after it is drawn; no pixel byte changes */
  const variant = async (writes: Array<[number, number]>): Promise<Frame> => {
    const s = await drawScene();
    for (const [r, v] of writes) s.setNextReg(r, v);
    s.runFrames(2);
    return s.screen();
  };

  it("recolours Layer 2 through its palette, its offset and the transparency colour", async () => {
    const asDrawn = await variant([]);
    // --- Layer 2's first palette ($43 bits 6-4 = 001), entry $A8 rewritten as $12: RGB333 0,4,5
    const entry = await variant([[0x43, 0x10], [0x40, 0xa8], [0x41, 0x12], [0x43, 0x00]]);
    // --- palette offset 1 ($70 bits 3-0): byte $A8 shows entry $B8, colour $B8: 5,6,0
    const offset = await variant([[0x70, 0x01]]);
    // --- entry $A8 given the colour $E3, the global transparency colour: the hills' body becomes
    // --- see-through. (Setting $14 to $A8 instead would also do it, and make every $E3 dot visible.)
    const transparent = await variant([[0x43, 0x10], [0x40, 0xa8], [0x41, 0xe3], [0x43, 0x00]]);

    const hill = paper(128, 110);
    expect(at(asDrawn, hill)).toBe(HILL);
    expect(at(entry, hill)).toBe("#0092B6");
    expect(at(offset, hill)).toBe("#B6DB00");
    expect(at(transparent, hill)).toBe(SKY);
    // --- the rest of the picture is the same in all four
    for (const f of [entry, offset, transparent]) {
      expect(at(f, POINTS.ground)).toBe(TILE_TOP);
      expect(at(f, POINTS.sprite)).toBe(SPRITE);
    }
    expect(at(entry, POINTS.panel)).toBe(PANEL);
    expect(at(transparent, POINTS.panel)).toBe(PANEL);
    // --- the offset moves the transparent sky too: byte $E3 shows entry $F3, colour $F3 (7,4,7), which
    // --- is not $14, so Layer 2's sky is opaque and covers the ULA's panel below it
    expect(at(offset, POINTS.panel)).toBe("#FF92FF");
    expect(at(offset, paper(10, 30))).toBe("#FF92FF");

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      const pictures = { "as-drawn": asDrawn, entry, offset, transparent };
      for (const [name, f] of Object.entries(pictures)) {
        await writeWebp(join(out, `en/under-the-hood/next-display/palettes/${name}.webp`), f);
      }
    }
  });
});

describe("next-display composition: orders, priority, blending", () => {
  /** The scene with Layer 2 scrolled up 50 lines and the tilemap 64, so every pair of layers overlaps */
  const stacked = async (writes: Array<[number, number]>): Promise<Frame> => {
    const s = await drawScene();
    for (const [r, v] of [[0x17, 50], [0x31, 64], ...writes] as Array<[number, number]>) s.setNextReg(r, v);
    s.runFrames(2);
    return s.screen();
  };
  const order = (o: number): [number, number] => [0x15, (o << 2) | 0x01]; // $15: sprites on, order o
  // --- A: a sprite on a hill; B: the ULA panel on a hill's edge; C: a platform's top on a hill;
  // --- D: a sprite on the ground (the tilemap), with no Layer 2 under it
  const A = paper(154, 60);
  const B = paper(128, 8);
  const C = paper(60, 56);
  const D = wide(96, 166);
  const EDGE = "#DB6D00"; // Layer 2 $CC: 6,3,0

  it("lets each of the six orders decide the four overlaps", async () => {
    // --- expected winners at A, B, C, D: S sprite, L Layer 2, U the ULA/tilemap layer
    const expected: Record<string, [string, string, string, string]> = {
      SLU: ["S", "L", "L", "S"], LSU: ["L", "L", "L", "S"], SUL: ["S", "U", "U", "S"],
      LUS: ["L", "L", "L", "U"], USL: ["S", "U", "U", "U"], ULS: ["L", "U", "U", "U"]
    };
    const out = process.env.NEXT_DISPLAY_SHOTS;
    for (const [i, name] of ["SLU", "LSU", "SUL", "LUS", "USL", "ULS"].entries()) {
      const f = await stacked([order(i)]);
      const [a, b, c, d] = expected[name];
      expect(`${name} A ${at(f, A)}`).toBe(`${name} A ${a === "S" ? SPRITE : HILL}`);
      expect(`${name} B ${at(f, B)}`).toBe(`${name} B ${b === "U" ? PANEL : EDGE}`);
      expect(`${name} C ${at(f, C)}`).toBe(`${name} C ${c === "U" ? TILE_TOP : HILL}`);
      expect(`${name} D ${at(f, D) === SPRITE ? "S" : "U"}`).toBe(`${name} D ${d}`);
      if (out) await writeWebp(join(out, `en/under-the-hood/next-display/composition/order-${name.toLowerCase()}.webp`), f);
    }
  });

  it("lifts a Layer 2 dot with the priority bit above everything", async () => {
    // --- USL: the ULA/tilemap on top; Layer 2's entry $A8 gets the priority bit (the 2nd $44 write, bit 7)
    const plain = await stacked([order(4)]);
    const lifted = await stacked([order(4), [0x43, 0x10], [0x40, 0xa8], [0x44, 0xa8], [0x44, 0x80], [0x43, 0x00]]);
    expect(at(plain, C)).toBe(TILE_TOP);
    expect(at(lifted, C)).toBe(HILL); // the hill's body ($A8) over the platform
    expect(at(lifted, A)).toBe(HILL); // and over the sprite
    expect(at(lifted, B)).toBe(PANEL); // the edge ($CC) has no priority: the panel stays on top
    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) await writeWebp(join(out, "en/under-the-hood/next-display/composition/priority.webp"), lifted);
  });

  it("blends Layer 2 with the ULA, which then shows only where Layer 2 is opaque", async () => {
    // --- the ULA's clip window opened to the whole display area (yellow paper everywhere); blend mode
    // --- 110 ($15 = 110 << 2 | sprites on), blend source the ULA ($68 bits 6-5 = 00)
    const f = await stacked([[0x1c, 0x04], [0x1a, 0], [0x1a, 255], [0x1a, 0], [0x1a, 191], [0x15, (6 << 2) | 1], [0x68, 0x00]]);
    // --- a hill's body: Layer 2 5,2,0 + ULA yellow paper 5,5,0 = 10,7,0, clamped to 7,7,0
    expect(at(f, paper(128, 40))).toBe("#FFFF00");
    // --- where Layer 2 is transparent, the yellow paper does not show at all: the fallback does
    expect(at(f, paper(10, 100))).toBe(SKY);
    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) await writeWebp(join(out, "en/under-the-hood/next-display/composition/blend.webp"), f);
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
