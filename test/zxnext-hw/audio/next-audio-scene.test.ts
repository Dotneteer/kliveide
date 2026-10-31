import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createSession, piI2sWord, type AudioSample, type NextTestSession, type PiI2sSamples } from "../../harness/zxnext";
import { ay, edgeStep, frequency, MASTER_CLOCK, relativeError, side, swing } from "./_audio-helpers";

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
 * Hardware (`vendor/next-fpga/3.02.01/src`):
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

// --- TurboSound Next (article 4): a chip select is a $FFFD write of %1 pp 111 cc - bit 7 set, bits 6-5 the
//     chip's pan (bit 6 left, bit 5 right), bits 4-2 = 111, bits 1-0 the chip (11 chip 0, 10 chip 1, 01 chip 2)
const CHIP_CODE = [0b11, 0b10, 0b01];
const PAN_BOTH = 0b11;
const selectChip = (s: NextTestSession, chip: number, pan = PAN_BOTH) => s.out(0xfffd, 0x80 | (pan << 5) | 0x1c | CHIP_CODE[chip]);
/** A TurboSound scene: NextReg $08 with TurboSound on (bit 1), then `setup`, recorded for `frames` */
async function tsScene(setup: (s: NextTestSession) => void, frames = 3, nr08 = NR08 | 0x02): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, nr08);
  s.runFrames(2);
  setup(s);
  s.runFrames(2);
  return s.startAudio().runFrames(frames).audio();
}
/** C5, E5 and G5 as periods, one per chip */
const CHORD = [209, 166, 140];


// --- The DAC chapter (article 5) ----------------------------------------------------------------------
//     soundrive.vhd: four 8-bit channels, reset (and held, `reset_i => reset or not nr_08_dac_en`) at $80,
//     left = A + B, right = C + D. zxnext.vhd ~2385-2391 and ~2614-2620: the port families by NextReg $84
//     bits 1-7 and the channels each port writes (the low byte only); ~2731-2734 every port write needs
//     NextReg $08 bit 3. NextRegs $2C (B), $2D (A and D), $2E (C). dma.vhd ~249-255 and ~424-451: one byte
//     per 32 x prescaler master clocks (875 kHz / prescaler) whatever the CPU speed; ctc_chan.vhd: the CTC
//     counts 28 MHz clocks / 16 (or 256) and reloads its time constant at zero.

/** A 16-step sine about the rest level $80 */
const SINE16 = [...Array(16)].map((_, i) => Math.round(128 + 127 * Math.sin((2 * Math.PI * i) / 16)));
/** One DAC channel's level in Klive's mix (about $80) as mixer units on one side: x 4 */
const dacUnits = (v: number) => units(v) / 4;

/** A parked CPU, NextReg $08 = `nr08`; `setup` writes ports and NextRegs; then `frames` frames recorded */
async function dacScene(setup: (s: NextTestSession) => void, frames = 2, nr08 = NR08): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, nr08);
  setup(s);
  s.runFrames(2);
  return s.startAudio().runFrames(frames).audio();
}

// --- A staircase: eight levels written to port $DF, one every 3,500 T-states (1 ms at 3.5 MHz)
const STAIR = [128, 192, 255, 192, 128, 64, 0, 64];
const STAIR_N1 = 255;
const STAIR_N2 = 10;
async function stair(): Promise<AudioSample[]> {
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
        and $07           ; 7
        ld l,a            ; 4
        ld b,${STAIR_N1}  ; 7
Dly1:   djnz Dly1         ; 13 * (n - 1) + 8
        ld b,${STAIR_N2}  ; 7
Dly2:   djnz Dly2         ; 13 * (n - 1) + 8
        nop               ; 4
        jp Loop           ; 10
        .org $9000
Table:  .defb ${STAIR.join(",")}
`,
    { entry: "Start" }
  );
  return record(s);
}
const STAIR_TACTS = 7 + 11 + 4 + 4 + 7 + 4 + 7 + 13 * (STAIR_N1 - 1) + 8 + 7 + 13 * (STAIR_N2 - 1) + 8 + 4 + 10;

/** The 16-step sine from a CPU loop to port $DF, 218 T-states a step, at CPU speed `speed` (NextReg $07) */
async function cpuSine(speed: number): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,${speed}
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
Table:  .defb ${SINE16.join(",")}
`,
    { entry: "Start" }
  );
  return record(s);
}

