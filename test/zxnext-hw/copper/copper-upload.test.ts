import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * How bytes reach copper list RAM, observed by what the uploaded instruction does.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - `$60` and `$63` both store the written byte in `nr_copper_data_stored` only at an EVEN copper
 *   address (~5396, ~5411: `if nr_copper_addr(0) = '0' then nr_copper_data_stored <= nr_wr_dat`).
 * - A `$63` write at an ODD address commits `nr_copper_data_stored` as the MSB and the written byte
 *   as the LSB (~3957-3979). A `$60` write stores MSB/LSB RAM directly.
 * - Copper list RAM (`dpram2`) is not cleared by a reset; the reset branch (~4998-5002) clears only
 *   the write address and the stored byte (and copper.vhd its own pointer/mode).
 *
 * The probe instruction is MOVE $14,$5A (global transparency colour): after a frame with the copper
 * running, NextReg $14 reads $5A only if both bytes landed where they should.
 */

const MOVE_HI = 0x14;
const MOVE_LO = 0x5a;

describe("copper list upload", () => {
  const runList = async (upload: string) => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        nextreg $62,$00          ; copper stopped
        nextreg $14,$E3
        nextreg $61,$00          ; write address 0
${upload}
        nextreg $7F,$A5
        jr $
    `);
    s.runUntilReady();
    return s;
  };

  it("B4: $60 at an even address stores the byte a following $63 commits as the MSB", async () => {
    const s = await runList(`
        nextreg $60,$${MOVE_HI.toString(16)}   ; even: MSB, and stored
        nextreg $63,$${MOVE_LO.toString(16)}   ; odd: commits stored MSB + this LSB
        nextreg $60,$FF          ; HALT (WAIT line 511)
        nextreg $60,$FF
        nextreg $62,$C0          ; run, restart every frame`);
    s.runFrames(2);
    expect(s.nextRegValue(0x14)).toBe(MOVE_LO);
  });

  it("B4: $63 at an odd address does not replace the stored byte", async () => {
    const s = await runList(`
        nextreg $63,$${MOVE_HI.toString(16)}   ; addr 0 even: stored = MOVE_HI
        nextreg $63,$${MOVE_LO.toString(16)}   ; addr 1 odd: commits MOVE $14,$5A
        nextreg $61,$03          ; addr 3 (odd), no even write before it
        nextreg $63,$${MOVE_LO.toString(16)}   ; commits stored (still MOVE_HI) + $5A at 2-3
        nextreg $60,$FF          ; addr 4-5: HALT
        nextreg $60,$FF
        nextreg $62,$C0`);
    // --- On hardware both instructions are MOVE $14,$5A. If the odd write replaced the stored byte,
    // --- instruction 1 would be $5A5A (MOVE $5A,$5A) and only instruction 0 would set $14 - so
    // --- turn instruction 0 into a NOP and run again: now only instruction 1 can set it.
    s.runFrames(2);
    expect(s.nextRegValue(0x14)).toBe(MOVE_LO);
    s.setNextReg(0x62, 0x00).setNextReg(0x14, 0xe3).setNextReg(0x61, 0x00);
    s.setNextReg(0x60, 0x00).setNextReg(0x60, 0x00); // --- instruction 0: NOP
    s.setNextReg(0x62, 0xc0).runFrames(2);
    expect(s.nextRegValue(0x14)).toBe(MOVE_LO);
  });

  it("B5: a reset keeps the copper list; restarting the copper runs it again", async () => {
    const s = await runList(`
        nextreg $60,$${MOVE_HI.toString(16)}
        nextreg $60,$${MOVE_LO.toString(16)}
        nextreg $60,$FF
        nextreg $60,$FF`);
    s.reset();
    s.setNextReg(0x14, 0xe3).setNextReg(0x62, 0xc0);
    // --- The CPU restarts in the ROM after the reset; the copper runs whatever the CPU does.
    s.runFrames(2);
    expect(s.nextRegValue(0x14)).toBe(MOVE_LO);
  });
});
