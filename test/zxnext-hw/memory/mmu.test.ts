import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";
import { hex, results, romBytes, runCode } from "./_memory-helpers";

/*
 * MMU slots, ROM in slots 0/1, out-of-range pages and ROM write protection (catalogue MEM-002 -
 * MEM-006, MEM-024).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2908: slot n ($n000 x 8K) shows page MMUn; ~2919: `mmu_A21_A13 = ("0001" + page(7:5)) & page(4:0)`,
 *   so page p is SRAM 8K page p + 32 and bit 8 is set for p >= $E0.
 * - ~2986-3014: in $0000-$3FFF a page with bit 8 clear is RAM; anything else (`$FF`, but also $E0-$FE)
 *   is the ROM selected by the machine (or `$04` in config mode). ROM is read-only unless the Alt ROM
 *   is enabled for writes (`sram_pre_rdonly = not (altrom_en and altrom_rw)`).
 * - ~3015-3017: in $4000-$FFFF a page with bit 8 set is inactive (`sram_pre_active = 0`): no SRAM
 *   cycle, so a write lands nowhere.
 * - ~4591-4598: MMU reset layout $FF $FF $0A $0B $04 $05 $00 $01 (MEM-001, tested elsewhere).
 */

describe("MMU", () => {
  // --- MEM-002: every slot 2-7 maps a page; another slot mapping the same page sees the same byte
  it("MEM-002: a byte written through one slot is read through another slot mapping that page", async () => {
    const s = await createSession();
    const pages = [0x10, 0x23, 0x37, 0x4c, 0x61, 0xdf];
    for (let slot = 2; slot <= 7; slot++) {
      s.setNextReg(0x50 + slot, pages[slot - 2]).poke(slot * 0x2000, 0x40 + slot).poke(slot * 0x2000 + 0x1fff, 0x80 + slot);
      expect(s.readNextReg(0x50 + slot), `MMU${slot} readback`).toBe(pages[slot - 2]);
    }
    for (let slot = 2; slot <= 7; slot++) {
      const other = slot === 7 ? 2 : slot + 1;
      s.setNextReg(0x50 + other, pages[slot - 2]);
      expect([s.peek(other * 0x2000), s.peek(other * 0x2000 + 0x1fff)], `page $${pages[slot - 2].toString(16)} via slot ${other}`).toEqual([
        0x40 + slot,
        0x80 + slot
      ]);
    }
  });

  // --- MEM-004 / MEM-024: ROM is read-only; the same LDIR into RAM pages changes them
  it("MEM-004/MEM-024: LDIR over $0000-$3FFF leaves the ROM unchanged", async () => {
    const s = await runCode(
      `
        ld hl,$c000              ; bank 0 at $C000: fill with $5A
        ld (hl),$5a
        ld de,$c001
        ld bc,$3fff
        ldir
        ld hl,$c000              ; copy over the ROM
        ld de,$0000
        ld bc,$4000
        ldir
        ld a,$a5
        ld ($0100),a             ; and a single write
        ld hl,$0000              ; what $0000-$000F and $3FF0-$3FFF read now
        ld de,$a000
        ld bc,16
        ldir
        ld hl,$3ff0
        ld bc,16
        ldir
        ld a,($0100)
        ld ($a020),a`
    );
    expect(hex(results(s, 16))).toBe(hex(romBytes(0, 0, 16)));
    expect(hex(Array.from(s.peekBytes(0xa010, 16)))).toBe(hex(romBytes(0, 0x3ff0, 16)));
    expect(s.peek(0xa020)).toBe(romBytes(0, 0x100, 1)[0]);
  });

  it("MEM-005/MEM-024: with RAM pages in slots 0/1 the same LDIR writes RAM; $FF brings the ROM back", async () => {
    const s = await runCode(
      `
        nextreg $50,$0a          ; slot 0 = page 10: bank 5, also visible at $4000
        nextreg $51,$1f
        ld hl,$c000
        ld (hl),$5a
        ld de,$c001
        ld bc,$3fff
        ldir
        ld hl,$c000
        ld de,$0000
        ld bc,$4000
        ldir
        ld a,($4000)             ; page 10 through slot 2
        ld ($a000),a
        ld a,($3fff)             ; page $1F through slot 1
        ld ($a001),a
        nextreg $50,$ff
        nextreg $51,$ff
        ld a,($0000)
        ld ($a002),a
        ld a,($3fff)
        ld ($a003),a`
    );
    expect(hex(results(s, 4))).toBe(hex([0x5a, 0x5a, romBytes(0, 0, 1)[0], romBytes(0, 0x3fff, 1)[0]]));
  });

  // --- MEM-006: pages $E0-$FF have bit 8 of mmu_A21_A13 set
  it("MEM-006: page $DF is the last RAM page; $E0-$FE in slot 0 read the ROM like $FF", async () => {
    const s = await runCode(
      `
        nextreg $57,$df
        ld a,$c6
        ld ($e000),a
        nextreg $57,$01
        nextreg $56,$df          ; the same page through slot 6
        ld a,($c000)
        ld ($a000),a
        nextreg $56,$00
        nextreg $50,$e0
        ld a,($0000)
        ld ($a001),a
        nextreg $50,$fe
        ld a,($0000)
        ld ($a002),a
        nextreg $50,$ff`
    );
    expect(hex(results(s, 3))).toBe(hex([0xc6, romBytes(0, 0, 1)[0], romBytes(0, 0, 1)[0]]));
  });

  it("MEM-006: a write through a page >= $E0 in slots 2-7 changes no RAM page", async () => {
    // --- Candidates a wrapping decoder would hit: the same low 5 bits in every 32-page group, and
    // --- the low 7 / low 6 bits of the page.
    const suspects = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0x60 & 0x3f, 0xe0 & 0x7f];
    const s = await createSession();
    for (const p of suspects) s.setNextReg(0x57, p).poke(0xe000, 0x11);
    s.setNextReg(0x57, 0x01);
    for (const page of [0xe0, 0xef, 0xfe]) {
      await s.loadCode(`
        .org $8000
        nextreg $56,${page}
        ld a,$ee
        ld ($c000),a
        nextreg $56,$00
        nextreg $7f,$a5
        jr $
      `);
      s.setNextReg(0x7f, 0).runUntilReady();
      for (const p of suspects) {
        s.setNextReg(0x57, p);
        expect(s.peek(0xe000), `page $${p.toString(16)} after a write to page $${page.toString(16)}`).toBe(0x11);
      }
      s.setNextReg(0x57, 0x01);
    }
  });
});
