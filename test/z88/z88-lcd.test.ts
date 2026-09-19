import { describe, expect, it } from "vitest";

import { MC_SCREEN_SIZE } from "@common/machines/constants";
import { createZ88Session, z88Model, Z88_HARNESS_BACKENDS, Z88_LCD, type Z88TestSession } from "../harness/z88";

/*
 * The Z88 LCD: the Blink renders the screen map at SBR through the four font tables (PB0-PB3) every
 * 40 ms (every 8th 5 ms frame), 8 pixel rows per text row, 256 bytes per row of (char, attribute)
 * cells.
 *
 * Cells (Blink documentation): attribute bit 5 (HRS) clear is a 6-pixel LORES character with a 9-bit
 * code (attribute bit 0 is code bit 8); codes $1C0+ are user-defined graphics from LORES0 (PB0),
 * the rest come from LORES1 (PB1). HRS set is an 8-pixel HIRES character with a 10-bit code (bits
 * 0-1); codes $300+ come from HIRES1 (PB3), the rest from HIRES0 (PB2). REV inverts, GRY greys,
 * UND underlines (row 7), FLS flashes; HRS|REV|FLS is the cursor, and HRS|REV|GRY without FLS is
 * a null cell that takes no space.
 *
 * Colours, the flash timings and the unpainted right edge are the TypeScript oracle's, pinned so the
 * WASM core reproduces them. Step 0.3 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */

// --- Where the test puts things (the session's flat RAM: banks $20-$23 at $0000-$FFFF)
const SCREEN = 0x8000; // bank $22, offset $0000
const LORES1 = 0xc000; // bank $23, offset $0000
const LORES0 = 0x4000; // bank $21, offset $0000
const HIRES0 = 0x2000; // bank $20, offset $2000
const HIRES1 = 0x6000; // bank $21, offset $2000

// --- The register values that select them. The Blink takes the bank from the high bits and an
// --- aligned offset from the low bits: SBR/PB3 = bank<<3 | offset>>11 (2K), PB1 = bank<<2 |
// --- offset>>12 (4K), PB0 = bank<<5 | offset>>9 (512 bytes), PB2 = bank<<1 | offset>>13 (8K).
const SBR = (0x22 << 3) | (0x0000 >> 11);
const PB1 = (0x23 << 2) | (0x0000 >> 12);
const PB0 = (0x21 << 5) | (0x0000 >> 9);
const PB2 = (0x20 << 1) | (0x2000 >> 13);
const PB3 = (0x21 << 3) | (0x2000 >> 11);

const COM_RAMS = 0x04;
const COM_LCDON = 0x01;

const ATTR_HRS = 0x20;
const ATTR_REV = 0x10;
const ATTR_FLS = 0x08;
const ATTR_GRY = 0x04;
const ATTR_UND = 0x02;

const { ON, OFF, GREY, SCREEN_OFF } = Z88_LCD;

/** Writes a 16-bit LCD register: B (the port's high byte) carries its high byte */
function outWord(s: Z88TestSession, port: number, value: number): void {
  s.out(((value >> 8) << 8) | port, value & 0xff);
}

async function lcdSession(backend: any, options: { size?: string; lcdOn?: boolean } = {}) {
  const model = z88Model();
  const config = options.size ? { ...model.config, [MC_SCREEN_SIZE]: options.size } : undefined;
  const s = await createZ88Session({ backend, config });
  await s.loadCode(`
      .org $f000
spin: jr spin
  `);
  outWord(s, 0x70, PB0);
  outWord(s, 0x71, PB1);
  outWord(s, 0x72, PB2);
  outWord(s, 0x73, PB3);
  outWord(s, 0x74, SBR);
  s.out(0xb0, COM_RAMS | (options.lcdOn === false ? 0 : COM_LCDON));
  return s;
}

/** Puts a cell of the screen map */
function cell(s: Z88TestSession, row: number, column: number, char: number, attr: number): void {
  s.poke(SCREEN + row * 256 + column * 2, [char, attr]);
}

/** The pixels of one row of a character cell */
function rowPixels(s: Z88TestSession, x: number, y: number, width: number): number[] {
  return Array.from({ length: width }, (_, i) => s.pixel(x + i, y));
}

/** Runs until the frame after the next render (renders happen at frames divisible by 8) */
function renderOnce(s: Z88TestSession): void {
  s.runFrames(1);
  while (s.machine.frames % 8 !== 1) s.runFrames(1);
}

