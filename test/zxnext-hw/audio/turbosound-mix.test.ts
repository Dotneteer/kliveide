import { describe, expect, it } from "vitest";

import { createSession, type AudioSample, type NextTestSession } from "../../harness/zxnext";
import { VOL_TABLE_YM, ay, magnitude, side, swing, toneHz } from "./_audio-helpers";

/*
 * TurboSound routing and levels: per-chip pan, stereo mode and mono mode together, the channel sums,
 * and the three-chip sum. Ports the hardware-visible parts of test/audio/TurboSoundDevice.step3/step4,
 * TurboSoundTesting.step15, PsgEnvStereo.step56, AudioControlDevice.step9 and FinalIntegration.step20
 * that `ay-psg.test.ts` (AY-009 - AY-016) and `ay-stereo-mode.test.ts` (AY-012) do not already hold.
 *
 * Hardware (`_input/next-fpga/src/audio/turbosound.vhd`):
 * - ~129-135: only while TurboSound is on ($08 bit 1, `turbosound_en_i`) does a $FFFD write %1pp111cc
 *   select chip cc and set *that chip's* pan to pp; the other chips keep theirs. Reset: pan "11".
 * - ~186-192 (chip 0; ~241-247, ~296-302 for 1, 2): L_mux = C when ACB ($08 bit 5) or mono else B;
 *   L_sum = A + L_mux; R = (mono ? L_sum : C) + B; L = mono ? R : L_sum. So ABC: L = A + B, R = B + C;
 *   ACB: L = A + C, R = C + B; mono (any stereo mode): L = R = A + B + C. `stereo_mode_i` is one
 *   signal for all three chips; `mono_mode_i(n)` = $09 bit 5 + n (zxnext.vhd ~6344-6345).
 * - ~323-329: the pan gates the chip's L (pan bit 1) and R (pan bit 0) *after* the stereo/mono mix.
 * - ~334-335: the output is the plain sum of the three panned chips.
 * - audio/ym2149.vhd: with R7 = $3F (tone and noise off) a channel outputs its level as DC; a fixed
 *   level L plays `volTableYm[2L + 1]` (YM mode).
 */

const RATE = 48_000;
const YM = 0x00;
const NR08 = 0x10; // --- internal speaker on; DACs, TurboSound off; ABC
const TS = 0x02; // --- $08 bit 1: TurboSound
const ACB = 0x20; // --- $08 bit 5
const MIXER_OFF = 0x3f;
const TONE_ONLY = [0x3e, 0x3d, 0x3b];
/** Select value %1pp111cc for chip 0/1/2 with pan `pan`. */
const select = (chip: number, pan = 3) => 0x9c | (pan << 5) | [3, 2, 1][chip];

async function psg(nr08 = NR08 | TS): Promise<NextTestSession> {
  const s = await createSession({ audioSampleRate: RATE });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  s.setNextReg(0x06, YM).setNextReg(0x08, nr08);
  return s;
}

function tone(s: NextTestSession, channel: number, period: number): NextTestSession {
  ay(s, 2 * channel, period & 0xff);
  ay(s, 2 * channel + 1, period >> 8);
  ay(s, 8 + channel, 0x0f);
  return ay(s, 7, TONE_ONLY[channel]);
}

/** Records `frames` frames and drops the first two samples, which can straddle the last write. */
const record = (s: NextTestSession, frames = 2): AudioSample[] => s.startAudio().runFrames(frames).audio().slice(2);
const sides = (samples: AudioSample[]) => ({
  left: swing(side(samples, "left")) > 0,
  right: swing(side(samples, "right")) > 0
});
const last = (s: NextTestSession): AudioSample => {
  const a = s.startAudio().runFrames(1).audio();
  return a[a.length - 1];
};

