import { expect, it } from "vitest";

import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { NEXT_PROFILES, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { createSession, forEachProfile, type NextTestSession } from "../../harness/zxnext";

/*
 * The EAR input stage and the issue 2 MIC bit (core 3.02.02, `.ai/zxnext-cores/30201-to-30204.md` 1.4),
 * on both profiles.
 *
 * Hardware:
 * - 3.02.01: zxnext_top_issue4.vhd@3.02.01 ~677-689 `relaxation` (INVERT on the debounced pin): a 1 held
 *   for 64 membrane enables (~1.15 ms) falls to 0; a 0 is never relaxed. zxnext.vhd@3.02.01 ~3456:
 *   port $FE bit 6 = (EAR in xor Pi EAR) or EAR out or (port_fe_mic and nr_08_keyboard_issue2), so with
 *   the issue 2 keyboard ($08 bit 0) and MIC set bit 6 is stuck at 1 and a tape cannot load.
 * - 3.02.04: zxnext_top_issue4.vhd@3.02.04 ~705-739 `symmetric_relaxation`: any change of the level
 *   restarts the count; a level held for 64 enables gives `port_fe_mic and issue 2`
 *   (zxnext.vhd@3.02.04 ~1755) instead, whichever level it is. ~3951: bit 6 = EAR in or EAR out. So the
 *   issue 2 MIC bit reads 1 only on a steady line, and a live tape signal comes through.
 * - Polarity: the 3.02.04 stage takes `ear_port_i_qq xor not pi_fe_ear` with INVERT = '1', which
 *   delivers the debounced pin as it is, where 3.02.01 delivered it inverted. The tests here count
 *   levels and lengths only, which do not depend on that; the ROM's loader (edge-driven) loads either.
 * - The ROM's LD-BYTES writes port $FE with bit 3 (MIC) set all along.
 */

const coreVersion = (profile: NextProfileId) => {
  const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
  return major * 10000 + minor * 100 + sub;
};

const CPU_HZ = 3_500_000;
const SAMPLE_T = 51;

function tapOf(data: Uint8Array): TapeDataBlock[] {
  const block = [0xff, ...data];
  const checksum = block.reduce((x, b) => x ^ b, 0);
  const length = block.length + 1;
  const parsed = tapeBlocksOf(new Uint8Array([length & 0xff, length >> 8, ...block, checksum]));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.blocks;
}

const PAYLOAD = new Uint8Array([...Array(64)].map((_, i) => (i * 37 + 11) & 0xff));

function pilotBlock(pulse: number, count: number): TapeDataBlock[] {
  const [block] = tapOf(new Uint8Array([0]));
  return [{ ...block, pilotPulseLength: pulse, pilotPulseCount: count }];
}

async function basic(profile: NextProfileId): Promise<NextTestSession> {
  const s = await createSession({ profile });
  await s.prepareBasic();
  return s;
}

/** Real-time LD-BYTES of PAYLOAD with $08 = `nr08`: did it load? */
async function loads(profile: NextProfileId, nr08: number): Promise<boolean> {
  const s = await basic(profile);
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${nr08.toString(16)}
        ld ix,$c000
        ld de,${PAYLOAD.length}
        ld a,$ff
        scf
        call $0556            ; LD-BYTES
        ld a,0
        jr nc,Done
        ld a,1
Done:   ld ($bf00),a
        di
        nextreg $7f,$a5
        jr $
`,
    { entry: "Start" }
  );
  s.insertTape(tapOf(PAYLOAD), { fastLoad: false });
  s.runFrames(250);
  return s.peek(0xbf00) === 1 && [...s.peekBytes(0xc000, PAYLOAD.length)].every((b, i) => b === PAYLOAD[i]);
}

/** Samples port $FE bit 6 every 51 T-states, with $08 = `nr08` and port $FE = `fe` written first */
async function sampled(s: NextTestSession, count: number, nr08: number, fe: number): Promise<number[]> {
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${nr08.toString(16)}
        ld a,$${fe.toString(16)}
        out ($fe),a
        ld bc,$fefe
        ld hl,$c000
        ld de,${count}
Loop:   in a,(c)              ; 12
        ld (hl),a             ; 7
        inc hl                ; 6
        dec de                ; 6
        ld a,d                ; 4
        or e                  ; 4
        jr nz,Loop            ; 12
        nextreg $7f,$a5
        jr $
`,
    { entry: "Start" }
  );
  s.runUntilReady({ maxFrames: 20 });
  return [...s.peekBytes(0xc000, count)].map((b) => (b & 0x40 ? 1 : 0));
}

