import type { AudioSample, NextTestSession } from "../../harness/zxnext";

/*
 * Shared measurements for the audio tests (catalogue §6 "tolerance policy").
 *
 * - Frequencies: within 1 % of the VHDL value.
 * - Levels: ratios against a full-scale level measured in the same session, so the mixer's scaling
 *   (which is the BEEP area's business) drops out. Within 0.01 of the VHDL table ratio.
 *
 * The PSG runs from `i_CLK_PSG_EN`, 28 MHz / 16 = 1.75 MHz (zxnext_top_issue4.vhd ~1042), and
 * ym2149.vhd divides that by 8 (`I_SEL_L = '1'`, cnt_div reload "0111") for the tone, noise and
 * envelope counters: one PSG tick every 128 master clocks.
 */

export const MASTER_CLOCK = 28_000_000;
export const PSG_TICK = 128; // --- master clocks per ym2149 `ena_div`
/** A sample rate that puts exactly 5 PSG ticks in each sample. */
export const ALIGNED_RATE = MASTER_CLOCK / (5 * PSG_TICK); // 43 750 Hz

/** ym2149.vhd `volTableAy` / `volTableYm`. */
export const VOL_TABLE_AY = [
  0x00, 0x03, 0x04, 0x06, 0x0a, 0x0f, 0x15, 0x22, 0x28, 0x41, 0x5b, 0x72, 0x90, 0xb5, 0xd7, 0xff
];
export const VOL_TABLE_YM = [
  0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04, 0x06, 0x07, 0x09, 0x0a, 0x0c, 0x0e, 0x11, 0x13,
  0x17, 0x1b, 0x20, 0x25, 0x2c, 0x35, 0x3e, 0x47, 0x54, 0x66, 0x77, 0x88, 0xa1, 0xc0, 0xe0, 0xff
];

/** Tone frequency for a 12-bit period: the output toggles every `max(1, period)` PSG ticks. */
export const toneHz = (period: number) => MASTER_CLOCK / (2 * PSG_TICK * Math.max(1, period));

export type Side = "left" | "right";
export const side = (samples: AudioSample[], which: Side) => samples.map((s) => s[which]);

export const swing = (values: number[]) => Math.max(...values) - Math.min(...values);

/**
 * The size of a square wave's steps: the largest change across 3 samples, so an edge that falls
 * inside a sample is still seen whole. Unlike `swing`, it ignores a slow drift of the midpoint - the
 * DC filter the cores put on the beeper takes several frames to settle.
 */
export function edgeStep(values: number[]): number {
  let step = 0;
  for (let i = 0; i + 3 < values.length; i++) step = Math.max(step, Math.abs(values[i + 3] - values[i]));
  return step;
}

/** Writes PSG register `reg` of the selected chip through $FFFD / $BFFD. */
export function ay(s: NextTestSession, reg: number, value: number): NextTestSession {
  return s.out(0xfffd, reg).out(0xbffd, value);
}

/** Reads PSG register `reg` of the selected chip through $FFFD. */
export function ayRead(s: NextTestSession, reg: number): number {
  return s.out(0xfffd, reg).in(0xfffd);
}

/** Indices where the signal crosses the midpoint of its range upwards. */
export function risingEdges(values: number[]): number[] {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  const edges: number[] = [];
  for (let i = 1; i < values.length; i++) if (values[i - 1] < mid && values[i] >= mid) edges.push(i);
  return edges;
}

/** Frequency of a periodic signal from its first and last rising edge. */
export function frequency(values: number[], rate: number): number {
  const edges = risingEdges(values);
  if (edges.length < 2) return 0;
  return (rate * (edges.length - 1)) / (edges[edges.length - 1] - edges[0]);
}

export const relativeError = (actual: number, expected: number) => Math.abs(actual - expected) / expected;

/** The signal as runs of high (1) / low (0) samples around its midpoint. */
export function runs(values: number[]): Array<{ high: boolean; length: number }> {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  const out: Array<{ high: boolean; length: number }> = [];
  for (const v of values) {
    const high = v >= mid;
    if (out.length && out[out.length - 1].high === high) out[out.length - 1].length++;
    else out.push({ high, length: 1 });
  }
  return out;
}

/** Fraction of samples above the midpoint. */
export function highFraction(values: number[]): number {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  return values.filter((v) => v >= mid).length / values.length;
}

/** Goertzel magnitude of `freq` in `values`, normalised by the sample count. */
export function magnitude(values: number[], rate: number, freq: number): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const w = (2 * Math.PI * freq) / rate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (const v of values) {
    const s0 = v - mean + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / values.length;
}
