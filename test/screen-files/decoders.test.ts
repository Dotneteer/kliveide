import { describe, expect, it } from "vitest";

import { splitPlus3Header, withHeader } from "@common/diskfs/plus3dos";
import { slrPicture, slrProbe } from "@common/screenFiles/loresScreen";
import { readScreenFile } from "@common/screenFiles/screenFile";
import { shcPicture, shcProbe, shrPicture, shrProbe } from "@common/screenFiles/timexScreen";
import {
  attrUsage,
  createScrPixelData,
  scrAttrOffset,
  scrPicture,
  scrPixelOffset,
  scrProbe
} from "@common/screenFiles/zxScreen";

/* The screen file decoders (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, Phase 1). */

const at = (w: number, x: number, y: number) => y * w + x;

describe("ZX Spectrum screen", () => {
  it("follows the ULA's third/line/row interleave", () => {
    expect(scrPixelOffset(0, 0)).toBe(0x0000);
    expect(scrPixelOffset(0, 1)).toBe(0x0100); // --- the next pixel line of a character row
    expect(scrPixelOffset(0, 8)).toBe(0x0020); // --- the next character row
    expect(scrPixelOffset(0, 63)).toBe(0x07e0);
    expect(scrPixelOffset(0, 64)).toBe(0x0800); // --- the second third
    expect(scrPixelOffset(0, 128)).toBe(0x1000); // --- the third third
    expect(scrPixelOffset(255, 191)).toBe(0x17ff);
    expect(scrAttrOffset(255, 191)).toBe(0x1aff);
  });

  it("draws INK and PAPER with BRIGHT, and swaps them in a FLASH cell's second phase", () => {
    const scr = new Uint8Array(6912);
    scr[scrPixelOffset(0, 100)] = 0x80; // --- pixel (0, 100) is INK
    scr[scrAttrOffset(0, 100)] = 0x80 | 0x40 | (1 << 3) | 6; // --- FLASH, BRIGHT, PAPER 1, INK 6
    const steady = scrPicture(scr, false);
    expect(steady.pixels[at(256, 0, 100)]).toBe(14); // --- BRIGHT yellow
    expect(steady.pixels[at(256, 1, 100)]).toBe(9); // --- BRIGHT blue
    expect(steady.flash[at(256, 0, 100)]).toBe(1);
    expect(steady.ink[at(256, 1, 100)]).toBe(14);
    expect(steady.paper[at(256, 0, 100)]).toBe(9);
    const swapped = scrPicture(scr, true);
    expect(swapped.pixels[at(256, 0, 100)]).toBe(9);
    expect(swapped.pixels[at(256, 1, 100)]).toBe(14);
    // --- a cell without FLASH does not swap
    expect(swapped.pixels[at(256, 0, 0)]).toBe(steady.pixels[at(256, 0, 0)]);
  });

  it("counts how the attributes use the colours", () => {
    const usage = attrUsage([0x47, 0x47, 0x80 | 0x10, 0x00]);
    expect(usage.ink[15]).toBe(2); // --- BRIGHT white INK twice
    expect(usage.paper[8]).toBe(2); // --- BRIGHT black PAPER
    expect(usage.paper[2]).toBe(1);
    expect(usage.paper[0]).toBe(1);
    expect(usage.bright).toBe(2);
    expect(usage.flash).toBe(1);
  });

  it("probes a pixel: its byte, bit and attribute", () => {
    const scr = new Uint8Array(6912);
    scr[scrPixelOffset(132, 47)] = 0x08;
    scr[scrAttrOffset(132, 47)] = 0x47;
    expect(scrProbe(scr, 132, 47)).toEqual({
      x: 132,
      y: 47,
      cellColumn: 16,
      cellRow: 5,
      pixelOffset: 0x07b0,
      bit: 3,
      ink: true,
      attrOffset: 0x18b0,
      attr: 0x47
    });
  });

  it("draws the previews' ABGR words as before", () => {
    const scr = new Uint8Array(6912);
    scr[0] = 0x80;
    scr[0x1800] = 0x40 | 2; // --- BRIGHT, INK 2
    const palette = Array.from({ length: 16 }, (_, i) => 0xff000000 + i);
    const target = new Uint32Array(256 * 192);
    createScrPixelData(scr, palette, target);
    expect(target[0]).toBe(palette[10]);
    expect(target[1]).toBe(palette[8]);
  });
});

