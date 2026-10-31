import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";
import { ay, edgeStep, side } from "./_audio-helpers";

/*
 * The Next's three sound outputs, as Klive plays the one chosen (`audioOutput`, the IDE's Sound Output
 * setting; catalogue OUT-001 - OUT-005).
 *
 * Hardware (`vendor/next-fpga/3.02.01/src`):
 * - audio/audio_mixer.vhd: the 13-bit sum per side, EAR 512 + MIC 128 + AY + DAC side x 4 + Pi.
 * - zxnext_top_issue4.vhd ~1279/1299: the jack's converters take `zxn_audio_L(11 downto 0)`: a sum of
 *   4,096 or more wraps. ~1313-1320: the speaker takes L(11..0) + R(11..0), or with the beeper diverted
 *   EAR at bit 10 and MIC at bit 8; ~1340 its pin is gated by $08 bit 4. ~1522: HDMI takes the whole
 *   sum; zxnext.vhd ~5166 $09 bit 2 silences it.
 * - zxnext.vhd ~6450: $06 bit 6 with $08 bit 4 diverts EAR and MIC from the mix to the speaker.
 *
 * Klive's words: (output value - its silence) x the output's gain (zxnext-audio-mixer.c): the jack
 * 12.8 about 1,536, the speaker 6.4 about 3,072, HDMI 7.34 about 1,536.
 *
 * The scene: three AY chips in mono with A, B and C at volume 15 and tone and noise off (a constant
 * 765 per chip and side: 2,295), the Pi off (512), the DACs on: left with A and B at $FF (2,040), right
 * at rest (1,024). Left sums to 4,847 (wraps on the jack to 751), right to 3,831.
 */

const RATE = 48_000;
const word = (v: number) => Math.round(v * 32768);

async function loudScene(): Promise<NextTestSession> {
  const s = await createSession({ audioSampleRate: RATE });
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, 0x1a).setNextReg(0x09, 0xe0); // --- speaker, DACs, TurboSound; all chips mono
  for (const select of [0xff, 0xfe, 0xfd]) {
    s.out(0xfffd, select);
    ay(s, 7, 0x3f);
    ay(s, 8, 0x0f);
    ay(s, 9, 0x0f);
    ay(s, 10, 0x0f);
  }
  s.out(0x1f, 0xff).out(0x0f, 0xff); // --- DAC A and B (left) at full
  return s;
}

/** The last sample of one frame, as 16-bit words */
function levels(s: NextTestSession): { left: number; right: number } {
  const last = s.startAudio().runFrames(1).audio().at(-1)!;
  return { left: word(last.left), right: word(last.right) };
}

describe("Sound outputs", () => {
  it("OUT-001: the jack (the default) wraps a sum past 4,095: 4,847 plays as 751", async () => {
    const s = await loudScene();
    const { left, right } = levels(s);
    expect(left).toBe(Math.trunc((751 - 1536) * 12.8)); // --- -10,048
    expect(right).toBe(Math.trunc((3831 - 1536) * 12.8)); // --- 29,376: below 4,096, whole
  });

  it("OUT-002: HDMI carries the whole sum, and NextReg $09 bit 2 silences it", async () => {
    const s = await loudScene();
    s.audioOutput("hdmi");
    const { left, right } = levels(s);
    expect(left).toBe(Math.trunc((4847 - 1536) * 7.34)); // --- 24,302: no wrap
    expect(right).toBe(Math.trunc((3831 - 1536) * 7.34));
    s.setNextReg(0x09, 0xe4);
    expect(levels(s)).toEqual({ left: 0, right: 0 });
  });

  it("OUT-003: the speaker plays the two jack values added, on both sides; $08 bit 4 off silences it", async () => {
    const s = await loudScene();
    s.audioOutput("speaker");
    const mono = Math.trunc((751 + 3831 - 3072) * 6.4); // --- 9,664
    expect(levels(s)).toEqual({ left: mono, right: mono });
    s.setNextReg(0x08, 0x0a); // --- speaker off
    expect(levels(s)).toEqual({ left: 0, right: 0 });
  });

  it("OUT-004: with $06 bit 6 the beeper leaves the jack and HDMI and plays on the speaker alone", async () => {
    const run = async (output: "jack" | "speaker" | "hdmi") => {
      const s = await createSession({ audioSampleRate: RATE });
      await s.loadCode(
        `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $06,$40
        nextreg $08,$50
        ld c,$fe
        ld a,$10
Loop:   out (c),a
        xor $10
        ld b,100
Dly:    djnz Dly
        jp Loop
`,
        { entry: "Start" }
      );
      s.audioOutput(output).runFrames(10);
      return edgeStep(side(s.startAudio().runFrames(2).audio(), "left"));
    };
    expect(await run("jack")).toBe(0);
    expect(await run("hdmi")).toBe(0);
    // --- EAR alone at bit 10 of the speaker's word (1,024 units) x 6.4: as loud as EAR on the jack
    expect((await run("speaker")) * 32768).toBeCloseTo(1024 * 6.4, -2);
  });

  it("OUT-005: below the jack's limit the jack and the speaker agree with the centred mix", async () => {
    // --- One chip, channel A at volume 15 with tone and noise off: 255 on the left (ABC), nothing wraps
    const s = await createSession({ audioSampleRate: RATE });
    await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
    ay(s, 7, 0x3f);
    ay(s, 8, 0x0f);
    expect(levels(s)).toEqual({ left: Math.trunc(255 * 12.8), right: 0 });
    s.audioOutput("speaker");
    const mono = Math.trunc(255 * 6.4);
    expect(levels(s)).toEqual({ left: mono, right: mono });
  });
});