// --- The DMA: a block from memory to port $DF (fixed), burst mode, prescaler P, auto restart
const DMA_P = 55;
const dmaWrites = (a: number, len: number, p: number, restart: boolean) => [
  0x83, // --- disable
  0x7d, a & 0xff, a >> 8, len & 0xff, len >> 8, // --- WR0: A -> B, port A start and length follow
  0x14, // --- WR1: port A memory, incrementing
  0x68, 0x21, p, // --- WR2: port B I/O, fixed, timing byte "01" then the prescaler
  0xcd, 0xdf, 0x00, // --- WR4: burst mode, port B address $00DF
  restart ? 0xa2 : 0x82, // --- WR5: auto restart
  0xcf, // --- load
  0x87 // --- enable
];
async function dmaSine(speed: number): Promise<AudioSample[]> {
  const s = await session();
  const prog = dmaWrites(0xc000, 16, DMA_P, true);
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,${speed}
        nextreg $08,$${NR08.toString(16)}
        ld hl,DmaProg
        ld b,16           ; the 16 bytes from DmaProg
Send:   ld a,(hl)
        out ($6b),a       ; the zxnDMA's port
        inc hl
        djnz Send
Park:   jr Park
DmaProg:
        .defb $83                 ; disable
        .defb $7d,$00,$c0,16,0    ; WR0: A to B, from $C000, 16 bytes
        .defb $14                 ; WR1: port A is memory, incrementing
        .defb $68,$21,${DMA_P}         ; WR2: port B is I/O, fixed; prescaler ${DMA_P}
        .defb $cd,$df,$00         ; WR4: burst mode, port B = $00DF
        .defb $a2                 ; WR5: auto restart
        .defb $cf,$87             ; load, enable
        .org $c000
        .defb ${SINE16.join(",")}
`,
    { entry: "Start" }
  );
  expect(Array.from(s.peekBytes(s.symbol("DmaProg"), prog.length)), "the listing is dmaWrites").toEqual(prog);
  return record(s);
}

// --- The CTC: channel 0, timer, prescaler 16, time constant 109, an interrupt at every zero count;
//     the interrupt routine writes the next step of the sine to port $DF
const CTC_TC = 109;
async function ctcSine(speed: number): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,${speed}
        nextreg $08,$${NR08.toString(16)}
        ld a,$be
        ld i,a
        im 2
        nextreg $22,$04          ; ULA and line interrupts off
        nextreg $c0,$a1          ; hardware IM 2, vectors from $A0
        nextreg $c9,$ff          ; clear the CTC status
        ld bc,$183b
        ld a,$85                 ; interrupt, timer, prescaler 16, time constant follows, control word
        out (c),a
        ld a,${CTC_TC}
        out (c),a
        ei
Park:   jr Park
Isr:    push af
        push hl
        ld hl,(Ptr)
        ld a,(hl)
        out ($df),a
        ld a,l
        inc a
        and $0f
        ld l,a
        ld (Ptr),hl
        pop hl
        pop af
        ei
        reti
Ptr:    .defw Table
        .org $9000
Table:  .defb ${SINE16.join(",")}
`,
    { entry: "Start" }
  );
  s.pokeWord(0xbe00 + 0xa6, s.symbol("Isr"));
  return record(s);
}

// --- A drum hit: 2,048 samples of noise that dies away, played once by the DMA at prescaler 55
const DRUM_LEN = 2048;
const DRUM = (() => {
  let x = 0x1234;
  return [...Array(DRUM_LEN)].map((_, i) => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const noise = ((x >> 16) & 0xff) - 128;
    return Math.max(0, Math.min(255, Math.round(128 + noise * Math.exp(-i / 380))));
  });
})();


// --- The Pi chapter (article 6) ------------------------------------------------------------------------
//     zxnext.vhd ~2239-2246: NextReg $A2 bits 7-6 enable left / right, 3-2 mute, 0 to EAR; ~2314-2315 a side
//     whose enable is clear takes the other side's word, and off, muted or routed to EAR it is the rest word
//     $200; ~2317-2330 the EAR bit rises at L(9..8) or R(9..8) = "11", falls at "00". i2s.vhd: the top 10 of
//     13 bits, sign inverted. i2s_receive.vhd: the left word latched at WS rising (mid-period), the right at
//     WS falling (the period's end). ~6449: the MIC line is port $FE bit 3 xor the tape input xor the EAR bit.

