import { describe, expect, it } from "vitest";

import { createSession, type AudioSample, type NextTestSession } from "../../harness/zxnext";
import { ay, edgeStep, frequency, relativeError, side, swing } from "./_audio-helpers";

/*
 * Beeper, MIC and the audio mixer (catalogue BEEP-001 - BEEP-004, BEEP-007, BEEP-008; BEEP-005/006 need
 * EAR input injection, which the harness cannot do yet).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~3595: `port_fe_ear` = $FE bit 4, `port_fe_mic` = $FE bit 3. ~6449: the mixer's MIC input is
 *   port_fe_mic xor the tape EAR input; ~6450 `beep_spkr_excl` = $06 bit 6 and $08 bit 4.
 * - audio/audio_mixer.vhd: pcm = ear + mic + ay + dac + i2s per side, with ear = 512 and mic = 128 while
 *   high and not excluded (`exc_i`), ay = the TurboSound sum (a full YM channel is 255), dac = the soundrive
 *   side (A + B or C + D) * 4. A plain sum: no saturation below the 13-bit range (max ~5998).
 * - The CPU runs at 28 MHz / 8 = 3.5 MHz with `$07` = 0; $08 bit 6 turns contention off, so a delay loop
 *   takes exactly its documented T-states.
 * - The sample clock is the 28 MHz master clock, so a frame yields rate * frame clocks / 28 MHz samples.
 */

const RATE = 48_000;
const NO_CONTENTION = 0x40;
const SPEAKER = 0x10;
const DAC_EN = 0x08;

async function session(rate = RATE): Promise<NextTestSession> {
  const s = await createSession({ audioSampleRate: rate });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}

/**
 * A program toggling `mask` of port $FE every 44 + 13 * (n - 1) T-states (contention off, 3.5 MHz).
 * `setup` runs first (e.g. NextReg writes).
 */
