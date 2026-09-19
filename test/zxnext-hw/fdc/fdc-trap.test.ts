import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The +3 FDC ports and their I/O trap (catalogue FDC-001 - FDC-004; the trap's NMI, $DA and $02 bit 4
 * are RST-006 in reset/reset-register.test.ts).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~5615, ~6211, ~5085: $D8 bit 0 (nr_d8_io_trap_fdc_en) reads back as "0000000" & bit 0; a reset
 *   clears it.
 * - ~2554-2558: $2FFD / $3FFD are A15-14 = 00, A13-12 = 10 / 11, A1-0 = 01 - and decoded only while
 *   $D8 bit 0 is set. The Next has no uPD765: with the trap off nothing answers them, so a read is
 *   $FF (~1826-1834, expansion bus off). With the trap on the port is an internal response without read
 *   data (not in port_internal_rd_response), which also reads $FF.
 * - ~3815, ~3846-3877: a trapped access raises a Multiface NMI; $DA records the cause and $D9 the
 *   written byte only while the NMI state machine accepts a cause (nmi_accept_cause: S_NMI_IDLE or
 *   S_NMI_FETCH, ~2120). After the fetch at $0066 it holds (S_NMI_HOLD): later traps change neither.
 */

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1);
}

/** A session with the trap on (and the Multiface NMI enabled, as RST-006) and the CPU parked. */
async function trapped(): Promise<NextTestSession> {
  return (await parked()).setNextReg(0x06, 0x08).setNextReg(0xd8, 0x01);
}

describe("+3 FDC ports", () => {
  it("FDC-001: $D8 bit 0 reads back alone; a soft reset clears it", async () => {
    const s = await parked();
    expect(s.setNextReg(0xd8, 0xff).readNextReg(0xd8)).toBe(0x01);
    expect(s.setNextReg(0xd8, 0xfe).readNextReg(0xd8)).toBe(0x00);
    s.setNextReg(0xd8, 0x01).reset();
    expect(s.readNextReg(0xd8), "after a soft reset").toBe(0x00);
  });

  it("FDC-002: with the trap on, A15-14 = 00, A13-12 = 10 / 11, A1-0 = 01 trap; a trapped read is $FF", async () => {
    const cases: Array<[port: number, write: boolean, cause: number]> = [
      [0x2ffd, false, 0x01],
      [0x2001, false, 0x01],
      [0x2c05, false, 0x01],
      [0x3ffd, false, 0x02],
      [0x3001, false, 0x02],
      [0x3ffd, true, 0x03],
      [0x3a41, true, 0x03]
    ];
    for (const [port, write, cause] of cases) {
      const s = await trapped();
      const what = `${write ? "write" : "read"} $${port.toString(16)}`;
      if (write) s.out(port, 0x5c);
      else expect(s.in(port), `${what}: the value`).toBe(0xff);
      expect(s.readNextReg(0xda), `${what}: $DA`).toBe(cause);
      if (write) expect(s.readNextReg(0xd9), `${what}: $D9`).toBe(0x5c);
    }
  });

  it("FDC-002: other addresses do not trap: $1FFD, $0FFD, $2FFF, $6FFD, $2FFE", async () => {
    for (const port of [0x1ffd, 0x0ffd, 0x2fff, 0x6ffd, 0x2ffe]) {
      const s = await trapped();
      s.in(port);
      expect(s.readNextReg(0xda), `read $${port.toString(16)}`).toBe(0x00);
    }
    const s = await trapped();
    s.out(0x2ffd, 0x11); // --- a $2FFD write is not a trap cause
    expect([s.readNextReg(0xda), s.readNextReg(0xd9)], "write $2ffd").toEqual([0x00, 0x00]);
  });

  it("FDC-002: with the trap off, $2FFD / $3FFD do not trap and nothing answers them", async () => {
    const s = await parked();
    s.setNextReg(0x06, 0x08).setNextReg(0xd8, 0x00);
    expect([s.in(0x2ffd), s.in(0x3ffd)]).toEqual([0xff, 0xff]);
    s.out(0x3ffd, 0x44);
    expect([s.readNextReg(0xda), s.readNextReg(0xd9)]).toEqual([0x00, 0x00]);
    s.runFrames(1);
    expect(s.registers().pc, "no NMI").toBeGreaterThanOrEqual(0x8000);
  });

  it("FDC-003: $DA and $D9 change only while the NMI state machine accepts a cause", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
        di
        nextreg $06,$08
        nextreg $d8,$01
        ld bc,$3ffd
        ld a,$a7
        out (c),a
        jr $`);
    s.runTo(0x0066, { maxFrames: 2 });
    // --- Still S_NMI_FETCH: a cause is accepted
    expect([s.readNextReg(0xda), s.readNextReg(0xd9)], "the trap").toEqual([0x03, 0xa7]);
    s.step(1); // --- the fetch at $0066: S_NMI_HOLD while the Multiface is paged in
    s.in(0x2ffd);
    s.out(0x3ffd, 0x55);
    expect([s.readNextReg(0xda), s.readNextReg(0xd9)], "traps in the handler").toEqual([0x03, 0xa7]);
    // --- $D9 is also a plain NextReg
    expect(s.setNextReg(0xd9, 0x3c).readNextReg(0xd9), "written as a NextReg").toBe(0x3c);
  });

  it("FDC-004: the Next has no uPD765: its status and data ports read $FF", async () => {
    const s = await parked();
    // --- A uPD765 would answer $80 (RQM) from its status register and a SENSE DRIVE STATUS result
    s.out(0x1ffd, 0x08); // --- the +3 motor bit
    expect(s.in(0x2ffd), "status").toBe(0xff);
    s.out(0x3ffd, 0x04).out(0x3ffd, 0x00); // --- SENSE DRIVE STATUS, drive 0
    expect([s.in(0x2ffd), s.in(0x3ffd)], "no result phase").toEqual([0xff, 0xff]);
  });
});
