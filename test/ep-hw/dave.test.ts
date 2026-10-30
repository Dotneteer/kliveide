import { describe, expect, it } from "vitest";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { bareMachine, standardLpt, stepUntil } from "./bare";

/*
 * DAVE's interrupts and timers (`.plans/ENTERPRISE_PLAN.md` §8.1; DAVE_MEMORY_IO.md §4): the latches,
 * B4h's semantics, the 1 kHz / 50 Hz / 1 Hz chain, tone-generator interrupts, BFh bit 1's slower
 * clock, and NICK's VINT on INT1. The CPU sits in `DI; HALT`, so nothing but the test touches DAVE.
 */

const tacts = (s: EpTestSession) => s.wasm.epGetTacts() >>> 0;

/** The T-states from now to the next time the latch bits in `mask` are set (the previous ones cleared first) */
function periodOf(s: EpTestSession, enable: number, mask: number): number {
  s.wasm.epWritePort(0xb4, enable | 0xaa);
  stepUntil(s, () => (s.wasm.epGetB4() & mask) !== 0);
  s.wasm.epWritePort(0xb4, enable | 0xaa);
  const start = tacts(s);
  stepUntil(s, () => (s.wasm.epGetB4() & mask) !== 0);
  return (tacts(s) - start) >>> 0;
}

describe("DAVE interrupts", () => {
  it("raises 1 kHz, 50 Hz and tone-generator interrupts at their periods", async () => {
    const s = await createEpSession();
    bareMachine(s);
    // --- 1 kHz: 250 ticks of 16 T; a latch is seen at the end of a HALT cycle (4 T)
    s.wasm.epWritePort(0xa7, 0x00);
    expect(periodOf(s, 0x01, 0x02)).toBe(4000);
    // --- 50 Hz: 5000 ticks, 80 000 T, not locked to the 79 942 T video frame
    s.wasm.epWritePort(0xa7, 0x20);
    expect(periodOf(s, 0x01, 0x02)).toBe(80_000);
    // --- Tone channel 0 with code 99: a reload every 100 ticks (250 000 / (n + 1) a second)
    s.wasm.epWritePort(0xa0, 99);
    s.wasm.epWritePort(0xa1, 0);
    s.wasm.epWritePort(0xa7, 0x40);
    expect(periodOf(s, 0x01, 0x02)).toBe(1600);
    // --- Tone channel 1 with code 0x123
    s.wasm.epWritePort(0xa2, 0x23);
    s.wasm.epWritePort(0xa3, 0x01);
    s.wasm.epWritePort(0xa7, 0x60);
    expect(periodOf(s, 0x01, 0x02)).toBe(0x124 * 16);
  });

  it("takes no tone-generator interrupt from a channel held by its sync bit", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.wasm.epWritePort(0xa0, 9);
    s.wasm.epWritePort(0xa7, 0x41);
    s.wasm.epWritePort(0xb4, 0xab);
    s.runFrames(2);
    expect(s.wasm.epGetB4() & 0x02).toBe(0);
    s.wasm.epWritePort(0xa7, 0x40);
    s.runFrames(1);
    expect(s.wasm.epGetB4() & 0x02).toBe(0x02);
  });

  it("raises the 1 Hz interrupt once a second", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.wasm.epWritePort(0xb4, 0x04 | 0xaa);
    // --- Find a latch (by frames, then exactly), then time the next one
    s.runUntil(() => (s.wasm.epGetB4() & 0x08) !== 0, { maxFrames: 60 });
    s.wasm.epWritePort(0xb4, 0x04 | 0xaa);
    s.runFrames(49);
    stepUntil(s, () => (s.wasm.epGetB4() & 0x08) !== 0);
    s.wasm.epWritePort(0xb4, 0x04 | 0xaa);
    const start = tacts(s);
    s.runFrames(49);
    expect(s.wasm.epGetB4() & 0x08).toBe(0);
    stepUntil(s, () => (s.wasm.epGetB4() & 0x08) !== 0);
    expect((tacts(s) - start) >>> 0).toBe(4_000_000);
  });

  it("follows B4h: an enable lets a latch set, a reset bit or disabling clears it, the read layout", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.wasm.epWritePort(0xa7, 0x00);
    // --- Disabled: the divider runs (bit 0 toggles at 1 kHz) but the latch never sets
    s.wasm.epWritePort(0xb4, 0x00);
    const dividers = new Set<number>();
    for (let i = 0; i < 3000; i++) {
      s.step(1);
      dividers.add(s.wasm.epGetB4() & 0x01);
    }
    expect([...dividers].sort()).toEqual([0, 1]);
    expect(s.wasm.epGetB4() & 0x02).toBe(0);
    // --- Enabled: the latch sets and pulls /INT
    s.wasm.epWritePort(0xb4, 0x01);
    stepUntil(s, () => (s.wasm.epGetB4() & 0x02) !== 0);
    expect(s.wasm.epGetIntLatch()).toBe(0x02);
    // --- Writing the enable alone keeps it; the reset bit clears it
    s.wasm.epWritePort(0xb4, 0x01);
    expect(s.wasm.epGetB4() & 0x02).toBe(0x02);
    s.wasm.epWritePort(0xb4, 0x03);
    expect(s.wasm.epGetB4() & 0x02).toBe(0);
    // --- Disabling clears it too
    stepUntil(s, () => (s.wasm.epGetB4() & 0x02) !== 0);
    s.wasm.epWritePort(0xb4, 0x00);
    expect(s.wasm.epGetB4() & 0x02).toBe(0);
  });

  it("services the interrupt in IM 1 at 0038h while a latch is set (level-triggered)", async () => {
    const s = await createEpSession();
    bareMachine(s, { halt: false });
    // --- An ISR that counts in 7FF0h and does not clear the latch: it runs again and again
    s.poke(0x0038, [0x21, 0xf0, 0x7f, 0x34, 0xfb, 0xc9]);
    s.poke(0x7ff0, 0);
    s.poke(0x0000, [0xed, 0x56, 0xfb, 0x18, 0xfe]);
    s.machine.pc = 0;
    s.wasm.epWritePort(0xa7, 0x00);
    s.wasm.epWritePort(0xb4, 0x01);
    stepUntil(s, () => s.peek(0x7ff0) >= 3);
    expect(s.wasm.epGetB4() & 0x02).toBe(0x02);
  });

  it("slows every DAVE frequency to 2/3 with BFh bit 1 (a 12 MHz input on a stock machine)", async () => {
    const s = await createEpSession();
    bareMachine(s, { bf: 0x0e });
    s.wasm.epWritePort(0xa7, 0x00);
    expect(periodOf(s, 0x01, 0x02)).toBe(6000);
  });
});

