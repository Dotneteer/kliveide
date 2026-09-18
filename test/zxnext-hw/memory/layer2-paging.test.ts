import { describe, expect, it } from "vitest";

import { ALL_CORES } from "../../harness/zxnext";
import { hex, results, romBytes, runCode } from "./_memory-helpers";

/*
 * Layer 2 memory paging through port $123B, and the priority of the $0000-$3FFF overlays (catalogue
 * MEM-017 - MEM-021).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~3884-3905: a $123B write with bit 4 = 0 sets bit 0 write mapping, bit 1 display enable, bit 2
 *   read mapping, bit 3 shadow bank ($13 instead of $12), bits 7-6 segment; with bit 4 = 1 it only
 *   stores the bank offset from bits 2-0. ~3913: $123B reads segment & "00" & shadow & read & enable
 *   & write.
 * - ~2922-2926: page = (bank + (segment, or A15-14 for segment 11) + offset) x 2 + A13.
 * - ~3001-3020, 3050: segments 00/01/10 map only $0000-$3FFF; segment 11 maps $0000-$BFFF. Write
 *   mapping applies to writes, read mapping to reads.
 * - ~3056-3085: DivMMC (conmem / automap) beats Layer 2, which beats the MMU and the ROM.
 * - ~4921: $12 resets to bank 8 (pages 16-21), $13 to bank 11 (pages 22-27).
 * - divmmc.vhd: with conmem, $2000-$3FFF is DivMMC RAM bank `$E3` bits 3-0.
 *
 * Every program unmaps Layer 2 before it stores results: with segment 11 the stores at $A000 would be
 * Layer 2 writes too.
 */

const L2 = "ld bc,$123b\n        ld a,";
const OUT = "\n        out (c),a";

/** Reads the first byte of `page` (through slot 6) into `dest`. */
const readPage = (page: number, dest: number, offset = 0) => `
        nextreg $56,${page}
        ld a,($c000+${offset})
        ld (${dest}),a
        nextreg $56,$00`;

/** Writes `value` to the first byte of `page` (through slot 6). */
const writePage = (page: number, value: number, offset = 0) => `
        nextreg $56,${page}
        ld a,${value}
        ld ($c000+${offset}),a
        nextreg $56,$00`;

