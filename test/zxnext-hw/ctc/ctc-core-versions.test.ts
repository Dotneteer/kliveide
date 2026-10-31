import { expect, it } from "vitest";

import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile, type NextTestSession } from "../../harness/zxnext";

/*
 * Z80 CTC: the 3.02.02 state machine (`.ai/zxnext-cores/30201-to-30204.md` 1.1), on both profiles.
 *
 * Hardware:
 * - device/ctc_chan.vhd@3.02.01 ~183-217, ~229-249: S_CONTROL_WORD / S_TIME_CONSTANT / S_WAIT /
 *   S_RUNNING; "time constant follows" is control_reg(0). A control word with D2 = 1, D1 = 0 in S_WAIT
 *   only sets control_reg(0): the channel stays in S_WAIT and, once the new control word no longer
 *   asks for a trigger (D3 = 0), starts on the next clock with the old constant (~205-210).
 * - device/ctc_chan.vhd@3.02.04 ~198-244, ~257-259: S_RESET / S_RESET_TC / S_TRIGGER / S_RUN / S_RUN_TC.
 *   The same control word in S_TRIGGER goes to S_RESET_TC (~220-222): the channel is held in reset
 *   (`reset_soft`, ~117) until a new time constant arrives, then waits for its trigger again.
 * - Both: the counter reads `t_count` (ctc_chan ~157 / ~168); in reset it is the stored constant.
 *   ZC/TO latches `$C9` (zxnext.vhd@3.02.01 ~6196); channel 1 is triggered by channel 0's ZC/TO
 *   (zxnext.vhd@3.02.01 ~4044-4073), and channel 0 is left in hard reset here, so no trigger comes.
 * - 3.02.04's other change, reloading on the count 1 -> 0 instead of one clock after reaching $00
 *   (ctc_chan.vhd@3.02.04 ~152-170 vs @3.02.01 ~142-166), shows only for one 28 MHz clock; the reload
 *   values and zero counts both versions agree on are pinned in `ctc.test.ts` and `ctc-counter-edge.test.ts`.
 */

const CH = [0x183b, 0x193b, 0x1a3b, 0x1b3b];
const TRIGGER = 0x08;
const TC = 0x04;
const CW = 0x01;

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

async function parked(profile: NextProfileId): Promise<NextTestSession> {
  const s = await createSession({ profile });
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("CTC-018: a D2 control word while a timer waits for its trigger", async () => {
    const s = await parked(profile);
    s.out(CH[1], TRIGGER | TC | CW).out(CH[1], 100);
    s.setNextReg(0xc9, 0xff).runFrames(1);
    expect({ count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02 }, "waiting for the trigger").toEqual({
      count: 100,
      status: 0
    });

    // --- D2 = 1 (a constant follows), D3 = 0 (no trigger), D1 = 0 (no software reset)
    s.out(CH[1], TC | CW).runFrames(1);
    if (v30204) {
      // --- ctc_chan.vhd@3.02.04 ~220-222: S_TRIGGER -> S_RESET_TC, held at the old constant
      expect({ count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02 }, "3.02.04: waits for a constant").toEqual({
        count: 100,
        status: 0
      });
    } else {
      // --- ctc_chan.vhd@3.02.01 ~205-210: S_WAIT -> S_RUNNING on the old constant
      expect(s.readNextReg(0xc9) & 0x02, "3.02.01: runs on the old constant").toBe(0x02);
    }

    // --- The next byte is the time constant in both (3.02.01 control_reg(0), 3.02.04 S_RESET_TC)
    s.out(CH[1], 0x41).setNextReg(0xc9, 0xff); // --- $41 would be a counter-mode control word
    if (v30204) {
      // --- loaded in S_TRIGGER, then S_RUN on the next clock (D3 = 0): a few counts down by the read
      const count = s.in(CH[1]);
      expect(count, "3.02.04: started on the new constant").toBeLessThanOrEqual(0x41);
      expect(count, "3.02.04: started on the new constant").toBeGreaterThan(0x41 - 8);
    } else {
      expect(s.in(CH[1]), "3.02.01: still counting the old period").toBeLessThanOrEqual(100);
    }
    s.runFrames(1);
    // --- D3 = 0 now: 3.02.04 leaves S_TRIGGER at once (~223-226); both run as timers
    expect(s.readNextReg(0xc9) & 0x02, "a running timer").toBe(0x02);
    expect(s.in(CH[1]), "reloads the new constant").toBeLessThanOrEqual(0x41);
  });

  it("CTC-018: a D2 control word with D3 keeps waiting for the trigger in both", async () => {
    const s = await parked(profile);
    s.out(CH[1], TRIGGER | TC | CW).out(CH[1], 100);
    s.out(CH[1], TRIGGER | TC | CW).out(CH[1], 60).setNextReg(0xc9, 0xff).runFrames(2);
    // --- 3.02.01 stays in S_WAIT and takes the constant; 3.02.04 S_RESET_TC -> S_TRIGGER. Out of
    // --- S_RUNNING / S_RUN both hold the counter at the stored constant (reset_soft, ~108 / ~117)
    expect({ count: s.in(CH[1]), status: s.readNextReg(0xc9) & 0x02 }, "waiting, new constant").toEqual({
      count: 60,
      status: 0
    });
  });
});
