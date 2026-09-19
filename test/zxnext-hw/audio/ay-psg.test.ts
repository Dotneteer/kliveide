import { describe, expect, it } from "vitest";

import { createSession, type AudioSample, type NextTestSession } from "../../harness/zxnext";
import {
  ALIGNED_RATE,
  MASTER_CLOCK,
  PSG_TICK,
  VOL_TABLE_AY,
  VOL_TABLE_YM,
  ay,
  ayRead,
  frequency,
  highFraction,
  magnitude,
  relativeError,
  runs,
  side,
  swing,
  toneHz
} from "./_audio-helpers";

/*
 * AY / TurboSound (catalogue AY-001 - AY-011, AY-013 - AY-019; AY-012 is `ay-stereo-mode.test.ts`).
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~2603-2604: $FFFD = A15-14 "11", $BFFD = "10", both A2 = 1, A1-0 = "01", gated by the
 *   internal port enable bit 16 ($84 bit 0); ~2605 $BFF5 (A3 = 0) reads the chip id and register
 *   number; ~6325 the PSGs are held in reset while $06 bits 1-0 = 11; `aymode_i` = $06 bit 0
 *   (0 = YM, 1 = AY); `turbosound_en_i` = $08 bit 1; `mono_mode_i` = $09 bits 7-5 (PSG 2..0).
 * - audio/turbosound.vhd ~120-140: with TurboSound enabled, a $FFFD write %1pp111cc selects chip cc
 *   (10 = 1, 01 = 2, else 0) and sets its left/right enables pp; only values with bits 7-5 = 000
 *   select a register. ~140-230: a PSG outputs while it is selected or TurboSound is on (the selected
 *   chip is frozen when TurboSound goes off). Mono: L = R = A + B + C.
 * - audio/ym2149.vhd:
 *   - register address 5 bits; writes to 16-31 are dropped; reads of 16-31 are $FF in YM mode and
 *     register n & 15 in AY mode; in AY mode R1/R3/R5/R13 read 4 bits and R6/R8/R9/R10 5 bits.
 *     R14/R15 read the (pulled-up, $FF) port while R7 bit 6/7 makes it an input.
 *   - tone period = R(2n+1) bits 3-0 & R(2n); the output toggles every max(1, period) ticks.
 *   - noise period = R6 bits 4-0, max(1, period); the 17-bit LFSR shifts every 2 * period ticks,
 *     feeding back bit 0 xor bit 2.
 *   - mixer: channel = (R7 tone-off bit or tone) and (R7 noise-off bit or noise); level from R8-R10
 *     bits 3-0 (index 2L+1, 0 for L = 0) or the 5-bit envelope when bit 4 is set.
 *   - envelope: period R11/R12 (max 1), 32 steps; an R13 write restarts it and its first step follows
 *     at once (`env_ena` is set by the restart), so the starting level (31 or 0) is not held.
 *   - output tables `volTableYm` (32 entries) / `volTableAy` (16, indexed by level bits 4-1).
 */

const RATE = 48_000;
const NR08 = 0x10; // --- internal speaker on; DACs, TurboSound off; ABC
const NR08_TS = 0x12; // --- the same with TurboSound on
const YM = 0x00;
const AY = 0x01;

// --- R7 mixer values (bits 6-7 = port directions, kept 0 unless a test needs them)
const TONE_ONLY = [0x3e, 0x3d, 0x3b]; // --- per channel: that tone on, every noise off
const NOISE_ONLY = [0x37, 0x2f, 0x1f];
const TONE_AND_NOISE = [0x36, 0x2d, 0x1b];
const MIXER_OFF = 0x3f; // --- every tone and noise off: each channel outputs its level as DC

/** Which side carries a channel alone in ABC mode (A left, B centre, C right). */
const CHANNEL_SIDE: Array<"left" | "right"> = ["left", "left", "right"];