function runs(bits: number[]): Array<{ v: number; n: number }> {
  const out: Array<{ v: number; n: number }> = [];
  for (const b of bits) {
    if (out.length && out[out.length - 1].v === b) out[out.length - 1].n++;
    else out.push({ v: b, n: 1 });
  }
  return out;
}

const us = (n: number) => (n * SAMPLE_T * 1e6) / CPU_HZ;

forEachProfile(undefined, (profile) => {
  const v30204 = coreVersion(profile) >= 30204;

  it("TAPE-010: real-time loading works with the issue 3 keyboard, and with issue 2 only from 3.02.04", async () => {
    expect(await loads(profile, 0x50), "issue 3").toBe(true);
    expect(await loads(profile, 0x51), "issue 2").toBe(v30204);
  });

  it("TAPE-011: with no tape, bit 6 reads the issue 2 MIC bit in both: 0 without, 1 with", async () => {
    const plain = await sampled(await basic(profile), 1000, 0x50, 0x08);
    expect(plain.every((b) => b === 0), "issue 3, MIC set").toBe(true);
    const issue2 = await sampled(await basic(profile), 1000, 0x51, 0x08);
    // --- 3.02.01: the OR at the port; 3.02.04: the steady line relaxed to `mic and issue 2`
    expect(issue2.every((b) => b === 1), "issue 2, MIC set").toBe(true);
  });

  it("TAPE-011: 2 ms tape pulses through the relaxation, without and with the issue 2 MIC bit", async () => {
    // --- each level is held 2 ms (7,000 T); the stage relaxes after about 1.15 ms
    const pulses = async (nr08: number) => {
      const s = await basic(profile);
      s.insertTape(pilotBlock(7000, 40), { fastLoad: false }).tapeMode("load");
      return runs(await sampled(s, 4000, nr08, 0x08)).slice(1, -1);
    };
    // --- Without issue 2: one level shows for ~1.15 ms after its edge, the rest reads 0, in both
    // --- (3.02.01 relaxes a 1; 3.02.04 relaxes both levels to 0, so the 0 level is unchanged)
    const plain = await pulses(0x50);
    const highs = plain.filter((x) => x.v === 1).map((x) => us(x.n));
    const lows = plain.filter((x) => x.v === 0).map((x) => us(x.n));
    expect(highs.length).toBeGreaterThan(4);
    for (const t of highs) expect(Math.abs(t - 1161)).toBeLessThan(30);
    for (const t of lows) expect(Math.abs(t - (4000 - 1161))).toBeLessThan(40);

    const issue2 = await pulses(0x51);
    if (v30204) {
      // --- relaxed to 1 instead: the 0 level shows for ~1.15 ms, the rest reads 1
      const ones = issue2.filter((x) => x.v === 1).map((x) => us(x.n));
      const zeros = issue2.filter((x) => x.v === 0).map((x) => us(x.n));
      expect(zeros.length).toBeGreaterThan(4);
      for (const t of zeros) expect(Math.abs(t - 1161)).toBeLessThan(30);
      for (const t of ones) expect(Math.abs(t - (4000 - 1161))).toBeLessThan(40);
    } else {
      // --- 3.02.01: stuck at 1, no edge at all (sampled whole: `runs` of one run sliced away)
      expect(issue2, "no edges").toEqual([]);
    }
  });
});
