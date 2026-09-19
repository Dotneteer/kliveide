import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";
import { hex, results, romBytes, runCode } from "./_memory-helpers";

/*
 * 128K / +3 / Pentagon paging through $7FFD, $DFFD, $1FFD, $EFF7 and NextRegs $8E / $8F (catalogue
 * MEM-003, MEM-007, MEM-008, MEM-010 - MEM-015).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2549-2560: $7FFD = A15 0, A14 1 (+3 timing), A1-0 01; $DFFD = A15-12 1101; $1FFD = A15-14 00,
 *   A13-12 01; $EFF7 = A15-12 1110, low byte $F7.
 * - ~3743-3746: `port_7ffd_bank` = $DFFD(3:0) & $7FFD(2:0); in Pentagon mode ($8F) bits 4-3 come from
 *   $7FFD bits 7-6, bit 5 from $7FFD bit 5 (Pentagon 1024 only), bit 6 is 0.
 * - ~4599-4664: every accepted paging write reloads the MMU: +3 special mode ($1FFD bit 0) sets all
 *   eight slots; otherwise MMU0/1 = $FF (or $00/$01 with $EFF7 bit 3), MMU6/7 = bank x 2 (+1), and
 *   MMU2-5 go back to $0A $0B $04 $05 only when special mode is left.
 * - ~2952: +3 machine type: ROM = $1FFD bit 2 & $7FFD bit 4.
 * - ~3659-3700, 3723-3730: a $8E write with bit 3 sets the bank (bits 6-4, $DFFD bit 0 = bit 7) and
 *   reloads MMU6/7; bit 2 = 0 sets the ROM bit from bit 0, bit 2 = 1 writes $1FFD bits 0-2 from bits
 *   2, 0, 1 (special mode); ~3794 without bit 3 MMU6/7 keep their pages.
 * - ~3766-3781: $8F has no reset branch; mode 01 (Profi) is disabled in this core
 *   (`nr_8f_mapping_mode_profi <= '0'`); 10 = Pentagon 512; 11 = Pentagon 1024 unless $EFF7 bit 2.
 * - ~3749: the $7FFD lock (bit 5) does not exist in Pentagon 1024.
 *
 * The harness machine is a +3 type with +3 timing after its hard reset (the post-firmware state).
 */

const mmu = (s: NextTestSession) => Array.from({ length: 8 }, (_, i) => s.readNextReg(0x50 + i));

