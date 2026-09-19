import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * SPR-036: the sprite layer is transparent outside its 320-pixel window.
 *
 * Hardware (`_input/next-fpga/src/video/sprites.vhd`): `hcounter_i_valid <= hcounter_i < 320` (~1019) and
 * `pixel_en_o` needs it (~1085), whatever the clip window and `$15` say. With sprites over the border
 * (`$15` bit 1) a sprite at X = 312 shows its left eight pixels (x 312-319); the rest of the line -
 * the right border - and the start of the next line - the left border before sprite x 0 - show no
 * sprite pixel.
 *
 * Found by PAR-002 (parity/screen-parity): the TypeScript core kept the last pixel of the window and
 * smeared sprite x 319 across the right border and into the next line's left border.
 *
 * Geometry: sprite x 0 is buffer x 32 (paper x 0 is buffer 96, 32 sprite pixels right of it, two
 * buffer pixels each); sprite y 0 is buffer row 16.
 */

const RED = 0xe0;

describe("sprite window", () => {
  it("SPR-036: over the border, nothing of a sprite shows right of x 319 or in the next line's left border", async () => {
    const s = await createSession();
    await s.loadCode(" .org $8000\n di\n jr $");
    s.runFrames(1);
    // --- Sprite palette entry 1 red; pattern 0 all index 1 (opaque: $4B stays $E3)
    s.setNextReg(0x43, 0x20).setNextReg(0x40, 0x01).setNextReg(0x41, RED).setNextReg(0x43, 0x00);
    s.out(0x303b, 0x00);
    for (let i = 0; i < 256; i++) s.out(0x5b, 0x01);
    // --- Sprite 0: X = 312 (X8 in attribute 2), Y = 100, visible, pattern 0, 4 attribute bytes
    s.out(0x303b, 0x00).out(0x57, 312 & 0xff).out(0x57, 100).out(0x57, 0x01).out(0x57, 0x80);
    s.setNextReg(0x15, 0x03); // --- sprites visible, over the border
    s.runFrames(2);

    const row = 16 + 100;
    const red = s.pixel(32 + 2 * 312, row);
    expect(s.pixel(32 + 2 * 319, row), "x 319, still in the window").toBe(red);
    const border = s.pixel(700, 4); // --- top border, no sprite there
    expect(red, "the sprite shows").not.toBe(border);
    for (const x of [32 + 2 * 320, 32 + 2 * 327, 700, 719]) {
      expect(s.pixel(x, row), `right of the window: buffer x ${x}`).toBe(border);
    }
    for (const x of [0, 16, 31]) {
      expect(s.pixel(x, row + 1), `next line's left border: buffer x ${x}`).toBe(border);
    }
  });
});
