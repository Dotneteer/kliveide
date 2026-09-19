import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * The $7FFD paging lock and NextReg $08 bit 7 (catalogue MEM-009, B13).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~3646: a $7FFD write is ignored while `port_7ffd_locked` (= port_7ffd_reg(5), bit 5 of the last
 *   accepted write) is set.
 * - ~3650: a NextReg $08 write with bit 7 = 1 clears port_7ffd_reg(5); bit 7 = 0 leaves it.
 * - read mux: $08 bit 7 = `not port_7ffd_locked`.
 * - ~3645: any reset clears port_7ffd_reg, so the lock is gone after a reset.
 * The paged bank is observed through MMU6 ($56 = bank * 2).
 */
describe("$7FFD lock", () => {
  it("bit 5 locks $7FFD; $08 bit 7 reads the lock and writing it 1 unlocks", async () => {
    const s = await createSession();
    expect(s.readNextReg(0x08) & 0x80).toBe(0x80);

    s.out(0x7ffd, 0x21); // --- bank 1, lock
    expect(s.readNextReg(0x56)).toBe(0x02);
    expect(s.readNextReg(0x08) & 0x80).toBe(0x00);

    s.out(0x7ffd, 0x03); // --- ignored while locked
    expect(s.readNextReg(0x56)).toBe(0x02);

    s.setNextReg(0x08, s.readNextReg(0x08) & 0x7f); // --- bit 7 = 0: still locked
    expect(s.readNextReg(0x08) & 0x80).toBe(0x00);

    s.setNextReg(0x08, s.readNextReg(0x08) | 0x80); // --- bit 7 = 1: unlocked
    expect(s.readNextReg(0x08) & 0x80).toBe(0x80);
    s.out(0x7ffd, 0x03);
    expect(s.readNextReg(0x56)).toBe(0x06);
  });

  it("a soft reset clears the lock", async () => {
    const s = await createSession();
    s.out(0x7ffd, 0x21).reset();
    expect(s.readNextReg(0x08) & 0x80).toBe(0x80);
    s.out(0x7ffd, 0x03);
    expect(s.readNextReg(0x56)).toBe(0x06);
  });
});