/** A parked CPU and the PSG set up: `$06` mode, `$08`. */
async function psg(opts: { rate?: number; mode?: number; nr08?: number } = {}): Promise<NextTestSession> {
  const s = await createSession({ audioSampleRate: opts.rate ?? RATE });
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  s.setNextReg(0x06, opts.mode ?? YM).setNextReg(0x08, opts.nr08 ?? NR08);
  return s;
}

/** Plays a tone on `channel` of the selected chip: period, level 15, that tone only. */
function tone(s: NextTestSession, channel: number, period: number, volume = 0x0f): NextTestSession {
  ay(s, 2 * channel, period & 0xff);
  ay(s, 2 * channel + 1, period >> 8);
  ay(s, 8 + channel, volume);
  return ay(s, 7, TONE_ONLY[channel]);
}

/** Records `frames` frames. */
const record = (s: NextTestSession, frames: number): AudioSample[] => s.startAudio().runFrames(frames).audio();

/** The last sample's level on one side after a frame - the DC level of a static setup. */
const dcLevel = (s: NextTestSession, which: "left" | "right" = "left") => {
  const samples = record(s, 1);
  return samples[samples.length - 1][which];
};

/**
 * ym2149.vhd `p_envelope_shape`, one step per `env_ena` event. Returns the level after each event;
 * the first event follows the R13 write at once, so element k is the level of plateau k.
 */
function envelopeLevels(shape: number, events: number): number[] {
  let vol = shape & 0x04 ? 0 : 31;
  let inc = shape & 0x04 ? 1 : 0;
  let hold = 0;
  const out: number[] = [];
  for (let e = 0; e < events; e++) {
    const isZero = vol >> 1 === 0;
    const isOnes = vol >> 1 === 15;
    const isBot = isZero && (vol & 1) === 0;
    const isBotP1 = isZero && (vol & 1) === 1;
    const isTopM1 = isOnes && (vol & 1) === 0;
    const isTop = isOnes && (vol & 1) === 1;
    let nextVol = vol;
    let nextHold = hold;
    let nextInc = inc;
    if (!hold) nextVol = inc ? (vol + 1) & 31 : (vol + 31) & 31;
    if (!(shape & 0x08)) {
      if (!inc ? isBotP1 : isTop) nextHold = 1;
    } else if (shape & 0x01) {
      if (!inc) {
        if (shape & 0x02 ? isBot : isBotP1) nextHold = 1;
      } else if (shape & 0x02 ? isTop : isTopM1) nextHold = 1;
    } else if (shape & 0x02) {
      if (!inc) {
        if (isBotP1) nextHold = 1;
        if (isBot) {
          nextHold = 0;
          nextInc = 1;
        }
      } else {
        if (isTopM1) nextHold = 1;
        if (isTop) {
          nextHold = 0;
          nextInc = 0;
        }
      }
    }
    vol = nextVol;
    hold = nextHold;
    inc = nextInc;
    out.push(vol);
  }
  return out;
}