describe("128K paging", () => {
  // --- MEM-003: 16K bank n = 8K pages 2n and 2n + 1
  it("MEM-003: the $7FFD bank at $C000 is MMU pages 2n / 2n + 1", async () => {
    const s = await createSession();
    for (let bank = 0; bank < 8; bank++) {
      s.out(0x7ffd, bank).poke(0xc000, 0x30 + bank).poke(0xffff, 0x70 + bank);
    }
    s.out(0x7ffd, 0);
    for (let bank = 0; bank < 8; bank++) {
      s.setNextReg(0x53, 2 * bank);
      const lo = s.peek(0x6000);
      s.setNextReg(0x53, 2 * bank + 1);
      expect([lo, s.peek(0x7fff)], `bank ${bank}`).toEqual([0x30 + bank, 0x70 + bank]);
    }
  });

  // --- MEM-007
  it("MEM-007: $7FFD bits 2-0 set MMU6/7, and the write puts the ROM back in slots 0/1", async () => {
    const s = await createSession();
    s.setNextReg(0x50, 0x0a).setNextReg(0x51, 0x0b).setNextReg(0x53, 0x20);
    s.out(0x7ffd, 0x05);
    // --- MMU2-5 keep what they had (MMU3 = $20), MMU6/7 = bank 5
    expect(mmu(s)).toEqual([0xff, 0xff, 0x0a, 0x20, 0x04, 0x05, 0x0a, 0x0b]);
  });

  it("MEM-007: $7FFD bit 4 selects ROM 0 or ROM 1", async () => {
    const s = await createSession();
    s.out(0x7ffd, 0x10);
    expect(hex(Array.from(s.peekBytes(0x0000, 16)))).toBe(hex(romBytes(1, 0, 16)));
    s.out(0x7ffd, 0x00);
    expect(hex(Array.from(s.peekBytes(0x0000, 16)))).toBe(hex(romBytes(0, 0, 16)));
  });

  // --- MEM-008
  it("MEM-008: $DFFD bits 3-0 extend the bank number", async () => {
    const s = await createSession();
    s.out(0xdffd, 0x01);
    expect([s.readNextReg(0x56), s.readNextReg(0x57)], "$DFFD alone reloads MMU6/7 (bank 8)").toEqual([0x10, 0x11]);
    s.out(0x7ffd, 0x03);
    expect([s.readNextReg(0x56), s.readNextReg(0x57)], "bank 11").toEqual([0x16, 0x17]);
    s.out(0xdffd, 0x0d).out(0x7ffd, 0x07);
    expect([s.readNextReg(0x56), s.readNextReg(0x57)], "bank 111").toEqual([0xde, 0xdf]);
    s.out(0xdffd, 0x00);
    expect([s.readNextReg(0x56), s.readNextReg(0x57)], "bank 7").toEqual([0x0e, 0x0f]);
  });

  it("MEM-008: $DFFD is ignored while $7FFD is locked", async () => {
    const s = await createSession();
    s.out(0x7ffd, 0x23).out(0xdffd, 0x01);
    expect(s.readNextReg(0x56)).toBe(0x06);
  });

  // --- MEM-010: the four +3 all-RAM layouts (~4603-4612)
  const SPECIAL: Array<[bits: number, banks: number[]]> = [
    [0b00, [0, 1, 2, 3]],
    [0b01, [4, 5, 6, 7]],
    [0b10, [4, 5, 6, 3]],
    [0b11, [4, 7, 6, 3]]
  ];
  for (const [bits, banks] of SPECIAL) {
    it(`MEM-010: $1FFD = ${(1 | (bits << 1)).toString(2).padStart(3, "0")} maps banks ${banks.join("-")}`, async () => {
      // --- Every bank n gets the signature $B0 + n at offset $3F00. The program first copies itself
      // --- into bank 6, because three of the layouts put bank 6 at $8000.
      const s = await runCode(
        `
        nextreg $56,$0c
        nextreg $57,$0d
        ld hl,$8000
        ld de,$c000
        ld bc,$4000
        ldir
        ld b,0
Sig:    ld a,b                   ; page 2n + 1 at $E000: offset $1F00 = bank offset $3F00
        add a,a
        inc a
        nextreg $57,a
        ld a,$b0
        add a,b
        ld ($ff00),a
        inc b
        ld a,b
        cp 8
        jr nz,Sig
        nextreg $56,$00
        nextreg $57,$01
        ld bc,$1ffd
        ld a,${1 | (bits << 1)}
        out (c),a
        ld a,($3f00)
        ld ($a000),a
        ld a,($7f00)
        ld ($a001),a
        ld a,($bf00)
        ld ($a002),a
        ld a,($ff00)
        ld ($a003),a`
      );
      expect(hex(results(s, 4))).toBe(hex(banks.map((b) => 0xb0 + b)));
      expect(mmu(s)).toEqual(banks.flatMap((b) => [2 * b, 2 * b + 1]));
    });
  }

  it("MEM-010: leaving special mode restores ROM, banks 5 and 2 and the $7FFD bank", async () => {
    const s = await createSession();
    s.out(0x7ffd, 0x03).out(0x1ffd, 0x07);
    expect(mmu(s)).toEqual([8, 9, 14, 15, 12, 13, 6, 7]);
    s.out(0x1ffd, 0x00);
    expect(mmu(s)).toEqual([0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x06, 0x07]);
  });

  // --- MEM-011: ~2952, ROM = $1FFD bit 2 & $7FFD bit 4
  for (let rom = 0; rom < 4; rom++) {
    it(`MEM-011: $1FFD bit 2 = ${rom >> 1}, $7FFD bit 4 = ${rom & 1} select ROM ${rom}`, async () => {
      const s = await createSession();
      s.out(0x7ffd, (rom & 1) << 4).out(0x1ffd, (rom >> 1) << 2);
      expect(hex(Array.from(s.peekBytes(0x0000, 16)))).toBe(hex(romBytes(rom, 0, 16)));
      expect(hex(Array.from(s.peekBytes(0x3ff0, 16)))).toBe(hex(romBytes(rom, 0x3ff0, 16)));
    });
  }

  // --- MEM-012 / MEM-015: $8F
  it("MEM-012: Pentagon 512 ($8F = 2) takes bank bits 4-3 from $7FFD bits 7-6 and ignores $DFFD", async () => {
    const s = await createSession();
    s.setNextReg(0x8f, 0x02).out(0xdffd, 0x01).out(0x7ffd, 0xc3);
    expect(s.readNextReg(0x56), "bank 3 + 24").toBe(0x36);
    s.out(0x7ffd, 0xe3); // --- bit 5 is the lock in Pentagon 512, not a bank bit
    expect(s.readNextReg(0x56)).toBe(0x36);
    s.out(0x7ffd, 0x01);
    expect(s.readNextReg(0x56), "locked").toBe(0x36);
  });

  it("MEM-012: Pentagon 1024 ($8F = 3) adds $7FFD bit 5 as bank bit 5 and has no lock", async () => {
    const s = await createSession();
    s.setNextReg(0x8f, 0x03).out(0x7ffd, 0xe3);
    expect(s.readNextReg(0x56), "bank 3 + 24 + 32").toBe(0x76);
    s.out(0x7ffd, 0x01);
    expect(s.readNextReg(0x56), "not locked").toBe(0x02);
  });

  it("MEM-012: $EFF7 bit 2 turns Pentagon 1024 back into standard paging", async () => {
    const s = await createSession();
    s.setNextReg(0x8f, 0x03).out(0xeff7, 0x04).out(0xdffd, 0x01).out(0x7ffd, 0xc3);
    expect(s.readNextReg(0x56), "$DFFD bank 8 + 3, $7FFD bits 7-6 ignored").toBe(0x16);
  });

  it("MEM-015: $8F reads back, survives a soft reset, and mode 1 (Profi, disabled) pages as standard", async () => {
    const s = await createSession();
    expect(s.readNextReg(0x8f)).toBe(0x00);
    s.setNextReg(0x8f, 0xfd);
    expect(s.readNextReg(0x8f)).toBe(0x01);
    s.out(0xdffd, 0x01).out(0x7ffd, 0xc3);
    expect(s.readNextReg(0x56)).toBe(0x16);
    s.setNextReg(0x8f, 0x02).reset();
    expect(s.readNextReg(0x8f), "no reset branch").toBe(0x02);
  });

  // --- MEM-013: ~4615-4619
  it("MEM-013: $EFF7 bit 3 maps RAM bank 0 at $0000", async () => {
    const s = await createSession();
    s.out(0xeff7, 0x08);
    expect([s.readNextReg(0x50), s.readNextReg(0x51)]).toEqual([0x00, 0x01]);
    s.poke(0x0010, 0x5a);
    expect(s.peek(0xc010), "bank 0 is also at $C000").toBe(0x5a);
    s.out(0x7ffd, 0x01);
    expect([s.readNextReg(0x50), s.readNextReg(0x51)], "a $7FFD write keeps it").toEqual([0x00, 0x01]);
    s.out(0xeff7, 0x00);
    expect([s.readNextReg(0x50), s.readNextReg(0x51)]).toEqual([0xff, 0xff]);
    expect(s.peek(0x0010)).toBe(romBytes(0, 0x10, 1)[0]);
  });

  // --- MEM-014
  it("MEM-014: a $8E write with bit 3 sets bank and ROM together", async () => {
    const s = await createSession();
    s.setNextReg(0x50, 0x0a);
    s.setNextReg(0x8e, 0xb9); // --- bit 7 + bits 6-4 = 011: bank 11; bit 3; bit 2 = 0; bit 0: ROM 1
    expect(mmu(s)).toEqual([0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x16, 0x17]);
    expect(hex(Array.from(s.peekBytes(0x0000, 8)))).toBe(hex(romBytes(1, 0, 8)));
  });

  it("MEM-014: without bit 3 a $8E write changes only the ROM", async () => {
    const s = await createSession();
    s.out(0x7ffd, 0x03);
    s.setNextReg(0x8e, 0x72); // --- bits 6-4 ignored; bit 1 -> $1FFD bit 2, bit 0 -> $7FFD bit 4: ROM 2
    expect([s.readNextReg(0x56), s.readNextReg(0x57)]).toEqual([0x06, 0x07]);
    expect(hex(Array.from(s.peekBytes(0x0000, 8)))).toBe(hex(romBytes(2, 0, 8)));
  });

  it("MEM-014: a $8E write with bit 2 enters +3 special mode (bits 1-0 = layout)", async () => {
    const s = await createSession();
    s.setNextReg(0x8e, 0x05); // --- $1FFD = 011: banks 4-5-6-7
    expect(mmu(s)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
