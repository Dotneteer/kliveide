import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSession, type AudioSample, type NextTestSession } from "../../harness/zxnext";
import { ay, edgeStep, frequency, relativeError, side, swing } from "./_audio-helpers";

/*
 * The machine captures of the audio series "ZX Spectrum Next: how the sound is made"
 * (docs/content/en/under-the-hood/emulator-internals/next-audio/, plan
 * `.plans/NEXT_AUDIO_ARTICLES_PLAN.md` §0.4). Each scene drives a sound source through ports and
 * NextRegs as a program would, checks the facts the article states about it, and only then, with
 * NEXT_AUDIO_SHOTS=<dir>, writes the captured samples as `<dir>/<article>/<scene>.json`. The usual
 * <dir> is `docs/authoring/next-audio/captures`; the article's figure generator
 * (`docs/authoring/next-audio/<article>-figures.cjs`) turns them into inline SVG.
 *
 * These are Klive's mixed output (both sides, 16-bit, the beeper DC-filtered and the DACs and the Pi
 * taken about their rest levels), not the hardware's unsigned sum; the captions say so.
 *
 * Hardware (`_input/next-fpga/src`):
 * - audio/audio_mixer.vhd: per side EAR 512 and MIC 128 while high, the AY sum (one full YM channel is
 *   255), each DAC side (A + B or C + D) x 4, the Pi I2S word (0-1023) x 1.
 * - zxnext_top_issue4.vhd ~1042: the PSG clock enable is 28 MHz / 16 = 1.75 MHz; ym2149.vhd divides it
 *   by 8 again, and a tone toggles every `period` of those ticks: 1.75 MHz / 16 / period.
 * - turbosound.vhd ~186-190: in ABC mode, channel B goes to both sides (L = A + B, R = C + B).
 * - zxnext.vhd ~5155-5159: NextReg $08 bit 6 contention off, bit 4 speaker, bit 3 DACs; NextReg $07 = 0
 *   is 3.5 MHz. Port $DF (Specdrum, $84 bit 7 on after reset) writes DACs A and D: both sides.
 */

const RATE = 48_000;
const CPU_HZ = 3_500_000;
/** NextReg $08: contention off, internal speaker on, DACs on */
const NR08 = 0x58;
const FRAMES = 3;

async function session(): Promise<NextTestSession> {
  return createSession({ audioSampleRate: RATE });
}

/** Lets the program start and the beeper's DC filter settle (1.4 Hz: about 0.1 s), then records `FRAMES` frames */
function record(s: NextTestSession): AudioSample[] {
  s.runFrames(40);
  return s.startAudio().runFrames(FRAMES).audio();
}

/** The first `KEEP` samples of a side as Klive's signed 16-bit words */
const KEEP = 960; // --- 20 ms at 48 kHz
const word = (samples: AudioSample[], which: "left" | "right") =>
  side(samples, which).slice(0, KEEP).map((v) => Math.round(v * 32768));

function save(article: string, scene: string, samples: AudioSample[], extra: Record<string, unknown> = {}): void {
  const out = process.env.NEXT_AUDIO_SHOTS;
  if (!out) return;
  const dir = join(out, article);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${scene}.json`),
    JSON.stringify({ rate: RATE, ...extra, left: word(samples, "left"), right: word(samples, "right") }) + "\n"
  );
}

// --- The beeper: port $FE bit 4 toggled every 1,760 T-states, 3.5 MHz, no contention
const BEEPER_N = 133;
const BEEPER_HALF = 44 + 13 * (BEEPER_N - 1); // --- 1,760 T-states
async function beeper(): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${NR08.toString(16)}
        ld c,$fe
        ld a,$10
Loop:   out (c),a         ; 12
        xor $10           ; 7
        ld b,${BEEPER_N}  ; 7
Dly:    djnz Dly          ; 13 * (n - 1) + 8
        jp Loop           ; 10
`,
    { entry: "Start" }
  );
  return record(s);
}

