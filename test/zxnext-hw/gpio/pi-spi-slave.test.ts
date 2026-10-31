import { expect, it } from "vitest";

import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile } from "../../harness/zxnext";

/*
 * NextReg $A0 bit 1: the Pi SPI slave enable (core 3.02.04, `.ai/zxnext-cores/30201-to-30204.md` 1.7),
 * on both profiles.
 *
 * Hardware:
 * - zxnext.vhd@3.02.01 ~6135: $A0 reads "00" & bits 5-3 & "00" & bit 0; ~5058 a reset clears it all.
 * - zxnext.vhd@3.02.04 ~6723: $A0 reads "00" & bits 5-3 & '0' & (bit 1 and g_option(4)) & bit 0, and
 *   the KS2 build has g_option = X"FFF2" (zxnext_top_issue4.vhd@3.02.04 ~40), bit 4 = 1: bit 1 reads
 *   back. ~5586-5587: a reset clears bits 7-2 and 0, not bit 1 (nextreg.txt@3.02.04: "hard reset = 0").
 * - The slave itself (the Pi pausing the CPU and reading the machine) has no emulator counterpart, and
 *   no Pi is attached, so the pins it takes over are not observable here.
 */

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

const hex = (v: number) => `$${v.toString(16).padStart(2, "0")}`;

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("GPIO-008: $A0 bit 1 reads back (3.02.04) and survives a soft reset; a hard reset clears it", async () => {
    const s = await createSession({ profile });
    expect(hex(s.setNextReg(0xa0, 0xff).readNextReg(0xa0)), "$FF").toBe(v30204 ? "$3b" : "$39");
    expect(hex(s.setNextReg(0xa0, 0x02).readNextReg(0xa0)), "$02").toBe(v30204 ? "$02" : "$00");
    s.setNextReg(0xa0, 0x3b).reset();
    expect(hex(s.readNextReg(0xa0)), "soft reset clears bits 7-2 and 0").toBe(v30204 ? "$02" : "$00");
    s.hardReset();
    expect(hex(s.readNextReg(0xa0)), "hard reset").toBe("$00");
  });
});
