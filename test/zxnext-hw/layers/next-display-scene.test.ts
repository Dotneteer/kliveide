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

describe("next-display ula: the Timex modes and the scroll", () => {
  /*
   * The ULA article's pictures, drawn straight into bank 5 (no layer but the ULA is on). The program
   * only idles; the test writes the screen bytes and port $FF itself.
   */
  const IDLE = ".org $8000\n di\n jr $\n";
  const bitmapAddress = (y: number, col: number) =>
    0x4000 | ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | col;

  /** A session with the ULA alone: the screen cleared to `attr`, the border black */
  const ulaOnly = async (attr: number): Promise<NextTestSession> => {
    const s = await createSession();
    await s.loadCode(IDLE);
    s.poke(0x4000, new Uint8Array(0x1800));
    s.poke(0x5800, new Uint8Array(768).fill(attr));
    s.out(0xfe, 0);
    return s;
  };

  // --- A ball of radius 36 dots centred at (48, 48): cells 1-10 across and down
  const inBall = (x: number, y: number) => (x - 48) ** 2 + (y - 48) ** 2 <= 36 * 36;
  const drawBall = (s: NextTestSession) => {
    for (let y = 0; y < 96; y++) {
      for (let col = 0; col < 12; col++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) if (inBall(col * 8 + b, y)) byte |= 0x80 >> b;
        s.poke(bitmapAddress(y, col), byte);
      }
    }
  };
  // --- Diagonal bands of colour, one line tall: ink by (line + 2 * column), six inks, normal then
  // --- bright, so the eight lines of a cell have eight different inks; paper black
  const INKS = [2, 6, 4, 5, 1, 3];
  const bandAttr = (y: number, col: number) => {
    const k = (y + 2 * col) % 12;
    return (k >= 6 ? 0x40 : 0) | INKS[k % 6];
  };
  /** The ball, coloured per 8 x 8 cell at $5800 and per 8 x 1 strip at $6000 (hi-colour's colours) */
  const ballScreen = async (): Promise<NextTestSession> => {
    const s = await ulaOnly(0x07);
    drawBall(s);
    for (let y = 0; y < 192; y++) {
      for (let col = 0; col < 32; col++) {
        s.poke(0x2000 + bitmapAddress(y, col), col < 12 && y < 96 ? bandAttr(y, col) : 0x07);
      }
    }
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 12; col++) s.poke(0x5800 + row * 32 + col, bandAttr(row * 8, col));
    }
    return s;
  };
  const showMode = (s: NextTestSession, portFf: number): Frame => {
    s.out(0xff, portFf);
    s.runFrames(2);
    return s.screen();
  };

  it("colours the same bitmap per 8 x 8 cell, or per 8 x 1 strip in hi-colour", async () => {
    const s = await ballScreen();
    const standard = showMode(s, 0x00);
    const hiColour = showMode(s, 0x02);
    // --- In the cell of column 5, row 2 (dots 40-47, lines 16-23) the ball covers the whole cell
    const top = paper(44, 16);
    const bottom = paper(44, 23);
    expect(at(standard, top)).toBe(at(standard, bottom)); // one colour for the cell
    expect(at(hiColour, top)).not.toBe(at(hiColour, bottom)); // its own colour on each line
    expect(at(hiColour, top)).toBe(at(standard, top)); // the cell's top line has the same colour in both
    // --- hi-colour: eight lines, eight colours
    expect(new Set([...Array(8).keys()].map((line) => at(hiColour, paper(44, 16 + line)))).size).toBe(8);
    // --- Outside the ball, both show the black paper
    expect(at(standard, paper(2, 2))).toBe("#000000");
    expect(at(hiColour, paper(2, 2))).toBe("#000000");

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      // --- 12 x 12 cells, 96 x 96 dots: buffer x 96-287, rows 48-143
      await writeCrop(join(out, "en/under-the-hood/next-display/ula/standard.webp"), standard, 96, 48, 192, 96);
      await writeCrop(join(out, "en/under-the-hood/next-display/ula/hicolour.webp"), hiColour, 96, 48, 192, 96);
    }
  });

  it("interleaves the two display files into 512 dots across in hi-res", async () => {
    const s = await createSession();
    await s.prepareBasic(); // the 48K ROM, for its font at $3D00
    const font = s.peekBytes(0x3d00, 96 * 8);
    await s.loadCode(IDLE);
    s.poke(0x4000, new Uint8Array(0x1800));
    s.poke(0x6000, new Uint8Array(0x1800));
    s.poke(0x5800, new Uint8Array(768).fill(0x71)); // standard mode: bright, blue ink on yellow paper
    s.out(0xfe, 0);
    const lines = ["512 DOTS ACROSS: 64 COLUMNS,", "EVEN ONES FROM $4000, ODD", "ONES FROM $6000."];
    for (const [row, text] of lines.entries()) {
      for (const [k, ch] of [...text].entries()) {
        // --- hi-res column k: even from the first file's column k/2, odd from the second file's
        const base = (k & 1) === 0 ? 0 : 0x2000;
        for (let line = 0; line < 8; line++) {
          s.poke(base + bitmapAddress(row * 8 + line, k >> 1), font[(ch.charCodeAt(0) - 0x20) * 8 + line]);
        }
      }
    }
    const hiRes = showMode(s, 0x0e); // hi-res, port $FF bits 5-3 = 001: bright blue on yellow
    const standard = showMode(s, 0x00); // the same bytes, the first display file alone
    // --- "5" is hi-res column 0: its top stroke, row 1 of the glyph, spans the cell; in standard
    // --- mode the first file's column 0 is the same glyph twice as wide
    const fiveTop = font[(0x35 - 0x20) * 8 + 1];
    const firstInk = Math.clz32(fiveTop) - 24; // the leftmost set bit, 0 = the byte's bit 7
    expect(pixelHex(hiRes, 96 + firstInk, 48 + 1)).toBe(pixelHex(standard, 96 + 2 * firstInk, 48 + 1));
    // --- hi-res ink and paper are port $FF's colour, not an attribute: the same as standard's 0x71 here
    expect(pixelHex(hiRes, 96 + 300, 48 + 100)).toBe(pixelHex(standard, 96 + 300, 48 + 100));
    // --- the border in hi-res is the paper colour (yellow), not port $FE's black
    expect(at(hiRes, wide(4, 100))).toBe(pixelHex(hiRes, 96 + 300, 48 + 100));
    expect(at(standard, wide(4, 100))).toBe("#000000");

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      // --- the left half of the display area, three text rows: 128 x 24 dots
      await writeCrop(join(out, "en/under-the-hood/next-display/ula/hires.webp"), hiRes, 96, 48, 256, 24);
      await writeCrop(join(out, "en/under-the-hood/next-display/ula/hires-standard.webp"), standard, 96, 48, 256, 24);
    }
  });

  it("scrolls the ULA's picture with its colours, wrapping at 256 x 192", async () => {
    const s = await ulaOnly(0x00);
    drawBall(s);
    // --- every cell gets a paper colour in diagonal bands, black ink: the ball is a black silhouette
    for (let row = 0; row < 24; row++) {
      for (let col = 0; col < 32; col++) s.poke(0x5800 + row * 32 + col, (((col + row) % 6) + 1) << 3);
    }
    s.runFrames(2);
    const plain = s.screen();
    s.setNextReg(0x26, 100);
    s.setNextReg(0x27, 60);
    s.runFrames(2);
    const scrolled = s.screen();
    // --- the dot at (x, y) is the unscrolled dot at (x + 100, y + 60), wrapped; x + 100 is not on a
    // --- cell edge, so the colours moved dot by dot with the picture
    for (const [x, y] of [[0, 0], [3, 10], [155, 131], [156, 132], [200, 100], [255, 191]]) {
      expect(at(scrolled, paper(x, y))).toBe(at(plain, paper((x + 100) % 256, (y + 60) % 192)));
    }
    // --- the border does not scroll
    expect(at(scrolled, wide(4, 100))).toBe("#000000");

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      await writeWebp(join(out, "en/under-the-hood/next-display/ula/scroll-0.webp"), plain);
      await writeWebp(join(out, "en/under-the-hood/next-display/ula/scroll-1.webp"), scrolled);
    }
  });
});

