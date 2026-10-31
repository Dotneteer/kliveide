import { expect, it } from "vitest";

import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile, type PiI2sSamples } from "../../harness/zxnext";

/*
 * The Pi I2S EAR bit on port $FE bit 6 (core 3.02.02, `.ai/zxnext-cores/30201-to-30204.md` 1.4), on
 * both profiles.
 *
 * Hardware:
 * - zxnext.vhd@3.02.01 ~3456: bit 6 = (i_AUDIO_EAR xor pi_fe_ear) or ...: the Pi's bit is XORed in at the
 *   port, after the tape's relaxation, so a steady 1 reads 1 for as long as it lasts.
 * - zxnext_top_issue4.vhd@3.02.04 ~736: the Pi's bit enters the symmetric relaxation's input
 *   (`ear_port_i_qq xor not zxn_pi_fe_ear`), and zxnext.vhd@3.02.04 ~3951 reads bit 6 = i_AUDIO_EAR or
 *   port_fe_ear: a level held 64 membrane enables (~1.15 ms) relaxes to `port_fe_mic and issue 2` (0
 *   here), so a steady Pi bit shows only for ~1.15 ms after its edge.
 * - zxnext.vhd ~2655-2667 (both): pi_fe_ear rises at threshold "11" (word $3FF) with $A2 bit 0 routing
 *   the Pi to EAR ($A2 = $C1).
 */

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

const constant = (v: number): PiI2sSamples => ({ rate: 48_000, sample: () => [v, v] });

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("I2S-010: a steady Pi EAR bit holds bit 6 on 3.02.01; on 3.02.04 it relaxes within ~1.15 ms", async () => {
    const s = await createSession({ profile });
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    s.setNextReg(0xa2, 0xc1).runFrames(1);
    const bit6 = () => (s.in(0x00fe) & 0x40 ? 1 : 0);
    expect(bit6(), "rest").toBe(0);
    // --- each edge read ~69 us after it (20 x JR = 240 T: a few words latched), then after a frame
    s.piI2sConnect(constant(0x7fff)).step(20); // --- word $3FF: the bit rises
    const up = bit6();
    s.runFrames(1);
    const upHeld = bit6();
    s.piI2sConnect(constant(-0x8000)).step(20); // --- word $000: the bit falls
    const down = bit6();
    s.runFrames(1);
    const downHeld = bit6();
    if (v30204) {
      // --- Relaxed to 0 a frame after either edge; one of the two edges shows as a 1 for ~1.15 ms.
      // --- Which one depends on the stage's polarity (see the header of tape-ear-versions.test.ts):
      // --- the VHDL as written makes it the falling edge, which is not pinned here.
      expect({ upHeld, downHeld }, "relaxed").toEqual({ upHeld: 0, downHeld: 0 });
      expect(up + down, "one edge shows").toBe(1);
    } else {
      expect([up, upHeld, down, downHeld], "XORed at the port, not relaxed").toEqual([1, 1, 0, 0]);
    }
  });
});
