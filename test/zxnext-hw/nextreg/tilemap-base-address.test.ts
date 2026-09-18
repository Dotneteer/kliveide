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

/*
 * B13 - where the tilemap lives after a reset.
 *
 * Hardware (zxnext.vhd reset branch): `nr_6e_tilemap_base <= "101100"` and `nr_6f_tilemap_tiles <=
 * "001100"`, i.e. the map at $6C00 and the tile definitions at $4C00 in bank 5 (nextreg.txt: "soft
 * reset = 0x6c00" / "0x4c00"). A program that enables the tilemap without writing $6E/$6F uses them.
 *
 * The map (40x32, tile + attribute) is all tile 0; tile 0 is pixel index 1 everywhere. With the old
 * $00 defaults the map and the definitions both sat on the zeroed ULA screen at $4000: index 0.
 */
describe.each(ALL_CORES)("tilemap default location after a reset - %s core", (core) => {
  it.each(["hard", "soft"] as const)("after a %s reset the map is at $6C00 and the tiles at $4C00", async (kind) => {
    const s = await createSession(core);
    s.setNextReg(0x6e, 0x80).setNextReg(0x6f, 0x80); // --- somewhere else first
    kind === "soft" ? s.reset() : s.hardReset();
    await s.loadCode(` .org $8000\n jr $`);
    // --- Bank 5 $4000-$5FFF zeroed, except tile 0 at $4C00: pixel index 1 everywhere
    for (let i = 0; i < 0x2000; i++) s.poke(0x4000 + i, i >= 0xc00 && i < 0xc20 ? 0x11 : 0x00);
    for (let i = 0; i < 40 * 32 * 2; i++) s.poke(0x6c00 + i, 0x00); // --- map: tile 0, attribute 0
    s.setNextReg(0x43, 0x30).setNextReg(0x40, 0x00).setNextReg(0x41, 0xe0).setNextReg(0x41, 0x1c); // --- tilemap palette: 0 red, 1 green
    s.setNextReg(0x43, 0x00).setNextReg(0x6b, 0x80).runFrames(2);
    s.expectProbe({ kind: "rect", name: "a paper-area tile", x: [100, 107], y: [50, 53], rgb: "next8:0x1C" });
  });
});
