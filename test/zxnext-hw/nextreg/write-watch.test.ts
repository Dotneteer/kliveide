import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * The core half of NextReg write breakpoints: the watch table, the origin discriminator and the
 * latch. See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.2.
 *
 * This is debugger machinery rather than emulated hardware, so there is no VHDL to cite. What it
 * must not do is change the machine: every case that arms a watch also checks the register ended
 * up holding what it would have held anyway.
 *
 * `$7F` is the user register - a plain 8-bit read/write register with no side effects - which is
 * why the other NextReg tests use it as the neutral target too.
 */
describe("NextReg write watch", () => {
  it("catches a $253B write and reports the value the register held before it", async () => {
    const s = await createSession();
    s.setNextReg(0x7f, 0x11);
    s.watchNextRegWrite(0x7f);

    s.setNextReg(0x7f, 0x22);

    expect(s.takeNextRegHit()).toEqual({
      reg: 0x7f,
      oldValue: 0x11,
      newValue: 0x22,
      origin: "cpu"
    });
    // --- The watch observes; it must not veto. The write landed.
    expect(s.nextRegValue(0x7f)).toBe(0x22);
  });

  it("catches a NEXTREG opcode, which never goes through the port layer", async () => {
    const s = await createSession();
    s.setNextReg(0x7f, 0x11);
    s.watchNextRegWrite(0x7f);

    /*
     * NEXTREG $7F,$33 (ED 91 7F 33): writes its own operand and leaves $243B alone.
     *
     * Driven with `runFrames` rather than `call`: `call` goes through the debug loop, which owns
     * the watch table and would clear the one this test armed. See `watchNextRegWrite`.
     */
    const program = await s.loadCode(`
      nextreg $7f, $33
      Spin: jr Spin
    `);
    s.setRegisters({ pc: program.entry });
    s.runFrames(1);

    expect(s.takeNextRegHit()).toMatchObject({ reg: 0x7f, oldValue: 0x11, newValue: 0x33 });
    expect(s.nextRegValue(0x7f)).toBe(0x33);
  });

  it("takes the latch once, then reports nothing until the next watched write", async () => {
    const s = await createSession();
    s.watchNextRegWrite(0x7f);
    s.setNextReg(0x7f, 0x44);

    expect(s.takeNextRegHit()).toBeDefined();
    expect(s.takeNextRegHit()).toBeUndefined();
  });

  it("says nothing about a register nobody is watching", async () => {
    const s = await createSession();
    s.watchNextRegWrite(0x7f);

    s.setNextReg(0x4c, 0x07);

    expect(s.takeNextRegHit()).toBeUndefined();
  });

  it("keeps the first write of a burst, not the last", async () => {
    /*
     * Latch-first, which is what makes a burst of watched writes usable: the earliest is reported,
     * the machine stops, and the rest are reported on later runs. Latching the last instead would
     * lose the write the user was waiting for.
     *
     * Note what this pins and what it does not. It proves the ordering, over a copper list that
     * writes two watched registers. It does *not* prove those two writes fell inside one Z80
     * instruction - the latch is only cleared when taken, so it would hold the first either way.
     * That multi-write-per-instruction is possible at all is argued in the plan from the core's
     * structure (the copper ticks 4x per horizontal cycle, `ZXNEXT_COPPER_TICKS_PER_HC`; a DMA
     * burst writes a fixed destination port inside the CPU's tact window), not from this test.
     */
    const s = await createSession();
    s.setNextReg(0x7f, 0x00);
    s.watchNextRegWrite(0x7f, { copper: true });
    s.watchNextRegWrite(0x4c, { copper: true });

    runCopperList(s, [
      [0x7f, 0xaa],
      [0x4c, 0x0b]
    ]);

    // --- The earlier MOVE of the two, with the value $7F held before the list ran.
    expect(s.takeNextRegHit()).toMatchObject({ reg: 0x7f, oldValue: 0x00, newValue: 0xaa });
    // --- Both landed; latching the first interfered with neither.
    expect(s.nextRegValue(0x7f)).toBe(0xaa);
    expect(s.nextRegValue(0x4c)).toBe(0x0b);
  });

  it("reports a write the hardware ignores, because that is the bug worth finding", async () => {
    /*
     * `$00` is read-only: `zxnextNextRegSetDirect` rejects it before assigning. The watch runs
     * above that rejection on purpose - a program writing a read-only register is exactly what a
     * user sets this breakpoint to catch, and saying nothing would be the wrong silence.
     */
    const s = await createSession();
    const before = s.nextRegValue(0x00);
    s.watchNextRegWrite(0x00);

    s.setNextReg(0x00, 0x5a);

    expect(s.takeNextRegHit()).toMatchObject({ reg: 0x00, newValue: 0x5a });
    // --- Reported, but still refused: the watch changed nothing.
    expect(s.nextRegValue(0x00)).toBe(before);
  });

  it("reports the stored previous value, not what a $253B read would return", async () => {
    /*
     * `$02`'s read mux forces bits `$60` to zero, so peeking it can differ from what it stores.
     * The latch must carry the stored value, or the IDE would show an "old value" the register
     * never held.
     */
    const s = await createSession();
    s.watchNextRegWrite(0x02);
    const stored = s.nextRegValue(0x02);

    s.setNextReg(0x02, 0x00);

    expect(s.takeNextRegHit()).toMatchObject({ reg: 0x02, oldValue: stored });
  });

  describe("value filters", () => {
    it("catches only the value it was armed for", async () => {
      const s = await createSession();
      s.watchNextRegWrite(0x7f, { value: 0x03 });

      s.setNextReg(0x7f, 0x02);
      expect(s.takeNextRegHit()).toBeUndefined();

      s.setNextReg(0x7f, 0x03);
      expect(s.takeNextRegHit()).toMatchObject({ reg: 0x7f, newValue: 0x03 });
    });

    it("compares only the masked bits", async () => {
      const s = await createSession();
      s.watchNextRegWrite(0x7f, { value: 0x03, mask: 0x0f });

      // --- High nibble differs, low nibble matches: a hit.
      s.setNextReg(0x7f, 0xf3);
      expect(s.takeNextRegHit()).toMatchObject({ newValue: 0xf3 });

      // --- Low nibble differs: no hit, whatever the high nibble does.
      s.setNextReg(0x7f, 0x04);
      expect(s.takeNextRegHit()).toBeUndefined();
    });

    it("matches any value when the mask is zero", async () => {
      // --- How the host collapses two breakpoints watching one register with different filters:
      // --- the core over-approximates and `DebugSupport` makes the exact decision.
      const s = await createSession();
      s.watchNextRegWrite(0x7f, { value: 0x03, mask: 0x00 });

      s.setNextReg(0x7f, 0x77);

      expect(s.takeNextRegHit()).toMatchObject({ newValue: 0x77 });
    });
  });

  describe("write origins", () => {
    it("ignores a Copper write unless the watch asked for one", async () => {
      const s = await createSession();
      s.watchNextRegWrite(0x7f);
      runCopperWrite(s, 0x7f, 0x66);

      expect(s.takeNextRegHit()).toBeUndefined();
      // --- The copper still wrote it; only the reporting was declined.
      expect(s.nextRegValue(0x7f)).toBe(0x66);
    });

    it("catches a Copper write when it did, and labels it", async () => {
      const s = await createSession();
      s.watchNextRegWrite(0x7f, { copper: true });
      runCopperWrite(s, 0x7f, 0x66);

      expect(s.takeNextRegHit()).toMatchObject({ reg: 0x7f, newValue: 0x66, origin: "copper" });
    });

    it("still labels a CPU write as CPU when copper writes are also watched", async () => {
      const s = await createSession();
      s.watchNextRegWrite(0x7f, { copper: true });

      s.setNextReg(0x7f, 0x55);

      expect(s.takeNextRegHit()).toMatchObject({ origin: "cpu" });
    });

    it("says nothing about the register writes a soft reset performs", async () => {
      // --- A soft reset replays a dozen registers through `SetDirect` with no origin set. Reporting
      // --- them would make the breakpoint fire on every reset, which is never what was meant.
      const s = await createSession();
      s.watchNextRegWrite(0x05);
      s.takeNextRegHit();

      s.reset();

      expect(s.takeNextRegHit()).toBeUndefined();
    });
  });

  it("stops reporting once the watches are cleared", async () => {
    // --- The debug loop calls this when it enters with no NextReg breakpoint armed. Without it a
    // --- table left over from a deleted breakpoint would keep stopping the machine.
    const s = await createSession();
    s.watchNextRegWrite(0x7f);
    s.clearNextRegWatches();

    s.setNextReg(0x7f, 0x77);

    expect(s.takeNextRegHit()).toBeUndefined();
  });
});

/** Runs a copper list of MOVEs, then lets it execute for one frame. */
function runCopperList(
  s: Awaited<ReturnType<typeof createSession>>,
  moves: Array<[reg: number, value: number]>
) {
  // --- Copper instruction memory is filled a byte at a time through NextReg $63, with $62 holding
  // --- the write pointer's high bits and the start mode. A MOVE is `0rrrrrrr vvvvvvvv`.
  s.setNextReg(0x62, 0x00);
  s.setNextReg(0x61, 0x00);
  for (const [reg, value] of moves) {
    s.setNextReg(0x63, reg & 0x7f);
    s.setNextReg(0x63, value & 0xff);
  }
  // --- A WAIT for an impossible position acts as the list's stop, so it runs once per frame.
  s.setNextReg(0x63, 0xff);
  s.setNextReg(0x63, 0xff);
  // --- Start the copper from the top of the list.
  s.setNextReg(0x62, 0x40);
  s.runFrames(1);
}

/** Runs one Copper MOVE that writes `value` to `reg`, then lets it execute. */
function runCopperWrite(s: Awaited<ReturnType<typeof createSession>>, reg: number, value: number) {
  runCopperList(s, [[reg, value]]);
}