describe.each(Z88_HARNESS_BACKENDS)("Z88 LCD (%s)", (backend) => {
  it("the register values select the intended addresses", async () => {
    const s = await lcdSession(backend);
    expect(s.blinkState()).toMatchObject({ PB0: 0x420, PB1: 0x8c, PB2: 0x41, PB3: 0x10c, SBR: 0x110 });
  });

  it("with COM.LCDON clear, the whole LCD shows the off colour", async () => {
    const s = await lcdSession(backend, { lcdOn: false });
    renderOnce(s);
    expect(s.screen().every((p) => p === SCREEN_OFF)).toBe(true);
  });

  it("a LORES character: 6 pixels from bits 5-0 of LORES1 font bytes", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x21, 0x00, 0x3f, 0x12, 0, 0, 0, 0x1e]);
    cell(s, 0, 0, 0x41, 0x00);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 6)).toEqual([ON, OFF, OFF, OFF, OFF, ON]);
    expect(rowPixels(s, 0, 1, 6)).toEqual([OFF, OFF, OFF, OFF, OFF, OFF]);
    expect(rowPixels(s, 0, 2, 6)).toEqual([ON, ON, ON, ON, ON, ON]);
    expect(rowPixels(s, 0, 3, 6)).toEqual([OFF, ON, OFF, OFF, ON, OFF]);
    expect(rowPixels(s, 0, 7, 6)).toEqual([OFF, ON, ON, ON, ON, OFF]);
    // --- The next cell (char 0: an empty glyph) starts at x = 6
    expect(rowPixels(s, 6, 2, 6)).toEqual([OFF, OFF, OFF, OFF, OFF, OFF]);
  });

  it("attribute bit 0 is bit 8 of the LORES code", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x141 * 8, [0x30]);
    cell(s, 0, 0, 0x41, 0x01);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 6)).toEqual([ON, ON, OFF, OFF, OFF, OFF]);
  });

  it("LORES codes $1C0 and up are user-defined graphics from LORES0", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES0 + 0x05 * 8, [0x2a]);
    cell(s, 0, 0, 0xc5, 0x01);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 6)).toEqual([ON, OFF, ON, OFF, ON, OFF]);
  });

  it("REV inverts, GRY greys, UND underlines", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x21, 0, 0, 0, 0, 0, 0, 0x00]);
    cell(s, 0, 0, 0x41, ATTR_REV);
    cell(s, 0, 1, 0x41, ATTR_GRY);
    cell(s, 0, 2, 0x41, ATTR_UND);
    cell(s, 0, 3, 0x41, ATTR_UND | ATTR_REV);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 6)).toEqual([OFF, ON, ON, ON, ON, OFF]);
    expect(rowPixels(s, 6, 0, 6)).toEqual([GREY, OFF, OFF, OFF, OFF, GREY]);
    expect(rowPixels(s, 12, 7, 6)).toEqual([ON, ON, ON, ON, ON, ON]);
    expect(rowPixels(s, 18, 7, 6)).toEqual([OFF, OFF, OFF, OFF, OFF, OFF]);
  });

  it("a HIRES character: 8 pixels from HIRES0; the next cell starts 8 pixels on", async () => {
    const s = await lcdSession(backend);
    s.poke(HIRES0 + 0x05 * 8, [0x81, 0xff]);
    s.poke(LORES1 + 0x41 * 8, [0x20]);
    cell(s, 0, 0, 0x05, ATTR_HRS);
    cell(s, 0, 1, 0x41, 0x00);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 8)).toEqual([ON, OFF, OFF, OFF, OFF, OFF, OFF, ON]);
    expect(rowPixels(s, 0, 1, 8)).toEqual([ON, ON, ON, ON, ON, ON, ON, ON]);
    expect(s.pixel(8, 0)).toBe(ON);
  });

  it("HIRES codes $300 and up come from HIRES1 (the OZ window font)", async () => {
    const s = await lcdSession(backend);
    s.poke(HIRES1 + 0x02 * 8, [0xf0]);
    cell(s, 0, 0, 0x02, ATTR_HRS | 0x03);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 8)).toEqual([ON, ON, ON, ON, OFF, OFF, OFF, OFF]);
  });

  it("a null cell (HRS|REV|GRY) takes no space", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x3f]);
    cell(s, 0, 0, 0x41, ATTR_HRS | ATTR_REV | ATTR_GRY);
    cell(s, 0, 1, 0x41, 0x00);
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 6)).toEqual([ON, ON, ON, ON, ON, ON]);
  });

  it("after null cells, the rest of the row is unlit", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x3f]);
    cell(s, 0, 0, 0x41, 0x00);
    for (let c = 1; c < 108; c++) cell(s, 0, c, 0x00, ATTR_HRS | ATTR_REV | ATTR_GRY);
    renderOnce(s);
    expect(s.pixel(5, 0)).toBe(ON);
    for (const x of [6, 100, 635, 639]) {
      for (const y of [0, 7]) expect(s.pixel(x, y)).toBe(OFF);
    }
  });

  it("a row of LORES cells leaves the last 4 pixels of a 640-pixel row unpainted (oracle quirk)", async () => {
    // --- 107 + 1 cells are scanned; the 107th starts at x = 636 and does not fit, and the fill
    // --- after the last cell starts beyond the row. A fresh LCD buffer is 0 there.
    const s = await lcdSession(backend);
    renderOnce(s);
    expect(s.pixel(635, 0)).toBe(OFF);
    expect(rowPixels(s, 636, 0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("the cursor (HRS|REV|FLS) is a LORES character inverted while TIM0 <= 120", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x21]);
    cell(s, 0, 0, 0x41, ATTR_HRS | ATTR_REV | ATTR_FLS);
    renderOnce(s);
    expect(s.blinkState().TIM0).toBeLessThanOrEqual(120);
    expect(rowPixels(s, 0, 0, 6)).toEqual([OFF, ON, ON, ON, ON, OFF]);
    s.runUntil((t) => t.blinkState().TIM0 > 128, "TIM0 past 128");
    renderOnce(s);
    expect(rowPixels(s, 0, 0, 6)).toEqual([ON, OFF, OFF, OFF, OFF, ON]);
  });

  it("FLS characters vanish for 200 frames (1 second) every other second", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x3f]);
    cell(s, 0, 0, 0x41, ATTR_FLS);
    renderOnce(s);
    expect(s.pixel(0, 0)).toBe(ON);
    s.runUntil((t) => t.machine.frames >= 216, "frame 216");
    renderOnce(s);
    expect(s.pixel(0, 0)).toBe(OFF);
    s.runUntil((t) => t.machine.frames >= 416, "frame 416");
    renderOnce(s);
    expect(s.pixel(0, 0)).toBe(ON);
  });

  it("renders only every 8th frame", async () => {
    const s = await lcdSession(backend);
    s.poke(LORES1 + 0x41 * 8, [0x3f]);
    renderOnce(s);
    expect(s.pixel(0, 0)).toBe(OFF);
    cell(s, 0, 0, 0x41, 0x00);
    s.runFrames(6);
    expect(s.machine.frames % 8).toBe(7);
    expect(s.pixel(0, 0)).toBe(OFF);
    s.runFrames(2);
    expect(s.pixel(0, 0)).toBe(ON);
  });

  it.each([
    [undefined, 640, 64, 0xff, 8],
    ["640x320", 640, 320, 0xff, 40],
    ["640x480", 640, 480, 0xff, 60],
    ["800x320", 800, 320, 100, 40],
    ["800x480", 800, 480, 100, 60]
  ] as const)("LCD size %s is %ix%i (SCW %i, SCH %i), every text row rendered", async (size, w, h, scw, sch) => {
    const s = await lcdSession(backend, { size });
    expect(s.lcdWidth).toBe(w);
    expect(s.lcdHeight).toBe(h);
    expect(s.blinkState()).toMatchObject({ SCW: scw, SCH: sch });
    expect(s.in(0x70)).toBe(scw);
    expect(s.in(0x71)).toBe(sch);

    s.poke(LORES1 + 0x41 * 8, [0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f]);
    cell(s, sch - 1, 0, 0x41, 0x00);
    renderOnce(s);
    expect(s.screen()).toHaveLength(w * h);
    expect(s.pixel(0, h - 1)).toBe(ON);
    expect(s.pixel(0, h - 9)).toBe(OFF);
    expect(s.pixel(6, h - 1)).toBe(OFF);
    expect(s.screen().some((p) => p === SCREEN_OFF)).toBe(false);
  });
});
