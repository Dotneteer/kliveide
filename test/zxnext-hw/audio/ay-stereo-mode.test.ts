import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type AudioSample, type CoreName } from "../../harness/zxnext";

/*
 * AY-012 - NextReg $08 bit 5 selects the stereo arrangement of every PSG.
 *
 * Hardware (`_input/next-fpga/src/audio/turbosound.vhd` ~184-201, per PSG):
 *   psg_L_mux <= psg_C when stereo_mode_i = '1' ... else psg_B;
 *   psg_L     <= psg_A + psg_L_mux;      psg_R <= psg_C + psg_B;
 * so with bit 5 = 0 (ABC) the left side is A + B and the right side B + C - channel B is the centre,
 * A is left only, C is right only. With bit 5 = 1 (ACB) the left side is A + C: C becomes the centre
 * and B is right only. `stereo_mode_i => nr_08_psg_stereo_mode` (zxnext.vhd ~6345, write ~5155).
 *
 * The mixer sums each side on its own (`audio_mixer.vhd` ~99: `pcm_L <= ear + mic + ay_L + dac_L`),
 * so a side with no channel on it stays at a constant level.
 *
 * One tone at a time: the side that carries it swings, the other side is flat.
 */

const SAMPLE_RATE = 48000;
const ABC = 0x1a; // --- $08: internal speaker, DACs, TurboSound on; bit 5 = 0
const ACB = 0x3a; // --- the same with bit 5 = 1

type Side = "swings" | "flat";

const swing = (samples: AudioSample[], side: "left" | "right") => {
  const values = samples.map((s) => s[side]);
  return Math.max(...values) - Math.min(...values);
};

/** Plays a tone on one PSG channel of chip 0 and returns the recorded frames. */
async function tone(core: CoreName, nr08: number, channel: number): Promise<AudioSample[]> {
  const s = await createSession(core, { audioSampleRate: SAMPLE_RATE });
  s.setNextReg(0x08, nr08);
  const ay = (reg: number, value: number) => s.out(0xfffd, reg).out(0xbffd, value);
  // --- Chip 0 is selected out of reset (turbosound.vhd ~123: ay_select <= "11").
  ay(2 * channel, 0x40); // --- tone period LSB: ~1.7 kHz
  ay(2 * channel + 1, 0x00);
  ay(8, 0x00);
  ay(9, 0x00);
  ay(10, 0x00);
  ay(8 + channel, 0x0f); // --- full volume on this channel only
  ay(7, 0x38 | (0x07 & ~(1 << channel))); // --- its tone enabled, the others and all noise off
  return s.startAudio().runFrames(4).audio();
}

const CASES: Array<[mode: string, nr08: number, channel: number, left: Side, right: Side]> = [
  ["ABC", ABC, 0, "swings", "flat"], // --- A: left only
  ["ABC", ABC, 1, "swings", "swings"], // --- B: centre
  ["ABC", ABC, 2, "flat", "swings"], // --- C: right only
  ["ACB", ACB, 0, "swings", "flat"], // --- A: left only in both modes
  ["ACB", ACB, 1, "flat", "swings"], // --- B: right only
  ["ACB", ACB, 2, "swings", "swings"] // --- C: centre
];

describe.each(ALL_CORES)("AY stereo mode (NextReg 08 bit 5) - %s core", (core) => {
  for (const [mode, nr08, channel, left, right] of CASES) {
    it(`${mode}: channel ${"ABC"[channel]} -> left ${left}, right ${right}`, async () => {
      const samples = await tone(core, nr08, channel);
      const swings = { left: swing(samples, "left"), right: swing(samples, "right") };
      const side = (s: number): Side => (s > 0 ? "swings" : "flat");
      expect({ left: side(swings.left), right: side(swings.right) }, JSON.stringify(swings)).toEqual({ left, right });
    });
  }

  it("a silent PSG produces a constant level on both sides", async () => {
    const s = await createSession(core, { audioSampleRate: SAMPLE_RATE });
    const samples = s.setNextReg(0x08, ABC).startAudio().runFrames(4).audio();
    expect([swing(samples, "left"), swing(samples, "right")]).toEqual([0, 0]);
  });
});
