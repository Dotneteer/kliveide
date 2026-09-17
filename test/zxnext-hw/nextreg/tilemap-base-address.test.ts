import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * NextReg $6E / $6F keep a 6-bit page offset plus the bank 7 flag.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd` ~5444-5450, readback ~6053):
 * `nr_6e_tilemap_base <= nr_wr_dat(5 downto 0)`, bit 7 selects bank 7, bit 6 reads 0
 * (tilemap.vhd:57, "5:0 are offsets into 16K").
 */
describe.each(ALL_CORES)("tilemap base address registers - %s core", (core) => {
  for (const reg of [0x6e, 0x6f]) {
    it(`$${reg.toString(16)} keeps bits 5-0 and bit 7, drops bit 6`, async () => {
      const s = await createSession(core);
      s.setNextReg(reg, 0x3f);
      expect(s.readNextReg(reg)).toBe(0x3f);
      s.setNextReg(reg, 0xff);
      expect(s.readNextReg(reg)).toBe(0xbf);
    });
  }
});