describe("TurboSound routing and levels", () => {
  it("TS-PAN-1: each chip keeps its own pan: chip 0 left only, chip 1 right only", async () => {
    // --- turbosound.vhd ~132-134: the select write sets only the chosen chip's pan; ~323-329
    const s = await psg();
    tone(s.out(0xfffd, select(0, 0b10)), 1, 100); // --- chip 0, channel B (centre), pan left
    tone(s.out(0xfffd, select(1, 0b01)), 1, 210); // --- chip 1, channel B (centre), pan right
    const samples = record(s, 4);
    const left = side(samples, "left");
    const right = side(samples, "right");
    const chip0 = toneHz(100);
    const chip1 = toneHz(210);
    expect(magnitude(left, RATE, chip0), "chip 0 on the left").toBeGreaterThan(10 * magnitude(left, RATE, chip1));
    expect(magnitude(right, RATE, chip1), "chip 1 on the right").toBeGreaterThan(10 * magnitude(right, RATE, chip0));
  });

  it("TS-PAN-2: the pan acts after the mono mix: mono chip panned left plays on the left only", async () => {
    // --- turbosound.vhd ~186-192 (mono: L = R = A + B + C), then ~323/327 (pan gates L and R)
    const s = await psg();
    s.out(0xfffd, select(0, 0b10));
    tone(s, 0, 0x0fe);
    s.setNextReg(0x09, 0x20);
    expect(sides(record(s))).toEqual({ left: true, right: false });
    s.out(0xfffd, select(0, 0b11));
    expect(sides(record(s)), "pan 11: mono on both sides").toEqual({ left: true, right: true });
  });

  it("TS-PAN-3: a pan survives stereo-mode and mono-mode changes", async () => {
    // --- turbosound.vhd ~129: only a select write changes a pan; $08/$09 writes do not
    const s = await psg();
    s.out(0xfffd, select(0, 0b01)); // --- right only
    tone(s, 1, 0x0fe); // --- B: centre in ABC
    expect(sides(record(s)), "ABC").toEqual({ left: false, right: true });
    s.setNextReg(0x08, NR08 | TS | ACB).setNextReg(0x09, 0x20).setNextReg(0x09, 0x00).setNextReg(0x08, NR08 | TS);
    expect(sides(record(s)), "after toggling ACB and mono").toEqual({ left: false, right: true });
  });

  it("TS-PAN-4: with TurboSound off a select value does not change the pan", async () => {
    // --- turbosound.vhd ~129: the select/pan branch needs turbosound_en_i = '1'
    const s = await psg(NR08);
    tone(s, 1, 0x0fe);
    s.out(0xfffd, select(0, 0b00)); // --- would mute chip 0
    expect(sides(record(s))).toEqual({ left: true, right: true });
  });

  for (const chip of [1, 2]) {
    it(`TS-STEREO-1: $08 bit 5 applies to chip ${chip} too: ACB puts channel B on the right only`, async () => {
      // --- turbosound.vhd ~241 / ~296: stereo_mode_i is shared by all three PSGs
      const s = await psg(NR08 | TS | ACB);
      tone(s.out(0xfffd, select(chip)), 1, 0x0fe);
      expect(sides(record(s)), "ACB").toEqual({ left: false, right: true });
      s.setNextReg(0x08, NR08 | TS);
      expect(sides(record(s)), "ABC: B is the centre").toEqual({ left: true, right: true });
    });
  }

  it("TS-STEREO-2: switching $08 bit 5 while a tone plays moves channel C at once", async () => {
    // --- turbosound.vhd ~186: the mux is combinational on stereo_mode_i
    const s = await psg();
    tone(s, 2, 0x0fe);
    expect(sides(record(s)), "ABC: C right only").toEqual({ left: false, right: true });
    s.setNextReg(0x08, NR08 | TS | ACB);
    expect(sides(record(s)), "ACB: C is the centre").toEqual({ left: true, right: true });
    s.setNextReg(0x08, NR08 | TS);
    expect(sides(record(s)), "ABC again").toEqual({ left: false, right: true });
  });

  it("TS-MONO-1: mono overrides ACB: channel B, right only in ACB, plays equally on both sides", async () => {
    // --- turbosound.vhd ~186-192: with mono_mode_i(0) = '1' both sides are A + B + C
    const s = await psg(NR08 | TS | ACB);
    tone(s, 1, 0x0fe);
    expect(sides(record(s)), "ACB stereo").toEqual({ left: false, right: true });
    s.setNextReg(0x09, 0x20);
    const mono = record(s);
    expect(sides(mono), "mono").toEqual({ left: true, right: true });
    expect(side(mono, "left"), "L = R").toEqual(side(mono, "right"));
  });

  it("TS-MONO-2: mono is per chip: chip 0 mono and chip 1 stereo at the same time", async () => {
    // --- turbosound.vhd ~186 / ~241: mono_mode_i(0) and mono_mode_i(1) are separate ($09 bits 5, 6)
    const s = await psg();
    tone(s.out(0xfffd, select(0)), 0, 100); // --- chip 0 channel A
    tone(s.out(0xfffd, select(1)), 0, 210); // --- chip 1 channel A
    s.setNextReg(0x09, 0x20);
    const right = side(record(s, 4), "right");
    expect(magnitude(right, RATE, toneHz(100)), "chip 0 (mono) reaches the right").toBeGreaterThan(10 * magnitude(right, RATE, toneHz(210)));
  });

  /*
   * DC levels (R7 = $3F): A at level 15 (volTableYm[31] = 255), B at 12 (volTableYm[25] = $66 = 102),
   * C at 10 (volTableYm[21] = $35 = 53). All sums stay well below the output's clamp.
   */
  const A = VOL_TABLE_YM[31];
  const B = VOL_TABLE_YM[25];
  const C = VOL_TABLE_YM[21];
  const LEVEL_CASES: Array<[name: string, nr08: number, nr09: number, left: number, right: number]> = [
    ["ABC: L = A + B, R = B + C", NR08 | TS, 0x00, A + B, B + C],
    ["ACB: L = A + C, R = C + B", NR08 | TS | ACB, 0x00, A + C, B + C],
    ["mono: L = R = A + B + C", NR08 | TS, 0x20, A + B + C, A + B + C],
    ["mono in ACB: L = R = A + B + C", NR08 | TS | ACB, 0x20, A + B + C, A + B + C]
  ];
  for (const [name, nr08, nr09, left, right] of LEVEL_CASES) {
    it(`TS-LEVEL-1: ${name}`, async () => {
      // --- turbosound.vhd ~186-192; units measured from channel A alone on the left in ABC
      const s = await psg(NR08 | TS);
      ay(s, 7, MIXER_OFF);
      const silent = last(s);
      ay(s, 8, 0x0f);
      const unit = (last(s).left - silent.left) / A;
      expect(unit, "a level moves the output").toBeGreaterThan(0);
      ay(s, 9, 0x0c);
      ay(s, 10, 0x0a);
      s.setNextReg(0x08, nr08).setNextReg(0x09, nr09);
      const l = last(s);
      const actual = [(l.left - silent.left) / unit, (l.right - silent.right) / unit];
      expect(Math.abs(actual[0] - left), `left ${actual[0].toFixed(1)} vs ${left}`).toBeLessThan(0.01 * left);
      expect(Math.abs(actual[1] - right), `right ${actual[1].toFixed(1)} vs ${right}`).toBeLessThan(0.01 * right);
    });
  }

  it("TS-LEVEL-2: the three chips add: three channel A levels give three times one", async () => {
    // --- turbosound.vhd ~334: pcm_ay_L = psg0_L + psg1_L + psg2_L
    const s = await psg();
    const silent = last(s);
    const levels: number[] = [];
    for (let chip = 0; chip < 3; chip++) {
      s.out(0xfffd, select(chip));
      ay(s, 7, MIXER_OFF);
      ay(s, 8, 0x0c);
      levels.push(last(s).left - silent.left);
    }
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels.map((l) => l / levels[0]).map((r) => Math.round(r * 100) / 100)).toEqual([1, 2, 3]);
    expect(last(s).right, "channel A never reaches the right in ABC").toBe(silent.right);
  });
});
