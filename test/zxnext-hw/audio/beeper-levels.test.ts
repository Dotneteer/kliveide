import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type AudioSample, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { edgeStep, side, swing } from "./_audio-helpers";

/*
 * Beeper levels in the mix: MIC on both sides, EAR + MIC together, the $FE bits that are not sound,
 * the one exclusion combination `beeper-mixer.test.ts` does not list, and the beeper adding to static
 * AY / DAC levels. Ports the hardware-visible parts of test/audio/BeeperFpga.step22,
 * BeeperMameCompat, AudioMixerDevice.step8 and AudioMixing.step17.
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~3585-3596: `port_fe_reg <= cpu_do(4 downto 0)` on a write to an even port (~2538:
 *   A0 = 0); EAR = bit 4, MIC = bit 3; bits 2-0 are the border only (~3601), bits 7-5 are not stored.
 * - zxnext.vhd ~6449-6450: the mixer's MIC is `port_fe_mic xor i_AUDIO_EAR xor pi_fe_ear` (no tape
 *   signal here); `beep_spkr_excl = nr_06_internal_speaker_beep and nr_08_internal_speaker_en`.
 * - audio/audio_mixer.vhd ~71-72, ~97-98, ~111-112: ear = 512, mic = 128 while set and not excluded;
 *   pcm_L = ear + mic + ay_L + dac_L + i2s_L and pcm_R the same with the right inputs - EAR and MIC
 *   go equally to *both* sides, and every source is a plain sum.
 */

const RATE = 48_000;
const NO_CONTENTION = 0x40;
const SPEAKER = 0x10;
const DAC_EN = 0x08;

async function session(core: CoreName): Promise<NextTestSession> {
  return createSession(core, { audioSampleRate: RATE });
}

/** Loads a program toggling `mask` of port $FE every 44 + 13 * 99 T-states; `setup` runs first. */
async function toggle(s: NextTestSession, mask: number, setup: string): Promise<void> {
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
${setup}
        ld c,$fe
        ld a,$${mask.toString(16)}
Loop:   out (c),a
        xor $${mask.toString(16)}
        ld b,100
Dly:    djnz Dly
        jp Loop
`,
    { entry: "Start" }
  );
}

const nr = (reg: number, value: number) => `        nextreg $${reg.toString(16)},$${value.toString(16)}`;
/** Records 2 frames after one frame of settling (program start, the cores' beeper filter). */
const settled = (s: NextTestSession): AudioSample[] => s.runFrames(1).startAudio().runFrames(2).audio();

describe.each(ALL_CORES)("Beeper levels - %s core", (core) => {
  it("BEEP-LVL-1: MIC ($FE bit 3) plays equally on the left and the right", async () => {
    // --- audio_mixer.vhd ~97-98: mic is added to pcm_L and pcm_R alike
    const s = await session(core);
    await toggle(s, 0x08, nr(0x08, NO_CONTENTION | SPEAKER));
    const samples = settled(s);
    expect(swing(side(samples, "left"))).toBeGreaterThan(0);
    expect(side(samples, "right")).toEqual(side(samples, "left"));
  });

  it("BEEP-LVL-2: EAR and MIC toggled together step 512 + 128 = 1.25 times EAR alone", async () => {
    // --- audio_mixer.vhd ~71-72 (ear_volume 512, mic_volume 128), ~97
    const ear = await session(core);
    await toggle(ear, 0x10, nr(0x08, NO_CONTENTION | SPEAKER));
    const both = await session(core);
    await toggle(both, 0x18, nr(0x08, NO_CONTENTION | SPEAKER));
    const ratio = edgeStep(side(settled(both), "left")) / edgeStep(side(settled(ear), "left"));
    expect(Math.abs(ratio - 640 / 512), ratio.toFixed(3)).toBeLessThan(0.02);
  });

  for (const [what, mask] of [["border bits 2-0", 0x07], ["bits 7-5", 0xe0]] as const) {
    it(`BEEP-LVL-3: toggling $FE ${what} makes no sound`, async () => {
      // --- zxnext.vhd ~3589: port_fe_reg keeps bits 4-0; only bits 4 and 3 feed the mixer (~3595-3596)
      const s = await session(core);
      await toggle(s, mask, nr(0x08, NO_CONTENTION | SPEAKER));
      const samples = settled(s);
      expect([swing(side(samples, "left")), swing(side(samples, "right"))]).toEqual([0, 0]);
    });
  }

  it("BEEP-LVL-4: $06 bit 6 = 0 and $08 bit 4 = 0 (no speaker): EAR still reaches the mix", async () => {
    // --- zxnext.vhd ~6450: exclusion needs both bits set; audio_mixer.vhd ~71
    const s = await session(core);
    await toggle(s, 0x10, `${nr(0x06, 0x00)}\n${nr(0x08, NO_CONTENTION)}`);
    expect(swing(side(settled(s), "left"))).toBeGreaterThan(0);
  });

  it("BEEP-LVL-5: the beeper adds to static AY and DAC levels: its step does not change", async () => {
    // --- audio_mixer.vhd ~111-112: a plain sum. AY channel A level 12 ($66 = 102) with tone and noise
    // --- off; DAC A at $C0 (+64 * 4 = 256); EAR 512: the peak stays far below the output's range.
    const plain = await session(core);
    await toggle(plain, 0x10, nr(0x08, NO_CONTENTION | SPEAKER | DAC_EN));
    const offsets = await session(core);
    await toggle(
      offsets,
      0x10,
      `${nr(0x08, NO_CONTENTION | SPEAKER | DAC_EN)}
${nr(0x06, 0x00)}
        ld a,$c0
        out ($1f),a
        ld bc,$fffd
        ld a,7
        out (c),a
        ld b,$bf
        ld a,$3f
        out (c),a
        ld b,$ff
        ld a,8
        out (c),a
        ld b,$bf
        ld a,$0c
        out (c),a`
    );
    const a = settled(plain);
    const b = settled(offsets);
    const stepPlain = edgeStep(side(a, "left"));
    const stepOffsets = edgeStep(side(b, "left"));
    expect(stepPlain).toBeGreaterThan(0);
    expect(Math.abs(stepOffsets / stepPlain - 1), `${stepPlain} vs ${stepOffsets}`).toBeLessThan(0.01);
    // --- and the offsets are really there: the two runs' left sides sit apart
    const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
    expect(mean(side(b, "left")) - mean(side(a, "left")), "AY + DAC offset on the left").toBeGreaterThan(0);
  });
});
