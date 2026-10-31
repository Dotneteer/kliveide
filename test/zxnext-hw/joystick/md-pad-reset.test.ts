import { expect, it } from "vitest";

import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile, type NextTestSession } from "../../harness/zxnext";

/*
 * The MD pad reset: A + B + C + START (core 3.02.02, `.ai/zxnext-cores/30201-to-30204.md` 1.8), on
 * both profiles.
 *
 * Hardware:
 * - zxnext_top_issue4.vhd@3.02.01 ~707-712: `btn_reset_n_i_q <= btn_reset_n_i`, the board's button only.
 * - zxnext_top_issue4.vhd@3.02.04 ~759-765: the line is also pulled low while either connector reports
 *   bits 4-7 (B, C, A, START in the `MODE X Z Y START A C B U D L R` order, ~1850) together. It then
 *   takes the button's path: debounced (8 enables of 2^18 clocks, ~75 ms, ~1095, ~1735-1760), then
 *   input/membrane/emu_fnkeys.vhd@3.02.04 ~146-157, ~255-260: on release, a press shorter than
 *   100 enables (~0.94 s) is F4 and a longer one F1; zxnext.vhd@3.02.04 ~6904-6905: F4 is a soft reset
 *   (outside config mode), F1 a hard reset.
 * - NextReg $02 reads bit 1 / bit 0 for a hard / soft last reset (zxnext.vhd@3.02.01 ~5815). NextReg $7F
 *   has no reset branch (`:= X"FF"`, ~1210): a soft reset keeps it; Klive's hard reset re-initialises it.
 * - A combination short of one button, or B + C + A + START split over the two connectors, is no reset.
 */

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

async function parked(profile: NextProfileId): Promise<NextTestSession> {
  const s = await createSession({ profile });
  await s.loadCode(" .org $8000\n di\n jr $");
  // --- $7F survives a soft reset and is re-initialised by a hard one; $02 says which came last
  s.setNextReg(0x7f, 0x12).runFrames(1);
  expect(s.readNextReg(0x02) & 0x03, "after the session's hard reset").toBe(0x02);
  return s;
}

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("JOY-009: A + B + C + START held for a short press, then released, is a soft reset (3.02.04)", async () => {
    const s = await parked(profile);
    s.joystick("left", "A", "B", "C", "START").runFrames(10);
    s.joystick("left").runFrames(10);
    expect({ reset: s.readNextReg(0x02) & 0x03, user: s.readNextReg(0x7f) }).toEqual(
      v30204 ? { reset: 0x01, user: 0x12 } : { reset: 0x02, user: 0x12 }
    );
  });

  it("JOY-009: held for over a second it is a hard reset (3.02.04)", async () => {
    const s = await parked(profile);
    s.joystick("right", "A", "B", "C", "START").runFrames(60);
    s.joystick("right").runFrames(10);
    expect({ reset: s.readNextReg(0x02) & 0x03, user: s.readNextReg(0x7f) }).toEqual(
      v30204 ? { reset: 0x02, user: 0xff } : { reset: 0x02, user: 0x12 }
    );
  });

  it("JOY-009: nothing happens while the buttons are held, or for three of them, or split over the connectors", async () => {
    const s = await parked(profile);
    s.joystick("left", "A", "B", "C", "START").runFrames(20);
    expect(s.readNextReg(0x02) & 0x03, "held: the reset comes on release").toBe(0x02);
    expect(s.registers().pc & 0xff00, "still in the loop").toBe(0x8000);
    s.joystick("left").runFrames(10);
    s.hardReset();
    await s.loadCode(" .org $8000\n di\n jr $");
    s.joystick("left", "A", "B", "START").runFrames(10);
    s.joystick("left").runFrames(10);
    s.joystick("left", "A", "B").joystick("right", "C", "START").runFrames(10);
    s.joystick("left").joystick("right").runFrames(10);
    expect(s.readNextReg(0x02) & 0x03, "no reset").toBe(0x02);
    expect(s.registers().pc & 0xff00, "still in the loop").toBe(0x8000);
  });
});