describe("AY / TurboSound", () => {
  // -------------------------------------------------------------------------------------------------
  // AY-001: register select, write, read
  // -------------------------------------------------------------------------------------------------

  /** A value per register with bits 7-5 set, so a read mask shows. */
  const pattern = (r: number) => 0xe0 | ((r * 7 + 5) & 0x1f);
  const AY_READ_MASK = [0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff, 0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff];

  it("AY-001: YM mode: registers 0-15 read back every bit written", async () => {
    const s = await psg({ mode: YM });
    for (let r = 0; r < 16; r++) ay(s, r, pattern(r));
    const read = Array.from({ length: 16 }, (_, r) => ayRead(s, r));
    expect(read).toEqual(Array.from({ length: 16 }, (_, r) => pattern(r)));
  });

  it("AY-001: AY mode: R1/R3/R5/R13 read 4 bits, R6/R8/R9/R10 read 5 bits", async () => {
    const s = await psg({ mode: AY });
    for (let r = 0; r < 16; r++) ay(s, r, pattern(r));
    const read = Array.from({ length: 16 }, (_, r) => ayRead(s, r));
    expect(read).toEqual(Array.from({ length: 16 }, (_, r) => pattern(r) & AY_READ_MASK[r]));
  });

  it("AY-001: R14/R15 read the pulled-up port ($FF) while R7 makes it an input", async () => {
    const s = await psg();
    ay(s, 14, 0x12);
    ay(s, 15, 0x34);
    ay(s, 7, 0x3f); // --- bits 6/7 = 0: both ports inputs
    expect([ayRead(s, 14), ayRead(s, 15)]).toEqual([0xff, 0xff]);
    ay(s, 7, 0xff); // --- outputs: the written values
    expect([ayRead(s, 14), ayRead(s, 15)]).toEqual([0x12, 0x34]);
  });

  it("AY-001: only $FFFD values with bits 7-5 = 000 select a register", async () => {
    const s = await psg();
    ay(s, 2, 0x5a);
    ay(s, 3, 0x0c);
    s.out(0xfffd, 0x02);
    for (const value of [0x23, 0x43, 0x83, 0xe3]) s.out(0xfffd, value);
    expect(s.in(0xfffd), "R2 still selected").toBe(0x5a);
  });

  it("AY-001: registers 16-31 in YM mode: writes are dropped, reads give $FF (B33)", async () => {
    const s = await psg({ mode: YM });
    ay(s, 2, 0x11);
    ay(s, 0x12, 0x77);
    expect(s.in(0xfffd), "R18 reads $FF").toBe(0xff);
    expect(ayRead(s, 2), "R2 unchanged").toBe(0x11);
  });

  it("AY-001: registers 16-31 in AY mode: writes are dropped, reads give register n & 15 (B33)", async () => {
    const s = await psg({ mode: AY });
    ay(s, 2, 0x11);
    ay(s, 0x12, 0x77);
    expect(s.in(0xfffd), "R18 reads R2").toBe(0x11);
    expect(ayRead(s, 2), "R2 unchanged").toBe(0x11);
  });

  it("AY-001: $BFF5 reads the selected chip's id and register number", async () => {
    const s = await psg({ nr08: NR08_TS });
    s.out(0xfffd, 0x05);
    expect(s.in(0xbff5), "chip 0: id 11").toBe(0xc5);
    s.out(0xfffd, 0xfe).out(0xfffd, 0x0b);
    expect(s.in(0xbff5), "chip 1: id 10").toBe(0x8b);
    s.out(0xfffd, 0xfd).out(0xfffd, 0x1c);
    expect(s.in(0xbff5), "chip 2: id 01, 5-bit register number").toBe(0x5c);
  });

  // -------------------------------------------------------------------------------------------------
  // AY-002 / AY-003 / AY-017 / AY-018 / AY-019: tone generators
  // -------------------------------------------------------------------------------------------------

  const TONES: Array<[channel: number, period: number]> = [
    [0, 0x0fe],
    [1, 0x1fc],
    [2, 0x07f]
  ];
  for (const [channel, period] of TONES) {
    it(`AY-00${channel === 0 ? 2 : 3}: tone channel ${"ABC"[channel]} alone, period $${period.toString(16)}: f = 1.75 MHz / (16 * period)`, async () => {
      const s = await psg();
      tone(s, channel, period);
      const values = side(record(s, 4), CHANNEL_SIDE[channel]);
      expect(relativeError(frequency(values, RATE), toneHz(period))).toBeLessThan(0.01);
    });
  }

  it("AY-002: only bits 3-0 of the coarse register count", async () => {
    const s = await psg();
    tone(s, 0, 0x110);
    ay(s, 1, 0xf1); // --- bits 7-4 set: the period stays $110
    const values = side(record(s, 4), "left");
    expect(relativeError(frequency(values, RATE), toneHz(0x110))).toBeLessThan(0.01);
  });

  it("AY-017: tone period 0 plays exactly like period 1", async () => {
    const play = async (period: number) => {
      const s = await psg();
      tone(s, 0, period);
      return side(record(s, 2), "left");
    };
    expect(await play(0)).toEqual(await play(1));
  });

  it("AY-018: a steady tone keeps its half-period across frame boundaries", async () => {
    const s = await psg();
    tone(s, 0, 0x0fe);
    const lengths = runs(side(record(s, 6), "left")).slice(1, -1).map((r) => r.length);
    const expected = (0x0fe * PSG_TICK * RATE) / MASTER_CLOCK; // --- 55.7 samples
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(Math.floor(expected) - 1);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(Math.ceil(expected) + 1);
  });

  it("AY-019: the tone frequency does not depend on the CPU speed", async () => {
    for (const speed of [0, 3]) {
      const s = await psg();
      s.setNextReg(0x07, speed);
      tone(s, 0, 0x0fe);
      const values = side(record(s, 4), "left");
      expect(relativeError(frequency(values, RATE), toneHz(0x0fe)), `$07 = ${speed}`).toBeLessThan(0.01);
    }
  });

  // -------------------------------------------------------------------------------------------------
  // AY-004 / AY-014: volume tables, PSG mode
  // -------------------------------------------------------------------------------------------------

  /** DC level of channel A for each fixed volume 0-15, as a fraction of volume 15. */
  async function volumeRatios(mode: number): Promise<number[]> {
    const s = await psg({ mode });
    ay(s, 7, MIXER_OFF);
    const levels: number[] = [];
    for (let v = 0; v < 16; v++) {
      ay(s, 8, v);
      levels.push(dcLevel(s));
    }
    return levels.map((l) => (l - levels[0]) / (levels[15] - levels[0]));
  }

  const nearly = (actual: number[], expected: number[], tolerance = 0.01) =>
    actual.every((a, i) => Math.abs(a - expected[i]) <= tolerance);
  const fmt = (values: number[]) => values.map((v) => v.toFixed(3)).join(" ");

  it("AY-004: YM mode: volume L plays volTableYm[2L + 1]; volume 0 is silent", async () => {
    const ratios = await volumeRatios(YM);
    const expected = Array.from({ length: 16 }, (_, v) => (v === 0 ? 0 : VOL_TABLE_YM[2 * v + 1] / 255));
    expect(nearly(ratios, expected), `${fmt(ratios)}\nvs ${fmt(expected)}`).toBe(true);
  });

  it("AY-004 / AY-014: AY mode ($06 bits 1-0 = 01): volume L plays volTableAy[L]", async () => {
    const ratios = await volumeRatios(AY);
    const expected = VOL_TABLE_AY.map((v) => v / 255);
    expect(nearly(ratios, expected), `${fmt(ratios)}\nvs ${fmt(expected)}`).toBe(true);
  });

  it("AY-014: mode 10 (ZXN-8950) uses the YM table: aymode is $06 bit 0", async () => {
    const ratios = await volumeRatios(0x02);
    const expected = Array.from({ length: 16 }, (_, v) => (v === 0 ? 0 : VOL_TABLE_YM[2 * v + 1] / 255));
    expect(nearly(ratios, expected), `${fmt(ratios)}\nvs ${fmt(expected)}`).toBe(true);
  });

  it("AY-014: mode 11 holds every PSG in reset: silent, registers cleared, writes ignored", async () => {
    const s = await psg({ nr08: NR08_TS });
    const silent = dcLevel(s);
    s.out(0xfffd, 0xfe); // --- chip 1 selected
    tone(s, 0, 0x0fe);
    expect(swing(side(record(s, 1), "left")), "chip 1 plays").toBeGreaterThan(0);

    s.setNextReg(0x06, 0x03);
    // --- The first sample's window opened before the hold (it straddles the frame boundary), so it
    // --- still averages in the tone: every sample after it is silent
    const held = record(s, 2);
    expect(swing(side(held.slice(1), "left")), "silent while held").toBe(0);
    expect(held[held.length - 1].left, "at the silent level").toBe(silent);
    ay(s, 8, 0x0f); // --- ignored while held
    s.setNextReg(0x06, YM);
    expect(ayRead(s, 7), "R7 back at its reset value, chip 0 selected again").toBe(0xff);
    expect([ayRead(s, 0), ayRead(s, 8)], "chip 0: nothing written").toEqual([0, 0]);
    s.out(0xfffd, 0xfe);
    expect([ayRead(s, 0), ayRead(s, 8)], "chip 1: cleared by the reset").toEqual([0, 0]);
  });

  // -------------------------------------------------------------------------------------------------
  // AY-005 / AY-006: noise and the mixer
  // -------------------------------------------------------------------------------------------------

  /** Channel A noise at `period`, level 15. */
  async function noise(period: number, frames = 4, rate = RATE): Promise<number[]> {
    const s = await psg({ rate });
    ay(s, 6, period);
    ay(s, 8, 0x0f);
    ay(s, 7, NOISE_ONLY[0]);
    return side(record(s, frames), "left");
  }

  it("AY-005: noise is not periodic, and a lower period changes level more often", async () => {
    const slow = runs(await noise(31));
    const fast = runs(await noise(8));
    expect(new Set(slow.slice(1, -1).map((r) => Math.round(r.length / 13.6))).size, "irregular run lengths").toBeGreaterThanOrEqual(4);
    expect(fast.length).toBeGreaterThan(2.5 * slow.length);
  });

  it("AY-005: the noise period is R6 bits 4-0", async () => {
    expect(await noise(0x3f, 2), "$3F plays like $1F").toEqual(await noise(0x1f, 2));
  });

  it("AY-017: noise period 0 plays exactly like period 1", async () => {
    expect(await noise(0, 2)).toEqual(await noise(1, 2));
  });

  it("AY-005: the noise bits follow the 17-bit LFSR with taps 0 and 2", async () => {
    // --- Period 31: one noise bit per 62 PSG ticks = 7936 master clocks = 13.6 samples at 48 kHz
    const bitLength = (2 * 31 * PSG_TICK * RATE) / MASTER_CLOCK;
    const bits: number[] = [];
    for (const run of runs(await noise(31, 6)).slice(1, -1)) {
      for (let i = Math.round(run.length / bitLength); i > 0; i--) bits.push(run.high ? 1 : 0);
    }
    expect(bits.length).toBeGreaterThan(300);
    // --- poly17 <= (p0 xor p2 xor zero) & p(16 downto 1); the output is p0, so o[n+17] = o[n] xor o[n+2]
    const mismatches = bits.slice(0, bits.length - 17).filter((b, n) => bits[n + 17] !== (b ^ bits[n + 2])).length;
    expect(mismatches).toBe(0);
  });

  for (let channel = 0; channel < 3; channel++) {
    const name = "ABC"[channel];
    const which = CHANNEL_SIDE[channel];
    it(`AY-006: channel ${name}: R7 gives tone, noise, tone AND noise, or a steady level`, async () => {
      const play = async (mixer: number) => {
        const s = await psg();
        ay(s, 2 * channel, 0x40); // --- 1709 Hz, 28 samples a cycle
        ay(s, 6, 31);
        ay(s, 8 + channel, 0x0f);
        ay(s, 7, mixer);
        return side(record(s, 4), which);
      };
      const toneOnly = await play(TONE_ONLY[channel]);
      expect(relativeError(frequency(toneOnly, RATE), toneHz(0x40)), "tone only").toBeLessThan(0.01);
      expect(highFraction(toneOnly)).toBeCloseTo(0.5, 1);

      // --- A freshly started LFSR is not balanced yet, so the noise's duty is compared, not assumed
      const noiseOnly = await play(NOISE_ONLY[channel]);
      expect(highFraction(noiseOnly), "noise only").toBeGreaterThan(0.15);
      expect(highFraction(noiseOnly)).toBeLessThan(0.85);
      expect(magnitude(noiseOnly, RATE, toneHz(0x40)), "no tone in it").toBeLessThan(magnitude(toneOnly, RATE, toneHz(0x40)) / 4);

      const both = await play(TONE_AND_NOISE[channel]);
      expect(Math.abs(highFraction(both) - highFraction(noiseOnly) / 2), "tone AND noise: high half as often as the noise").toBeLessThan(0.08);

      const neither = (await play(MIXER_OFF)).slice(2); // --- the first sample can straddle the R7 write
      expect(swing(neither), "neither: steady").toBe(0);
      expect(neither[0], "at the full level, not silence").toBe(Math.max(...toneOnly));
    });
  }

  // -------------------------------------------------------------------------------------------------
  // AY-007 / AY-008: envelope
  // -------------------------------------------------------------------------------------------------

  /** Records `frames` frames of channel A on the envelope, with 5 samples per envelope step. */
  async function envelope(shape: number, mode = YM, frames = 1) {
    const s = await psg({ rate: ALIGNED_RATE, mode });
    ay(s, 7, MIXER_OFF);
    const silent = dcLevel(s);
    ay(s, 8, 0x0f);
    const full = dcLevel(s);
    ay(s, 11, 25); // --- 25 ticks a step = 5 samples at 43 750 Hz
    ay(s, 12, 0);
    ay(s, 8, 0x10);
    ay(s, 13, shape);
    const values = side(record(s, frames), "left");
    const plateau = (k: number) => (values[5 * k + 2] - silent) / (full - silent);
    return { s, values, silent, full, plateau, steps: Math.floor(values.length / 5) };
  }

  for (let shape = 0; shape < 16; shape++) {
    it(`AY-007: envelope shape ${shape} (R13 = $${shape.toString(16)}) steps as ym2149.vhd does`, async () => {
      const { plateau, steps } = await envelope(shape);
      const expected = envelopeLevels(shape, steps).map((v) => VOL_TABLE_YM[v] / 255);
      const actual = expected.map((_, k) => plateau(k));
      const first = actual.findIndex((a, k) => Math.abs(a - expected[k]) > 0.01);
      expect(first, `first differing step ${first}: ${fmt(actual.slice(0, 8))}\nvs ${fmt(expected.slice(0, 8))}`).toBe(-1);
    });
  }

  it("AY-007 / AY-014: in AY mode the envelope plays volTableAy[level bits 4-1]", async () => {
    const shape = 0x0e; // --- /\/\
    const { plateau, steps } = await envelope(shape, AY);
    const expected = envelopeLevels(shape, steps).map((v) => VOL_TABLE_AY[v >> 1] / 255);
    const actual = expected.map((_, k) => plateau(k));
    const first = actual.findIndex((a, k) => Math.abs(a - expected[k]) > 0.01);
    expect(first, `first differing step ${first}`).toBe(-1);
  });

  it("AY-008: writing R13 again with the same value restarts the envelope", async () => {
    const { s, values, silent } = await envelope(0x00); // --- \___
    expect(values[values.length - 1], "decayed and held at 0").toBe(silent);
    ay(s, 13, 0x00);
    const again = side(record(s, 1), "left");
    expect(Math.max(...again), "restarted near the top").toBeGreaterThan(silent + 0.8 * (Math.max(...values) - silent));
    expect(again[again.length - 1]).toBe(silent);
  });

  // -------------------------------------------------------------------------------------------------
  // AY-009 - AY-011, AY-013, AY-015, AY-016: TurboSound
  // -------------------------------------------------------------------------------------------------

  it("AY-009: with TurboSound on, $FFFD %1111 11cc selects chip 0/1/2", async () => {
    const s = await psg({ nr08: NR08_TS });
    const select = [0xff, 0xfe, 0xfd];
    select.forEach((sel, chip) => ay(s.out(0xfffd, sel), 0, 0x11 * (chip + 1)));
    const read = select.map((sel) => ayRead(s.out(0xfffd, sel), 0));
    expect(read).toEqual([0x11, 0x22, 0x33]);
    expect(ayRead(s.out(0xfffd, 0xfc), 0), "cc = 00 selects chip 0").toBe(0x11);
  });

  it("AY-009: with TurboSound off, the select value does nothing: every access is chip 0", async () => {
    const s = await psg({ nr08: NR08 });
    ay(s.out(0xfffd, 0xfe), 0, 0x42); // --- would be chip 1
    s.setNextReg(0x08, NR08_TS);
    expect(ayRead(s.out(0xfffd, 0xff), 0), "landed in chip 0").toBe(0x42);
    expect(ayRead(s.out(0xfffd, 0xfe), 0), "chip 1 untouched").toBe(0x00);
  });

  it("AY-010: three chips play three tones at once", async () => {
    const s = await psg({ nr08: NR08_TS });
    const periods = [100, 150, 210];
    periods.forEach((p, chip) => tone(s.out(0xfffd, [0xff, 0xfe, 0xfd][chip]), 0, p));
    const left = side(record(s, 4), "left");
    const present = periods.map((p) => magnitude(left, RATE, toneHz(p)));
    const absent = magnitude(left, RATE, toneHz(123));
    for (const m of present) expect(m, `${present.map((x) => x.toFixed(0))} vs ${absent.toFixed(0)}`).toBeGreaterThan(10 * absent);
  });

  const PAN: Array<[pan: number, left: boolean, right: boolean]> = [
    [0, false, false],
    [1, false, true],
    [2, true, false],
    [3, true, true]
  ];
  for (const [pan, left, right] of PAN) {
    it(`AY-011: $FFFD bits 6-5 = ${pan.toString(2).padStart(2, "0")}: left ${left ? "on" : "off"}, right ${right ? "on" : "off"}`, async () => {
      const s = await psg({ nr08: NR08_TS });
      s.out(0xfffd, 0x9f | (pan << 5)); // --- chip 0 with this pan
      tone(s, 1, 0x0fe); // --- channel B: the centre
      const samples = record(s, 2);
      expect([swing(side(samples, "left")) > 0, swing(side(samples, "right")) > 0]).toEqual([left, right]);
    });
  }

  for (const [chip, bit] of [[0, 0x20], [1, 0x40], [2, 0x80]] as const) {
    it(`AY-013: $09 bit ${Math.log2(bit)} puts PSG ${chip} in mono: channel A on both sides`, async () => {
      const s = await psg({ nr08: NR08_TS });
      s.out(0xfffd, [0xff, 0xfe, 0xfd][chip]);
      tone(s, 0, 0x0fe);
      const stereo = record(s, 2);
      expect([swing(side(stereo, "left")) > 0, swing(side(stereo, "right")) > 0], "stereo: A is left only").toEqual([true, false]);
      s.setNextReg(0x09, bit);
      const mono = record(s, 2);
      expect([swing(side(mono, "left")) > 0, swing(side(mono, "right")) > 0], "mono: both").toEqual([true, true]);
      expect(Math.max(...side(mono, "left")), "L = R = A + B + C").toBe(Math.max(...side(mono, "right")));
    });
  }

  it("AY-015: with $84 bit 0 clear, $FFFD/$BFFD writes do not reach the PSG", async () => {
    const s = await psg();
    s.setNextReg(0x84, 0xfe);
    tone(s, 0, 0x0fe);
    expect(swing(side(record(s, 2), "left")), "no tone").toBe(0);
    s.setNextReg(0x84, 0xff);
    expect([ayRead(s, 0), ayRead(s, 8), ayRead(s, 7)], "registers never written").toEqual([0x00, 0x00, 0xff]);
  });

  it("AY-016: turning TurboSound off freezes the selected chip: its registers and only its output", async () => {
    const s = await psg({ nr08: NR08_TS });
    tone(s.out(0xfffd, 0xff), 0, 100); // --- chip 0
    tone(s.out(0xfffd, 0xfe), 0, 210); // --- chip 1, left selected
    s.setNextReg(0x08, NR08);
    expect(ayRead(s, 0), "reads chip 1").toBe(210);
    const left = side(record(s, 4), "left");
    const chip1 = magnitude(left, RATE, toneHz(210));
    expect(chip1, "chip 1 plays").toBeGreaterThan(0);
    expect(magnitude(left, RATE, toneHz(100)), "chip 0 is not mixed in").toBeLessThan(chip1 / 20);
  });
});
