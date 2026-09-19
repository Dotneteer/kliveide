import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * Port decoding (catalogue PORT-004, PORT-005, PORT-009 - PORT-013).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2538: $FE is every even address (A0 = 0); no enable bit.
 * - ~3453-3465: $FE reads 1 & EAR & 1 & keyboard columns, where EAR = the EAR input or the last $FE
 *   bit 4 written (or bit 3, MIC, with $08 bit 0 = issue 2).
 * - ~2549: $7FFD = A15 0, A1-0 01, not $1FFD, and A14 1 only in +3 timing; `port_7ffd_wr` does not
 *   depend on the timing (`port_7ffd_active` only drives contention, ~4476).
 * - ~2555: $1FFD = A15-14 00, A13-12 01, A1-0 01 - never also $7FFD.
 * - ~1826-1834: an IN that no device answers reads $FF (expansion bus off).
 * - ~2591-2593, 2747: $FFFD reads the selected register; $BFFD reads the same only in +3 timing;
 *   $BFF5 (A3 = 0) reads the chip id and register number (ym2149.vhd ~221: AY_ID & '0' & addr;
 *   turbosound.vhd ~158-268: AY#0 = 11, AY#1 = 10, AY#2 = 01).
 * - ~2622: $DF reads Kempston joystick 1 only with the Specdrum port enabled and the mouse disabled.
 *
 * The harness machine is +3 timing after its hard reset; the border is observed in the picture.
 */

describe("port decoding", () => {
  it("PORT-004: every even port address sets the border", async () => {
    // --- The CPU is parked: left alone it runs the ROM, which sets the border itself
    const reference = await createSession();
    await reference.loadCode(" .org $8000\n jr $");
    reference.runFrames(1); // --- one settled frame after the hard reset
    reference.out(0x00fe, 0x02).runFrames(1);
    const red = reference.pixel(8, 8);
    reference.out(0x00fe, 0x01).runFrames(1);
    const blue = reference.pixel(8, 8);
    expect(red).not.toBe(blue);

    const s = await createSession();
    await s.loadCode(" .org $8000\n jr $");
    s.runFrames(1);
    for (const port of [0x1234, 0xfffe, 0x0000, 0x7ffc]) {
      s.out(0x00fe, 0x01).runFrames(1);
      expect(s.pixel(8, 8)).toBe(blue);
      s.out(port, 0x02).runFrames(1);
      expect(s.pixel(8, 8), `port $${port.toString(16)}`).toBe(red);
    }
  });

  it("PORT-005: $FE reads bits 7 and 5 as 1, bit 6 from EAR out (and MIC on issue 2)", async () => {
    const s = await createSession();
    const read = (value: number, issue2: boolean) => {
      s.setNextReg(0x08, issue2 ? 0x01 : 0x00).out(0x00fe, value);
      return s.in(0x00fe);
    };
    // --- No key down: bits 4-0 = 1; no EAR input
    expect(read(0x00, false)).toBe(0xbf);
    expect(read(0x10, false), "EAR out").toBe(0xff);
    expect(read(0x08, false), "MIC, issue 3").toBe(0xbf);
    expect(read(0x08, true), "MIC, issue 2").toBe(0xff);
    expect(read(0x00, true)).toBe(0xbf);
  });

  // --- PORT-009
  it("PORT-009: $7FFD pages in 48K, 128K and +3 timing", async () => {
    for (const timing of [0x90, 0xa0, 0xb0]) {
      const s = await createSession();
      s.setNextReg(0x03, timing).out(0x7ffd, 0x03);
      expect(s.readNextReg(0x56), `timing $${timing.toString(16)}`).toBe(0x06);
    }
  });

  it("PORT-009: A14 is decoded only in +3 timing", async () => {
    for (const [timing, pages] of [[0x90, true], [0xa0, true], [0xb0, false]] as const) {
      const s = await createSession();
      s.setNextReg(0x03, timing).out(0x0ffd, 0x03); // --- A14 = 0, A13-12 = 00: not $1FFD
      expect(s.readNextReg(0x56), `timing $${timing.toString(16)}`).toBe(pages ? 0x06 : 0x00);
    }
  });

  it("PORT-010: a $1FFD write does not also write $7FFD", async () => {
    const s = await createSession();
    s.out(0x7ffd, 0x03).out(0x1ffd, 0x00);
    expect(s.readNextReg(0x56)).toBe(0x06);
    expect((s.readNextReg(0x8e) >> 4) & 0x07, "$8E bank bits").toBe(0x03);
  });

  it("PORT-011: ports no device decodes read $FF", async () => {
    const s = await createSession();
    // --- Not $DFFD: it matches $FFFD's read decode (A15-14 = 11, A2 = 1; ~2591) and reads the AY.
    // --- Not $0xx1 with A15-12 = 0: that is the +3 floating bus port in +3 timing.
    for (const port of [0x8001, 0xab31, 0x7ffd, 0x4001, 0x1ffd, 0x00e7, 0x0057, 0x005b, 0x0103, 0x8f7b]) {
      expect(s.in(port), `$${port.toString(16)}`).toBe(0xff);
    }
  });

  // --- PORT-012
  it("PORT-012: $BFF5 reads the chip id and the selected register number", async () => {
    const s = await createSession();
    s.out(0xfffd, 0x0e);
    expect(s.in(0xbff5), "AY#0, R14").toBe(0xce);
    s.out(0xfffd, 0x1f); // --- bits 7-5 = 000: a 5-bit register number
    expect(s.in(0xbff5)).toBe(0xdf);

    s.setNextReg(0x08, 0x02); // --- TurboSound on
    s.out(0xfffd, 0xfe).out(0xfffd, 0x05); // --- select AY#1 (1111 11 10), then R5
    expect(s.in(0xbff5), "AY#1, R5").toBe(0x85);
    s.out(0xfffd, 0xfd).out(0xfffd, 0x03);
    expect(s.in(0xbff5), "AY#2, R3").toBe(0x43);
  });

  it("PORT-012: $BFFD reads the register like $FFFD in +3 timing only", async () => {
    const s = await createSession();
    s.out(0xfffd, 0x02).out(0xbffd, 0x5a);
    expect(s.in(0xfffd)).toBe(0x5a);
    expect(s.in(0xbffd), "+3").toBe(0x5a);
    s.setNextReg(0x03, 0xa0);
    expect(s.in(0xbffd), "128K").toBe(0xff);
    expect(s.in(0xfffd)).toBe(0x5a);
  });

  // --- PORT-013: $83 bit 5 = mouse, $84 bit 7 = Specdrum ($DF), $05 = 010 00 010: Kempston 1 / 2
  it("PORT-013: $DF reads Kempston 1 only with the mouse disabled and the Specdrum enabled", async () => {
    const read = async (mouse: boolean, specdrum: boolean) => {
      const s = await createSession();
      s.setNextReg(0x05, 0x42);
      if (!mouse) s.setNextReg(0x83, 0xdf);
      if (!specdrum) s.setNextReg(0x84, 0x7f);
      return s.in(0x00df);
    };
    expect(await read(true, true), "mouse enabled").toBe(0xff);
    expect(await read(false, true), "mouse disabled").toBe(0x00);
    expect(await read(false, false), "Specdrum disabled").toBe(0xff);
  });
});
