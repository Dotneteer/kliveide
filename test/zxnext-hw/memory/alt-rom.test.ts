import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";
import { hex, NEXT_ROM, results, romBytes, runCode } from "./_memory-helpers";

/*
 * NextReg $8C Alt ROM and the ROM contents (catalogue MEM-016, MEM-022).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2207-2221: $8C is stored whole and read back whole (~6101); every reset copies bits 3-0 into
 *   bits 7-4. Bit 7 enables the Alt ROM, bit 6 makes it the write target, bits 5/4 lock the ROM.
 * - ~2940-2962, +3 machine type: with bit 5 or 4 set the ROM number is bits 5-4 (whether or not the
 *   Alt ROM is enabled) and the Alt ROM is the 48K one (Alt ROM 1) when bit 5 is set; otherwise ROM =
 *   $1FFD bit 2 & $7FFD bit 4 and the Alt ROM follows $7FFD bit 4.
 * - ~3011, 3053: in the ROM area `rdonly = not (altrom_en and altrom_rw)`; `sram_altrom_en` is set for
 *   a read when read-only, for a write when writable. So bit 6 = 0: reads come from the Alt ROM and
 *   writes are dropped; bit 6 = 1: reads come from the normal ROM and writes go to the Alt ROM.
 * - ~3090: Alt ROM 0 (128K) is SRAM 0x018000, Alt ROM 1 (48K) 0x01C000.
 */

/** Writes `pattern + i` to $0000-$000F (through whatever the ROM area maps for writes). */
const writeRomArea = (pattern: number) => `
        ld hl,$0000
        ld a,${pattern}
        ld b,16
Fill${pattern}:
        ld (hl),a
        inc hl
        inc a
        djnz Fill${pattern}`;

/** Copies $0000-$000F to `dest`. */
const readRomArea = (dest: number) => `
        ld hl,$0000
        ld de,${dest}
        ld bc,16
        ldir`;

const seq = (start: number) => Array.from({ length: 16 }, (_, i) => (start + i) & 0xff);

describe("Alt ROM", () => {
  it("MEM-016: $8C reads back whole; a soft reset copies bits 3-0 into bits 7-4", async () => {
    const s = await createSession();
    s.setNextReg(0x8c, 0x0a);
    expect(s.readNextReg(0x8c)).toBe(0x0a);
    s.reset();
    expect(s.readNextReg(0x8c)).toBe(0xaa);
    s.setNextReg(0x8c, 0x03).reset();
    expect(s.readNextReg(0x8c)).toBe(0x33);
  });

  it("MEM-016: with bit 6 writes go to the Alt ROM and reads to the ROM; without it reads come from the Alt ROM", async () => {
    const s = await runCode(
      `
        nextreg $8c,$c0          ; enabled, writable: Alt ROM 0 ($7FFD bit 4 = 0)
        ${writeRomArea(0x40)}
        ${readRomArea(0xa000)}
        ld bc,$7ffd              ; Alt ROM 1
        ld a,$10
        out (c),a
        ${writeRomArea(0x60)}
        nextreg $8c,$80          ; enabled, read-only
        ${readRomArea(0xa010)}
        ${writeRomArea(0x90)}    ; dropped
        ${readRomArea(0xa020)}
        ld bc,$7ffd
        xor a
        out (c),a
        ${readRomArea(0xa030)}
        nextreg $8c,$00
        ${readRomArea(0xa040)}`
    );
    expect(hex(results(s, 16)), "writable: reads the ROM").toBe(hex(romBytes(0, 0, 16)));
    expect(hex(Array.from(s.peekBytes(0xa010, 16))), "Alt ROM 1").toBe(hex(seq(0x60)));
    expect(hex(Array.from(s.peekBytes(0xa020, 16))), "read-only: the write was dropped").toBe(hex(seq(0x60)));
    expect(hex(Array.from(s.peekBytes(0xa030, 16))), "Alt ROM 0").toBe(hex(seq(0x40)));
    expect(hex(Array.from(s.peekBytes(0xa040, 16))), "disabled").toBe(hex(romBytes(0, 0, 16)));
  });

  // --- ~2944-2947: bits 5-4 select the ROM on the +3 machine type, Alt ROM enabled or not
  for (const [lock, rom] of [[0x10, 1], [0x20, 2], [0x30, 3]]) {
    it(`MEM-016: lock bits $${lock.toString(16)} force ROM ${rom} whatever $7FFD and $1FFD select`, async () => {
      const s = await createSession();
      s.out(0x7ffd, 0x10).out(0x1ffd, 0x04); // --- ROM 3 selected by the ports
      s.setNextReg(0x8c, lock);
      expect(hex(Array.from(s.peekBytes(0x0000, 16)))).toBe(hex(romBytes(rom, 0, 16)));
      s.out(0x7ffd, 0x00).out(0x1ffd, 0x00);
      expect(hex(Array.from(s.peekBytes(0x0000, 16)))).toBe(hex(romBytes(rom, 0, 16)));
    });
  }

  it("MEM-016: with a lock bit set, bit 5 (not $7FFD bit 4) picks Alt ROM 0 or 1", async () => {
    const s = await runCode(
      `
        nextreg $8c,$c0
        ${writeRomArea(0x10)}    ; Alt ROM 0
        ld bc,$7ffd
        ld a,$10
        out (c),a
        ${writeRomArea(0x30)}    ; Alt ROM 1
        nextreg $8c,$90          ; lock bit 4: Alt ROM 0 although $7FFD bit 4 = 1
        ${readRomArea(0xa000)}
        ld bc,$7ffd
        xor a
        out (c),a
        nextreg $8c,$a0          ; lock bit 5: Alt ROM 1 although $7FFD bit 4 = 0
        ${readRomArea(0xa010)}
        nextreg $8c,$00`
    );
    expect(hex(results(s, 16))).toBe(hex(seq(0x10)));
    expect(hex(Array.from(s.peekBytes(0xa010, 16)))).toBe(hex(seq(0x30)));
  });
});

describe("ROM contents", () => {
  // --- MEM-022: ROM n is the n-th 16K of the ROM image the firmware loads
  it("MEM-022: ROM 0-3 are the four 16K parts of the Next ROM image", async () => {
    const s = await createSession();
    for (let rom = 0; rom < 4; rom++) {
      s.out(0x7ffd, (rom & 1) << 4).out(0x1ffd, (rom >> 1) << 2);
      const seen = s.peekBytes(0x0000, 0x4000);
      const expected = NEXT_ROM.subarray(rom * 0x4000, (rom + 1) * 0x4000);
      const firstDiff = seen.findIndex((v, i) => v !== expected[i]);
      expect(firstDiff, `ROM ${rom}: first difference`).toBe(-1);
    }
    // --- and they really are different ROMs
    expect(new Set([0, 1, 2, 3].map((r) => hex(romBytes(r, 0, 8)))).size).toBe(4);
  });
});