/** A parked CPU, NextReg $A2 = `a2`, the stream connected, then `frames` frames recorded after `settle` */
async function piScene(a2: number, stream: PiI2sSamples, frames = 2, settle = 2): Promise<AudioSample[]> {
  const s = await session();
  await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
  s.setNextReg(0x08, NR08).setNextReg(0xa2, a2).piI2sConnect(stream);
  s.runFrames(settle);
  return s.startAudio().runFrames(frames).audio();
}
const PI_AMP = 32000;
/** Left a 1,000 Hz sine, right a 1,500 Hz one */
const PI_TWO: PiI2sSamples = {
  rate: RATE,
  sample: (k) => [Math.round(PI_AMP * Math.sin((2 * Math.PI * 1000 * k) / RATE)), Math.round(PI_AMP * Math.sin((2 * Math.PI * 1500 * k) / RATE))]
};
/** The Pi's word swing in mixer units: (s >> 6) per step */
const piUnits = (v: number) => units(v);

/** A slow 250 Hz sine with noise that repeats every period (192 samples), the same on both sides */
const EAR_PERIOD = RATE / 250;
const EAR_NOISE = (() => {
  let x = 0x2468;
  return [...Array(EAR_PERIOD)].map(() => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return ((x >> 16) % 14001) - 7000;
  });
})();
const earWave = (k: number) => {
  const p = ((k % EAR_PERIOD) + EAR_PERIOD) % EAR_PERIOD;
  return Math.max(-32768, Math.min(32767, Math.round(26000 * Math.sin((2 * Math.PI * p) / EAR_PERIOD) + EAR_NOISE[p])));
};
/**
 * The EAR bit by the hardware's rule on a stream with the same word on both sides: at each sample's
 * mid-period the left latch takes sample k, at its end the right latch takes it too, and after each latch
 * the bit rises at L(9..8) or R(9..8) = "11" and falls at "00". Between the two latches the left word is a
 * sample ahead of the right, so a rising wave that steps from just below the middle ("01") to just above
 * it ("10") reads "11": the bit rises at the upward zero crossing.
 */
function earOf(values: number[], start = false): boolean[] {
  let ear = start;
  let l = 0x200, r = 0x200;
  const step = () => {
    const t = ((l >> 8) | (r >> 8)) & 3;
    if (t === 3) ear = true;
    else if (t === 0) ear = false;
  };
  return values.map((v) => {
    l = piI2sWord(v);
    step();
    r = piI2sWord(v);
    step();
    return ear;
  });
}
const edgesOf = (b: boolean[]) => b.map((e, i) => (i > 0 && e !== b[i - 1] ? i : -1)).filter((i) => i >= 0);


// --- The last chapter (article 8): Klive's own audio path. zxnext-audio-mixer.c: one sample every
//     28 MHz / rate clocks, the schedule carried across frame ends; the beeper and the AY averaged over
//     each sample's window (the jack and the speaker), the sum's value at the sample's moment for HDMI.

