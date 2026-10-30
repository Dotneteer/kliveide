import { describe, expect, it } from "vitest";

import { audioSamplesPerBurst } from "@renderer/features/emulator/useEmulatorAudio";

/*
 * The audio worklet sizes its queue in bursts of samples (Sampling.worklet.js): its hold-back, its lag
 * bound and its lone-frame wait are all counted in bursts. A burst that is too large makes every one of
 * them too large: the ZX Spectrum Next counts its frame in 28 MHz clocks (frameTactMultiplier 8 against
 * its 3.5 MHz base clock), and leaving the multiplier out made its burst 7,780 samples instead of 972,
 * so the sound started about half a second late and stayed that far behind.
 */
describe("audioSamplesPerBurst", () => {
  it("ZX Spectrum Next: 567,264 clocks of 28 MHz a frame give 972.45 samples at 48 kHz", () => {
    expect(audioSamplesPerBurst(567_264, 3_500_000, 48_000, 1, 8)).toBeCloseTo(972.45, 2);
  });

  it("ZX Spectrum 48K: 69,888 T-states at 3.5 MHz give 958.5 samples at 48 kHz", () => {
    expect(audioSamplesPerBurst(69_888, 3_500_000, 48_000, 1, 1)).toBeCloseTo(958.46, 2);
  });

  it("Cambridge Z88: eight 5 ms frames a burst at 44.1 kHz", () => {
    expect(audioSamplesPerBurst(16_384, 3_276_800, 44_100, 8, 1)).toBeCloseTo(1764, 6);
  });

  it("treats a missing multiplier or burst size as 1", () => {
    expect(audioSamplesPerBurst(69_888, 3_500_000, 48_000, 0, 0)).toBeCloseTo(958.46, 2);
  });
});
