import { describe, expect, it } from "vitest";

import { EpChars } from "@common/machines/char-codes";
import { createEpSession, type EpTestSession } from "../harness/enterprise";

/*
 * The memory panel's Enterprise character set (`EpChars`) against EXOS 2.1's own font, read from video
 * RAM after boot: in the CH128 text screen a glyph's row r is at (LD2 + r) * 128 + code.
 */

function glyph(s: EpTestSession, code: number): string[] {
  const ld2 = s.lpt()[1].ld2;
  return Array.from({ length: 7 }, (_, r) => {
    const byte = s.vram(((ld2 + r) * 128 + code) & 0xffff);
    return [...Array(8)].map((_, i) => (byte & (0x80 >> i) ? "#" : ".")).join("");
  });
}

describe("the Enterprise character set", () => {
  it("matches EXOS's font: £ at 23h, # at 01h, the umlauts below 20h", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    expect(glyph(s, 0x23)).toEqual(["...###..", "..##.##.", "..##....", ".####...", "..##....", "..##....", ".######."]);
    expect(glyph(s, 0x01)).toEqual(["..##.##.", "..##.##.", ".#######", "..##.##.", ".#######", "..##.##.", "..##.##."]);
    expect(glyph(s, 0x13)).toEqual([".##..##.", "........", "..####..", ".##..##.", ".##..##.", ".##..##.", "..####.."]);
    expect(glyph(s, 0x41)).toEqual(["...##...", "..####..", ".##..##.", ".##..##.", ".######.", ".##..##.", ".##..##."]);
    expect([EpChars[0x23].v, EpChars[0x01].v, EpChars[0x13].v, EpChars[0x41].v]).toEqual(["£", "#", "ö", "A"]);
  });
});
