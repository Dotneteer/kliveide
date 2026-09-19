import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type NextTestSession } from "../../harness/zxnext";
import { hex, romBytes } from "./_memory-helpers";

/*
 * Paging details ported from the TypeScript-only test/zxnext/MemoryDevice.test.ts (catalogue MEM-002,
 * MEM-009, MEM-010, MEM-014).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~3715: `elsif port_1ffd_wr = '1' and port_7ffd_locked = '0'` - a $1FFD write is ignored while $7FFD
 *   is locked (~3749: `port_7ffd_locked` = $7FFD bit 5 outside Pentagon 1024), and ~3793 it does not
 *   reload the MMU either.
 * - ~3743-3746: `port_7ffd_bank` = $DFFD(3:0) & $7FFD(2:0). ~4621-4658: leaving +3 special mode
 *   (`port_1ffd_special_old`) reloads MMU6/7 with that bank, $DFFD bits included.
 * - ~3693-3699: a $8E write with bit 3 clears $DFFD bit 3 and sets $DFFD bits 2-0 to "00" & bit 7, so
 *   the bank is exactly $8E bit 7 & bits 6-4, whatever $DFFD held.
 * - ~3659-3666, ~3726-3731: a $8E write sets $1FFD bit 2 from bit 1 and, with bit 2 = 0, $7FFD bit 4
 *   from bit 0; ~2952: ROM = $1FFD bit 2 & $7FFD bit 4. Bits 7-3 do not change the ROM.
 * - ~2908-2919: MMU slot n shows 8K page MMUn, SRAM page p + 32; ~3015-3017 pages $00-$DF are RAM.
 */

const mmu = (s: NextTestSession) => Array.from({ length: 8 }, (_, i) => s.readNextReg(0x50 + i));

async function parked(core: "ts" | "wasm"): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

describe.each(ALL_CORES)("paging details - %s core", (core) => {
  it("MEM-009: $1FFD writes are ignored while $7FFD is locked", async () => {
    const s = await parked(core);
    s.out(0x7ffd, 0x20); // --- bank 0, lock
    s.out(0x1ffd, 0x01); // --- would enter special mode (banks 0-1-2-3)
    expect(mmu(s), "no special mode").toEqual([0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01]);
    s.out(0x1ffd, 0x04); // --- would select ROM 2
    expect(hex(Array.from(s.peekBytes(0x0000, 16))), "still ROM 0").toBe(hex(romBytes(0, 0, 16)));
    // --- unlocked through $08 bit 7 (~3650), the same write is accepted
    s.setNextReg(0x08, s.readNextReg(0x08) | 0x80).out(0x1ffd, 0x04);
    expect(hex(Array.from(s.peekBytes(0x0000, 16))), "ROM 2 once unlocked").toBe(hex(romBytes(2, 0, 16)));
  });

  it("MEM-010: leaving special mode restores the $DFFD-extended $7FFD bank in MMU6/7", async () => {
    const s = await parked(core);
    s.out(0x7ffd, 0x03).out(0xdffd, 0x02); // --- bank 2 * 8 + 3 = 19: pages 38 / 39
    expect([s.readNextReg(0x56), s.readNextReg(0x57)]).toEqual([38, 39]);
    s.out(0x1ffd, 0x01);
    expect(mmu(s), "special mode 00: banks 0-1-2-3").toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    s.out(0x1ffd, 0x00);
    expect(mmu(s)).toEqual([0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 38, 39]);
  });

  it("MEM-014: a $8E write with bit 3 replaces the $DFFD bank bits", async () => {
    const s = await parked(core);
    s.out(0xdffd, 0x0d).out(0x7ffd, 0x07); // --- bank 111: pages $DE / $DF
    expect(s.readNextReg(0x56)).toBe(0xde);
    s.setNextReg(0x8e, 0x98); // --- bit 7 = 1, bits 6-4 = 001, bit 3: bank %0001_001 = 9
    expect([s.readNextReg(0x56), s.readNextReg(0x57)], "bank 9, not 105").toEqual([18, 19]);
    s.out(0x7ffd, 0x02); // --- $DFFD now holds 0001: bank 10
    expect(s.readNextReg(0x56)).toBe(20);
  });

  for (const extra of [0x00, 0x08, 0x80, 0x88, 0x78]) {
    it(`MEM-014: $8E bits 1-0 select ROM 0-3 (other bits $${extra.toString(16).padStart(2, "0")})`, async () => {
      const s = await parked(core);
      for (let rom = 0; rom < 4; rom++) {
        s.setNextReg(0x8e, extra | rom);
        expect(hex(Array.from(s.peekBytes(0x0000, 16))), `ROM ${rom}`).toBe(hex(romBytes(rom, 0, 16)));
        expect(hex(Array.from(s.peekBytes(0x3ff0, 16))), `ROM ${rom} end`).toBe(hex(romBytes(rom, 0x3ff0, 16)));
      }
    });
  }

  it("MEM-002: every page $00-$DF is its own 8K of RAM through each of slots 2-7", async () => {
    const s = await parked(core);
    // --- Nothing runs between the pokes, so the program's own page (4) may be overwritten.
    for (let page = 0; page < 0xe0; page++) {
      const slot = 2 + (page % 6);
      s.setNextReg(0x50 + slot, page).poke(slot * 0x2000, page).poke(slot * 0x2000 + 0x1fff, page ^ 0xff);
    }
    const bad: string[] = [];
    for (let page = 0; page < 0xe0; page++) {
      const slot = 2 + ((page + 3) % 6); // --- read through a different slot than the write
      s.setNextReg(0x50 + slot, page);
      const got = [s.peek(slot * 0x2000), s.peek(slot * 0x2000 + 0x1fff)];
      if (got[0] !== page || got[1] !== (page ^ 0xff)) bad.push(`page $${page.toString(16)} via slot ${slot}: ${hex(got)}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });
});
