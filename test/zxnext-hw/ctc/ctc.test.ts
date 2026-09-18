import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { delay } from "../_timing-helpers";

/*
 * Z80 CTC (catalogue CTC-001 - CTC-014).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~2646: ports `$183B`-`$1F3B` (A15-A11 = 00011, low byte $3B), gated by internal port
 *   enable bit 27 (`$85` bit 3, ~2398). A10-A8 select the channel (~4056).
 * - zxnext.vhd ~4044-4073: four channels (`NUM_CTC => 4`) clocked by `i_CLK_28`; channels 4-7 have
 *   no hardware, so ctc.vhd's read mux gives $00 for them and their writes go nowhere. The clock /
 *   trigger inputs are `ctc_zc_to(2 downto 0) & ctc_zc_to(3)`: channel 0 is clocked by channel 3's
 *   ZC/TO, channel n (n = 1-3) by channel n-1's. `o_im2_vector_wr => open`: a vector write does nothing.
 * - zxnext.vhd ~1892-1909: the CTC's ZC/TO pulses are interrupt requests 3-6 of the im2 chain (vector
 *   `$C0` bits 7-5 & index & '0'), their enables are `ctc_int_en` (control-word bit 7, also written by
 *   `$C5`, ~4058), and `$C9` reads / clears (write 1) their status (~6196, ~1909).
 * - ctc_chan.vhd:
 *   - control word = a write with D0 = 1 while no time constant is expected; stored as D7-D2.
 *     D7 interrupt enable, D6 counter mode, D5 prescaler 256, D4 rising edge, D3 timer waits for a
 *     trigger, D2 time constant follows, D1 software reset.
 *   - From hard reset only a control word with D2 = 1 leaves S_CONTROL_WORD; the byte after it is the
 *     time constant whatever its D0 (`iowr_tc_exp`). Time constant -> S_WAIT -> S_RUNNING, except a
 *     timer with D3 = 1, which waits for a trigger edge. Changing D4 counts as an edge.
 *   - Outside S_RUNNING the channel is in soft reset: the prescaler is 0 and the counter holds the
 *     time constant. D1 = 1 re-enters S_CONTROL_WORD (D2 = 0) or S_TIME_CONSTANT (D2 = 1).
 *   - The prescaler is a free-running 8-bit count of 28 MHz clocks; a timer decrements when its low
 *     nibble (prescaler 16) or the whole byte (prescaler 256) is all ones. A counter decrements on the
 *     trigger edge instead.
 *   - ZC/TO is one clock when the count becomes 0, and the same clock reloads the time constant; a
 *     time constant of 0 therefore counts 256. A port read returns the down-counter.
 *
 * At 3.5 MHz one T-state is 8 clocks of 28 MHz: a timer with prescaler 16 counts every 2 T-states,
 * with prescaler 256 every 32.
 */

// ---------------------------------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------------------------------

/** Channel ports. */
const CH = [0x183b, 0x193b, 0x1a3b, 0x1b3b];

/** Control-word bits. */
const INT = 0x80;
const COUNTER = 0x40;
const P256 = 0x20;
const RISING = 0x10;
const TRIGGER = 0x08;
const TC = 0x04;
const RESET = 0x02;
const CW = 0x01;

/** 28 MHz clocks per T-state at 3.5 MHz. */
const CLK_PER_TACT = 8;