describe("next-display layer2: one byte per dot, in three resolutions", () => {
  /*
   * The Layer 2 article's pictures: Layer 2 alone (the ULA switched off, the fallback colour black),
   * its 80K written straight into banks 8-12 from the test.
   */
  const IDLE = ".org $8000\n di\n jr $\n";
  /** Writes `bytes` (up to 80K) from the start of bank 8, page by page through MMU slot 7 */
  const writeLayer2 = (s: NextTestSession, bytes: Uint8Array) => {
    const saved = s.mmuPage(7);
    for (let page = 0; page * 0x2000 < bytes.length; page++) {
      s.setNextReg(0x57, 16 + page);
      s.poke(0xe000, bytes.subarray(page * 0x2000, (page + 1) * 0x2000));
    }
    s.setNextReg(0x57, saved);
  };
  const layer2Only = async (): Promise<NextTestSession> => {
    const s = await createSession();
    await s.loadCode(IDLE);
    s.setNextReg(0x68, 0x80); // the ULA off
    s.setNextReg(0x4a, 0x00); // the fallback colour black
    s.out(0x123b, 0x02); // Layer 2 on
    return s;
  };
  /** Wide-mode clip window: the whole 320 x 256 (X in units of two dots) */
  const wideClip = (s: NextTestSession) => {
    s.setNextReg(0x1c, 0x01);
    for (const v of [0, 159, 0, 255]) s.setNextReg(0x18, v);
  };

  // --- Eight colours (RRRGGGBB), none of them $E3, the transparency colour
  const BANDS = [0xe0, 0xfc, 0x1c, 0x1f, 0x03, 0xc3, 0xff, 0x92];
  const BAND_HEX = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#DB00FF", "#FFFFFF", "#9292B6"];

  it("reads the same bytes across in 256 x 192 and down in 320 x 256", async () => {
    // --- byte o is band o >> 11: 2,048 bytes, eight 256-byte pages, per band
    const bytes = new Uint8Array(80 * 1024).map((_, o) => BANDS[(o >> 11) % 8]);
    const s = await layer2Only();
    writeLayer2(s, bytes);
    s.runFrames(2);
    const rows = s.screen();
    s.setNextReg(0x70, 0x10); // 320 x 256
    wideClip(s);
    s.runFrames(2);
    const columns = s.screen();
    // --- 256 x 192: a page is a line, so the bands run across, 8 lines each
    expect(at(rows, paper(10, 3))).toBe(BAND_HEX[0]);
    expect(at(rows, paper(200, 3))).toBe(BAND_HEX[0]);
    expect(at(rows, paper(10, 12))).toBe(BAND_HEX[1]);
    expect(at(rows, paper(10, 191))).toBe(BAND_HEX[23 % 8]);
    // --- 320 x 256: a page is a column, so the bands run down, 8 columns each, over the wide area
    expect(at(columns, wide(3, 10))).toBe(BAND_HEX[0]);
    expect(at(columns, wide(3, 250))).toBe(BAND_HEX[0]);
    expect(at(columns, wide(12, 10))).toBe(BAND_HEX[1]);
    expect(at(columns, wide(319, 100))).toBe(BAND_HEX[39 % 8]);

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      await writeWebp(join(out, "en/under-the-hood/next-display/layer2/rows.webp"), rows);
      await writeWebp(join(out, "en/under-the-hood/next-display/layer2/columns.webp"), columns);
    }
  });

  it("puts two 4-bit dots in a byte at 640 x 256, coloured through the palette offset", async () => {
    const s = await createSession();
    await s.prepareBasic(); // the 48K ROM, for its font at $3D00
    const font = s.peekBytes(0x3d00, 96 * 8);
    await s.loadCode(IDLE);
    s.setNextReg(0x68, 0x80);
    s.setNextReg(0x4a, 0x00);
    s.out(0x123b, 0x02);
    const lines = [
      "LAYER 2 AT 640 X 256: 80 COLUMNS OF TEXT, 4 BITS A DOT, 2 DOTS IN A BYTE.",
      "THE BYTE AT X * 256 + Y HOLDS DOTS 2X AND 2X+1 OF LINE Y: THE HIGH NIBBLE FIRST.",
      "INK IS NIBBLE $F, PAPER NIBBLE $0; THE PALETTE OFFSET PICKS THEIR ROW OF 16."
    ];
    const bytes = new Uint8Array(80 * 1024);
    for (const [row, text] of lines.entries()) {
      for (const [k, ch] of [...text].entries()) {
        for (let line = 0; line < 8; line++) {
          const glyph = font[(ch.charCodeAt(0) - 0x20) * 8 + line];
          for (let b = 0; b < 4; b++) {
            // --- dots 2b and 2b+1 of the character: glyph bits 7-2b and 6-2b
            const hi = (glyph >> (7 - 2 * b)) & 1 ? 0xf0 : 0x00;
            const lo = (glyph >> (6 - 2 * b)) & 1 ? 0x0f : 0x00;
            bytes[(4 * k + b) * 256 + row * 8 + line] = hi | lo;
          }
        }
      }
    }
    writeLayer2(s, bytes);
    s.setNextReg(0x70, 0x20); // 640 x 256, palette offset 0
    wideClip(s);
    s.runFrames(2);
    const plain = s.screen();
    s.setNextReg(0x70, 0x2e); // palette offset $E: entries $E0-$EF
    s.runFrames(2);
    const offset = s.screen();
    // --- "L" (0x4C): its glyph row 1 is a vertical stroke; one buffer pixel per 640-mode dot
    const glyphL = font[(0x4c - 0x20) * 8 + 1];
    const firstInk = Math.clz32(glyphL) - 24;
    expect(pixelHex(plain, 32 + firstInk, 16 + 1)).toBe("#006DFF"); // entry $0F
    expect(pixelHex(plain, 32 + 7, 16 + 1)).toBe("#000000"); // entry $00
    expect(pixelHex(offset, 32 + firstInk, 16 + 1)).toBe("#FF6DFF"); // entry $EF
    expect(pixelHex(offset, 32 + 7, 16 + 1)).toBe("#FF0000"); // entry $E0

    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      // --- the left half of the wide area, the three text rows: 320 dots of 640 x 24 lines
      await writeCrop(join(out, "en/under-the-hood/next-display/layer2/hires.webp"), plain, 32, 16, 320, 24);
      await writeCrop(join(out, "en/under-the-hood/next-display/layer2/hires-offset.webp"), offset, 32, 16, 320, 24);
    }
  });
});

