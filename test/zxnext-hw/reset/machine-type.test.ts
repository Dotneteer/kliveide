import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * NextReg $03 - machine type, display timing, user lock, config mode (catalogue RST-007 - RST-012).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd` ~5100-5130, read mux ~5840):
 * - read: palette_sub_idx (7) & machine_timing (6-4) & user_dt_lock (3) & machine_type (2-0).
 * - timing changes only when bit 7 = 1, bit 3 = 0 and the lock is off; 000/001 -> 001 (48K),
 *   010 -> 128K, 011 -> +3, 100 -> Pentagon, 101-111 -> 011.
 * - bit 3 toggles the lock (`user_dt_lock xor bit 3`).
 * - the machine type (001-100) changes only in config mode.
 * - low bits 111 enter config mode, 000 leave it unchanged, anything else leaves it.
 * - $0A bits 7-6 (Multiface type) change only in config mode (~5170).
 * Writing only bit 7 + timing with low bits 000 keeps config mode and the type as they are.
 */
const timing = (v: number) => (v >> 4) & 0x07;
const type = (v: number) => v & 0x07;

describe("NextReg 0x03 machine type", () => {
  it("RST-007: the machine type changes only in config mode", async () => {
    const s = await createSession();
    const initial = type(s.readNextReg(0x03));
    s.setNextReg(0x03, 0x02);
    expect(type(s.readNextReg(0x03)), "outside config mode").toBe(initial);
    s.setNextReg(0x03, 0x07); // --- enter config mode; 111 is not a type
    expect(type(s.readNextReg(0x03))).toBe(initial);
    s.setNextReg(0x03, 0x01); // --- accepted (config mode at the time), then config mode is left
    expect(type(s.readNextReg(0x03))).toBe(0x01);
    s.setNextReg(0x03, 0x02);
    expect(type(s.readNextReg(0x03)), "config mode was left").toBe(0x01);
  });

  const TIMINGS: Array<[written: number, stored: number]> = [
    [0, 1], [1, 1], [2, 2], [3, 3], [4, 4], [5, 3], [6, 3], [7, 3]
  ];
  for (const [written, stored] of TIMINGS) {
    it(`RST-008: writing timing ${written} with bit 7 stores ${stored}`, async () => {
      const s = await createSession();
      s.setNextReg(0x03, 0x80 | (written << 4));
      expect(timing(s.readNextReg(0x03))).toBe(stored);
    });
  }

  it("RST-008: without bit 7 the timing does not change", async () => {
    const s = await createSession();
    s.setNextReg(0x03, 0x80 | (2 << 4));
    s.setNextReg(0x03, 4 << 4);
    expect(timing(s.readNextReg(0x03))).toBe(2);
  });

  /*
   * Frame length per timing at 3.5 MHz (zxula_timing.vhd): 48K 224 x 312, 128K and +3 228 x 311,
   * Pentagon 224 x 320 tacts.
   */
  const FRAMES: Array<[name: string, t: number, tacts: number]> = [
    ["48K", 1, 224 * 312],
    ["128K", 2, 228 * 311],
    ["+3", 3, 228 * 311],
    ["Pentagon", 4, 224 * 320]
  ];
  for (const [name, t, tacts] of FRAMES) {
    it(`RST-008: ${name} timing runs ${tacts} tacts per frame`, async () => {
      const s = await createSession();
      await s.loadCode(` .org $8000\n jr $`);
      s.setNextReg(0x07, 0x00).setNextReg(0x03, 0x80 | (t << 4));
      s.runFrames(2);
      // --- A frame end is observed at an instruction boundary (the loop is 12 T-states), so measure
      // --- ten frames and allow less than one instruction of difference.
      const before = s.tacts;
      s.runFrames(10);
      expect(Math.abs(s.tacts - before - 10 * tacts), `${s.tacts - before} for 10 frames`).toBeLessThan(12);
    });
  }

  /*
   * The picture follows the raster: every timing shows the paper at buffer (96, 48) and the border
   * around it (TimingConfig's framing), whatever the line and frame length.
   */
  for (const [name, t] of FRAMES) {
    it(`RST-008: ${name} timing draws paper and border in place`, async () => {
      const s = await createSession();
      await s.loadCode(` .org $8000\n jr $`);
      s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x10).setNextReg(0x41, 0xe0).setNextReg(0x41, 0x1c); // --- paper 0 red, 1 green
      for (let row = 0; row < 8; row++) s.poke(0x4000 + (row << 8), 0x00);
      s.poke(0x5800, 0x08).poke(0x5801, 0x00); // --- cell 0 paper 1, cell 1 paper 0
      s.out(0xfe, 0x01).setNextReg(0x03, 0x80 | (t << 4)).runFrames(3);
      s.expectProbe({ kind: "rect", name: "cell 0", x: [98, 109], y: [49, 54], rgb: "next8:0x1C" });
      s.expectProbe({ kind: "rect", name: "cell 1", x: [114, 125], y: [49, 54], rgb: "next8:0xE0" });
      s.expectProbe({ kind: "rect", name: "left border", x: [40, 90], y: [49, 54], rgb: "next8:0x1C" });
      s.expectProbe({ kind: "rect", name: "top border", x: [98, 600], y: [20, 44], rgb: "next8:0x1C" });
    });
  }

  it("RST-009: bit 3 toggles the user lock; while locked timing writes are ignored", async () => {
    const s = await createSession();
    s.setNextReg(0x03, 0x80 | (2 << 4));
    s.setNextReg(0x03, 0x08); // --- lock on
    expect(s.readNextReg(0x03) & 0x08).toBe(0x08);
    s.setNextReg(0x03, 0x80 | (4 << 4));
    expect(timing(s.readNextReg(0x03)), "locked").toBe(2);
    s.setNextReg(0x03, 0x08); // --- lock off
    expect(s.readNextReg(0x03) & 0x08).toBe(0x00);
    s.setNextReg(0x03, 0x80 | (4 << 4));
    expect(timing(s.readNextReg(0x03))).toBe(4);
    s.setNextReg(0x03, 0x88 | (1 << 4)); // --- bit 3 with bit 7: toggles the lock, no timing change
    expect(timing(s.readNextReg(0x03))).toBe(4);
    expect(s.readNextReg(0x03) & 0x08).toBe(0x08);
  });

  it("RST-010: bit 7 reads 1 between the two bytes of a $44 write", async () => {
    const s = await createSession();
    s.setNextReg(0x40, 0x00);
    expect(s.readNextReg(0x03) & 0x80).toBe(0x00);
    s.setNextReg(0x44, 0x12);
    expect(s.readNextReg(0x03) & 0x80).toBe(0x80);
    s.setNextReg(0x44, 0x01);
    expect(s.readNextReg(0x03) & 0x80).toBe(0x00);
  });

  it("RST-011: $0A bits 7-6 (Multiface type) change only in config mode", async () => {
    const s = await createSession();
    const mf = () => (s.readNextReg(0x0a) >> 6) & 0x03;
    const initial = mf();
    s.setNextReg(0x0a, (initial ^ 0x03) << 6);
    expect(mf(), "outside config mode").toBe(initial);
    s.setNextReg(0x03, 0x07);
    s.setNextReg(0x0a, 0x80);
    expect(mf()).toBe(0x02);
    s.setNextReg(0x03, 0x03); // --- leave config mode
    s.setNextReg(0x0a, 0x40);
    expect(mf(), "config mode was left").toBe(0x02);
  });

  it("RST-012: low bits 000 keep config mode, any other non-111 value leaves it", async () => {
    const s = await createSession();
    s.setNextReg(0x03, 0x07);
    s.setNextReg(0x03, 0x00); // --- still in config mode
    s.setNextReg(0x03, 0x04); // --- accepted, then config mode is left
    expect(type(s.readNextReg(0x03))).toBe(0x04);
    s.setNextReg(0x03, 0x02);
    expect(type(s.readNextReg(0x03))).toBe(0x04);
  });
});