/** A session with the CPU parked, so the ROM does not rewrite anything. */
async function parked(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

/** Programs a channel from outside: control word, then the time constant. */
const program = (s: NextTestSession, ch: number, control: number, tc: number) => s.out(CH[ch], control).out(CH[ch], tc);

/** I register value: the vector table is at $BE00-$BF00. */
const TABLE = 0xbe00;

/** Interrupt counters: one per CTC channel, one for the pulse-mode vector $FF, one for anything else. */
const COUNTERS = ["Count0", "Count1", "Count2", "Count3", "CountFF", "CountOther"];

const isr = (label: string, counter: string) => `
${label}: push hl
        ld hl,(${counter})
        inc hl
        ld (${counter}),hl
        pop hl
        ei
        reti`;

/**
 * An IM 2 program: I = $BE, ULA and line interrupts off, `$C0` = `c0` (hardware IM2 with vector base
 * $A0 by default), CTC status cleared, then `setup`, EI and park. Vector $A6 + 2n counts channel n,
 * $FF counts pulse-mode interrupts, every other vector counts in CountOther.
 */
const im2Program = (setup: string, c0 = 0xa1) => `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $22,$04          ; ULA and line interrupts off
        nextreg $c0,${c0}
        nextreg $c9,$ff          ; clear the CTC status
${setup}
        ei
        nextreg $7f,$a5
Park:   jr Park
${isr("Isr0", "Count0")}
${isr("Isr1", "Count1")}
${isr("Isr2", "Count2")}
${isr("Isr3", "Count3")}
${isr("IsrFF", "CountFF")}
${isr("IsrOther", "CountOther")}
${COUNTERS.map((c) => `${c}: .defw 0`).join("\n")}
`;

/** Loads an `im2Program` and installs its vector table. */
async function im2Session(core: CoreName, setup: string, c0 = 0xa1): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  await s.loadCode(im2Program(setup, c0), { entry: "Start" });
  const base = c0 & 0xe0;
  for (let v = 0; v < 256; v += 2) s.pokeWord(TABLE + v, s.symbol("IsrOther"));
  for (let ch = 0; ch < 4; ch++) s.pokeWord(TABLE + base + 6 + 2 * ch, s.symbol(`Isr${ch}`));
  s.pokeWord(TABLE + 0xff, s.symbol("IsrFF"));
  return s;
}

/** The interrupt counters. */
const counts = (s: NextTestSession) => Object.fromEntries(COUNTERS.map((c) => [c, s.peekWord(s.symbol(c))]));

/** Z80 code writing a control word and a time constant to a channel (changes A, BC). */
const setupChannel = (ch: number, control: number, tc: number) => `
        ld bc,$${CH[ch].toString(16)}
        ld a,$${control.toString(16)}
        out (c),a
        ld a,${tc}
        out (c),a`;

/**
 * Runs `frames` frames after the program is ready and returns how many interrupts each counter took,
 * plus the elapsed 28 MHz clocks (from T-states: the program must run at 3.5 MHz). The window starts a
 * frame after ready: zero counts that happened while the setup ran with interrupts off are pending,
 * and are served after EI - they belong before the window.
 */
function measure(s: NextTestSession, frames: number) {
  s.runUntilReady().runFrames(1);
  const before = counts(s);
  const tacts = s.tacts;
  s.runFrames(frames);
  const after = counts(s);
  return {
    n: Object.fromEntries(COUNTERS.map((c) => [c, after[c] - before[c]])),
    clocks: (s.tacts - tacts) * CLK_PER_TACT
  };
}

/** `actual` is within 1 of `expected` (a count over a window whose ends fall anywhere in a period). */
function expectAbout(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual}, expected ${expected.toFixed(2)}`).toBeLessThanOrEqual(1);
}

/**
 * Reads channel `ch` twice, `distance` T-states apart (start of one `IN r,(C)` to the start of the
 * next, so both sample at the same point of the instruction), after programming it with `control`
 * and `tc`. Returns both readings.
 */
async function twoReadings(core: CoreName, ch: number, control: number, tc: number, distance: number) {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  await s.loadCode(
    `
        .org $8000
Start:  di
${setupChannel(ch, control, tc)}
        in h,(c)                 ; 12
${delay(distance - 12)}
        in l,(c)
        ld (Result),hl
        nextreg $7f,$a5
        jr $
