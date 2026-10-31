import { expect, it } from "vitest";

import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile, type NextTestSession } from "../../harness/zxnext";

/*
 * NextReg $0A bit 5: swap SD0 and SD1 (core 3.02.03, `.ai/zxnext-cores/30201-to-30204.md` 1.5), on
 * both profiles.
 *
 * Hardware:
 * - zxnext.vhd@3.02.04 ~5698-5707: bit 5 is stored only when config mode (NextReg $03 = xxxxx111) is on
 *   and bit 2 of the written value is 1; ~1224 `nr_0a_sd_swap := '0'` has no reset branch, so a soft
 *   reset keeps it. ~6446: $0A reads `mf_type & sd_swap & automap & reverse & '0' & dpi`.
 *   ~3606-3609: port $E7 `xxxxxx10` -> "111111" & not swap & swap, `xxxxxx01` -> "111111" & swap &
 *   not swap: with the swap, the value that selected card 0 selects card 1 and the other way round.
 * - zxnext.vhd@3.02.01 ~5169-5175: no such bit; ~5858 $0A reads bit 5 as '0'; ~3308-3311 $E7 `10` is
 *   always card 0 ($FE), `01` always card 1 ($FD).
 * - The card: CMD0 answers R1 = $01 (SD Physical Layer spec, SPI mode); an empty slot never drives MISO,
 *   so the bus reads $FF. Only card 0 is in the slot here.
 */

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

const CONFIG_ON = 0x07; // --- $03 low bits 111: config mode
const CONFIG_OFF = 0x03; // --- +3, any non-zero value other than 111 leaves config mode

/** Selects with `select` on $E7, sends CMD0 and returns its R1 ($FF: no card answered). */
async function cmd0(s: NextTestSession, select: number): Promise<number> {
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld a,$${select.toString(16)}
        out ($e7),a
        ld hl,Cmd0
        ld bc,$06eb
        otir
        ld b,64
Poll:   in a,(c)
        cp $ff
        jr nz,Got
        djnz Poll
Got:    ld (Result),a
        ld a,$ff
        out ($e7),a
        nextreg $7f,$a5
Park:   jr Park
Cmd0:   .defb $40,0,0,0,0,$95
Result: .defb 0`,
    { entry: "Start" }
  );
  s.setNextReg(0x7f, 0x00); // --- the previous run left $A5 there
  await s.runUntilReadyAsync({ maxFrames: 20 });
  return s.peek(s.symbol("Result"));
}

async function withCard(profile: NextProfileId): Promise<NextTestSession> {
  const s = await createSession({ profile });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  s.attachSdCard(new Uint8Array(2048 * 512));
  return s;
}

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("SPI-009: $0A bit 5 is written only in config mode with bit 2 set, and reads back (3.02.04)", async () => {
    const s = await createSession({ profile });
    s.setNextReg(0x0a, 0x25); // --- outside config mode: ignored by both
    expect(s.readNextReg(0x0a) & 0x24, "outside config mode").toBe(0x00);
    s.setNextReg(0x03, CONFIG_ON);
    s.setNextReg(0x0a, 0x21); // --- bit 2 clear: no change
    expect(s.readNextReg(0x0a) & 0x24, "config mode, bit 2 clear").toBe(0x00);
    s.setNextReg(0x0a, 0x25);
    expect(s.readNextReg(0x0a) & 0x24, "config mode, bit 2 set; bit 2 reads 0").toBe(v30204 ? 0x20 : 0x00);
    s.setNextReg(0x03, CONFIG_OFF);
    s.setNextReg(0x0a, 0x05); // --- out of config mode a write cannot clear it
    expect(s.readNextReg(0x0a) & 0x24, "kept outside config mode").toBe(v30204 ? 0x20 : 0x00);
    expect(s.readNextReg(0x0a) & 0x1b, "the other bits are written").toBe(0x01);
    s.reset();
    expect(s.readNextReg(0x0a) & 0x20, "a soft reset keeps it (no reset branch)").toBe(v30204 ? 0x20 : 0x00);
    s.hardReset();
    expect(s.readNextReg(0x0a) & 0x20, "hard reset").toBe(0x00);
  });

  it("SPI-009: with the swap, $E7 low bits 10 select card 1 and 01 select card 0 (3.02.04)", async () => {
    const s = await withCard(profile);
    expect(await cmd0(s, 0xfe), "no swap: $FE is card 0").toBe(0x01);
    expect(await cmd0(s, 0xfd), "no swap: $FD is the empty slot 1").toBe(0xff);
    s.setNextReg(0x03, CONFIG_ON).setNextReg(0x0a, 0x25).setNextReg(0x03, CONFIG_OFF);
    expect(await cmd0(s, 0xfe), "swap: $FE").toBe(v30204 ? 0xff : 0x01);
    expect(await cmd0(s, 0xfd), "swap: $FD").toBe(v30204 ? 0x01 : 0xff);
    // --- the swap off again (config mode, bit 2 set, bit 5 clear)
    s.setNextReg(0x03, CONFIG_ON).setNextReg(0x0a, 0x05).setNextReg(0x03, CONFIG_OFF);
    expect(await cmd0(s, 0xfe), "swap off: $FE is card 0").toBe(0x01);
  });
});
