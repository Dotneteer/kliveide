import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, parkedSession, writePalette } from "../ula/_ula-helpers";
import { rng, spriteFrame, type SpriteAttrs } from "./_sprite-model";

/*
 * Sprites (catalogue SPR-001 - SPR-035; SPR-006 is in attribute-mirror, SPR-027 in sprite-collision).
 * The picture tests compare every sprite pixel of the 320 x 256 sprite area with the transcription of
 * sprites.vhd in `_sprite-model.ts`, for random scenes of all 128 sprites (4 / 5-byte attributes,
 * anchors, composite and unified relatives, 4 / 8-bit patterns, scale, mirror, rotate, wrap-around).
 *
 * sprites.vhd CPU side: $303B write selects sprite d(6:0) for $57 and pattern d(5:0) (+128 bytes with
 * d(7)) for $5B; $5B writes auto-increment the 14-bit pattern address; $57 writes auto-increment the
 * attribute byte and move to the next sprite after byte 3 when its bit 6 is 0, or after byte 4.
 * $303B read: bit 1 = a line ran out of time, bit 0 = collision; the read clears both.
 * Video side: the line buffer covers x 0-319; the output is gated by the clip window - without
 * over-border ($15 bit 1) the $19 window + 32 and y < 224 (the reset window is the paper); with
 * over-border the whole 320 x 256, or with $15 bit 5 the window x1*2 .. x2*2+1, y1 .. y2.
 * zxnext.vhd: $15 bit 0 only gates the pixel into the mixer (~6880) - the engine runs regardless;
 * a sprite pixel is transparent only when not written ($14 does not apply to sprites).
 */

type Scene = { attrs: SpriteAttrs[]; patterns: Uint8Array; transparent: number };

/** A random scene whose busiest line needs at most `budget` engine clocks (no time-outs). */
function randomScene(seed: number, budget = 800): Scene {
  for (let attempt = 0; ; attempt++) {
    const r = rng(seed * 101 + attempt);
    const transparent = Math.floor(r() * 256);
    const patterns = new Uint8Array(0x4000);
    for (let i = 0; i < patterns.length; i++) patterns[i] = r() < 0.3 ? transparent : Math.floor(r() * 256);
    const scale = () => (r() < 0.6 ? 0 : r() < 0.6 ? 1 : r() < 0.6 ? 2 : 3);
    const attrs: SpriteAttrs[] = [];
    for (let i = 0; i < 128; i++) {
      const visible = r() < 0.85 ? 0x80 : 0;
      const pattern = Math.floor(r() * 64);
      const five = r() < 0.6;
      const relative = five && i > 0 && r() < 0.35;
      if (relative) {
        const off = () => Math.floor(r() * 97 - 48) & 0xff;
        const attr2 = (Math.floor(r() * 16) << 4) | (Math.floor(r() * 8) << 1) | (r() < 0.5 ? 1 : 0);
        const attr4 = 0x40 | (r() < 0.5 ? 0x20 : 0) | (scale() << 3) | (scale() << 1) | (r() < 0.5 ? 1 : 0);
        attrs.push([off(), off(), attr2, visible | 0x40 | pattern, attr4]);
      } else {
        const x = r() < 0.05 ? 490 + Math.floor(r() * 22) : Math.floor(r() * 340);
        const y = r() < 0.05 ? 500 + Math.floor(r() * 12) : Math.floor(r() * 270);
        const attr2 = (Math.floor(r() * 16) << 4) | (Math.floor(r() * 8) << 1) | (x >> 8);
        const four = five && r() < 0.4;
        const attr4 = (four ? 0x80 | (r() < 0.5 ? 0x40 : 0) : 0) | (r() < 0.5 ? 0x20 : 0) | (scale() << 3) | (scale() << 1) | (y >> 8);
        attrs.push([x & 0xff, y & 0xff, attr2, visible | (five ? 0x40 : 0) | pattern, five ? attr4 : 0]);
      }
    }
    const scene = { attrs, patterns, transparent };
    const busiest = Math.max(...spriteFrame(attrs, patterns, transparent, false).map((l) => l.cost));
    if (busiest <= budget) return scene;
  }
}

