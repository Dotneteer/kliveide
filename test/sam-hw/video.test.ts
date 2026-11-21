import { describe, expect, it } from "vitest";

import { createBareSam } from "./bare";
import type { SamTestSession } from "../harness/samcoupe";

/*
 * The ASIC's picture (plan §7; ASIC_VIDEO_MEMORY_TIMING.md §3): each mode on a worked byte, the mode-3
 * pixel swap, BRIGHT as CLUT 8-15, FLASH, the border, SOFF, the palette, a mid-line CLUT change, ATTR.
 *
 * The buffer: screen line y is row 48 + y; screen pixel clock c (12 MHz, 0-511) is column 64 + c.
 */

const SCREEN_PAGE = 30;
const VMPR = 0x00fc;

function rgb(s: SamTestSession, colour: number): number {
  return s.wasm.samGetPaletteRgb(colour) >>> 0;
}

function pixel(s: SamTestSession, y: number, c: number): number {
  return s.pixels()[(48 + y) * 640 + 64 + c] >>> 0;
}

/** A bare machine with the CPU idling in RAM (JR $), interrupts off, a known CLUT */
async function screenMachine(mode: number): Promise<SamTestSession> {
  const s = await createBareSam();
  s.poke(0x0000, [0x18, 0xfe]);
  for (let i = 0; i < 16; i++) s.out((i << 8) | 0xf8, i === 0 ? 0 : 0x10 + i * 7);
  s.out(VMPR, (((mode - 1) & 3) << 5) | SCREEN_PAGE);
  // --- Clear the screen pages
  s.pokePage(SCREEN_PAGE, 0, new Uint8Array(0x8000));
  return s;
}

