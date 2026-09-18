import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, displayFileAddress } from "../../harness/zxnext";

/*
 * MEM-025 - $7FFD bit 3 displays bank 7 instead of bank 5 (the 128K shadow screen).
 *
 * Hardware: zxnext.vhd `port_7ffd_shadow` (port_7ffd_reg(3), also written by NextReg $69 bit 6,
 * ~3657) selects the bank the ULA fetches from. Cell (0,0) gets paper 1 in bank 5 and paper 2 in
 * bank 7, with an empty bitmap in both; bank 7 is paged at $C000 to write it.
 */
describe.each(ALL_CORES)("shadow screen - %s core", (core) => {
  it("$7FFD bit 3 switches the display between bank 5 and bank 7", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x11).setNextReg(0x41, 0x03).setNextReg(0x41, 0xe0); // --- paper 1 blue, 2 red
    s.out(0x7ffd, 0x07); // --- bank 7 at $C000, bank 5 displayed
    for (let row = 0; row < 8; row++) {
      s.poke(displayFileAddress(row, 0), 0x00);
      s.poke(displayFileAddress(row, 0) + 0x8000, 0x00);
    }
    s.poke(0x5800, 0x08).poke(0xd800, 0x10);
    const cell = { kind: "rect" as const, x: [96, 111] as [number, number], y: [48, 55] as [number, number] };

    s.runFrames(2).expectProbe({ ...cell, name: "bank 5", rgb: "next8:0x03" });
    s.out(0x7ffd, 0x0f).runFrames(2).expectProbe({ ...cell, name: "bank 7", rgb: "next8:0xE0" });
    expect(s.readNextReg(0x69) & 0x40).toBe(0x40);
    s.out(0x7ffd, 0x07).runFrames(2).expectProbe({ ...cell, name: "bank 5 again", rgb: "next8:0x03" });
  });
});
