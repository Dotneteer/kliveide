import { describe, expect, it } from "vitest";

import { createTimexSession, hasTc2048Rom, SPECTRUM_COLORS } from "..";

describe("Timex Computer 2048 harness", () => {
  it("boots the 48K ROM to the BASIC main entry on the Timex core", async () => {
    const s = await createTimexSession();
    s.bootToBasic();

    expect(s.machine.pc).toBe(0x12ac);
    expect(s.machine.isOsInitialized).toBe(true);
    expect(s.timex.romInUse).toBe("sp48");
    expect(s.portFf).toBe(0);
    expect(s.scale).toBe(2);
    expect(s.exports.sp48GetScreenWidth()).toBe(704);
  });

  it("probes the paper and the border in the 704-wide picture", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    // --- Top-left cell: pixel row 0 = %10000000, attribute ink 2 (red) on paper 6 (yellow)
    s.poke(0x4000, 0x80).poke(0x5800, 0x32).out(0xfe, 1).renderNow();

    expect(s.paperPixel(0, 0)).toBe(SPECTRUM_COLORS[2]);
    expect(s.paperPixel(1, 0)).toBe(SPECTRUM_COLORS[2]);
    expect(s.paperPixel(2, 0)).toBe(SPECTRUM_COLORS[6]);
    expect(s.borderPixel()).toBe(SPECTRUM_COLORS[1]);
  });

  it.skipIf(!hasTc2048Rom())("boots the TC2048 ROM named in KLIVE_TC2048_ROM", async () => {
    const s = await createTimexSession({ rom: "tc2048" });
    s.bootToBasic();
    expect(s.timex.romInUse).toBe("tc2048");
    expect(s.machine.pc).toBe(0x12ac);
  });
});