describe("Timex hi-colour", () => {
  it("gives every pixel row of a cell its own attribute, from the $6000 half", () => {
    const shc = new Uint8Array(12288);
    shc[scrPixelOffset(0, 0)] = 0xff;
    shc[scrPixelOffset(0, 1)] = 0xff;
    shc[6144 + scrPixelOffset(0, 0)] = 2; // --- row 0: INK 2
    shc[6144 + scrPixelOffset(0, 1)] = 4; // --- row 1: INK 4
    const picture = shcPicture(shc);
    expect(picture.pixels[at(256, 0, 0)]).toBe(2);
    expect(picture.pixels[at(256, 0, 1)]).toBe(4);
    expect(shcProbe(shc, 3, 1)).toMatchObject({ stripColumn: 0, pixelOffset: 0x100, attrOffset: 6144 + 0x100, attr: 4, ink: true });
  });
});

describe("Timex hi-res", () => {
  it("takes the left byte of each 16-pixel word from $4000 and the right one from $6000", () => {
    const shr = new Uint8Array(12288);
    shr[0] = 0x80; // --- word 0, left byte: pixel 0
    shr[6144] = 0x01; // --- word 0, right byte: pixel 15
    shr[1] = 0x80; // --- word 1, left byte: pixel 16
    const picture = shrPicture(shr);
    expect(picture.width).toBe(512);
    expect([0, 1, 7, 8, 14, 15, 16].map((x) => picture.pixels[x])).toEqual([1, 0, 0, 0, 0, 1, 1]);
    expect(shrProbe(shr, 15, 0)).toMatchObject({ wordColumn: 0, right: true, offset: 6144, byte: 1, bit: 0, ink: true });
    expect(shrProbe(shr, 16, 0)).toMatchObject({ wordColumn: 1, right: false, offset: 1, ink: true });
  });
});

describe("LoRes", () => {
  it("is row-major, the bottom 48 rows at $6000", () => {
    const slr = Uint8Array.from({ length: 12288 }, (_, i) => i & 0xff);
    expect(slrPicture(slr).pixels[at(128, 5, 2)]).toBe((2 * 128 + 5) & 0xff);
    expect(slrProbe(slr, 0, 47)).toMatchObject({ offset: 47 * 128, address: 0x4000 + 47 * 128, bottom: false });
    expect(slrProbe(slr, 0, 48)).toMatchObject({ offset: 48 * 128, address: 0x6000, bottom: true });
  });
});

describe("screen files", () => {
  it("split a PLUS3DOS header off and keep it", () => {
    const body = new Uint8Array(6912);
    const { file } = readScreenFile("scr", withHeader({ name: "S.SCR", kind: "code", data: body, start: 0x4000 }));
    expect(file?.body.length).toBe(6912);
    expect(file?.bytes.length).toBe(7040);
    expect(file?.header).toMatchObject({ kind: "code", length: 6912, param1: 0x4000 });
    expect(readScreenFile("scr", body).file?.header).toBeUndefined();
  });

  it("do not skip 128 bytes that only look like a header (bad checksum)", () => {
    const bytes = withHeader({ name: "S.SCR", kind: "code", data: new Uint8Array(6912), start: 0x4000 });
    bytes[127] ^= 0xff;
    expect(readScreenFile("scr", bytes).error).toEqual({ size: 7040, expected: 6912 });
  });

  it("refuse a wrong size, naming the size and the one expected", () => {
    expect(readScreenFile("shr", new Uint8Array(12000)).error).toEqual({ size: 12000, expected: 12288 });
    expect(readScreenFile("slr", new Uint8Array(12288)).file?.kind).toBe("slr");
  });

  it("splitPlus3Header leaves a headerless file whole", () => {
    const bytes = new Uint8Array(200);
    expect(splitPlus3Header(bytes).body).toBe(bytes);
  });
});
