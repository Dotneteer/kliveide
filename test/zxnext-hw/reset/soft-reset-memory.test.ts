import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * RST-013 - a soft reset keeps RAM and resets the paging.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`): `reset` resets the MMU (~4590), port_7ffd_reg,
 * port_dffd_reg and port_1ffd_reg (~3645-3710); SRAM contents are not touched by any reset branch.
 */
describe.each(ALL_CORES)("soft reset and memory - %s core", (core) => {
  it("RST-013: RAM survives, MMU and 128K/+3 paging return to their reset values", async () => {
    const s = await createSession(core);
    s.setNextReg(0x52, 0x20).poke(0x4000, 0xa5); // --- page $20
    s.setNextReg(0x57, 0x31).poke(0xe000, 0x5a); // --- page $31
    s.out(0x1ffd, 0x01).out(0xdffd, 0x01).out(0x7ffd, 0x05); // --- +3 all-RAM, bank 21
    expect(s.readNextReg(0x8e)).not.toBe(0x08);

    s.reset();
    expect([0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57].map((r) => s.readNextReg(r))).toEqual([
      0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01
    ]);
    expect(s.readNextReg(0x8e), "$7FFD, $DFFD and $1FFD reset").toBe(0x08);

    s.setNextReg(0x52, 0x20).setNextReg(0x57, 0x31);
    expect([s.peek(0x4000), s.peek(0xe000)]).toEqual([0xa5, 0x5a]);
  });
});
