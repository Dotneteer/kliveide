import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * NextReg $04 stores bits 6-0 only (catalogue NR-019; ported from test/zxnext/NextRegDevice.test.ts
 * "Reg $04 write #1/#2").
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~1099: `nr_04_romram_bank` is 7 bits; ~5131-5132: a $04 write stores `nr_wr_dat(6 downto 0)` -
 *   bit 7 is dropped.
 * - ~2998-3000: in config mode $0000-$3FFF maps SRAM `nr_04_romram_bank & A13`, writable. 16K bank 16
 *   is Next RAM page 0/1 (memory/config-mode MEM-026).
 * - ~6232: $04 is not in the read mux: it reads $00 (nextreg/read-mux NR-009), so the stored bank is
 *   observed through the memory it maps.
 */

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nLoop: jr Loop");
  return s;
}

describe("NextReg $04 config-mode bank", () => {
  it("NR-019: $04 = $90 maps the same 16K SRAM bank as $10 (bit 7 is not stored)", async () => {
    const s = await parked();
    const type = s.readNextReg(0x03) & 0x07;
    s.setNextReg(0x03, 0x07); // --- config mode
    s.setNextReg(0x04, 0x90).poke(0x0000, [0x5a, 0x5b]).poke(0x2000, [0xa5, 0xa6]);
    s.setNextReg(0x04, 0x11).poke(0x0000, 0x00); // --- another bank in between
    s.setNextReg(0x04, 0x10);
    expect([...s.peekBytes(0x0000, 2), ...s.peekBytes(0x2000, 2)], "bank 16 through $10").toEqual([0x5a, 0x5b, 0xa5, 0xa6]);
    s.setNextReg(0x03, type); // --- leave config mode
    s.setNextReg(0x52, 0x00).setNextReg(0x53, 0x01); // --- RAM pages 0 and 1 at $4000 / $6000
    expect([...s.peekBytes(0x4000, 2), ...s.peekBytes(0x6000, 2)], "SRAM bank 16 = RAM page 0/1").toEqual([
      0x5a, 0x5b, 0xa5, 0xa6
    ]);
    expect(s.readNextReg(0x04), "write-only: reads $00").toBe(0x00);
  });
});