/** A beeper tone: port $FE bit 4 flipped every 44 + 13 x (n - 1) T-states, on output `output` */
async function beeperTone(n: number, output: "jack" | "hdmi"): Promise<AudioSample[]> {
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
        ld b,${n}         ; 7
Dly:    djnz Dly          ; 13 * (n - 1) + 8
        jp Loop           ; 10
`,
    { entry: "Start" }
  );
  s.audioOutput(output);
  return record(s);
}
const TONE_N = 12;
const TONE_HALF = 44 + 13 * (TONE_N - 1); // --- 187 T-states: 9,358 Hz

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
  // --- TurboSound Next (article 4)
  it("turbosound: off, only the selected chip plays; on, all three; off again, the chip selected last", async () => {
    const play = (s: NextTestSession) => CHORD.forEach((p, chip) => { selectChip(s, chip); tone(s, 1, p); });
    const hz = (v: AudioSample[]) => [toneOf(209), toneOf(166), toneOf(140)].map((f) => magnitudeAt(side(v, "left"), f, RATE));
    const on = await tsScene(play);
    // --- With TurboSound off from the start, the select writes do nothing: chip 0 gets all three setups,
    //     the last one wins (period 140), and only chip 0 is heard
    const off = await tsScene(play, 3, NR08);
    // --- TurboSound on, the chord set up (chip 2 selected last), then switched off: chip 2 alone plays on
    const frozen = await tsScene((s) => { play(s); s.setNextReg(0x08, NR08); });
    const [onM, offM, frozenM] = [on, off, frozen].map(hz);
    const strong = Math.max(...onM) / 3;
    expect(onM.every((m) => m > strong), "on: all three notes").toBe(true);
    expect(offM.map((m) => m > strong)).toEqual([false, false, true]);
    expect(frozenM.map((m) => m > strong)).toEqual([false, false, true]);
    expect(Math.max(...side(on, "left").map(units))).toBeLessThanOrEqual(3 * 255 + 2);
    save("turbosound", "on", on, { periods: CHORD }, 480);
    save("turbosound", "off", off, { periods: CHORD }, 480);
    save("turbosound", "frozen", frozen, { periods: CHORD }, 480);
  });

  it("turbosound: each chip panned to its own place: chip 0 left, chip 1 both sides, chip 2 right", async () => {
    const pans = [0b10, 0b11, 0b01];
    const v = await tsScene((s) => CHORD.forEach((p, chip) => { selectChip(s, chip, pans[chip]); tone(s, 1, p); }));
    const at = (which: "left" | "right") => CHORD.map((p) => magnitudeAt(side(v, which), toneOf(p), RATE));
    const strong = Math.max(...at("left"), ...at("right")) / 3;
    expect(at("left").map((m) => m > strong)).toEqual([true, true, false]);
    expect(at("right").map((m) => m > strong)).toEqual([false, true, true]);
    save("turbosound", "panned", v, { periods: CHORD, pans }, 480);
  });

  it("turbosound: nine channels at full volume stay within 3 x 510 = 1,530 units a side in ABC stereo", async () => {
    // --- Three chords of three notes: chip 0 C major, chip 1 F major, chip 2 G major, an octave apart
    const periods = [
      [418, 332, 279], // C4 E4 G4
      [313, 248, 209], // F4 A4 C5
      [140, 111, 93] //   G5 B5 D6
    ];
    const v = await tsScene((s) =>
      periods.forEach((ps, chip) => {
        selectChip(s, chip);
        ps.forEach((p, c) => tone(s, c, p, 0x38));
      })
    );
    for (const which of ["left", "right"] as const) {
      const u = side(v, which).map(units);
      expect(Math.max(...u), which).toBeLessThanOrEqual(1530 + 2);
      expect(Math.max(...u), which).toBeGreaterThan(900);
    }
    save("turbosound", "nine", v, { periods }, 960);
  });

  it("dacs: a DAC holds each level it is written until the next write: eight steps, 1 ms each", async () => {
    expect(STAIR_TACTS).toBe(3500);
    const v = await stair();
    const left = side(v, "left");
    expect(side(v, "right"), "port $DF writes A and D: both sides").toEqual(left);
    // --- plateaus of 48 samples (1 ms), at (level - 128) x 4 units: $DF writes A, B stays at $80
    const levels = plateaus(left.map((x) => Math.round(dacUnits(x))), 30);
    for (const l of STAIR.map((x) => x - 128)) expect(levels, `a step at ${l}`).toContain(l);
    save("dacs", "stair", v, { steps: STAIR, stepTacts: STAIR_TACTS, cpuHz: CPU_HZ }, 480);
  });

  it("dacs: Covox's two ports reach one side each, Specdrum's one port both, and every port needs NextReg $08 bit 3", async () => {
    const left = (v: AudioSample[]) => swing(side(v, "left").map(dacUnits));
    const right = (v: AudioSample[]) => swing(side(v, "right").map(dacUnits));
    const covoxLeft = await dacScene((s) => s.out(0x000f, 0xff));
    expect([left(covoxLeft), right(covoxLeft)], "$0F: DAC B, left only").toEqual([0, 0]); // --- settled: no swing
    const at = (v: AudioSample[], which: "left" | "right") => Math.round(dacUnits(side(v, which)[100]));
    expect([at(covoxLeft, "left"), at(covoxLeft, "right")], "$0F = $FF: left +127").toEqual([127, 0]);
    const covoxRight = await dacScene((s) => s.out(0x004f, 0x00));
    expect([at(covoxRight, "left"), at(covoxRight, "right")], "$4F = $00: right -128").toEqual([0, -128]);
    const spec = await dacScene((s) => s.out(0x00df, 0xc0));
    expect([at(spec, "left"), at(spec, "right")], "$DF: A and D").toEqual([64, 64]);
    const gs = await dacScene((s) => s.out(0x00b3, 0xc0));
    expect([at(gs, "left"), at(gs, "right")], "$B3: B and C").toEqual([64, 64]);
    const anyHigh = await dacScene((s) => s.out(0x12df, 0xc0));
    expect(at(anyHigh, "left"), "only the low byte counts").toBe(64);
    const off = await dacScene((s) => s.out(0x00df, 0xc0), 2, NR08 & ~0x08);
    expect([at(off, "left"), at(off, "right")], "DACs off: held at rest").toEqual([0, 0]);
    const noSpec = await dacScene((s) => s.setNextReg(0x84, 0x7f).out(0x00df, 0xc0));
    expect(at(noSpec, "left"), "$84 bit 7 off: $DF ignored").toBe(0);
    // --- $FB: Pentagon's mono port (A and D) unless Soundrive mode 2 is on; then it is mode 2's D
    const pentagon = await dacScene((s) => s.setNextReg(0x84, 0xfb).out(0x00fb, 0xc0));
    expect([at(pentagon, "left"), at(pentagon, "right")], "$FB, mode 2 off: A and D").toEqual([64, 64]);
    const sd2 = await dacScene((s) => s.out(0x00fb, 0xc0));
    expect([at(sd2, "left"), at(sd2, "right")], "$FB, mode 2 on: D only").toEqual([0, 64]);
    // --- the NextReg mirrors
    const nrB = await dacScene((s) => s.setNextReg(0x2c, 0xc0));
    const nrAD = await dacScene((s) => s.setNextReg(0x2d, 0xc0));
    const nrC = await dacScene((s) => s.setNextReg(0x2e, 0xc0));
    expect([nrB, nrAD, nrC].map((v) => [at(v, "left"), at(v, "right")]), "$2C B, $2D A+D, $2E C").toEqual([
      [64, 0],
      [64, 64],
      [0, 64]
    ]);
  });

  it("dacs: Covox stereo: two tones, one on each side, from ports $0F (left) and $4F (right)", async () => {
    // --- every step writes the 16-step sine to $0F (DAC B) and a 32-step sine, an octave lower, to $4F (DAC C)
    const SINE32 = [...Array(32)].map((_, i) => Math.round(128 + 127 * Math.sin((2 * Math.PI * i) / 32)));
    const s = await session();
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $07,0
        nextreg $08,$${NR08.toString(16)}
        ld hl,Left
        ld de,Right
Loop:   ld a,(hl)         ; 7
        out ($0f),a       ; 11
        ld a,(de)         ; 7
        out ($4f),a       ; 11
        ld a,l            ; 4
        inc a             ; 4
        and $0f           ; 7
        ld l,a            ; 4
        ld a,e            ; 4
        inc a             ; 4
        and $1f           ; 7
        ld e,a            ; 4
        ld b,9            ; 7
Dly:    djnz Dly          ; 13 * 8 + 8
        jp Loop           ; 10
        .org $9000
Left:   .defb ${SINE16.join(",")}
        .org $9100
Right:  .defb ${SINE32.join(",")}
`,
      { entry: "Start" }
    );
    const step = 7 + 11 + 7 + 11 + 4 + 4 + 7 + 4 + 4 + 4 + 7 + 4 + 7 + 13 * 8 + 8 + 10; // --- 203 T-states
    const v = record(s);
    const l = side(v, "left");
    const r = side(v, "right");
    expect(relativeError(frequency(l, RATE), CPU_HZ / step / 16), "left: 16 steps").toBeLessThan(0.01);
    expect(relativeError(frequency(r, RATE), CPU_HZ / step / 32), "right: 32 steps, an octave down").toBeLessThan(0.01);
    expect(magnitudeAt(r, CPU_HZ / step / 16, RATE), "the left tone is not on the right").toBeLessThan(magnitudeAt(l, CPU_HZ / step / 16, RATE) / 20);
    save("dacs", "covox", v, { stepTacts: step, cpuHz: CPU_HZ }, 480);
  });

  it("dacs: a CPU loop plays twice as high at 7 MHz; the DMA and the CTC play the same at every CPU speed", async () => {
    const cpu = [await cpuSine(0), await cpuSine(1)];
    const dma = [await dmaSine(0), await dmaSine(1)];
    const ctc = [await ctcSine(0), await ctcSine(2)];
    const hz = (v: AudioSample[]) => frequency(side(v, "left"), RATE);
    const cpuHz = CPU_HZ / DAC_PERIOD / 16; // --- 1,003.4 Hz
    expect(relativeError(hz(cpu[0]), cpuHz), "CPU loop, 3.5 MHz").toBeLessThan(0.01);
    expect(relativeError(hz(cpu[1]), 2 * cpuHz), "CPU loop, 7 MHz: an octave up").toBeLessThan(0.01);
    // --- the DMA: 32 x P master clocks a byte, plus the few clocks a byte's own transfer takes
    const dmaHz = MASTER_CLOCK / (32 * DMA_P) / 16; // --- 994.3 Hz
    //     to get the bus back in burst mode (DMA-020): 968 Hz at 3.5 MHz, 964 Hz at 7 MHz, against 994 Hz
    for (const [i, v] of dma.entries()) {
      expect(hz(v), `DMA at speed ${i}: never faster than 875 kHz / P`).toBeLessThan(dmaHz);
      expect(relativeError(hz(v), dmaHz), `DMA at speed ${i}: within a few clocks a byte`).toBeLessThan(0.04);
    }
    expect(relativeError(hz(dma[1]), hz(dma[0])), "the CPU's speed hardly matters to the DMA").toBeLessThan(0.01);
    const ctcHz = MASTER_CLOCK / (16 * CTC_TC) / 16; // --- 1,003.4 Hz
    for (const [i, v] of ctc.entries()) expect(relativeError(hz(v), ctcHz), `CTC at speed ${i}`).toBeLessThan(0.01);
    save("dacs", "cpu35", cpu[0], { hz: hz(cpu[0]) }, 480);
    save("dacs", "cpu7", cpu[1], { hz: hz(cpu[1]) }, 480);
    save("dacs", "dma35", dma[0], { hz: hz(dma[0]), prescaler: DMA_P }, 480);
    save("dacs", "dma7", dma[1], { hz: hz(dma[1]), prescaler: DMA_P }, 480);
    save("dacs", "ctc35", ctc[0], { hz: hz(ctc[0]), tc: CTC_TC }, 480);
    save("dacs", "ctc14", ctc[1], { hz: hz(ctc[1]), tc: CTC_TC }, 480);
  });

  it("dacs: a drum hit, 2,048 samples played once by the DMA at about 15,900 samples a second", async () => {
    const s = await session();
    await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
    s.setNextReg(0x08, NR08);
    s.poke(0xc000, DRUM);
    s.runFrames(2).startAudio();
    for (const b of dmaWrites(0xc000, DRUM_LEN, DMA_P, false)) s.out(0x6b, b);
    const v = s.runFrames(8).audio();
    const u = side(v, "left").map(dacUnits);
    const start = u.findIndex((x) => Math.abs(x) > 2);
    const lengthMs = (DRUM_LEN * 32 * DMA_P) / MASTER_CLOCK * 1000; // --- 128.7 ms
    const peak = (from: number, ms: number) => Math.max(...u.slice(from, from + (ms * RATE) / 1000).map(Math.abs));
    expect(peak(start, 10), "loud at first").toBeGreaterThan(60);
    expect(peak(start + (100 * RATE) / 1000, 10), "quiet 100 ms later").toBeLessThan(peak(start, 10) / 4);
    const after = start + Math.round(((lengthMs + 3) * RATE) / 1000);
    expect(swing(u.slice(after, after + 200)), "then the last level holds").toBe(0);
    save("dacs", "drum", v, { lengthMs, prescaler: DMA_P, samples: DRUM_LEN, from: start }, Math.min(v.length, start + 7200));
  });

  it("pi: NextReg $A2 chooses stereo, mono from the left or the right word, and mutes a side", async () => {
    const at = (v: AudioSample[], which: "left" | "right", hz: number) => magnitudeAt(side(v, which), hz, RATE);
    const modes = { stereo: 0xc0, monoLeft: 0x80, monoRight: 0x40, muteLeft: 0xc8 } as const;
    const got: Record<string, AudioSample[]> = {};
    for (const [name, a2] of Object.entries(modes)) got[name] = await piScene(a2, PI_TWO);
    const has = (v: AudioSample[], which: "left" | "right", hz: number) => at(v, which, hz) > 0.01;
    const expectSides = (name: string, left: number | null, right: number | null) => {
      const v = got[name];
      for (const [which, hz] of [["left", left], ["right", right]] as const) {
        for (const f of [1000, 1500]) expect(has(v, which, f), `${name} ${which} ${f} Hz`).toBe(hz === f);
      }
    };
    expectSides("stereo", 1000, 1500);
    expectSides("monoLeft", 1000, 1000);
    expectSides("monoRight", 1500, 1500);
    expectSides("muteLeft", null, 1500);
    expect(swing(side(got.muteLeft, "left")), "muted: the rest word, flat").toBe(0);
    // --- one word step is one mixer unit: a full sine swings 2 x 32,000 / 64 = 1,000 units
    expect(swing(side(got.stereo, "left").map(piUnits))).toBeCloseTo(1000, -1);
    for (const [name, v] of Object.entries(got)) save("pi-audio", name, v, { a2: modes[name as keyof typeof modes] }, 240);
  });

  it("pi: each sample's left word lands half a sample period before its right word", async () => {
    // --- 1,000 samples a second, alternating +-20,000: the left side steps half a millisecond before the right
    const v = await piScene(0xc0, { rate: 1000, sample: (k) => (k % 2 ? [20000, 20000] : [-20000, -20000]) }, 3);
    const steps = (x: number[]) => x.map((y, i) => (i > 0 && Math.abs(y - x[i - 1]) > 0.01 ? i : -1)).filter((i) => i >= 0);
    const l = steps(side(v, "left"));
    const r = steps(side(v, "right"));
    expect(l.length).toBeGreaterThan(20);
    const firstR = r.find((i) => i > l[0])!;
    expect(firstR - l[0], "24 samples: half of 1 ms at 48 kHz").toBeGreaterThanOrEqual(23);
    expect(firstR - l[0]).toBeLessThanOrEqual(25);
    expect(l[1] - l[0], "one step a millisecond").toBeCloseTo(48, -1);
    save("pi-audio", "latch", v, { rate: 1000 }, 480);
  });

  it("pi: routed to EAR, a noisy slow wave becomes a clean one-bit signal by the hysteresis", async () => {
    const v = await piScene(0xc1, { rate: RATE, sample: (k) => [earWave(k), earWave(k)] }, 2, 40);
    const u = side(v, "left").map(units);
    // --- the Pi's word leaves the mixer while routed; the EAR bit is heard on the MIC line (128 units)
    //     (an edge inside a sample splits its step over two samples: one edge, not two)
    const edges: number[] = [];
    u.forEach((y, i) => {
      if (i > 1 && Math.abs(y - u[i - 2]) > 100 && (edges.length === 0 || i - edges[edges.length - 1] > 3)) edges.push(i - 1);
    });
    const ms = (u.length / RATE) * 1000;
    expect(edges.length / ms, "two edges per 4 ms period, no chatter").toBeCloseTo(0.5, 1);
    // --- the captured edges sit where the hysteresis rule puts them: find the stream's phase
    let best = { shift: 0, miss: Infinity };
    for (let shift = 0; shift < EAR_PERIOD; shift++) {
      const sim = earOf([...Array(u.length + EAR_PERIOD)].map((_, k) => earWave(k + shift))).slice(EAR_PERIOD);
      const simEdges = edgesOf(sim);
      const miss = edges.reduce((t, e) => t + Math.min(...simEdges.map((x) => Math.abs(x - e))), 0);
      if (miss < best.miss) best = { shift, miss };
    }
    expect(best.miss / edges.length, "every edge within a sample or two of the rule").toBeLessThan(2.5);
    // --- a plain threshold at zero would have switched many more times on the same wave
    const plain = [...Array(u.length)].map((_, k) => earWave(k + best.shift + EAR_PERIOD) >= 0);
    const plainEdges = plain.filter((e, i) => i > 0 && e !== plain[i - 1]).length;
    expect(plainEdges, "a plain threshold chatters").toBeGreaterThan(2 * edges.length);
    // --- a clean sine shows where the two thresholds really are: up at the zero crossing, down at -16,384
    const clean = (k: number) => Math.round(26000 * Math.sin((2 * Math.PI * k) / EAR_PERIOD));
    const ce = edgesOf(earOf([...Array(2 * EAR_PERIOD)].map((_, k) => clean(k)), true));
    const fallAt = Math.round((EAR_PERIOD * (Math.PI + Math.asin(16384 / 26000))) / (2 * Math.PI));
    expect(ce[0], "falls once both words are below a quarter").toBeGreaterThanOrEqual(fallAt - 1);
    expect(ce[0]).toBeLessThanOrEqual(fallAt + 1);
    expect(ce[1], "rises at the upward zero crossing").toBe(EAR_PERIOD);
    const samples = [...Array(u.length)].map((_, k) => earWave(k + best.shift));
    save("pi-audio", "ear", v, { shift: best.shift, period: EAR_PERIOD, input: samples }, 960);
  });

  it("pi: a tone the Pi streams to EAR reads back from port $FE bit 6, as a tape would", async () => {
    const s = await session();
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld hl,0
        ld d,0
        ld bc,20000
Loop:   in a,($fe)
        and $40
        cp d
        jr z,Same
        ld d,a
        inc hl
Same:   dec bc
        ld a,b
        or c
        jr nz,Loop
        ld (Edges),hl
Done:   jr Done
Edges:  .defw 0
`,
      { entry: "Start" }
    );
    s.setNextReg(0xa2, 0xc1).piI2sConnect({ rate: RATE, sample: (k) => (Math.floor(k / 24) % 2 ? [32000, 32000] : [-32000, -32000]) });
    const t0 = s.tacts;
    s.runTo("Done");
    const seconds = (s.tacts - t0) / CPU_HZ;
    const edges = s.peekWord(s.symbol("Edges"));
    expect(relativeError(edges / seconds, 2000), "a 1,000 Hz square: 2,000 edges a second").toBeLessThan(0.03);
  });


  it("klive: a frame carries 972 or 973 samples, and the fraction of a sample carries to the next", async () => {
    const s = await session();
    await s.loadCode(" .org $8000\nStart: di\nPark: jr Park", { entry: "Start" });
    s.runFrames(2).startAudio();
    const counts: number[] = [];
    for (let f = 0; f < 40; f++) {
      const before = s.audio().length;
      s.runFrames(1);
      counts.push(s.audio().length - before);
    }
    // --- the frame in 28 MHz clocks, from the counts' long-run average
    const perFrame = counts.reduce((a, b) => a + b, 0) / counts.length;
    const lo = Math.floor(perFrame);
    expect(new Set(counts), "only two sizes").toEqual(new Set([lo, lo + 1]));
    // --- 128K timing: 456 x 311 dots of 7 MHz = 567,264 clocks; x 48,000 / 28 MHz = 972.45
    const exact = (456 * 311 * 4 * RATE) / MASTER_CLOCK;
    expect(lo).toBe(Math.floor(exact));
    // --- every prefix of frames has within one sample of the exact total: nothing is lost
    let total = 0;
    counts.forEach((c, i) => {
      total += c;
      expect(Math.abs(total - (i + 1) * exact), `after ${i + 1} frames`).toBeLessThan(1);
    });
    const out = process.env.NEXT_AUDIO_SHOTS;
    if (out) {
      mkdirSync(join(out, "klive-audio"), { recursive: true });
      writeFileSync(join(out, "klive-audio", "carry.json"), JSON.stringify({ rate: RATE, exact, counts }) + "\n");
    }
  });

  it("klive: averaging the window keeps a 9,358 Hz beeper tone clean; point sampling adds an alias at 1,209 Hz", async () => {
    const f = CPU_HZ / (2 * TONE_HALF); // --- 9,358 Hz
    const alias = 5 * f - RATE; // --- the fifth harmonic, 46,791 Hz, folds back to 1,209 Hz
    expect(Math.round(alias)).toBe(-1209);
    const jack = await beeperTone(TONE_N, "jack");
    const hdmi = await beeperTone(TONE_N, "hdmi");
    const mag = (v: AudioSample[], hz: number) => magnitudeAt(side(v, "left"), Math.abs(hz), RATE);
    // --- each output has its own gain (12.8 the jack, 7.34 HDMI): compare each alias with its own tone
    const ratio = (v: AudioSample[], hz: number) => mag(v, hz) / mag(v, f);
    expect(ratio(hdmi, alias), "point sampling: an alias a fifth of the tone").toBeGreaterThan(0.15);
    expect(ratio(jack, alias), "averaged: the alias almost gone").toBeLessThan(0.01);
    // --- an average is a rough filter: the third harmonic's alias, 28,075 Hz folded to 19,925 Hz, is
    //     only about halved
    const third = 3 * f - RATE;
    expect(ratio(jack, third) / ratio(hdmi, third), "the 19,925 Hz alias: about half").toBeGreaterThan(0.4);
    expect(ratio(jack, third) / ratio(hdmi, third)).toBeLessThan(0.75);
    save("klive-audio", "jack", jack, { hz: f, alias: -alias, halfTacts: TONE_HALF, cpuHz: CPU_HZ }, 2880);
    save("klive-audio", "hdmi", hdmi, { hz: f, alias: -alias, halfTacts: TONE_HALF, cpuHz: CPU_HZ }, 2880);
  });

});