/** Uploads patterns (one $303B select, 16K auto-incremented $5B writes) and attributes (auto-incremented $57). */
function upload(s: NextTestSession, scene: Scene): NextTestSession {
  s.out(0x303b, 0x00);
  for (const b of scene.patterns) s.out(0x005b, b);
  s.out(0x303b, 0x00);
  for (const a of scene.attrs) {
    for (let k = 0; k < 4; k++) s.out(0x0057, a[k]);
    if (a[3] & 0x40) s.out(0x0057, a[4]);
  }
  return s;
}

/** A parked session: sprite palette i = colour i, ULA off, fallback $E3, the scene uploaded. */
async function spriteScreen(core: CoreName, scene: Scene): Promise<NextTestSession> {
  const s = await parkedSession(core);
  writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i] as [number, number]), 0x20);
  s.setNextReg(0x43, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x4a, 0xe3).setNextReg(0x68, 0x80);
  s.setNextReg(0x4b, scene.transparent);
  return upload(s, scene);
}

const NONE = hex8(0xe3);

/** Sprite-area pixels that differ from the model; `window(x, y)` says where the output is enabled. */
function mismatches(
  s: NextTestSession,
  scene: Scene,
  zeroOnTop: boolean,
  window: (x: number, y: number) => boolean,
  colour: (i: number) => string = hex8
): string[] {
  const lines = spriteFrame(scene.attrs, scene.patterns, scene.transparent, zeroOnTop);
  const bad: string[] = [];
  for (let y = 0; y < 256 && bad.length < 8; y++) {
    for (let x = 0; x < 320 && bad.length < 8; x++) {
      const i = lines[y].pixels[x];
      const want = i >= 0 && window(x, y) ? colour(i) : NONE;
      const got = s.pixel(32 + 2 * x, 16 + y);
      if (got !== want || s.pixel(33 + 2 * x, 16 + y) !== want) {
        const o = lines[y].owner[x];
        bad.push(`(${x},${y}): ${got} != ${want} (index ${i}, sprite ${o}${o >= 0 ? " " + scene.attrs[o].map((v) => v.toString(16)).join(",") : ""})`);
      }
    }
  }
  return bad;
}

const ALL = () => true;
const DEBUG = process.env.SPR_DEBUG === "1";

