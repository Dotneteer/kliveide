import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HT1080Z_BASIC_SNIFF_BYTES, isTokenisedHt1080zBasic } from "@common/ht1080z/basContent";

/*
 * A `.bas` is an HT-1080Z program by its content (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D1): an FFh,
 * then lines whose links agree with their lengths.
 */
const DEMO = new Uint8Array(readFileSync(join(__dirname, "../../scripts/doc-shots/recipes/ht1080z-demo.bas")));
const utf16 = (text: string, bigEndian: boolean, bom: boolean) => {
  const out: number[] = bom ? (bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]) : [];
  for (const c of text) {
    const code = c.charCodeAt(0);
    out.push(...(bigEndian ? [code >> 8, code & 0xff] : [code & 0xff, code >> 8]));
  }
  return new Uint8Array(out);
};

/** The demo program as if saved from another address: every link moved by `delta` */
function relocated(delta: number): Uint8Array {
  const bytes = new Uint8Array(DEMO);
  let pos = 1;
  while (true) {
    const link = bytes[pos] | (bytes[pos + 1] << 8);
    if (!link) break;
    const moved = link + delta;
    bytes[pos] = moved & 0xff;
    bytes[pos + 1] = moved >> 8;
    pos = link - 0x42e9 + 1;
  }
  return bytes;
}

describe("isTokenisedHt1080zBasic", () => {
  it("takes a tokenised program, an empty one, and one saved from another address", () => {
    expect(isTokenisedHt1080zBasic(DEMO)).toBe(true);
    expect(isTokenisedHt1080zBasic([0xff, 0x00, 0x00])).toBe(true);
    expect(isTokenisedHt1080zBasic(relocated(0x6a00 - 0x42e9))).toBe(true);
  });

  it("takes the first bytes of a longer program, and refuses a whole file cut short", () => {
    expect(isTokenisedHt1080zBasic(DEMO.subarray(0, 60), false)).toBe(true);
    expect(isTokenisedHt1080zBasic(DEMO.subarray(0, 60), true)).toBe(false);
    expect(HT1080Z_BASIC_SNIFF_BYTES).toBeGreaterThanOrEqual(256);
  });

  it("refuses text: UTF-8, and UTF-16 either way, with or without a BOM", () => {
    const listing = '10 PRINT "HELLO"\r\n20 GOTO 10\r\n';
    expect(isTokenisedHt1080zBasic(new TextEncoder().encode(listing))).toBe(false);
    expect(isTokenisedHt1080zBasic(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(listing)]))).toBe(false);
    for (const bigEndian of [false, true]) {
      for (const bom of [false, true]) expect(isTokenisedHt1080zBasic(utf16(listing, bigEndian, bom))).toBe(false);
    }
    // --- One short line of UTF-16 text, whose bytes happen to hold a 00h
    expect(isTokenisedHt1080zBasic(utf16("1\n", false, true))).toBe(false);
  });

  it("refuses noise: FFh bytes, a broken chain, and too few bytes", () => {
    expect(isTokenisedHt1080zBasic(new Uint8Array(64).fill(0xff))).toBe(false);
    const broken = new Uint8Array(DEMO);
    broken[1] ^= 0x01;
    expect(isTokenisedHt1080zBasic(broken)).toBe(false);
    expect(isTokenisedHt1080zBasic([0xff])).toBe(false);
    expect(isTokenisedHt1080zBasic([])).toBe(false);
  });
});
