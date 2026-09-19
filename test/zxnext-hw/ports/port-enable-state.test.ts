import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * What the internal port enables ($82-$85) do *not* gate, and what a disabled port keeps
 * (catalogue PORT-014 - PORT-016; ported from test/zxnext/PortEnableGating.test.ts and
 * test/zxnext/NextIoPortManager.test.ts).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~2538: `port_fe` is every even address, with no enable bit.
 * - ~2581-2582: `port_243b` / `port_253b` decode the address only, with no enable bit.
 * - ~2348-2400: the enables gate the *decode* (`port_ff_wr <= iowr and port_ff and port_ff_io_en`,
 *   ~2670; `port_123b <= ... and port_layer2_io_en`, ~2591). The registers behind a port have no
 *   enable term in their own processes, so a disabled port keeps what it held and shows it again
 *   when re-enabled. ~2769: port $FF reads the Timex register only while `port_ff_io_en` is set,
 *   else the ULA floating bus ($FF in +3 timing).
 * - ~3640-3660: `port_7ffd_reg <= cpu_do` only when `port_7ffd_locked = '0'` - a locked $7FFD
 *   ignores the whole byte (bank, shadow screen, ROM, lock). ~6104-6105: `$8E` reads
 *   dffd(0) & 7ffd(2:0) & '1' & 1ffd(0) & 1ffd(2) & (7ffd(4) and not 1ffd(0)); ~6041 `$69` bit 6 is
 *   7ffd(3); `$08` bit 7 reads `not port_7ffd_locked`.
 */

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  // --- Park the CPU: the ROM would rewrite the port enables and the border
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1); // --- one settled frame after the hard reset
}

describe("port enables: ungated ports and kept state", () => {
  it("PORT-014: with $82-$85 all 0 the NextReg ports and the ULA port $FE still work", async () => {
    const s = await parked();
    s.setNextReg(0x82, 0x00).setNextReg(0x83, 0x00).setNextReg(0x84, 0x00).setNextReg(0x85, 0x00);

    // --- $243B / $253B (~2581-2582): select, write, read back, and $243B reads the selection
    s.out(0x243b, 0x7f).out(0x253b, 0x5a);
    expect(hex(s.in(0x253b)), "$253B").toBe("$5a");
    expect(hex(s.in(0x243b)), "$243B").toBe("$7f");
    expect([0x82, 0x83, 0x84, 0x85].map((r) => hex(s.readNextReg(r))), "the enables read back").toEqual([
      "$00",
      "$00",
      "$00",
      "$00"
    ]);

    // --- $FE write (~2538): the border follows
    s.out(0x00fe, 0x02).runFrames(1);
    const red = s.pixel(8, 8);
    s.out(0x00fe, 0x01).runFrames(1);
    expect(s.pixel(8, 8), "border changed").not.toBe(red);
    s.out(0x00fe, 0x02).runFrames(1);
    expect(s.pixel(8, 8), "border back").toBe(red);

    // --- $FE read (~3453-3465): SPACE is bit 0 of the $7FFE half-row
    expect(hex(s.in(0x7ffe) & 0x1f), "no key").toBe("$1f");
    s.keyDown("SPACE");
    expect(hex(s.in(0x7ffe) & 0x1f), "SPACE").toBe("$1e");
  });

  it("PORT-015: a disabled port $FF keeps the Timex register and shows it again when re-enabled", async () => {
    const s = await parked();
    s.setNextReg(0x08, 0x04); // --- $08 bit 2: $FF reads the Timex register (~2769)
    s.out(0x00ff, 0x3a);
    expect(hex(s.in(0x00ff)), "enabled").toBe("$3a");

    s.setNextReg(0x82, 0xfe); // --- bit 0 off
    expect(hex(s.in(0x00ff)), "disabled: floating bus, $FF in +3 timing").toBe("$ff");
    s.out(0x00ff, 0x07); // --- ignored (~2670)
    expect(hex(s.readNextReg(0x69) & 0x3f), "$69 still has the old value").toBe("$3a");

    s.setNextReg(0x82, 0xff);
    expect(hex(s.in(0x00ff)), "re-enabled").toBe("$3a");
  });

  it("PORT-015: a disabled port $123B keeps the Layer 2 control and shows it again when re-enabled", async () => {
    const s = await parked();
    s.out(0x123b, 0x02); // --- Layer 2 visible
    expect(hex(s.in(0x123b)), "enabled").toBe("$02");

    s.setNextReg(0x83, 0x7f); // --- bit 15 ($83 bit 7) off (~2591)
    expect(hex(s.in(0x123b)), "disabled").toBe("$ff");
    s.out(0x123b, 0x10); // --- ignored
    expect(hex(s.readNextReg(0x69) & 0x80), "$69 bit 7: Layer 2 still enabled").toBe("$80");

    s.setNextReg(0x83, 0xff);
    expect(hex(s.in(0x123b)), "re-enabled").toBe("$02");
  });

  it("PORT-016: a locked $7FFD ignores every bit of later writes: bank, shadow screen, ROM", async () => {
    const s = await parked();
    s.out(0x7ffd, 0x3f); // --- bank 7, shadow screen, ROM 1, lock
    const state = () => ({
      mmu6: hex(s.readNextReg(0x56)),
      shadow: hex(s.readNextReg(0x69) & 0x40),
      p8e: hex(s.readNextReg(0x8e)),
      unlocked: hex(s.readNextReg(0x08) & 0x80)
    });
    // --- $8E = 0 & 111 & 1 & 0 & 0 & 1 (~6105)
    const locked = { mmu6: "$0e", shadow: "$40", p8e: "$79", unlocked: "$00" };
    expect(state(), "after the locking write").toEqual(locked);
    for (const v of [0x00, 0x10, 0x02]) {
      s.out(0x7ffd, v);
      expect(state(), `$7FFD <- ${hex(v)} while locked`).toEqual(locked);
    }
  });
});