// --- One AY channel: chip 0, channel B, tone period 109, full volume; written once
const PSG_PERIOD = 109;
async function psg(): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, NR08);
  ay(s, 2, PSG_PERIOD & 0xff); // --- R2/R3: channel B's tone period
  ay(s, 3, PSG_PERIOD >> 8);
  ay(s, 9, 0x0f); // --- R9: channel B's volume, fixed 15
  ay(s, 7, 0x3d); // --- R7: only tone B enabled (active low)
  return record(s);
}

// --- A DAC: a 16-step sine written to port $DF (Specdrum: DACs A and D) every 218 T-states
const DAC_STEPS = 16;
const DAC_N = 13;
const DAC_PERIOD = 62 + 13 * (DAC_N - 1); // --- 218 T-states between writes
const DAC_TABLE = [...Array(DAC_STEPS)].map((_, i) => Math.round(128 + 127 * Math.sin((2 * Math.PI * i) / DAC_STEPS)));
async function dac(): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${NR08.toString(16)}
        ld hl,Table
Loop:   ld a,(hl)         ; 7
        out ($df),a       ; 11
        ld a,l            ; 4
        inc a             ; 4
        and $0f           ; 7
        ld l,a            ; 4
        ld b,${DAC_N}     ; 7
Dly:    djnz Dly          ; 13 * (n - 1) + 8
        jp Loop           ; 10
        .org $9000
Table:  .defb ${DAC_TABLE.join(",")}
`,
    { entry: "Start" }
  );
  return record(s);
}

// --- The Pi: a 1,000 Hz sine streamed in stereo at 48 kHz, NextReg $A2 = stereo
const PI_HZ = 1000;
const PI_AMPLITUDE = 32000;
async function pi(): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, NR08).setNextReg(0xa2, 0xc0);
  s.piI2sConnect({
    rate: RATE,
    sample: (k) => {
      const v = Math.round(PI_AMPLITUDE * Math.sin((2 * Math.PI * PI_HZ * k) / RATE));
      return [v, v];
    }
  });
  return record(s);
}

describe("Audio series scenes", () => {
  it("overview: every source plays its tone at the rate its settings give, on both sides, in the mixer's proportions", async () => {
    const scenes = { beeper: await beeper(), psg: await psg(), dac: await dac(), pi: await pi() };
    const expected = {
      beeper: CPU_HZ / (2 * BEEPER_HALF), // --- 994.3 Hz
      psg: 1_750_000 / 16 / PSG_PERIOD, // --- 1,003.4 Hz
      dac: CPU_HZ / DAC_PERIOD / DAC_STEPS, // --- 1,003.4 Hz
      pi: PI_HZ
    };
    for (const [name, samples] of Object.entries(scenes)) {
      const left = side(samples, "left");
      expect(samples.length, name).toBeGreaterThan(2000);
      expect(relativeError(frequency(left, RATE), expected[name as keyof typeof expected]), name).toBeLessThan(0.01);
      expect(side(samples, "right"), `${name}: both sides`).toEqual(left);
    }
    // --- The swings in mixer units, relative to the beeper's 512 (its edge: the DC filter's slow drift
    //     is not part of it): one AY channel 255, the DAC's
    //     254 steps x 4, the Pi's word swing (2 x 32000 / 64 = 1000)
    const beep = edgeStep(side(scenes.beeper, "left"));
    const ratio = (name: keyof typeof scenes) => swing(side(scenes[name], "left")) / beep;
    expect(ratio("psg")).toBeCloseTo(255 / 512, 1);
    expect(ratio("dac")).toBeCloseTo((254 * 4) / 512, 1);
    expect(ratio("pi")).toBeCloseTo(1000 / 512, 1);

    // --- The DAC scene also records its write period, for the "generator and level writer" figure
    for (const [name, samples] of Object.entries(scenes)) {
      const extra = name === "dac" ? { writePeriodTacts: DAC_PERIOD, cpuHz: CPU_HZ, steps: DAC_STEPS } : {};
      save("overview", name, samples, { hz: expected[name as keyof typeof expected], ...extra });
    }
  });
});