describe("SAM picture", () => {
  it("palette levels: RED1+GRN1+GRN0+BLU0 is (4,6,2), with BRIGHT (5,7,3)", async () => {
    const s = await screenMachine(4);
    const level = (v: number) => Math.round((v * 7) / 255);
    const c = rgb(s, 0x20 | 0x40 | 0x04 | 0x01);
    expect([level(c & 0xff), level((c >> 8) & 0xff), level((c >> 16) & 0xff)]).toEqual([4, 6, 2]);
    const b = rgb(s, 0x20 | 0x40 | 0x04 | 0x01 | 0x08);
    expect([level(b & 0xff), level((b >> 8) & 0xff), level((b >> 16) & 0xff)]).toEqual([5, 7, 3]);
  });

  it("mode 4: two pixels a byte, the high nibble left, each two pixel clocks wide", async () => {
    const s = await screenMachine(4);
    s.pokePage(SCREEN_PAGE, 10 * 128 + 3, 0x5a);
    s.runFrames(2);
    const x = 3 * 2 * 2;
    expect(pixel(s, 10, x)).toBe(rgb(s, s.wasm.samGetClut(5)));
    expect(pixel(s, 10, x + 1)).toBe(rgb(s, s.wasm.samGetClut(5)));
    expect(pixel(s, 10, x + 2)).toBe(rgb(s, s.wasm.samGetClut(10)));
    expect(pixel(s, 10, x + 4)).toBe(rgb(s, s.wasm.samGetClut(0)));
  });

  it("mode 4 runs on into the next page (line 191 at 5F80h of the pair)", async () => {
    const s = await screenMachine(4);
    s.pokePage(SCREEN_PAGE, 191 * 128, 0x30);
    s.runFrames(2);
    expect(pixel(s, 191, 0)).toBe(rgb(s, s.wasm.samGetClut(3)));
  });

  it("mode 3: four pixels a byte, one clock each, pixel 01 -> CLUT 2 and 10 -> 1, HMPR bits 6-5 the high bits", async () => {
    const s = await screenMachine(3);
    s.out(0x00fb, 0x40);
    // --- 00 01 10 11
    s.pokePage(SCREEN_PAGE, 20 * 128, 0x1b);
    s.runFrames(2);
    const base = 0x08;
    expect(pixel(s, 20, 0)).toBe(rgb(s, s.wasm.samGetClut(base | 0)));
    expect(pixel(s, 20, 1)).toBe(rgb(s, s.wasm.samGetClut(base | 2)));
    expect(pixel(s, 20, 2)).toBe(rgb(s, s.wasm.samGetClut(base | 1)));
    expect(pixel(s, 20, 3)).toBe(rgb(s, s.wasm.samGetClut(base | 3)));
  });

  it("mode 1: the Spectrum layout, attributes at +1800h, BRIGHT selects CLUT 8-15", async () => {
    const s = await screenMachine(1);
    // --- Line 9 (third char row's second line): data at ((9&7)<<8) | ((9&38h)<<2) = 0120h + column 2
    s.pokePage(SCREEN_PAGE, 0x0122, 0x80);
    s.pokePage(SCREEN_PAGE, 0x1800 + 1 * 32 + 2, 0x40 | (3 << 3) | 6);
    s.runFrames(2);
    expect(pixel(s, 9, 2 * 16)).toBe(rgb(s, s.wasm.samGetClut(8 + 6)));
    expect(pixel(s, 9, 2 * 16 + 2)).toBe(rgb(s, s.wasm.samGetClut(8 + 3)));
  });

  it("mode 2: linear data, an attribute per byte at +2000h", async () => {
    const s = await screenMachine(2);
    s.pokePage(SCREEN_PAGE, 50 * 32 + 1, 0x01);
    s.pokePage(SCREEN_PAGE, 0x2000 + 50 * 32 + 1, (2 << 3) | 5);
    s.runFrames(2);
    expect(pixel(s, 50, 16 + 14)).toBe(rgb(s, s.wasm.samGetClut(5)));
    expect(pixel(s, 50, 16)).toBe(rgb(s, s.wasm.samGetClut(2)));
  });

  it("FLASH swaps ink and paper every 16 frames", async () => {
    const s = await screenMachine(2);
    s.pokePage(SCREEN_PAGE, 0, 0x80);
    s.pokePage(SCREEN_PAGE, 0x2000, 0x80 | (2 << 3) | 5);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      s.runFrames(1);
      seen.add(pixel(s, 0, 0));
    }
    expect(seen).toEqual(new Set([rgb(s, s.wasm.samGetClut(5)), rgb(s, s.wasm.samGetClut(2))]));
  });

  it("the border is CLUT (bit 5 << 3) | bits 2-0; SOFF in modes 3/4 shows black, not in modes 1/2", async () => {
    const s = await screenMachine(4);
    s.out(0x00fe, 0x20 | 0x03);
    s.runFrames(2);
    expect(s.pixels()[10 * 640 + 10] >>> 0).toBe(rgb(s, s.wasm.samGetClut(11)));
    s.pokePage(SCREEN_PAGE, 10 * 128, 0x55);
    s.out(0x00fe, 0x80 | 0x03);
    s.runFrames(2);
    expect(pixel(s, 10, 0)).toBe(0xff000000);
    expect(s.pixels()[10 * 640 + 10] >>> 0).toBe(0xff000000);
    expect(s.in(0xfefe) & 0x80).toBe(0x80);
    s.out(VMPR, SCREEN_PAGE);
    s.runFrames(2);
    expect(s.pixels()[10 * 640 + 10] >>> 0).toBe(rgb(s, s.wasm.samGetClut(3)));
    expect(s.in(0xfefe) & 0x80).toBe(0);
  });

  it("a CLUT write mid-line lands at the next cell", async () => {
    const s = await screenMachine(4);
    // --- CLUT 0 = colour 0; at screen line 30, hc 200, set it to 7Fh
    s.runFrames(1);
    const line = 68 + 30;
    s.wasm.samSetFrameTact(line * 384 + 200);
    s.out(0x00f8, 0x7f);
    s.wasm.samSetCpuPc(0);
    for (let i = 0; i < 100; i++) s.step(1);
    const before = pixel(s, 30, (192 - 128) * 2);
    const after = pixel(s, 30, (216 - 128) * 2);
    expect(before).toBe(rgb(s, 0));
    expect(after).toBe(rgb(s, 0x7f));
  });

  it("ATTR reads the attribute being fetched, and the last one in the border", async () => {
    const s = await screenMachine(2);
    for (let y = 0; y < 192; y++) for (let c = 0; c < 32; c++) s.pokePage(SCREEN_PAGE, 0x2000 + y * 32 + c, c === 31 ? 0x5a : 0x11);
    s.runFrames(1);
    s.wasm.samSetFrameTact((68 + 40) * 384 + 250);
    s.wasm.samSetCpuPc(0);
    s.step(4);
    expect(s.in(0x00ff)).toBe(0x11);
    // --- In the right border after line 40: the last attribute (column 31)
    while (s.wasm.samGetFrameTacts() < (68 + 41) * 384 + 4) s.step(1);
    expect(s.in(0x00ff)).toBe(0x5a);
  });

  it("HPEN is the screen line, 192 in the border", async () => {
    const s = await screenMachine(4);
    s.wasm.samSetFrameTact((68 + 77) * 384 + 200);
    s.step(1);
    expect(s.in(0x01f8)).toBe(77);
    s.wasm.samSetFrameTact(5 * 384);
    s.step(1);
    expect(s.in(0x01f8)).toBe(192);
  });
});