Result: .defw 0`,
    { entry: "Start" }
  );
  s.runUntilReady();
  const r = s.peekWord(s.symbol("Result"));
  return { first: r >> 8, second: r & 0xff };
}

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("CTC - %s core", (core: CoreName) => {
  // --- CTC-001: control word and time constant --------------------------------------------------------

  it("CTC-001: after hard reset a channel reads 0; a control word without D2 leaves it in reset", async () => {
    const s = await parked(core);
    expect(CH.map((p) => s.in(p)), "hard reset").toEqual([0, 0, 0, 0]);
    // --- D2 = 0: stays in S_CONTROL_WORD, so $64 (D0 = 0) is not a time constant
    s.out(CH[0], P256 | CW).out(CH[0], 0x64);
    s.setNextReg(0xc9, 0xff).runFrames(2);
    expect(s.in(CH[0]), "no time constant taken").toBe(0);
    expect(s.readNextReg(0xc9) & 0x01, "not counting").toBe(0);
  });

  it("CTC-001: a control word with D2 then a time constant: the channel reads the constant", async () => {
    const s = await parked(core);
    program(s, 0, P256 | TC | CW, 200);
    expect(s.in(CH[0])).toBe(200);
    s.runFrames(1);
    const later = s.in(CH[0]);
    expect(later, "counting down, reloading from 200").toBeLessThanOrEqual(200);
    s.runFrames(1);
    expect(s.in(CH[0]), "still counting").not.toBe(later);
  });

  it("CTC-001: the byte after a D2 control word is the time constant even with D0 = 1", async () => {
    const s = await parked(core);
    program(s, 0, P256 | TC | CW, 0x41); // --- $41 would be a counter-mode control word
    expect(s.in(CH[0])).toBe(0x41);
    s.setNextReg(0xc9, 0xff).runFrames(1);
    expect(s.readNextReg(0xc9) & 0x01, "a running timer").toBe(0x01);
  });

  it("CTC-001: each port addresses its own channel", async () => {
    const s = await parked(core);
    [11, 22, 33, 44].forEach((tc, ch) => program(s, ch, P256 | TC | CW, tc));
    expect(CH.map((p) => s.in(p))).toEqual([11, 22, 33, 44]);
  });

  // --- CTC-002 / CTC-003: prescaler ---------------------------------------------------------------------

  it("CTC-002: with prescaler 16 a timer counts once every 2 T-states (16 clocks of 28 MHz)", async () => {
    // --- 200 T-states = 1600 clocks = exactly 100 prescaler periods, wherever the window starts
    const r = await twoReadings(core, 0, TC | CW, 250, 200);
    expect(r.first, "shortly after the time constant").toBeGreaterThan(230);
    expect(r.first - r.second).toBe(100);
    const odd = await twoReadings(core, 2, TC | CW, 250, 202);
    expect(odd.first - odd.second, "channel 2, 202 T-states").toBe(101);
  });

  it("CTC-003: with prescaler 256 (D5) a timer counts once every 32 T-states", async () => {
    const r = await twoReadings(core, 0, P256 | TC | CW, 250, 1600);
    expect(r.first, "shortly after the time constant").toBeGreaterThan(245);
    expect(r.first - r.second).toBe(50);
    const other = await twoReadings(core, 3, P256 | TC | CW, 250, 1632);
    expect(other.first - other.second, "channel 3, 1632 T-states").toBe(51);
  });

  // --- CTC-004: reload -------------------------------------------------------------------------------

  it("CTC-004: at zero the counter reloads the time constant", async () => {
    // --- TC 10: the count cycles 10 ... 1 (0 shows for one 28 MHz clock), so modulo 10 it is a
    // --- plain down-counter. 23 counts later it is 3 lower, modulo 10.
    const r = await twoReadings(core, 0, P256 | TC | CW, 10, 23 * 32);
    expect(r.first).toBeLessThanOrEqual(10);
    expect(r.second).toBeLessThanOrEqual(10);
    expect((((r.first - r.second) % 10) + 10) % 10).toBe(3);
  });

  it("CTC-004: a time constant of 0 counts 256", async () => {
    // --- TC 0 reloads 0, so the count is a plain modulo-256 down-counter: 300 counts = 44 lower
    const r = await twoReadings(core, 1, P256 | TC | CW, 0, 300 * 32);
    expect((((r.first - r.second) % 256) + 256) % 256).toBe(44);
  });

  // --- CTC-005: software reset ---------------------------------------------------------------------

  it("CTC-005: a software reset with D2 stops the channel at its constant until a new one", async () => {
    const s = await parked(core);
    program(s, 0, P256 | TC | CW, 200).runFrames(1);
    s.out(CH[0], P256 | TC | RESET | CW).setNextReg(0xc9, 0xff);
    expect(s.in(CH[0]), "holds the old constant").toBe(200);
    s.runFrames(3);
    expect(s.in(CH[0]), "still stopped").toBe(200);
    expect(s.readNextReg(0xc9) & 0x01, "no zero count").toBe(0);
    s.out(CH[0], 50);
    expect(s.in(CH[0]), "the new constant").toBe(50);
    s.runFrames(1);
    expect(s.readNextReg(0xc9) & 0x01, "running again").toBe(0x01);
  });

  it("CTC-005: a software reset without D2 returns to the reset state until a D2 control word", async () => {
    const s = await parked(core);
    program(s, 0, P256 | TC | CW, 50).runFrames(1);
    s.out(CH[0], RESET | CW).setNextReg(0xc9, 0xff);
    expect(s.in(CH[0]), "holds the constant").toBe(50);
    s.out(CH[0], 0x32); // --- D0 = 0 and no constant expected: not a time constant
    s.runFrames(2);
    expect({ count: s.in(CH[0]), status: s.readNextReg(0xc9) & 0x01 }, "stopped").toEqual({ count: 50, status: 0 });
    program(s, 0, P256 | TC | CW, 0x10);
    expect(s.in(CH[0])).toBe(0x10);
    s.runFrames(1);
    expect(s.readNextReg(0xc9) & 0x01, "running again").toBe(0x01);
  });

  // --- CTC-006: interrupts -------------------------------------------------------------------------

  for (const ch of [0, 1, 2, 3]) {
    it(`CTC-006: control-word D7 makes channel ${ch} interrupt once a period on vector $${(0xa6 + 2 * ch).toString(16).toUpperCase()}`, async () => {
      // --- prescaler 256, constant 0: a zero count every 256 x 256 clocks
      const s = await im2Session(core, setupChannel(ch, INT | P256 | TC | CW, 0));
      const m = measure(s, 10);
      expectAbout(m.n[`Count${ch}`], m.clocks / 65536, `channel ${ch}`);
      expect(m.n.CountOther + m.n.CountFF, "no other vector").toBe(0);
      expect(s.readNextReg(0xc5), "$C5 reads the control-word bit").toBe(1 << ch);
    });
  }

  it("CTC-006: a control word without D7 clears the enable $C5 reads", async () => {
    const s = await im2Session(core, setupChannel(0, INT | P256 | TC | CW, 0));
    s.runUntilReady().runFrames(2);
    expect(counts(s).Count0, "interrupting").toBeGreaterThan(0);
    program(s, 0, P256 | TC | CW, 0);
    expect(s.readNextReg(0xc5) & 0x01).toBe(0);
    const before = counts(s).Count0;
    s.runFrames(3);
    expect(counts(s).Count0 - before, "no more interrupts").toBe(0);
  });

  it("CTC-006: in pulse mode an enabled channel interrupts IM 2 through vector $FF", async () => {
    const s = await im2Session(core, setupChannel(0, INT | P256 | TC | CW, 0), 0x00);
    const m = measure(s, 10);
    expectAbout(m.n.CountFF, m.clocks / 65536, "pulse interrupts");
    expect(m.n.Count0 + m.n.CountOther).toBe(0);
  });

  // --- CTC-007: vector write -----------------------------------------------------------------------

  it("CTC-007: a vector write does not change the hardware IM2 vector or disturb the channel", async () => {
    const s = await im2Session(core, setupChannel(0, INT | P256 | TC | CW, 0));
    s.runUntilReady().runFrames(1);
    const count = s.in(CH[0]);
    s.out(CH[0], 0xf0); // --- D0 = 0 and no constant expected: a vector
    expect(s.in(CH[0]), "count untouched").toBe(count);
    const m = measure(s, 10);
    expectAbout(m.n.Count0, m.clocks / 65536, "still $A6, still once a period");
    expect(m.n.CountOther + m.n.CountFF, "vector $F0 never used").toBe(0);
  });

  it("CTC-007: a vector write does not change the pulse-mode vector $FF either", async () => {
    const s = await im2Session(core, setupChannel(0, INT | P256 | TC | CW, 0), 0x00);
    s.runUntilReady();
    s.out(CH[0], 0xf0);
    const m = measure(s, 5);
    expect(m.n.CountFF).toBeGreaterThan(0);
    expect(m.n.CountOther).toBe(0);
  });

  // --- CTC-008: chaining ---------------------------------------------------------------------------

  it("CTC-008: channel 0's ZC/TO clocks channel 1, 1 clocks 2, 2 clocks 3 in counter mode", async () => {
    const s = await im2Session(
      core,
      [
        setupChannel(0, INT | P256 | TC | CW, 16), // --- a zero count every 16 x 256 clocks
        setupChannel(1, INT | COUNTER | TC | CW, 2),
        setupChannel(2, INT | COUNTER | P256 | TC | CW, 3), // --- the prescaler does not apply
        setupChannel(3, INT | COUNTER | TC | CW, 4)
      ].join("\n")
    );
    const m = measure(s, 10);
    const n0 = m.clocks / (16 * 256);
    expectAbout(m.n.Count0, n0, "channel 0");
    expectAbout(m.n.Count1, n0 / 2, "channel 1");
    expectAbout(m.n.Count2, n0 / 6, "channel 2");
    expectAbout(m.n.Count3, n0 / 24, "channel 3");
  });

  it("CTC-008: channel 3's ZC/TO clocks channel 0", async () => {
    const s = await im2Session(
      core,
      [setupChannel(3, INT | P256 | TC | CW, 16), setupChannel(0, INT | COUNTER | TC | CW, 3)].join("\n")
    );
    const m = measure(s, 10);
    const n3 = m.clocks / (16 * 256);
    expectAbout(m.n.Count3, n3, "channel 3");
    expectAbout(m.n.Count0, n3 / 3, "channel 0");
  });

  it("CTC-008: a chain through the wrap: timer 2 -> counter 3 -> counter 0 -> counter 1", async () => {
    const s = await im2Session(
      core,
      [
        setupChannel(2, INT | P256 | TC | CW, 16),
        setupChannel(3, INT | COUNTER | TC | CW, 2),
        setupChannel(0, INT | COUNTER | TC | CW, 2),
        setupChannel(1, INT | COUNTER | TC | CW, 2)
      ].join("\n")
    );
    const m = measure(s, 10);
    const n2 = m.clocks / (16 * 256);
    expectAbout(m.n.Count2, n2, "channel 2");
    expectAbout(m.n.Count3, n2 / 2, "channel 3");
    expectAbout(m.n.Count0, n2 / 4, "channel 0");
    expectAbout(m.n.Count1, n2 / 8, "channel 1");
  });

  // --- CTC-009: timer trigger ----------------------------------------------------------------------

  it("CTC-009: a timer with D3 waits for its trigger - the upstream channel's ZC/TO", async () => {
    const s = await parked(core);
    program(s, 1, TRIGGER | TC | CW, 100).setNextReg(0xc9, 0xff).runFrames(2);
    expect({ count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02 }, "waiting").toEqual({ count: 100, status: 0 });
    program(s, 0, P256 | TC | CW, 10); // --- channel 0 is channel 1's trigger
    s.runFrames(1);
    expect(s.readNextReg(0xc9) & 0x02, "channel 1 started").toBe(0x02);
  });

  it("CTC-009: changing the edge select (D4) counts as the trigger", async () => {
    const s = await parked(core);
    program(s, 1, TRIGGER | TC | CW, 100).setNextReg(0xc9, 0xff);
    s.out(CH[1], TRIGGER | CW).runFrames(2); // --- same edge: still waiting
    expect({ count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02 }, "waiting").toEqual({ count: 100, status: 0 });
    s.out(CH[1], RISING | TRIGGER | CW).runFrames(1);
    expect(s.readNextReg(0xc9) & 0x02, "started").toBe(0x02);
  });

  // --- CTC-010: channels 4-7 -----------------------------------------------------------------------

  it("CTC-010: channels 4-7 read $00 and their writes reach no channel", async () => {
    const s = await parked(core);
    s.setNextReg(0xc9, 0xff);
    for (const port of [0x1c3b, 0x1d3b, 0x1e3b, 0x1f3b]) s.out(port, INT | TC | CW).out(port, 50);
    expect([0x1c3b, 0x1d3b, 0x1e3b, 0x1f3b].map((p) => s.in(p)), "channels 4-7").toEqual([0, 0, 0, 0]);
    expect(CH.map((p) => s.in(p)), "channels 0-3 untouched").toEqual([0, 0, 0, 0]);
    s.runFrames(2);
    expect(s.readNextReg(0xc9), "no zero count anywhere").toBe(0);
  });

  // --- CTC-011: status -----------------------------------------------------------------------------

  it("CTC-011: $C9 latches each channel's zero count; writing 1 clears that bit", async () => {
    const s = await parked(core);
    s.setNextReg(0xc9, 0xff);
    program(s, 0, P256 | TC | CW, 0);
    program(s, 2, P256 | TC | CW, 0);
    s.runFrames(1);
    expect(s.readNextReg(0xc9), "channels 0 and 2").toBe(0x05);
    s.out(CH[0], RESET | CW).out(CH[2], RESET | CW); // --- stop both
    s.setNextReg(0xc9, 0x01);
    expect(s.readNextReg(0xc9), "channel 0 cleared").toBe(0x04);
    s.setNextReg(0xc9, 0x04);
    expect(s.readNextReg(0xc9), "channel 2 cleared").toBe(0x00);
    program(s, 1, P256 | TC | CW, 0);
    program(s, 3, P256 | TC | CW, 0);
    s.runFrames(1);
    expect(s.readNextReg(0xc9), "channels 1 and 3").toBe(0x0a);
  });

  // --- CTC-012: port enable ------------------------------------------------------------------------

  it("CTC-012: with port enable bit 27 ($85 bit 3) off, channel writes are ignored", async () => {
    const s = await parked(core);
    const enables = s.readNextReg(0x85);
    s.setNextReg(0x85, enables & ~0x08).setNextReg(0xc9, 0xff);
    program(s, 0, P256 | TC | CW, 100).runFrames(2);
    s.setNextReg(0x85, enables);
    expect({ count: s.in(CH[0]), status: s.readNextReg(0xc9) & 0x01 }, "never programmed").toEqual({ count: 0, status: 0 });
  });

  it("CTC-012: a running channel keeps running while its ports are disabled", async () => {
    const s = await parked(core);
    const enables = s.readNextReg(0x85);
    program(s, 0, P256 | TC | CW, 0);
    s.setNextReg(0x85, enables & ~0x08);
    s.out(CH[0], RESET | CW); // --- ignored: the port is off
    s.setNextReg(0xc9, 0xff).runFrames(1);
    expect(s.readNextReg(0xc9) & 0x01, "still counting").toBe(0x01);
  });

  // --- CTC-013 / CTC-014: long-run rate ------------------------------------------------------------

  it("CTC-013: over 50 frames the zero counts match the programmed rate", async () => {
    const s = await im2Session(
      core,
      [
        setupChannel(0, INT | P256 | TC | CW, 0), // --- 65536 clocks
        setupChannel(3, INT | TC | CW, 200) // --- 3200 clocks
      ].join("\n")
    );
    const m = measure(s, 50);
    expectAbout(m.n.Count0, m.clocks / 65536, "channel 0");
    expectAbout(m.n.Count3, m.clocks / 3200, "channel 3");
  });

  it("CTC-014: the CTC runs from the 28 MHz clock, so its rate does not change with the CPU speed", async () => {
    const setup = setupChannel(0, INT | P256 | TC | CW, 0);
    const slow = await im2Session(core, setup);
    const m = measure(slow, 50);
    const fast = await im2Session(core, `        nextreg $07,$03\n${setup}`);
    const f = measure(fast, 50);
    expect(fast.readNextReg(0x07) & 0x30, "running at 28 MHz").toBe(0x30);
    // --- Frames are 28 MHz clocks at every speed: the 3.5 MHz window's clock count holds for both
    expectAbout(m.n.Count0, m.clocks / 65536, "3.5 MHz");
    expectAbout(f.n.Count0, m.clocks / 65536, "28 MHz");
  });
});
