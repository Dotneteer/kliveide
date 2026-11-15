/*
 * The audio mixer's analysis (`dev/plans/AUDIO_MIXER_PLAN.md` §3.2, phase 4): each sound source's
 * level, spectrum and waveform from the machine's taps (`IAudioChannelMixer.getAudioChannelTaps`).
 *
 * It runs in the emulator's renderer, beside the machine, once per emulated frame, and keeps for each
 * channel the last FFT_SIZE samples. What it hands out is small and fixed (a few numbers, SPECTRUM_BANDS
 * bands and SCOPE_POINTS waveform points per channel), so it can cross to the IDE window every frame.
 *
 * - A tap carries the source's level before the mix's DC filter, so a silent AY channel sits at a
 *   constant below zero: every measure is taken about the window's mean.
 * - The spectrum: a Hann-windowed radix-2 FFT, folded into log-spaced bands from MIN_HZ to the lower of
 *   MAX_HZ and the Nyquist frequency, each band its loudest bin, in dB from SPECTRUM_FLOOR_DB to 0 dB
 *   (a full-scale sine) mapped to 0..1.
 * - Nothing here is a `t()` text: the UI formats the numbers.
 */

/** Samples per analysis window (a power of two): about 21 ms at 48 kHz */
export const FFT_SIZE = 1024;
/** Spectrum bands per channel */
export const SPECTRUM_BANDS = 48;
/** Waveform points per channel (the window's last SCOPE_POINTS samples, decimated) */
export const SCOPE_POINTS = 128;
export const MIN_HZ = 40;
export const MAX_HZ = 16_000;
/** The spectrum's floor: a band this far below a full-scale sine reads 0 */
export const SPECTRUM_FLOOR_DB = -72;

/** One source's measures over the last window */
export type AudioChannelMeasures = {
  /** The largest excursion from the window's mean (full scale 1) */
  peak: number;
  /** The root mean square about the mean (a full-scale sine is about 0.707) */
  rms: number;
  /** SPECTRUM_BANDS values 0..1, low to high */
  spectrum: number[];
  /** SCOPE_POINTS samples about the mean, oldest first */
  scope: number[];
};

/** The band edges in Hz for a sample rate (SPECTRUM_BANDS + 1 values) */
export function spectrumBandEdges(sampleRate: number): number[] {
  const top = Math.min(MAX_HZ, sampleRate / 2);
  return Array.from({ length: SPECTRUM_BANDS + 1 }, (_, i) => MIN_HZ * Math.pow(top / MIN_HZ, i / SPECTRUM_BANDS));
}

/** An in-place iterative radix-2 FFT of `re` + i`im` (length a power of two) */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k;
        const q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci;
        const ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr;
        im[q] = im[p] - ti;
        re[p] += tr;
        im[p] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

const HANN = Float64Array.from({ length: FFT_SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
/* A full-scale sine's largest bin through the Hann window: amplitude x N / 4 */
const FULL_SCALE_BIN = FFT_SIZE / 4;

/**
 * The measures of one channel's window
 * @param window FFT_SIZE samples, oldest first
 * @param sampleRate The samples' rate
 */
export function measureWindow(window: Float64Array, sampleRate: number): AudioChannelMeasures {
  let sum = 0;
  for (let i = 0; i < FFT_SIZE; i++) sum += window[i];
  const mean = sum / FFT_SIZE;
  let peak = 0;
  let squares = 0;
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    const v = window[i] - mean;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    squares += v * v;
    re[i] = v * HANN[i];
  }
  fftInPlace(re, im);
  const edges = spectrumBandEdges(sampleRate);
  const binHz = sampleRate / FFT_SIZE;
  const spectrum: number[] = [];
  for (let b = 0; b < SPECTRUM_BANDS; b++) {
    const lo = Math.max(1, Math.floor(edges[b] / binHz));
    const hi = Math.min(FFT_SIZE / 2 - 1, Math.max(lo, Math.ceil(edges[b + 1] / binHz) - 1));
    let m = 0;
    for (let k = lo; k <= hi; k++) m = Math.max(m, Math.hypot(re[k], im[k]));
    const db = 20 * Math.log10(m / FULL_SCALE_BIN + 1e-12);
    spectrum.push(Math.max(0, Math.min(1, (db - SPECTRUM_FLOOR_DB) / -SPECTRUM_FLOOR_DB)));
  }
  const scope: number[] = [];
  const step = FFT_SIZE / 2 / SCOPE_POINTS;
  for (let i = 0; i < SCOPE_POINTS; i++) scope.push(window[FFT_SIZE / 2 + Math.floor(i * step)] - mean);
  return { peak, rms: Math.sqrt(squares / FFT_SIZE), spectrum, scope };
}

/** Keeps each channel's last FFT_SIZE samples and measures them */
export class AudioChannelAnalyzer {
  private windows: Float64Array[] = [];
  private write = 0;

  /**
   * Adds a frame's taps: `samples[s * channelCount + c]`
   * @returns false when the channel count changed (the windows started over)
   */
  push(samples: ArrayLike<number>, sampleCount: number, channelCount: number): boolean {
    let same = true;
    if (this.windows.length !== channelCount) {
      this.windows = Array.from({ length: channelCount }, () => new Float64Array(FFT_SIZE));
      this.write = 0;
      same = false;
    }
    for (let s = 0; s < sampleCount; s++) {
      for (let c = 0; c < channelCount; c++) this.windows[c][this.write] = samples[s * channelCount + c];
      this.write = (this.write + 1) % FFT_SIZE;
    }
    return same;
  }

  /** The measures of every channel, in the taps' order */
  measure(sampleRate: number): AudioChannelMeasures[] {
    const ordered = new Float64Array(FFT_SIZE);
    return this.windows.map((ring) => {
      // --- Oldest first: from the write position round to it
      ordered.set(ring.subarray(this.write), 0);
      ordered.set(ring.subarray(0, this.write), FFT_SIZE - this.write);
      return measureWindow(ordered, sampleRate);
    });
  }

  /** Forgets every window */
  reset(): void {
    this.windows = [];
    this.write = 0;
  }
}
