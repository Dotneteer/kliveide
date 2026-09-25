import { describe, expect, it } from "vitest";

import { createZ88Session } from "../harness/z88";

/*
 * OZ switches the Z88 off (coma: LCD off, CPU snoozed on the keyboard) after the Panel's idle
 * timeout, 5 minutes by default. It never did in Klive, whatever the OZ version (issue #1374).
 *
 * Each ROM counts idle minutes its own way, and the Blink broke each one:
 *
 * - OZ 5.0 decrements its minute counter on the MIN interrupt. It writes TMK = $07 once, then resets
 *   the clock with COM.RESTIM while booting. The RTC reset also put TMK back to TICK, so MIN never
 *   interrupted again. RESTIM now resets the clock only.
 * - OZ 4.7 enables only TICK and reads the MIN bit from TSTA inside its TICK handler. TSTA held only
 *   the latest event, and the next TICK replaced MIN 5 ms after it was raised. TSTA now latches every
 *   event until TACK.
 * - OZ 4.0 enables MIN and worked once a key had been pressed. Its countdown is loaded on the
 *   first key, so these runs press one first, as anyone using the machine would have.
 *
 * 200 frames are one second.
 */

const SECOND = 200;
const COM_LCDON = 0x01;

describe("the OZ idle timeout", () => {
  for (const model of ["OZ50", "OZ47", "OZ40"]) {
    it(`${model} switches off after the default 5 minutes`, async () => {
      const s = await createZ88Session({ model, rom: "model", audioSampleRate: 44_100 });
      s.runFrames(10 * SECOND);
      s.keyDown("Down");
      s.runFrames(20);
      s.keyUp("Down");

      s.runFrames(4 * 60 * SECOND);
      expect(s.blinkState().COM & COM_LCDON, "still on after 4 idle minutes").toBe(COM_LCDON);

      s.runFrames(2 * 60 * SECOND);
      expect(s.blinkState().COM & COM_LCDON, "off after 6 idle minutes").toBe(0);
    }, 120_000);
  }
});