describe.each(ALL_CORES)("Layer 2 paging - %s core", (core) => {
  it("MEM-017: bit 0 maps $0000-$3FFF writes to Layer 2; reads still see the ROM", async () => {
    const s = await runCode(
      core,
      `
        ${L2}$01${OUT}
        in a,(c)
        ld e,a
        ld a,$5a
        ld ($0000),a             ; Layer 2 bank 8, page 16
        ld a,$5b
        ld ($3fff),a             ; page 17, last byte
        ld a,$5c
        ld ($4000),a             ; segment 00: $4000 is not mapped
        ld a,($0000)
        ld d,a
        xor a
        out (c),a
        ld a,e
        ld ($a000),a
        ld a,d
        ld ($a001),a
        ${readPage(16, 0xa002)}
        ${readPage(17, 0xa003, 0x1fff)}
        ${readPage(10, 0xa004)}`
    );
    expect(hex(results(s, 5))).toBe(hex([0x01, romBytes(0, 0, 1)[0], 0x5a, 0x5b, 0x5c]));
  });

  it("MEM-018: bit 2 maps reads; with bit 0 as well reads and writes both go to Layer 2", async () => {
    const s = await runCode(
      core,
      `
        ${writePage(16, 0x77)}
        ${L2}$04${OUT}
        in a,(c)
        ld e,a
        ld a,($0000)             ; Layer 2 page 16
        ld d,a
        ld a,$99
        ld ($0000),a             ; a write to the ROM: dropped
        ld a,$05
        out (c),a
        ld a,$88
        ld ($0001),a             ; now into Layer 2
        ld a,($0001)
        ld h,a
        xor a
        out (c),a
        ld a,e
        ld ($a000),a
        ld a,d
        ld ($a001),a
        ld a,h
        ld ($a002),a
        ${readPage(16, 0xa003)}
        ${readPage(16, 0xa004, 1)}
        ld a,($0000)
        ld ($a005),a`
    );
    expect(hex(results(s, 6))).toBe(hex([0x04, 0x77, 0x88, 0x77, 0x88, romBytes(0, 0, 1)[0]]));
  });

  it("MEM-019: bits 7-6 pick the 16K segment, 11 maps all 48K; bit 3 uses the shadow bank $13", async () => {
    const s = await runCode(
      core,
      `
        ${L2}$41${OUT}           ; segment 01: $0000 -> bank 9 (page 18)
        ld a,$21
        ld ($0000),a
        ld a,$81                 ; segment 10: bank 10 (page 20)
        out (c),a
        ld a,$22
        ld ($0000),a
        ld a,$c1                 ; segment 11: $0000/$4000/$8000 -> banks 8/9/10
        out (c),a
        ld a,$31
        ld ($0001),a
        ld a,$32
        ld ($4001),a
        ld a,$33
        ld ($8001),a
        ld a,$34
        ld ($c001),a             ; not mapped: MMU6 (page 0)
        ld a,$09                 ; shadow: bank 11 (page 22)
        out (c),a
        ld a,$41
        ld ($0000),a
        xor a
        out (c),a
        ${readPage(18, 0xa000)}
        ${readPage(20, 0xa001)}
        ${readPage(16, 0xa002, 1)}
        ${readPage(18, 0xa003, 1)}
        ${readPage(20, 0xa004, 1)}
        ld a,($c001)
        ld ($a005),a
        ${readPage(22, 0xa006)}`
    );
    expect(hex(results(s, 7))).toBe(hex([0x21, 0x22, 0x31, 0x32, 0x33, 0x34, 0x41]));
  });

  it("MEM-020: bit 4 stores a bank offset without touching the other bits", async () => {
    const s = await runCode(
      core,
      `
        ${L2}$01${OUT}
        ld a,$11                 ; offset 1
        out (c),a
        in a,(c)
        ld e,a
        ld a,$51
        ld ($0000),a             ; bank 8 + 1: page 18
        ld a,$c1                 ; segment 11 keeps the offset
        out (c),a
        ld a,$12                 ; offset 2
        out (c),a
        ld a,$52
        ld ($4000),a             ; bank 8 + 1 + 2: page 22
        xor a
        out (c),a
        ld a,$10                 ; offset back to 0
        out (c),a
        ld a,e
        ld ($a000),a
        ${readPage(18, 0xa001)}
        ${readPage(22, 0xa002)}`
    );
    expect(hex(results(s, 3))).toBe(hex([0x01, 0x51, 0x52]));
  });

  it("MEM-019: NextReg $12 moves the mapped bank", async () => {
    const s = await runCode(
      core,
      `
        nextreg $12,20
        ${L2}$01${OUT}
        ld a,$6c
        ld ($2000),a             ; bank 20, page 41
        xor a
        out (c),a
        nextreg $12,8
        ${readPage(41, 0xa000)}`
    );
    expect(results(s, 1)).toEqual([0x6c]);
  });

  // --- MEM-021: all three claim $2000: DivMMC RAM (conmem), Layer 2 (write mapping), MMU1 (page 30)
  it("MEM-021: $0000-$3FFF priority is DivMMC, then Layer 2, then the MMU", async () => {
    const s = await runCode(
      core,
      `
        ${writePage(17, 0x00)}
        ${writePage(30, 0x00)}
        ld a,$80                 ; DivMMC conmem, RAM bank 0 at $2000
        out ($e3),a
        xor a
        ld ($2000),a
        nextreg $51,30
        ${L2}$01${OUT}
        ld a,$11
        ld ($2000),a             ; -> DivMMC RAM
        xor a
        out ($e3),a
        ld a,$22
        ld ($2000),a             ; -> Layer 2 page 17
        xor a
        out (c),a
        ld a,$33
        ld ($2000),a             ; -> MMU1 page 30
        nextreg $51,$ff
        ld a,$80
        out ($e3),a
        ld a,($2000)
        ld ($a000),a
        xor a
        out ($e3),a
        ${readPage(17, 0xa001)}
        ${readPage(30, 0xa002)}`
    );
    expect(hex(results(s, 3))).toBe(hex([0x11, 0x22, 0x33]));
  });
});
