import { expect, it } from "vitest";

import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile, type NextTestSession } from "../../harness/zxnext";

/*
 * NextReg $81 bit 3 and the +3 disk motor latch (core 3.02.03, `.ai/zxnext-cores/30201-to-30204.md`
 * 1.6), seen through the Multiface +3 readback of $1FFD, on both profiles.
 *
 * Hardware:
 * - zxnext.vhd@3.02.01: `port_1ffd_reg` is 8 bits and a $1FFD write stores the whole byte (~875,
 *   ~3721; not while $7FFD is locked, ~3715); the MF+3 enable port with A15-12 = 0001 reads it back
 *   (~4292). $81 has bits 6-4 and 1-0 (~5469-5473), bit 3 reads '0'.
 * - zxnext.vhd@3.02.04: `port_1ffd_reg` is 3 bits (~976, ~4216). $81 bit 3 = `nr_81_expbus_fdc`
 *   (write ~6004, read ~6660, `:= '0'` with no reset branch, ~1323). The motor latch `port_1ffd_mtr_n`
 *   (~4235-4253): off on reset and while bit 3 is 0; otherwise any write decoded as $1FFD (`port_xffd`,
 *   A13-12 = 01, no DAC conflict - the port enable and the $7FFD lock do not gate it) takes bit 3. The
 *   MF+3 readback is `"0000" & (not port_1ffd_mtr_n) & port_1ffd_reg` (~4804). The FDC pins are driven
 *   only on an issue 5 board (~1818-1837), so on KS2 the readback and $81 are what software sees.
 * - Multiface +3 ($0A bits 7-6 = 00, the reset value): the NMI pages it in; enable-port reads ($3F)
 *   drive the bus (multiface.vhd, as in `multiface.test.ts`).
 */

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

/** A parked session; `body` runs, then a Multiface NMI is taken and the MF+3 $1FFD readback is returned. */
async function readback(profile: NextProfileId, body: string): Promise<{ s: NextTestSession; value: number }> {
  const s = await createSession({ profile });
  await s.loadCode(" .org $8000\n di\nLoop: jr Loop");
  await s.loadCode(
    `
        .org $8000
Start:  di
${body}
        nextreg $06,$08          ; M1 button NMI enable
        nextreg $02,$08          ; Multiface NMI
Loop:   jr Loop`,
    { entry: "Start" }
  );
  s.runTo(0x0066, { maxFrames: 2 }).step(1);
  return { s, value: s.in(0x1f3f) };
}

const out1ffd = (v: number) => `        ld bc,$1ffd\n        ld a,$${v.toString(16)}\n        out (c),a`;

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("MF-008: $81 bit 3 is stored and reads back (3.02.04); a soft reset keeps it, a hard reset clears it", async () => {
    const s = await createSession({ profile });
    s.setNextReg(0x81, 0x08);
    expect(s.readNextReg(0x81) & 0x08, "written").toBe(v30204 ? 0x08 : 0x00);
    s.reset();
    expect(s.readNextReg(0x81) & 0x08, "soft reset: no reset branch").toBe(v30204 ? 0x08 : 0x00);
    s.hardReset();
    expect(s.readNextReg(0x81) & 0x08, "hard reset").toBe(0x00);
  });

  it("MF-008: without $81 bit 3 the MF+3 readback of $1FFD is bits 2-0 (3.02.04) or the whole byte (3.02.01)", async () => {
    const { value } = await readback(profile, out1ffd(0xfc));
    expect(value).toBe(v30204 ? 0x04 : 0xfc);
  });

  it("MF-008: with $81 bit 3, $1FFD bit 3 latches the disk motor, which the readback shows as bit 3", async () => {
    const { value } = await readback(profile, `        nextreg $81,$08\n${out1ffd(0xfc)}`);
    expect(value).toBe(v30204 ? 0x0c : 0xfc);
  });

  it("MF-008: clearing $81 bit 3 turns the motor off", async () => {
    const { value } = await readback(profile, `        nextreg $81,$08\n${out1ffd(0x0c)}\n        nextreg $81,$00`);
    expect(value).toBe(v30204 ? 0x04 : 0x0c);
  });

  it("MF-008: the motor latch ignores the $7FFD lock that holds the paging bits (3.02.04)", async () => {
    const { value } = await readback(
      profile,
      `        nextreg $81,$08
${out1ffd(0x04)}
        ld bc,$7ffd
        ld a,$20                 ; bit 5: lock the paging
        out (c),a
${out1ffd(0x0a)}`
    );
    // --- the locked write changes no paging bit (both); 3.02.04's motor takes its bit 3 anyway
    expect(value).toBe(v30204 ? 0x0c : 0x04);
  });
});