describe("VINT on INT1", () => {
  /** The NICK line (counted from vertical sync) on which the INT1 latch sets */
  function vintLine(s: EpTestSession): number {
    s.wasm.epWritePort(0xb4, 0x10 | 0xaa);
    stepUntil(s, () => (s.wasm.epGetB4() & 0x20) !== 0);
    return s.nick().line;
  }

  it("latches where the VINT block ends (D6, the ep128emu/EXOS-book edge), and B4h bit 4 shows the line's VINT", async () => {
    const s = await createEpSession();
    // --- The picture is 256 lines; a 2-line VINT block follows (lines 256-257 of the frame)
    bareMachine(s, { lpt: standardLpt({ vintLines: 2 }) });
    // --- `nick().line` counts from vertical sync, which starts on LPT line 260: LPT line L is line
    // --- (L - 260) mod 312. The VINT block is LPT lines 256-257, so the latch sets at the start of 258
    const line = vintLine(s);
    expect(line).toBe(258 - 260 + 312);
    // --- While a VINT line runs, B4h bit 4 is set
    stepUntil(s, () => s.nick().line === 256 - 260 + 312 && s.nick().slot === 10);
    expect(s.wasm.epGetB4() & 0x10).toBe(0x10);
  });

  it("gives one interrupt for consecutive VINT blocks", async () => {
    const s = await createEpSession();
    const picture = [
      { lines: 100, mode: 7, lm: 10, rm: 52, ld1: 0x4000 },
      { lines: 2, mode: 7, vint: true, lm: 10, rm: 52 },
      { lines: 2, mode: 7, vint: true, lm: 10, rm: 52 },
      { lines: 152, mode: 7, lm: 10, rm: 52 }
    ];
    bareMachine(s, { lpt: standardLpt({ picture }) });
    s.wasm.epWritePort(0xb4, 0x10 | 0xaa);
    let latches = 0;
    const start = s.wasm.epGetFrames();
    while (s.wasm.epGetFrames() - start < 3) {
      s.step(1);
      if (s.wasm.epGetB4() & 0x20) {
        latches++;
        s.wasm.epWritePort(0xb4, 0x10 | 0xaa);
      }
    }
    expect(latches).toBe(3);
  });
});
