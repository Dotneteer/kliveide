import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * NextRegs whose readback is assembled from other state (catalogue NR-014 - NR-018).
 * Hardware references are `_input/next-fpga/src/zxnext.vhd` unless noted.
 */

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

describe("composite NextReg readbacks", () => {
  /*
   * NR-014: each clip register ($18 Layer 2, $19 sprites, $1A ULA, $1B tilemap) writes x1, x2, y1, y2
   * in turn and advances a 2-bit index (~5218-5253); reading returns the value at the current index
   * (~5892-5922). $1C reads the four indices (tm & ula & sprite & layer2, ~5925) and a write with bit
   * n set resets index n (~5255-5266). Reset values (~4940-4960): $00/$FF/$00/$BF, tilemap $00/$9F/$00/$FF.
   */
  const CLIPS: Array<[reg: number, shift: number, reset: [number, number, number, number]]> = [
    [0x18, 0, [0x00, 0xff, 0x00, 0xbf]],
    [0x19, 2, [0x00, 0xff, 0x00, 0xbf]],
    [0x1a, 4, [0x00, 0xff, 0x00, 0xbf]],
    [0x1b, 6, [0x00, 0x9f, 0x00, 0xff]]
  ];
  for (const [reg, shift, reset] of CLIPS) {
    it(`NR-014: ${hex(reg)} reads its clip values in turn, $1C tracks the index`, async () => {
      const s = await createSession();
      const seen: string[] = [];
      // --- Walk the reset values: writing back what was read keeps them, and advances the index.
      for (let i = 0; i < 4; i++) {
        const value = s.readNextReg(reg);
        seen.push(`${i}:${hex(value)} idx ${(s.readNextReg(0x1c) >> shift) & 0x03}`);
        s.setNextReg(reg, value);
      }
      expect(seen).toEqual(reset.map((v, i) => `${i}:${hex(v)} idx ${i}`));
      expect((s.readNextReg(0x1c) >> shift) & 0x03, "index wraps after four writes").toBe(0);

      s.setNextReg(reg, 0x11).setNextReg(reg, 0x22).setNextReg(reg, 0x33).setNextReg(reg, 0x44);
      expect(s.readNextReg(reg)).toBe(0x11);
      s.setNextReg(reg, 0x11); // --- idx 1
      expect(s.readNextReg(reg)).toBe(0x22);
      s.setNextReg(0x1c, 0x0f & ~(1 << (shift / 2))); // --- resets the other three indices only
      expect((s.readNextReg(0x1c) >> shift) & 0x03, "other bits leave this index alone").toBe(1);
      s.setNextReg(0x1c, 1 << (shift / 2));
      expect((s.readNextReg(0x1c) >> shift) & 0x03).toBe(0);
      expect(s.readNextReg(reg)).toBe(0x11);
    });
  }

  /*
   * NR-015: $34 selects the sprite the $35-$39 / $75-$79 attribute mirrors write; it reads back
   * '0' & the 7-bit sprite number (~5873; sprites.vhd ~602-616). Every $75-$79 write increments it.
   */
  it("NR-015: $34 reads the 7-bit sprite number; $75-$79 writes advance it", async () => {
    const s = await createSession();
    s.setNextReg(0x34, 0x85);
    expect(s.readNextReg(0x34)).toBe(0x05);
    s.setNextReg(0x34, 0x7f);
    expect(s.readNextReg(0x34)).toBe(0x7f);
    s.setNextReg(0x34, 0x10).setNextReg(0x35, 0x00); // --- $35: no increment
    expect(s.readNextReg(0x34)).toBe(0x10);
    s.setNextReg(0x79, 0x00);
    expect(s.readNextReg(0x34)).toBe(0x11);
    s.setNextReg(0x75, 0x00);
    expect(s.readNextReg(0x34)).toBe(0x12);
  });

  /*
   * NR-016: the first byte of a $44 pair is kept in `nr_stored_palette_value` (~5410), which $28
   * reads (~5957); the second byte does not change it.
   */
  it("NR-016: $28 returns the first byte of the last $44 pair", async () => {
    const s = await createSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x10);
    s.setNextReg(0x44, 0xa5);
    expect(s.readNextReg(0x28)).toBe(0xa5);
    s.setNextReg(0x44, 0x01);
    expect(s.readNextReg(0x28)).toBe(0xa5);
    s.setNextReg(0x44, 0x3c);
    expect(s.readNextReg(0x28)).toBe(0x3c);
  });

  /*
   * NR-017: $69 reads `port_123b_layer2_en & port_7ffd_shadow & port_ff_reg(5:0)` (~6025). A $69
   * write sets all three (~3905, ~3657, ~3615); port writes to $123B / $7FFD / $FF show up in it.
   * Port $FF is read back through `in $FF` with NextReg $08 bit 2 (Timex read) set.
   */
  it("NR-017: port $123B bit 1, $7FFD bit 3 and port $FF bits 5-0 show in $69", async () => {
    const s = await createSession();
    s.out(0x123b, 0x02);
    expect(s.readNextReg(0x69)).toBe(0x80);
    s.out(0x7ffd, 0x08);
    expect(s.readNextReg(0x69)).toBe(0xc0);
    s.out(0x00ff, 0x3e);
    expect(s.readNextReg(0x69)).toBe(0xfe);
    s.out(0x123b, 0x00).out(0x7ffd, 0x00).out(0x00ff, 0x00);
    expect(s.readNextReg(0x69)).toBe(0x00);
  });

  it("NR-017: a $69 write sets the Layer 2 enable, the shadow screen and port $FF", async () => {
    const s = await createSession();
    s.setNextReg(0x08, s.readNextReg(0x08) | 0x04); // --- port $FF reads the Timex register
    s.setNextReg(0x69, 0xc6);
    expect(s.in(0x123b) & 0x02, "$123B bit 1").toBe(0x02);
    expect(s.in(0x00ff) & 0x3f, "port $FF bits 5-0").toBe(0x06);
    expect(s.readNextReg(0x69)).toBe(0xc6);
    s.setNextReg(0x69, 0x00);
    expect(s.in(0x123b) & 0x02).toBe(0x00);
    expect(s.readNextReg(0x69)).toBe(0x00);
  });

  /*
   * NR-018: $8E reads `port_dffd_reg(0) & port_7ffd_reg(2:0) & '1' & port_1ffd_reg(0) &
   * port_1ffd_reg(2) & ((port_7ffd_reg(4) and not port_1ffd_reg(0)) or (port_1ffd_reg(1) and
   * port_1ffd_reg(0)))` (~6071). Klive runs +3 timing, so $7FFD, $DFFD and $1FFD all decode.
   */
  const PAGING: Array<[dffd: number, p7ffd: number, p1ffd: number, expected: number]> = [
    [0x00, 0x00, 0x00, 0x08],
    [0x00, 0x05, 0x00, 0x58], // --- bank 5
    [0x00, 0x17, 0x00, 0x79], // --- bank 7, ROM select bit 4 -> bit 0
    [0x01, 0x03, 0x00, 0xb8], // --- $DFFD bit 0 -> bit 7
    [0x00, 0x10, 0x04, 0x0b], // --- +3 ROM: 1FFD bit 2 -> bit 1, 7FFD bit 4 -> bit 0
    [0x00, 0x10, 0x01, 0x0c], // --- special mode: bit 2 set, bit 0 = 1FFD(1) = 0
    [0x00, 0x00, 0x07, 0x0f] // --- special mode, 1FFD bits 2 and 1 -> bits 1 and 0
  ];
  for (const [dffd, p7ffd, p1ffd, expected] of PAGING) {
    it(`NR-018: $DFFD=${hex(dffd)} $7FFD=${hex(p7ffd)} $1FFD=${hex(p1ffd)} -> $8E=${hex(expected)}`, async () => {
      const s = await createSession();
      s.out(0x1ffd, p1ffd).out(0xdffd, dffd).out(0x7ffd, p7ffd);
      expect(hex(s.readNextReg(0x8e))).toBe(hex(expected));
    });
  }
});
