import { describe, expect, it } from "vitest";

import { createZ88Session, type Z88TestSession } from "../harness/z88";

/*
 * OZ 4.7 with Keyclick on: the keyboard must not go dead (issue #1374).
 *
 * The report: turn Keyclick on in the Panel, go back to the Index, press an arrow key. The
 * highlight moves once, then no key does anything, while the machine keeps running.
 *
 * The cause was the core's NMOS Z80 LD A,I glitch; the Z88 has a CMOS Z80 (see `Z80_CMOS` in
 * `src/emu/z80/wasm/z80.c`). OZ's "save the interrupt state and DI" routine ($003B) reads IFF2 with
 * LD A,I. An RTC interrupt accepted right after it cleared P/V, OZ decided interrupts had been off,
 * and its key-wait routine ($CB2A) returned without EI. With interrupts never re-enabled, OZ never
 * scanned the keyboard again, and the RTC interrupt that stays pending (STA.TIME) never gets serviced.
 *
 * This is the reported sequence, key for key, as whole-frame presses. It froze every time before the
 * fix, which is what the last expectation checks: the IM 1 handler still runs.
 */

const IM1_ENTRY = 0x0038;

function press(s: Z88TestSession, keys: Parameters<Z88TestSession["keyDown"]>, hold = 20, after = 80) {
  s.keyDown(...keys);
  s.runFrames(hold);
  s.keyUp(...keys);
  s.runFrames(after);
}

describe("OZ 4.7 with Keyclick on", () => {
  it("the keyboard keeps working after an arrow key in the Index", async () => {
    const s = await createZ88Session({ model: "OZ47", rom: "model", audioSampleRate: 44_100 });
    s.runFrames(2000);

    // --- Panel (Square+S): Keyclick is the field below the first; Y sets it, Enter stores it
    press(s, ["Square", "S"], 20, 400);
    press(s, ["Down"], 4, 80);
    press(s, ["Y"], 4, 80);
    press(s, ["Enter"], 4, 300);
    press(s, ["Index"], 4, 400);

    for (let i = 0; i < 3; i++) press(s, ["Down"]);

    // --- Frozen, OZ sits in a key wait with interrupts off for good: the handler never runs again.
    // --- Alive, the 10 ms RTC TICK comes in about every 2 frames' worth of instructions.
    let interrupts = 0;
    for (let i = 0; i < 20_000; i++) {
      s.step(1);
      if (s.registers().pc === IM1_ENTRY) interrupts++;
    }
    expect(interrupts).toBeGreaterThan(0);
    expect(s.blinkState().STA & 0x01, "no RTC interrupt left pending").toBe(0);
  }, 60_000);
});
