import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Z80 CTC: counter-mode clocking and the NextReg $C5 enable override (catalogue CTC-015 - CTC-017).
 * Ported from the hardware-visible cases of the device-level `test/zxnext/CtcDevice.test.ts`
 * ("Counter mode", "Trigger edge change", "Interrupt enable"); the rest of that file is covered by
 * `ctc.test.ts`.
 *
 * Hardware (`_input/next-fpga/src`):
 * - device/ctc_chan.vhd
 *   - ~141: `t_count_en <= prescaler_clk when D6 = 0 else clk_trg_edge` - a counter (D6 = 1) never
 *     counts on the prescaler, only on a clock/trigger edge.
 *   - ~119, ~265: `clk_trg_edge` includes `clk_edge_change`, a control word whose D4 differs from the
 *     stored D4 - one counted edge, on either edge select.
 *   - ~229-234: a control word (D0 = 1, no time constant expected) without D1 leaves a running channel
 *     running; ~211 S_RUNNING stays S_RUNNING.
 *   - ~142-166: the count reaching 0 while running gives ZC/TO and, in the same clock, reloads the time
 *     constant.
 *   - ~245-246: `i_int_en_wr` ($C5 write) overwrites the D7 interrupt enable of the control register.
 * - zxnext.vhd ~4044-4073: channel n (1-3) is clocked by channel n-1's ZC/TO, channel 0 by channel 3's;
 *   ZC/TO is gated by `state = S_RUNNING` (ctc_chan ~166), so a channel left in reset clocks nothing.
 *   ~4058: `$C5` bits 3-0 drive `i_int_en_wr`/`i_int_en` of channels 3-0.
 * - zxnext.vhd ~1892-1909, ~6196: ZC/TO is interrupt request 3 + n of the im2 chain; `$C9` latches it.
 */

const CH = [0x183b, 0x193b, 0x1a3b, 0x1b3b];

const INT = 0x80;
const COUNTER = 0x40;
const P256 = 0x20;
const RISING = 0x10;
const TC = 0x04;
const CW = 0x01;

async function parked(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

const program = (s: NextTestSession, ch: number, control: number, tc: number) => s.out(CH[ch], control).out(CH[ch], tc);

describe.each(ALL_CORES)("CTC counter edges - %s core", (core: CoreName) => {
  it("CTC-015: a counter never counts on the prescaler: without upstream ZC/TO it holds its constant", async () => {
    const s = await parked(core);
    // --- channel 1 is clocked by channel 0's ZC/TO; channel 0 is still in hard reset (no ZC/TO)
    program(s, 1, COUNTER | P256 | TC | CW, 100);
    program(s, 2, COUNTER | TC | CW, 50);
    s.setNextReg(0xc9, 0xff).runFrames(3);
    expect([s.in(CH[1]), s.in(CH[2])], "ctc_chan ~141: no prescaler in counter mode").toEqual([100, 50]);
    expect(s.readNextReg(0xc9) & 0x06, "no zero count").toBe(0);
  });

  it("CTC-016: in counter mode a control word that flips D4 counts one edge; the same D4 does not", async () => {
    const s = await parked(core);
    program(s, 1, COUNTER | TC | CW, 100);
    s.out(CH[1], COUNTER | RISING | CW); // --- D4 0 -> 1: clk_edge_change
    expect(s.in(CH[1]), "D4 changed").toBe(99);
    s.out(CH[1], COUNTER | RISING | CW); // --- D4 unchanged
    expect(s.in(CH[1]), "same D4").toBe(99);
    s.out(CH[1], COUNTER | CW); // --- D4 1 -> 0
    expect(s.in(CH[1]), "D4 changed back").toBe(98);
  });

  /*
   * Parity finding, fixed 2026-09-19: both cores reload the constant but lose the ZC/TO of a zero reached through a D4
   * flip: $C9 does not latch it and the downstream channel is not clocked. In the VHDL the count
   * reaching 0 gives ZC/TO on the next 28 MHz clock whatever made it count (ctc_chan ~142-166:
   * `zc_to <= t_count_zero and not t_count_zero_d and state = S_RUNNING`), which is request 3 + n of
   * the im2 chain (zxnext.vhd ~1897, status ~6196) and channel n + 1's clock (~4044-4073). The TS
   * core's `CtcDevice.writePort` clocks the channel through the zero without reporting the ZC/TO to
   * the interrupt device or the chain; the WASM core behaves the same.
   */
  it("CTC-016: D4 flips that reach zero give a zero count: $C9 latches it, the constant reloads, the next channel counts", async () => {
    const s = await parked(core);
    program(s, 2, COUNTER | TC | CW, 5); // --- clocked by channel 1's ZC/TO
    program(s, 1, COUNTER | TC | CW, 2);
    s.setNextReg(0xc9, 0xff);
    s.out(CH[1], COUNTER | RISING | CW);
    expect({ count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02 }, "one edge").toEqual({ count: 1, status: 0 });
    s.out(CH[1], COUNTER | CW).step(1);
    expect(
      { count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02, next: s.in(CH[2]) },
      "second edge: zero count (ctc_chan ~148-150 reload, zxnext.vhd ~6196 status, ~4044-4073 chain)"
    ).toEqual({ count: 2, status: 0x02, next: 4 });
  });

  // -------------------------------------------------------------------------------------------------
  // CTC-017: $C5 overrides the control word's D7
  // -------------------------------------------------------------------------------------------------

  const TABLE = 0xbe00;

  /** Hardware IM2 (vector base $A0), CTC 0 as a timer with D7 set (prescaler 256, constant 0). */
  async function interrupting(): Promise<NextTestSession> {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\n jr $");
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld a,$be
        ld i,a
        im 2
        nextreg $22,$04          ; ULA and line interrupts off
        nextreg $c0,$a1          ; hardware IM2, vector base $A0
        nextreg $c9,$ff
        ld bc,$183b
        ld a,$${(INT | P256 | TC | CW).toString(16)}
        out (c),a
        xor a
        out (c),a
        ei
        nextreg $7f,$a5
Park:   jr Park
Isr:    push hl
        ld hl,(Count)
        inc hl
        ld (Count),hl
        pop hl
        ei
        reti
Count:  .defw 0`,
      { entry: "Start" }
    );
    for (let v = 0; v < 256; v += 2) s.pokeWord(TABLE + v, s.symbol("Isr"));
    return s;
  }

  const count = (s: NextTestSession) => s.peekWord(s.symbol("Count"));

  it("CTC-017: a $C5 write clears the enable D7 set: no more interrupts, the status still latches", async () => {
    const s = await interrupting();
    s.runUntilReady().runFrames(2);
    expect(count(s), "D7: interrupting").toBeGreaterThan(0);
    expect(s.readNextReg(0xc5) & 0x01).toBe(0x01);
    s.setNextReg(0xc5, 0x00);
    expect(s.readNextReg(0xc5) & 0x01, "ctc_chan ~245: $C5 overwrote D7").toBe(0x00);
    s.runFrames(1); // --- anything pending when $C5 was written is served here
    const before = count(s);
    s.setNextReg(0xc9, 0xff).runFrames(3);
    expect(count(s) - before, "no interrupts").toBe(0);
    expect(s.readNextReg(0xc9) & 0x01, "the channel still counts to zero").toBe(0x01);
    s.setNextReg(0xc5, 0x01).runFrames(2);
    expect(count(s) - before, "$C5 bit 0 enables it again").toBeGreaterThan(0);
  });
});