async function toggle(s: NextTestSession, mask: number, n: number, setup = ""): Promise<void> {
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
${setup}
        ld c,$fe
        ld a,$${mask.toString(16)}
Loop:   out (c),a         ; 12
        xor $${mask.toString(16)}           ; 7
        ld b,${n}         ; 7
Dly:    djnz Dly          ; 13 * (n - 1) + 8
        jp Loop           ; 10
`,
    { entry: "Start" }
  );
}

const halfPeriod = (n: number) => 44 + 13 * (n - 1);
const record = (s: NextTestSession, frames: number): AudioSample[] => s.startAudio().runFrames(frames).audio();
/** Swing of the left side, skipping the first frame (the program's start and the beeper filter settle). */
const beeperSwing = (s: NextTestSession) => {
  s.runFrames(1);
  return swing(side(record(s, 2), "left"));
};

describe("Beeper and mixer", () => {
  it("BEEP-001: toggling $FE bit 4 plays a square wave at the toggle rate on both sides", async () => {
    const s = await session();
    await toggle(s, 0x10, 100, `        nextreg $08,$${(NO_CONTENTION | SPEAKER).toString(16)}`);
    s.runFrames(1);
    const samples = record(s, 4);
    const expected = 3_500_000 / (2 * halfPeriod(100)); // --- 1314.8 Hz
    expect(relativeError(frequency(side(samples, "left"), RATE), expected)).toBeLessThan(0.01);
    expect(side(samples, "right")).toEqual(side(samples, "left"));
  });

  it("BEEP-002: $FE bit 3 (MIC) alone plays a quarter of the EAR amplitude (128 vs 512)", async () => {
    const ear = await session();
    await toggle(ear, 0x10, 100, `        nextreg $08,$${(NO_CONTENTION | SPEAKER).toString(16)}`);
    const mic = await session();
    await toggle(mic, 0x08, 100, `        nextreg $08,$${(NO_CONTENTION | SPEAKER).toString(16)}`);
    const ratio = beeperSwing(mic) / beeperSwing(ear);
    expect(ratio).toBeGreaterThan(0.24);
    expect(ratio).toBeLessThan(0.26);
  });

  it("BEEP-003: $08 bit 4 and $06 bit 6 read back; hard reset values 1 and 0", async () => {
    const s = await session();
    expect([s.readNextReg(0x08) & 0x10, s.readNextReg(0x06) & 0x40]).toEqual([0x10, 0x00]);
    s.setNextReg(0x08, s.readNextReg(0x08) & ~0x10).setNextReg(0x06, s.readNextReg(0x06) | 0x40);
    expect([s.readNextReg(0x08) & 0x10, s.readNextReg(0x06) & 0x40]).toEqual([0x00, 0x40]);
  });

  const EXCLUSION: Array<[nr06Bit6: boolean, speaker: boolean, heard: boolean]> = [
    [false, true, true],
    [true, true, false], // --- beep_spkr_excl: the beeper goes to the internal speaker only
    [true, false, true] // --- no speaker: nothing to divert to
  ];
  for (const [bit6, speaker, heard] of EXCLUSION) {
    for (const [what, mask] of [["EAR", 0x10], ["MIC", 0x08]] as const) {
      it(`BEEP-003: $06 bit 6 = ${+bit6}, $08 bit 4 = ${+speaker}: ${what} ${heard ? "is" : "is not"} in the mix`, async () => {
        const s = await session();
        await toggle(
          s,
          mask,
          100,
          `        nextreg $06,$${(bit6 ? 0x40 : 0x00).toString(16)}\n        nextreg $08,$${(NO_CONTENTION | (speaker ? SPEAKER : 0)).toString(16)}`
        );
        expect(beeperSwing(s) > 0).toBe(heard);
      });
    }
  }

  /*
   * BEEP-004: the mixer's weights, as ratios so the output gain drops out. Full-scale steps: EAR 512,
   * MIC 128, one YM channel at volume 15 = 255, one DAC channel from $00 to $FF = 255 * 4 = 1020.
   * The gain itself is a product choice (2026-09-18: a full AY channel keeps its earlier loudness), so
   * sums above ~1110 units clamp; the additivity check stays below that.
   */
  async function weights(): Promise<{ ear: number; ay: number; dac: number }> {
    const e = await session();
    await toggle(e, 0x10, 100, `        nextreg $08,$${(NO_CONTENTION | SPEAKER).toString(16)}`);
    const ear = edgeStep(side(record(e.runFrames(1), 2), "left"));

    const a = await session();
    a.setNextReg(0x06, 0x00).setNextReg(0x08, SPEAKER);
    ay(a, 0, 0xfe);
    ay(a, 8, 0x0f);
    ay(a, 7, 0x3e);
    const ayChannel = edgeStep(side(record(a.runFrames(1), 2), "left"));

    const d = await session();
    d.setNextReg(0x08, SPEAKER | DAC_EN);
    const dacLevel = (v: number) => {
      const samples = record(d.out(0x1f, v), 1);
      return samples[samples.length - 1].left;
    };
    const dac = Math.abs(dacLevel(0xff) - dacLevel(0x00));
    return { ear, ay: ayChannel, dac };
  }

  it("BEEP-004: EAR : one full AY channel : one full DAC channel = 512 : 255 : 1020", async () => {
    const w = await weights();
    expect(w.ay).toBeGreaterThan(0);
    const ratios = { ear: w.ear / w.ay, dac: w.dac / w.ay };
    expect(Math.abs(ratios.ear - 512 / 255), JSON.stringify(ratios)).toBeLessThan(0.05);
    expect(Math.abs(ratios.dac - 1020 / 255), JSON.stringify(ratios)).toBeLessThan(0.05);
  });

  it("BEEP-004: sources add: an AY level and a DAC level together are the sum of each alone", async () => {
    // --- Static (DC) levels: AY channels A and B at volume 12 (volTableYm[25] = $66 each: 204 on the
    // --- left) with tone and noise off, DAC A at $C0 (+64 * 4 = 256).
    const s = await session();
    s.setNextReg(0x06, 0x00).setNextReg(0x08, SPEAKER | DAC_EN);
    const levelNow = () => {
      const samples = record(s, 1);
      return samples[samples.length - 1].left;
    };
    const silence = levelNow();
    ay(s, 7, 0x3f);
    ay(s, 8, 0x0c);
    ay(s, 9, 0x0c);
    const ayOnly = levelNow() - silence;
    s.out(0x1f, 0xc0);
    const both = levelNow() - silence;
    ay(s, 8, 0x00);
    ay(s, 9, 0x00);
    const dacOnly = levelNow() - silence;
    expect(ayOnly).toBeGreaterThan(0);
    expect(Math.abs(both - (ayOnly + dacOnly)) / both, `${ayOnly} + ${dacOnly} vs ${both}`).toBeLessThan(0.005);
    expect(Math.abs(dacOnly / ayOnly - 256 / 204), "the proportions").toBeLessThan(0.01);
  });

  it("BEEP-007: after reset, with nothing playing, both sides hold one constant level", async () => {
    const s = await session();
    s.runFrames(2);
    const samples = record(s, 4);
    expect(swing(side(samples, "left"))).toBe(0);
    expect(side(samples, "right")).toEqual(side(samples, "left"));
  });

  for (const rate of [44_100, 48_000]) {
    it(`BEEP-008: at ${rate} Hz a frame yields rate * frame length / 28 MHz samples`, async () => {
      const s = await session(rate);
      s.setNextReg(0x07, 0).runFrames(1);
      const t0 = s.tacts;
      s.runFrames(1);
      const frameClocks = (s.tacts - t0) * 8; // --- 3.5 MHz T-states -> 28 MHz clocks
      const samples = record(s, 20).length / 20;
      expect(Math.abs(samples - (rate * frameClocks) / 28_000_000)).toBeLessThan(0.1);
    });
  }
});
