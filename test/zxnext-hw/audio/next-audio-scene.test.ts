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
/** Klive's mixer: hardware mixer units to 16-bit words (zxnext-audio-mixer.c, ZXNEXT_MIXER_GAIN) */
const MIXER_GAIN = 12.8;
/** The slow beeper loop of the mixer scene: 3,346 * d + 31 T-states per half period */
const SLOW_D = 5;
const SLOW_HALF = 3346 * SLOW_D + 31; // --- 16,761 T-states: 104.4 Hz

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
const word = (samples: AudioSample[], which: "left" | "right", keep = KEEP) =>
  side(samples, which).slice(0, keep).map((v) => Math.round(v * 32768));

function save(
  article: string,
  scene: string,
  samples: AudioSample[],
  extra: Record<string, unknown> = {},
  keep = KEEP
): void {
  const out = process.env.NEXT_AUDIO_SHOTS;
  if (!out) return;
  const dir = join(out, article);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${scene}.json`),
    JSON.stringify({ rate: RATE, gain: MIXER_GAIN, ...extra, left: word(samples, "left", keep), right: word(samples, "right", keep) }) + "\n"
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

// --- The beeper article (article 2): the note loop of the overview at another CPU speed (NextReg $07)
//     and with contention on or off (NextReg $08 bit 6), the loop at `org`
async function beeperAt(speed: number, contention: boolean, org = 0x8000): Promise<AudioSample[]> {
  const s = await session();
  const nr08 = contention ? NR08 & ~0x40 : NR08;
  await s.loadCode(
    `
        .org $${org.toString(16)}
Start:  di
        nextreg $07,${speed}
        nextreg $08,$${nr08.toString(16)}
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

// --- Two voices from one bit: every pass of a 112 T-state loop gives each voice a 34 T-state slot.
//     An 8-bit phase per voice gains its step each pass; a carry out of it switches EAR on for that
//     voice's slot. Steps 4 and 5: 31,250 passes a second x 4 / 256 = 488.3 Hz and x 5 / 256 = 610.4 Hz,
//     a major third. The slots never overlap, so the bit is the two pulse trains added.
const TWO_PASS = 112;
const TWO_SLOT = 34;
const TWO_STEPS = [4, 5];
async function twoVoices(): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${NR08.toString(16)}
        ld hl,0               ; H, L: the two voices' phases
        ld de,$${((TWO_STEPS[0] << 8) | TWO_STEPS[1]).toString(16).padStart(4, "0")}           ; D, E: their steps
Loop:   ld a,h            ; 4
        add a,d           ; 4
        ld h,a            ; 4
        sbc a,a           ; 4   $FF on a carry
        and $10           ; 7
        out ($fe),a       ; 11  voice 1's slot begins
        ld a,l            ; 4
        add a,e           ; 4
        ld l,a            ; 4
        sbc a,a           ; 4
        and $10           ; 7
        out ($fe),a       ; 11  voice 2's slot begins
        ld a,0            ; 7
        nop               ; 4
        nop               ; 4
        nop               ; 4
        nop               ; 4
        out ($fe),a       ; 11  both off
        jp Loop           ; 10
`,
    { entry: "Start" }
  );
  return record(s);
}

/** The lengths of a square wave's halves in 3.5 MHz T-states, from its edges (interpolated inside the
 *  sample that holds each one, so to within about 10 T-states) */
function halfPeriodsInTacts(values: number[]): number[] {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  const edges: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] < mid !== values[i] < mid) edges.push(i - 1 + (mid - values[i - 1]) / (values[i] - values[i - 1]));
  }
  return edges.slice(1).map((e, i) => ((e - edges[i]) * CPU_HZ) / RATE);
}

/** The magnitude of one frequency in a signal (a single DFT bin, mean removed), per sample */
function magnitudeAt(values: number[], hz: number, rate: number): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let re = 0;
  let im = 0;
  values.forEach((v, i) => {
    const w = (2 * Math.PI * hz * i) / rate;
    re += (v - mean) * Math.cos(w);
    im += (v - mean) * Math.sin(w);
  });
  return Math.hypot(re, im) / values.length;
}

// --- One AY chip (article 3): chip 0 written between frames through $FFFD/$BFFD, with the CPU parked;
//     `mode` is NextReg $06 bits 1-0 (0 YM, 1 AY). Recording starts straight after `setup`.
async function psgScene(setup: (s: NextTestSession) => void, frames: number, mode = 0): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, NR08).setNextReg(0x06, (s.nextRegValue(0x06) & 0xfc) | mode);
  s.runFrames(2);
  setup(s);
  return s.startAudio().runFrames(frames).audio();
}
const PSG_TICK_HZ = 1_750_000 / 8; // --- 218,750 counter steps a second
const toneOf = (period: number) => PSG_TICK_HZ / (2 * Math.max(1, period));
const units = (v: number) => (v * 32768) / MIXER_GAIN;
/** A channel's tone: period, fixed volume 15, and R7 with only that channel's tone on */
function tone(s: NextTestSession, channel: number, period: number, r7 = 0x3f & ~(1 << channel)): void {
  ay(s, 2 * channel, period & 0xff);
  ay(s, 2 * channel + 1, period >> 8);
  ay(s, 8 + channel, 0x0f);
  ay(s, 7, r7);
}
/** Crossings of the middle level a second: how often an on/off signal flips (a sample that holds an
 *  edge has a level in between, so counting changed samples would count most edges twice) */
function flipsPerSecond(values: number[]): number {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  let flips = 0;
  for (let i = 1; i < values.length; i++) if (values[i - 1] < mid !== values[i] < mid) flips++;
  return (flips * RATE) / values.length;
}
/** Plateaus: runs of at least `min` equal samples, as their values */
function plateaus(values: number[], min = 4): number[] {
  const out: number[] = [];
  let run = 1;
  for (let i = 1; i <= values.length; i++) {
    if (i < values.length && values[i] === values[i - 1]) run++;
    else {
      if (run >= min) out.push(values[i - 1]);
      run = 1;
    }
  }
  return out;
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

  // --- The mixer (article 7): the beeper switched on from silence, about 104 Hz, recorded from its
  //     first edge. Klive's mix removes the beeper's constant level (a 1.4 Hz high-pass, what the
  //     capacitor after the hardware's converters does), so the square starts 512 units above silence
  //     and settles about zero; the hardware's sum would sit at 1,536 and 2,048 all along.
  it("mixer: Klive centres the beeper: it starts 512 units above silence and settles about zero", async () => {
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
        ld d,${SLOW_D}    ; 7
Outer:  ld b,0            ; 7
Inner:  djnz Inner        ; 13 * 255 + 8
        dec d             ; 4
        jr nz,Outer       ; 12 / 7
        jp Loop           ; 10
`,
      { entry: "Start" }
    );
    const samples = s.startAudio().runFrames(20).audio();
    const left = side(samples, "left");
    const unit = MIXER_GAIN / 32768; // --- one mixer unit as a normalised sample
    const half = Math.round((RATE * SLOW_HALF) / CPU_HZ); // --- samples per half period
    // --- The first half period: the full step above silence (the filter has barely moved)
    const first = left.slice(half / 4, half / 2);
    expect(Math.max(...first) / unit).toBeGreaterThan(500);
    expect(Math.max(...first) / unit).toBeLessThan(513);
    // --- After about 0.3 s: still a 512-unit square, now about zero
    const late = left.slice(Math.round(0.3 * RATE), Math.round(0.3 * RATE) + 4 * half);
    expect(edgeStep(late) / unit).toBeCloseTo(512, -1);
    const mean = late.reduce((a, b) => a + b, 0) / late.length;
    expect(Math.abs(mean / unit)).toBeLessThan(30);
    expect(relativeError(frequency(late, RATE), CPU_HZ / (2 * SLOW_HALF))).toBeLessThan(0.01);
    save("mixer", "beeper-start", samples, { hz: CPU_HZ / (2 * SLOW_HALF) }, Math.round(0.4 * RATE));
  });
  // --- The beeper (article 2): a note's pitch is the loop's length; double the CPU's speed, double the
  //     pitch; contention stretches the loop and lowers it
  it("beeper: the note loop plays 994 Hz at 3.5 MHz, twice that at 7 MHz, and lower with contention on", async () => {
    const at35 = side(await beeperAt(0, false), "left");
    const at7 = side(await beeperAt(1, false), "left");
    const contended = side(await beeperAt(0, true), "left");
    const contendedLow = side(await beeperAt(0, true, 0x6000), "left");
    const f35 = frequency(at35, RATE);
    expect(relativeError(f35, CPU_HZ / (2 * BEEPER_HALF))).toBeLessThan(0.005);
    expect(relativeError(frequency(at7, RATE), (2 * CPU_HZ) / (2 * BEEPER_HALF))).toBeLessThan(0.005);
    const fc = frequency(contended, RATE);
    const fcl = frequency(contendedLow, RATE);
    expect(fcl).toBeLessThan(f35 * 0.99);
    // --- Contention is not a lower note: a pass keeps its 1,760 T-states while the beam is in the border
    //     and is stretched to about 2,000 while the picture's lines are drawn, so the pitch drops and comes
    //     back every frame. (The frame average, `fcl`, is only how many periods fit in 20 ms.)
    const passes = halfPeriodsInTacts(contendedLow);
    const border = passes.filter((t) => t < 1775); // --- (a pass that straddles the picture's edge is in neither)
    const picture = passes.filter((t) => t > 1950);
    expect(border.length).toBeGreaterThan(10);
    expect(picture.length).toBeGreaterThan(10);
    for (const t of border) expect(Math.abs(t - BEEPER_HALF)).toBeLessThan(20);
    const pictureMean = picture.reduce((a, b) => a + b, 0) / picture.length;
    expect(pictureMean).toBeGreaterThan(1980);
    expect(pictureMean).toBeLessThan(2030);
    const extra = {
      hz: f35,
      hz7: frequency(at7, RATE),
      hzContended: fc,
      hzContendedLow: fcl,
      halfTacts: BEEPER_HALF,
      pictureHalfTacts: pictureMean,
      hzPicture: CPU_HZ / (2 * pictureMean)
    };
    const samples = { "note-35": await beeperAt(0, false), "note-7": await beeperAt(1, false), "note-contended": await beeperAt(0, true, 0x6000) };
    for (const [name, v] of Object.entries(samples)) save("beeper", name, v, extra);
  });

  it("beeper: two voices from one bit carry both pitches, 488.3 Hz and 610.4 Hz", async () => {
    const samples = await twoVoices();
    const left = side(samples, "left");
    const passHz = CPU_HZ / TWO_PASS;
    const [f1, f2] = TWO_STEPS.map((st) => (passHz * st) / 256);
    const m1 = magnitudeAt(left, f1, RATE);
    const m2 = magnitudeAt(left, f2, RATE);
    // --- Both notes are there, of similar strength, far above what lies between and around them
    for (const hz of [300, 400, 549, 700, 800]) {
      expect(magnitudeAt(left, hz, RATE), `${hz} Hz`).toBeLessThan(Math.min(m1, m2) / 5);
    }
    expect(m2 / m1).toBeGreaterThan(0.7);
    expect(m2 / m1).toBeLessThan(1.4);
    expect(side(samples, "right")).toEqual(left);
    const spectrum = [...Array(241)].map((_, i) => {
      const hz = 100 + i * 5;
      return [hz, magnitudeAt(left, hz, RATE)];
    });
    save("beeper", "two-voices", samples, { passTacts: TWO_PASS, slotTacts: TWO_SLOT, steps: TWO_STEPS, hz: [f1, f2], spectrum });
  });
  // --- One AY chip (article 3)
  it("psg: A4 is period 249, 439.3 Hz, and one channel at full volume swings 255 units", async () => {
    const samples = await psgScene((s) => tone(s, 0, 249), 3);
    const left = side(samples, "left");
    expect(relativeError(frequency(left, RATE), toneOf(249))).toBeLessThan(0.005);
    expect(units(Math.max(...left))).toBeCloseTo(255, -1);
    expect(units(Math.min(...left))).toBeCloseTo(0, -1);
    save("psg", "a4", samples, { hz: toneOf(249) }, 480);
  });

  it("psg: tone, noise, tone AND noise, and neither (a steady level) on channel A", async () => {
    // --- R7 bit 0 tone A off, bit 3 noise A off (active low); noise period 8, tone period 109
    const set = (r7: number) => (s: NextTestSession) => {
      ay(s, 6, 8);
      tone(s, 0, 109, r7);
    };
    const run = async (r7: number) => side(await psgScene(set(r7), 2), "left");
    const toneOnly = await run(0x3e);
    const noiseOnly = await run(0x37);
    const both = await run(0x36);
    const neither = await run(0x3f);
    expect(relativeError(frequency(toneOnly, RATE), toneOf(109))).toBeLessThan(0.01);
    // --- Where the tone is low for a whole sample, tone AND noise is silent; where it is high, it is noise
    toneOnly.forEach((v, i) => {
      if (v === 0) expect(both[i], `sample ${i}`).toBe(0);
    });
    expect(both.some((v, i) => toneOnly[i] > 0 && v === 0)).toBe(true);
    expect(both.some((v) => units(v) > 250)).toBe(true);
    // --- (the first sample straddles the R7 write)
    expect(new Set(neither.slice(1)).size).toBe(1);
    expect(units(neither[1])).toBeCloseTo(255, -1);
    // --- Noise period 8: 109,375 / 8 = 13,672 shifts a second; the output bit changes on about half
    expect(flipsPerSecond(noiseOnly)).toBeGreaterThan(4000);
    const save2 = (name: string, v: number[]) =>
      save("psg", name, v.map((x) => [x, x]).map(([l, r]) => ({ left: l, right: r })) as unknown as AudioSample[], {}, 480);
    save2("mix-tone", toneOnly);
    save2("mix-noise", noiseOnly);
    save2("mix-both", both);
    save2("mix-neither", neither);
  });

  it("psg: the noise period sets how often the level changes: period 1 against period 31", async () => {
    const run = async (period: number) =>
      side(await psgScene((s) => { ay(s, 6, period); ay(s, 8, 0x0f); ay(s, 7, 0x37); }, 3), "left");
    const fast = await run(1);
    const slow = await run(31);
    // --- 109,375 / 31 = 3,528 shifts a second, about half of them change the bit
    expect(flipsPerSecond(slow)).toBeGreaterThan(1400);
    expect(flipsPerSecond(slow)).toBeLessThan(2200);
    expect(flipsPerSecond(fast)).toBeGreaterThan(5 * flipsPerSecond(slow));
    save("psg", "noise-1", fast.map((v) => ({ left: v, right: v })) as unknown as AudioSample[], {}, 480);
    save("psg", "noise-31", slow.map((v) => ({ left: v, right: v })) as unknown as AudioSample[], { shiftsPerSecond: 109375 / 31 }, 480);
  });

  it("psg: the 16 envelope shapes reduce to 8: shapes 0-3 play as 9, shapes 4-7 as 15", async () => {
    const EP = 20; // --- 20 ticks a step: 91 µs, 32 steps 2.9 ms
    const shapes: number[][] = [];
    for (let shape = 0; shape < 16; shape++) {
      const left = side(
        await psgScene((s) => {
          ay(s, 7, 0x3f);
          ay(s, 11, EP);
          ay(s, 12, 0);
          ay(s, 8, 0x10);
          ay(s, 13, shape);
        }, 1),
        "left"
      );
      shapes.push(left.slice(0, 480));
    }
    for (let shape = 0; shape < 4; shape++) expect(shapes[shape], `shape ${shape}`).toEqual(shapes[9]);
    for (let shape = 4; shape < 8; shape++) expect(shapes[shape], `shape ${shape}`).toEqual(shapes[15]);
    const distinct = new Set(shapes.map((v) => v.join(",")));
    expect(distinct.size).toBe(8);
    const out = process.env.NEXT_AUDIO_SHOTS;
    if (out) {
      mkdirSync(join(out, "psg"), { recursive: true });
      writeFileSync(join(out, "psg", "envelopes.json"), JSON.stringify({ rate: RATE, gain: MIXER_GAIN, stepTicks: EP, shapes }) + "\n");
    }
  });

  it("psg: the envelope climbs in 32 steps in YM mode and in 16 in AY mode, in the same time", async () => {
    const EP = 60; // --- a step every 274 µs, 13 samples
    const run = async (mode: number) =>
      side(
        await psgScene((s) => {
          ay(s, 7, 0x3f);
          ay(s, 11, EP);
          ay(s, 12, 0);
          ay(s, 8, 0x10);
          ay(s, 13, 0x0d); // --- /‾ : one climb, then held at the top
        }, 1, mode),
        "left"
      );
    const ym = await run(0);
    const ayMode = await run(1);
    const climb = (v: number[]) => [...new Set(plateaus(v.slice(0, Math.round((32 * EP * RATE) / PSG_TICK_HZ) + 20)))];
    // --- YM: 32 steps, but the table's lowest entries come in equal pairs (1, 1, 2, 2, 3, 3): 29 levels
    expect(climb(ym).length).toBeGreaterThanOrEqual(27);
    expect(climb(ym).length).toBeLessThanOrEqual(29);
    expect(climb(ayMode).length).toBeLessThanOrEqual(16);
    expect(climb(ayMode).length).toBeGreaterThanOrEqual(14);
    // --- Both end at the top, 255 units, at the same moment
    expect(units(ym[ym.length - 1])).toBeCloseTo(255, -1);
    expect(units(ayMode[ayMode.length - 1])).toBeCloseTo(255, -1);
    const keep = 600;
    save("psg", "climb-ym", ym.map((v) => ({ left: v, right: v })) as unknown as AudioSample[], { stepTicks: EP }, keep);
    save("psg", "climb-ay", ayMode.map((v) => ({ left: v, right: v })) as unknown as AudioSample[], { stepTicks: EP }, keep);
  });

  it("psg: the envelope as a waveform: shapes 8 and 10 at 488 Hz", async () => {
    const run = async (shape: number, ep: number) =>
      side(await psgScene((s) => { ay(s, 7, 0x3f); ay(s, 11, ep); ay(s, 12, 0); ay(s, 8, 0x10); ay(s, 13, shape); }, 3), "left");
    const saw = await run(0x08, 14); // --- 32 steps of 14 ticks: 218,750 / 448 = 488.3 Hz
    const tri = await run(0x0a, 7); //  --- 64 steps of 7 ticks: the same
    for (const v of [saw, tri]) expect(relativeError(frequency(v.slice(100), RATE), PSG_TICK_HZ / 448)).toBeLessThan(0.01);
    save("psg", "buzz-saw", saw.map((v) => ({ left: v, right: v })) as unknown as AudioSample[], { hz: PSG_TICK_HZ / 448 }, 480);
    save("psg", "buzz-tri", tri.map((v) => ({ left: v, right: v })) as unknown as AudioSample[], { hz: PSG_TICK_HZ / 448 }, 480);
  });

  it("psg: a C major chord, C5 E5 G5 on channels A, B, C, each alone and all three", async () => {
    const periods = [209, 166, 140];
    const both = (s: NextTestSession, r7: number) => periods.forEach((p, c) => tone(s, c, p, r7));
    const alone = [];
    for (let c = 0; c < 3; c++) {
      // --- Only this channel is written: a channel whose tone and noise are both off is not silent,
      //     it plays its volume as a steady level, so the others must stay at volume 0
      const v = await psgScene((s) => tone(s, c, periods[c]), 2);
      // --- ABC stereo: A and B on the left, C on the right
      alone.push(side(v, c === 2 ? "right" : "left"));
      expect(relativeError(frequency(alone[c], RATE), toneOf(periods[c])), "ABC"[c]).toBeLessThan(0.01);
    }
    const all = await psgScene((s) => both(s, 0x38), 2);
    // --- The left side is A + B exactly (one sum per sample in the mixer), the right C + B
    const left = side(all, "left");
    left.forEach((v, i) => expect(Math.abs(v - (alone[0][i] + alone[1][i]))).toBeLessThan(2 / 32768));
    const out = process.env.NEXT_AUDIO_SHOTS;
    if (out) {
      writeFileSync(
        join(out, "psg", "chord.json"),
        JSON.stringify({ rate: RATE, gain: MIXER_GAIN, periods, hz: periods.map(toneOf), channels: alone.map((v) => v.slice(0, 960).map((x) => Math.round(x * 32768))) }) + "\n"
      );
    }
  });
});