describe("next-display tilemap: orientations and text mode", () => {
  /*
   * The tilemap article's pictures: the tilemap alone (the ULA off, the fallback colour black), its map,
   * tiles and palette written from the test into bank 5 and the tilemap's first palette.
   */
  const IDLE = ".org $8000\n di\n jr $\n";
  const tilemapOnly = async (): Promise<NextTestSession> => {
    const s = await createSession();
    await s.loadCode(IDLE);
    s.setNextReg(0x68, 0x80);
    s.setNextReg(0x4a, 0x00);
    return s;
  };
  /** 8-bit colours into the tilemap's first palette from entry `first` */
  const tilemapPalette = (s: NextTestSession, first: number, colours: number[]) => {
    s.setNextReg(0x43, 0x30).setNextReg(0x40, first);
    for (const c of colours) s.setNextReg(0x41, c);
    s.setNextReg(0x43, 0x00);
  };

  it("draws one tile in its eight orientations: rotate clockwise, then mirror", async () => {
    const s = await tilemapOnly();
    // --- tile 0: all nibble $F, transparent; tile 1: an F on grey with a red top-left dot
    const F = [
      "21111100", "01000000", "01000000", "01111000",
      "01000000", "01000000", "01000000", "00000000"
    ];
    const tile1 = F.flatMap((row) => [0, 2, 4, 6].map((i) => (Number(row[i]) << 4) | Number(row[i + 1])));
    // --- the tiles at $6C00, past the map at $6000 (40 x 32 entries of two bytes: 2,560 bytes)
    s.poke(0x6c00, new Uint8Array(32).fill(0xff));
    s.poke(0x6c20, tile1);
    // --- the map at $6000: 40 x 32 entries of (tile, attribute), all empty but eight; tile k (0-7) at
    // --- column 1 + 2 * (k mod 4), row 1 + 2 * floor(k / 4), attribute bits 3-1 = k
    const map = new Uint8Array(40 * 32 * 2);
    const at8 = (k: number) => ({ col: 1 + 2 * (k % 4), row: 1 + 2 * Math.floor(k / 4) });
    for (let k = 0; k < 8; k++) {
      const { col, row } = at8(k);
      map[(row * 40 + col) * 2] = 1;
      map[(row * 40 + col) * 2 + 1] = k << 1;
    }
    s.poke(0x6000, map);
    tilemapPalette(s, 0, [0x49, 0xff, 0xe0]); // 0 grey, 1 white, 2 red
    s.setNextReg(0x6e, 0x20).setNextReg(0x6f, 0x2c).setNextReg(0x6b, 0x80);
    s.runFrames(2);
    const f = s.screen();
    // --- where the red dot goes: rotate (bit 1) moves tile dot (u, v) to (7 - v, u), then X mirror
    // --- (bit 3) takes x to 7 - x, and Y mirror (bit 2) y to 7 - y
    for (let k = 0; k < 8; k++) {
      let [x, y] = [0, 0];
      if (k & 1) [x, y] = [7 - y, x];
      if (k & 4) x = 7 - x;
      if (k & 2) y = 7 - y;
      const { col, row } = at8(k);
      expect(`attr ${k << 1}: ${at(f, wide(col * 8 + x, row * 8 + y))}`).toBe(`attr ${k << 1}: #FF0000`);
    }
    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      // --- columns 0-8 and rows 0-4: 72 x 40 dots
      await writeCrop(join(out, "en/under-the-hood/next-display/tilemap/orientations.webp"), f, 32, 16, 144, 40);
    }
  });

  it("shows 80 columns of text in text mode, two colours per character", async () => {
    const s = await createSession();
    await s.prepareBasic();
    const font = s.peekBytes(0x3d00, 96 * 8);
    await s.loadCode(IDLE);
    s.setNextReg(0x68, 0x80);
    s.setNextReg(0x4a, 0x00);
    const lines: Array<[string, number]> = [
      ["TILEMAP TEXT MODE: 80 X 32 CHARACTERS, ONE BIT A DOT, 8 BYTES A CHARACTER.", 0x00],
      ["A MAP ENTRY IS A CHARACTER CODE AND AN ATTRIBUTE: ITS TOP 7 BITS PICK 2 COLOURS.", 0x02],
      ["THE WHOLE SCREEN: 5,120 BYTES OF MAP AND 768 BYTES OF FONT, ALL IN BANK 5.", 0x04],
      ["NO MIRRORING OR ROTATION HERE: THOSE BITS OF THE ATTRIBUTE ARE COLOUR NOW.", 0x06]
    ];
    // --- the map at $6000 (80 x 32 x 2 = 5,120 bytes), the font as tiles 32-127 from $7400
    const map = new Uint8Array(80 * 32 * 2);
    for (let i = 0; i < 80 * 32; i++) map[2 * i] = 0x20;
    for (const [row, [text, attr]] of lines.entries()) {
      for (let col = 0; col < 80; col++) {
        map[(row * 80 + col) * 2] = col < text.length ? text.charCodeAt(col) : 0x20;
        map[(row * 80 + col) * 2 + 1] = attr;
      }
    }
    s.poke(0x6000, map);
    s.poke(0x7400 + 32 * 8, font);
    // --- entry pairs (paper, ink): black/white, dark blue/yellow, dark red/cyan, black/green
    tilemapPalette(s, 0, [0x00, 0xff, 0x02, 0xfc, 0xa0, 0x1f, 0x00, 0x1c]);
    s.setNextReg(0x6e, 0x20).setNextReg(0x6f, 0x34).setNextReg(0x6b, 0xc8); // on, 80 x 32, text mode
    s.runFrames(2);
    const f = s.screen();
    const paperInk = [["#000000", "#FFFFFF"], ["#0000B6", "#FFFF00"], ["#B60000", "#00FFFF"], ["#000000", "#00FF00"]];
    for (const [row, [text]] of lines.entries()) {
      // --- glyph row 0 is blank in this font: paper; the first character's first ink dot on its row 1
      expect(pixelHex(f, 32 + 3, 16 + row * 8)).toBe(paperInk[row][0]);
      const g = font[(text.charCodeAt(0) - 0x20) * 8 + 1];
      expect(pixelHex(f, 32 + Math.clz32(g) - 24, 16 + row * 8 + 1)).toBe(paperInk[row][1]);
    }
    const out = process.env.NEXT_DISPLAY_SHOTS;
    if (out) {
      // --- the left half, 40 of the 80 columns, four rows: 320 dots of 640 x 32 lines
      await writeCrop(join(out, "en/under-the-hood/next-display/tilemap/text.webp"), f, 32, 16, 320, 32);
    }
  });
});

/** One picture as lossless WebP, alpha forced opaque */
async function writeWebp(path: string, frame: Frame): Promise<void> {
  await writeCrop(path, frame, 0, 0, frame.width, frame.height);
}

/** A rectangle of the picture (buffer pixels) as lossless WebP, alpha forced opaque */
async function writeCrop(path: string, frame: Frame, x: number, y: number, width: number, height: number): Promise<void> {
  const opaque = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * frame.width + x) * 4;
    opaque.set(frame.rgba.subarray(from, from + width * 4), row * width * 4);
  }
  for (let k = 3; k < opaque.length; k += 4) opaque[k] = 0xff;
  const webp = await sharp(Buffer.from(opaque.buffer), { raw: { width, height, channels: 4 } })
    .webp({ lossless: true })
    .toBuffer();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, webp);
}
