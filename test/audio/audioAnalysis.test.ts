import { describe, expect, it } from "vitest";

import {
  AudioChannelAnalyzer,
  FFT_SIZE,
  SCOPE_POINTS,
  SPECTRUM_BANDS,
  measureWindow,
  spectrumBandEdges
} from "@common/audio/audioAnalysis";

/*
 * The audio mixer's analysis (`dev/plans/AUDIO_MIXER_PLAN.md` §3.2): synthetic tones must land in the
 * right band, a square must show its odd harmonics, and a constant offset (a silent AY channel's level)
 * must read as silence.
 */

const RATE = 48_000;

function tone(hz: number, amplitude = 1, offset = 0, shape: "sine" | "square" = "sine"): Float64Array {
  return Float64Array.from({ length: FFT_SIZE }, (_, i) => {
    const phase = (2 * Math.PI * hz * i) / RATE;
    return offset + amplitude * (shape === "sine" ? Math.sin(phase) : Math.sin(phase) >= 0 ? 1 : -1);
  });
}

/** The band a frequency falls in */
function bandOf(hz: number): number {
  const edges = spectrumBandEdges(RATE);
  return edges.findIndex((e, i) => hz >= e && hz < edges[i + 1]);
}

const loudest = (spectrum: number[]) => spectrum.indexOf(Math.max(...spectrum));

describe("audio mixer analysis", () => {
  it("puts a 1 kHz sine in the 1 kHz band at full scale", () => {
    const m = measureWindow(tone(1000), RATE);
    expect(m.spectrum).toHaveLength(SPECTRUM_BANDS);
    expect(loudest(m.spectrum)).toBe(bandOf(1000));
    expect(m.spectrum[bandOf(1000)]).toBeGreaterThan(0.97);
    // --- Not a whole number of cycles in the window: its mean is a little off zero
    expect(m.peak).toBeCloseTo(1, 1);
    expect(m.rms).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it("shows a square's odd harmonics and not its even ones", () => {
    const m = measureWindow(tone(500, 0.5, 0, "square"), RATE);
    expect(loudest(m.spectrum)).toBe(bandOf(500));
    // --- The 3rd harmonic is a third of the fundamental (-9.5 dB); the 2nd is absent
    const third = m.spectrum[bandOf(1500)];
    const second = m.spectrum[bandOf(1000)];
    expect(third).toBeGreaterThan(m.spectrum[bandOf(500)] - 0.2);
    expect(third).toBeGreaterThan(second + 0.2);
  });

  it("reads a constant offset as silence", () => {
    const m = measureWindow(tone(1000, 0, -0.375), RATE);
    expect(m.peak).toBe(0);
    expect(m.rms).toBe(0);
    expect(Math.max(...m.spectrum)).toBe(0);
    expect(m.scope.every((v) => v === 0)).toBe(true);
  });

  it("measures a tone about its mean, whatever its offset", () => {
    const plain = measureWindow(tone(2000, 0.25), RATE);
    const offset = measureWindow(tone(2000, 0.25, 0.5), RATE);
    expect(offset.peak).toBeCloseTo(plain.peak, 6);
    expect(offset.rms).toBeCloseTo(plain.rms, 6);
    expect(loudest(offset.spectrum)).toBe(loudest(plain.spectrum));
  });

  it("keeps each channel's window across frames, oldest first", () => {
    const a = new AudioChannelAnalyzer();
    const sine = tone(1000);
    // --- Two channels interleaved, fed in frames of 960 samples: channel 0 the sine, channel 1 silent
    let fed = 0;
    while (fed < FFT_SIZE) {
      const n = Math.min(960, FFT_SIZE - fed);
      const frame = new Float32Array(n * 2);
      for (let s = 0; s < n; s++) frame[s * 2] = sine[fed + s];
      a.push(frame, n, 2);
      fed += n;
    }
    const [ch0, ch1] = a.measure(RATE);
    expect(loudest(ch0.spectrum)).toBe(bandOf(1000));
    expect(ch0.rms).toBeCloseTo(Math.SQRT1_2, 2);
    expect(ch1.peak).toBe(0);
    expect(ch0.scope).toHaveLength(SCOPE_POINTS);
  });

  it("starts over when the channel count changes", () => {
    const a = new AudioChannelAnalyzer();
    expect(a.push(new Float32Array(6), 3, 2)).toBe(false);
    expect(a.push(new Float32Array(6), 3, 2)).toBe(true);
    expect(a.push(new Float32Array(9), 3, 3)).toBe(false);
    expect(a.measure(RATE)).toHaveLength(3);
  });
});
