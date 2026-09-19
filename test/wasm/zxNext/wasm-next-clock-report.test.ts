import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * The CPU speed the app shows: the status bar reads `machine.clockMultiplier` (with the 3.5 MHz
 * base clock) from every completed frame. It is the *effective* speed - `$07` bits 5-4, what the CPU
 * actually runs at (zxnext.vhd ~5742-5770) - so NextZXOS booting at 28 MHz shows 28 MHz. The WASM
 * machine never updated it, and the status bar sat at 3.5 MHz whatever the program did.
 */
describe.each(ALL_CORES)("reported CPU speed - %s core", (core) => {
  for (const [speed, multiplier] of [[0, 1], [1, 2], [2, 4], [3, 8]]) {
    it(`$07 = ${speed} reports a clock multiplier of ${multiplier}`, async () => {
      const s = await createSession(core);
      await s.loadCode(` .org $8000\n jr $`);
      s.setNextReg(0x07, speed).runFrames(2);
      expect(s.machine.clockMultiplier).toBe(multiplier);
    });
  }
});