describe.each(ALL_CORES)("Sprites - %s core", (core: CoreName) => {
  for (const seed of [1, 2, 3, 4]) {
    it(`SPR-001 - SPR-005, SPR-008/009, SPR-014 - SPR-023, SPR-030/031, SPR-034/035: random 128-sprite scene ${seed}`, async () => {
      const scene = randomScene(seed);
      const s = await spriteScreen(core, scene);
      s.setNextReg(0x15, 0x03).runFrames(2); // --- visible, over the border
      const m = mismatches(s, scene, false, ALL);
      if (DEBUG && m.length) console.log(core, seed, m.join(" | "));
      expect(m).toEqual([]);
    });
  }

  it("SPR-024: $15 bit 6 puts sprite 0 on top (a later sprite does not overwrite)", async () => {
    const scene = randomScene(7);
    const s = await spriteScreen(core, scene);
    s.setNextReg(0x15, 0x43).runFrames(2);
    expect(mismatches(s, scene, true, ALL)).toEqual([]);
  });

  it("SPR-010: $15 bit 0 clear shows no sprite", async () => {
    const scene = randomScene(1);
    const s = await spriteScreen(core, scene);
    s.setNextReg(0x15, 0x02).runFrames(2);
    expect(colours(s, [32, 671], [16, 271])).toBe(NONE);
  });

  it("SPR-011 / SPR-013: without over-border the $19 window + 32 applies (reset: the paper); y stays below 224", async () => {
    const scene = randomScene(2);
    const s = await spriteScreen(core, scene);
    s.setNextReg(0x15, 0x01).runFrames(2);
    expect(mismatches(s, scene, false, (x, y) => x >= 32 && x <= 287 && y >= 32 && y <= 223), "reset window").toEqual([]);
    s.setNextReg(0x1c, 0x02).setNextReg(0x19, 16).setNextReg(0x19, 200).setNextReg(0x19, 8).setNextReg(0x19, 250).runFrames(1);
    expect(s.readNextReg(0x1c) & 0x0c, "$1C bits 3-2").toBe(0x00);
    const m = mismatches(s, scene, false, (x, y) => x >= 48 && x <= 232 && y >= 40 && y <= 223);
    if (DEBUG && m.length) console.log(core, "clip", m.join(" | "));
    expect(m, "window 16-200 x 8-250").toEqual([]);
  });

  it("SPR-011 / SPR-012: over-border ignores the window; with $15 bit 5 it is x1*2 .. x2*2+1, y1 .. y2", async () => {
    const scene = randomScene(3);
    const s = await spriteScreen(core, scene);
    s.setNextReg(0x1c, 0x02).setNextReg(0x19, 20).setNextReg(0x19, 100).setNextReg(0x19, 10).setNextReg(0x19, 200);
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(mismatches(s, scene, false, ALL), "over-border, no border clip").toEqual([]);
    s.setNextReg(0x15, 0x23).runFrames(1);
    expect(mismatches(s, scene, false, (x, y) => x >= 40 && x <= 201 && y >= 10 && y <= 200), "border clip").toEqual([]);
  });

  it("SPR-028: $43 bit 3 selects the second sprite palette", async () => {
    const scene = randomScene(4);
    const s = await spriteScreen(core, scene);
    writePalette(s, Array.from({ length: 256 }, (_, i) => [i, i ^ 0x3c] as [number, number]), 0x60);
    s.setNextReg(0x43, 0x08).setNextReg(0x15, 0x03).runFrames(2);
    expect(mismatches(s, scene, false, ALL, (i) => hex8(i ^ 0x3c))).toEqual([]);
  });

  /** One 16x16 sprite 0 of pattern 0 at (x, y); pattern 0 all `pixel`. */
  async function oneSprite(pixel: number, x: number, y: number): Promise<NextTestSession> {
    const s = await parkedSession(core);
    writePalette(s, [[pixel, 0x1c]], 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80);
    s.out(0x303b, 0);
    for (let i = 0; i < 256; i++) s.out(0x005b, pixel);
    s.out(0x303b, 0).out(0x0057, x & 0xff).out(0x0057, y).out(0x0057, x >> 8).out(0x0057, 0x80);
    return s;
  }

  it("SPR-018: $4B compares the pattern byte; a sprite colour equal to $14 stays opaque", async () => {
    const s = await oneSprite(0x42, 100, 100);
    s.setNextReg(0x14, 0x1c).setNextReg(0x4b, 0xe3).setNextReg(0x15, 0x03).runFrames(2);
    expect(colours(s, [32 + 200, 32 + 231], [16 + 100, 16 + 115]), "colour = $14: opaque").toBe(hex8(0x1c));
    s.setNextReg(0x4b, 0x42).runFrames(1);
    expect(colours(s, [32 + 200, 32 + 231], [16 + 100, 16 + 115]), "byte = $4B: transparent").toBe(hex8(0xe0));
  });

  /** Two sprites: 0 at (100, 100), 1 at (108, 104); the flag after a frame, read once. */
  async function collision(setup: (s: NextTestSession) => void, second = 0x05): Promise<number> {
    const s = await parkedSession(core);
    s.out(0x303b, 0);
    for (let i = 0; i < 256; i++) s.out(0x005b, 0x05); // --- pattern 0 opaque
    for (let i = 0; i < 256; i++) s.out(0x005b, second); // --- pattern 1
    s.out(0x303b, 0);
    for (const [x, y, p] of [[100, 100, 0], [108, 104, 1]]) s.out(0x0057, x).out(0x0057, y).out(0x0057, 0).out(0x0057, 0x80 | p);
    s.setNextReg(0x4b, 0xe3);
    setup(s);
    s.runFrames(2);
    s.in(0x303b);
    s.runFrames(1);
    return s.in(0x303b) & 0x01;
  }

  it("SPR-025: transparent pixels do not collide; clipped pixels and a disabled sprite layer still do", async () => {
    expect(await collision((s) => s.setNextReg(0x15, 0x03)), "opaque overlap").toBe(1);
    expect(await collision((s) => s.setNextReg(0x15, 0x03), 0xe3), "the second sprite transparent").toBe(0);
    // --- the overlap (x 108-115, y 104-115 in sprite coordinates) lies outside a window of x 0-40
    expect(await collision((s) => s.setNextReg(0x1c, 0x02).setNextReg(0x19, 0).setNextReg(0x19, 20).setNextReg(0x19, 0).setNextReg(0x19, 191).setNextReg(0x15, 0x01)), "clipped").toBe(1);
    expect(await collision((s) => s.setNextReg(0x15, 0x02)), "$15 bit 0 clear").toBe(1);
  });

  it("SPR-026: a line with more sprite work than time sets $303B bit 1; a light frame does not", async () => {
    const s = await parkedSession(core);
    s.out(0x303b, 0);
    for (let i = 0; i < 256; i++) s.out(0x005b, 0x05);
    // --- 128 sprites at y 100, x 8 wide (128 pixels each): 128 x 129 clocks >> one line
    s.out(0x303b, 0);
    for (let i = 0; i < 128; i++) s.out(0x0057, (i * 2) & 0xff).out(0x0057, 100).out(0x0057, 0).out(0x0057, 0xc0).out(0x0057, 0x18);
    s.setNextReg(0x15, 0x03).runFrames(2);
    s.in(0x303b);
    s.runFrames(1);
    expect(s.in(0x303b) & 0x02, "heavy").toBe(0x02);
    s.out(0x303b, 0);
    for (let i = 0; i < 128; i++) s.out(0x0057, (i * 2) & 0xff).out(0x0057, 100).out(0x0057, 0).out(0x0057, i < 8 ? 0x80 : 0x00);
    s.runFrames(2);
    s.in(0x303b);
    s.runFrames(1);
    expect(s.in(0x303b) & 0x02, "light").toBe(0x00);
  });

  it("SPR-007 / SPR-029: with $09 bit 4 (tie) $34 and $303B select the same sprite", async () => {
    // --- ($35-$39 are write-only: the result is checked on screen)
    const s = await parkedSession(core);
    writePalette(s, [[5, 0x1c]], 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80).setNextReg(0x4b, 0xe3);
    s.out(0x303b, 0);
    for (let i = 0; i < 256; i++) s.out(0x005b, 0x05);
    s.setNextReg(0x09, 0x10);
    // --- $34 = 5, then four $57 writes land in sprite 5 without a $303B select
    s.setNextReg(0x34, 0x05).out(0x0057, 100).out(0x0057, 100).out(0x0057, 0x00).out(0x0057, 0x80);
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(colours(s, [32 + 200, 32 + 231], [16 + 100, 16 + 115]), "sprite 5 written through $57").toBe(hex8(0x1c));
    s.out(0x303b, 0x09);
    expect(s.readNextReg(0x34), "$34 follows $303B").toBe(0x09);
    // --- without the tie they are independent
    s.setNextReg(0x09, 0x00).setNextReg(0x34, 0x20).out(0x303b, 0x0a);
    expect(s.readNextReg(0x34), "untied").toBe(0x20);
  });

  it("SPR-007: with the tie, $34 bit 7 selects the second half of the pattern for $5B (4-bit patterns)", async () => {
    const s = await parkedSession(core);
    writePalette(s, [[0x02, 0x1c], [0x01, 0xfc]], 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80).setNextReg(0x4b, 0xff);
    s.out(0x303b, 0x03);
    for (let i = 0; i < 256; i++) s.out(0x005b, 0x11); // --- pattern 3: both halves nibble 1
    s.setNextReg(0x09, 0x10).setNextReg(0x34, 0x83); // --- tie: pattern 3, second half (N6 = 1)
    for (let i = 0; i < 128; i++) s.out(0x005b, 0x22); // --- only the second half: nibble 2
    // --- sprite 0: 4-bit, pattern 3, N6 = 1 (attr 4 = $C0), at (100, 100)
    s.setNextReg(0x09, 0x00).out(0x303b, 0).out(0x0057, 100).out(0x0057, 100).out(0x0057, 0).out(0x0057, 0xc3).out(0x0057, 0xc0);
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(colours(s, [32 + 200, 32 + 231], [16 + 100, 16 + 115]), "N6 half written through the tie").toBe(hex8(0x1c));
  });

  it("SPR-035: a relative sprite 0 (no anchor yet on the line) is invisible", async () => {
    const scene = randomScene(5);
    // --- sprite 0 relative and visible, sprite 1 a visible anchor far away
    scene.attrs[0] = [10, 10, 0x00, 0xc0 | 5, 0x40];
    scene.attrs[1] = [100, 100, 0x00, 0xc0 | 6, 0x00];
    const s = await spriteScreen(core, scene);
    s.setNextReg(0x15, 0x03).runFrames(2);
    expect(mismatches(s, scene, false, ALL)).toEqual([]);
  });

  /*
   * SPR-032: every frame the program moves sprite 0 from X 40 to X 200 at copper line 96 (through the
   * $35 mirror) and back at line 250. The sprite is 16 wide and 192 tall (8 stacked relatives would do;
   * here: one sprite scaled Y x8 = 128 lines, from paper row 32). Rows built before the change show it at
   * 40, rows after at 200. The engine builds line V during line V - 1: rows near 96 are not checked.
   */
  it("SPR-032: an attribute change in mid-frame moves the sprite from the next lines on", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
Start:  di
        nextreg $7f,$a5
Frame:  ld a,250
        call WaitLine
        nextreg $34,0
        nextreg $35,40
        ld a,96
        call WaitLine
        nextreg $34,0
        nextreg $35,200
        jr Frame
WaitLine:
        ld e,a
        ld bc,$243b
        ld a,$1f
        out (c),a
        ld bc,$253b
WaitUntil:
        in a,(c)
        cp e
        jr nz,WaitUntil
        ret
    `, { entry: "Start" });
    writePalette(s, [[5, 0x1c]], 0x20);
    s.setNextReg(0x43, 0x00).setNextReg(0x4a, 0xe0).setNextReg(0x68, 0x80).setNextReg(0x4b, 0xe3);
    s.out(0x303b, 0);
    for (let i = 0; i < 256; i++) s.out(0x005b, 0x05);
    s.out(0x303b, 0).out(0x0057, 40).out(0x0057, 64).out(0x0057, 0).out(0x0057, 0xc0).out(0x0057, 0x06); // --- y 64 (paper 32), Y x8
    s.setNextReg(0x15, 0x03).runUntilReady().runFrames(3);
    // --- sprite rows 64-191 = paper rows 32-159; line 96 (paper row 96) = sprite row 128
    const at = (x: number, y0: number, y1: number) => colours(s, [32 + 2 * x, 32 + 2 * x + 31], [16 + y0, 16 + y1]);
    expect({ before: at(40, 64, 124), after: at(200, 132, 191), oldGone: at(40, 132, 191) }).toEqual({
      before: hex8(0x1c),
      after: hex8(0x1c),
      oldGone: hex8(0xe0)
    });
  });
});
