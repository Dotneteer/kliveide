import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * B3 - NextReg $4A (fallback colour) reset value.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd` ~4990): the reset branch sets
 * `nr_4a_fallback_rgb <= X"E3"` (the `X"00"` line above it is commented out). The fallback colour is
 * what shows where no layer is opaque, e.g. with the ULA disabled by $68 bit 7.
 */
describe("NextReg $4A fallback colour after reset", () => {
  it("reads $E3 after a hard reset and after a soft reset", async () => {
    const s = await createSession();
    expect(s.readNextReg(0x4a)).toBe(0xe3);
    s.setNextReg(0x4a, 0x00).reset();
    expect(s.readNextReg(0x4a)).toBe(0xe3);
  });

  it("shows as magenta where no layer is opaque", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        nextreg $68,$80          ; ULA (border included) transparent; no other layer enabled
        nextreg $7F,$A5
        jr $
    `);
    s.runUntilReady().runFrames(1);
    s.expectProbe({ kind: "rect", name: "whole frame", x: [0, 719], y: [0, 287], rgb: "next8:0xE3" });
  });
});
