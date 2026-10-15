import { describe, expect, it } from "vitest";
import { fillTvNoise, type TvNoiseState } from "@renderer/features/emulator/tvNoiseEffect";

const W = 64;
const H = 48;

function frame(state: TvNoiseState): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  fillTvNoise(data, W, H, state);
  return data;
}

describe("TV noise", () => {
  it("fills every pixel with an opaque grey", () => {
    const data = frame({ seed: 1 });
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 1]).toBe(data[i]);
      expect(data[i + 2]).toBe(data[i]);
      expect(data[i + 3]).toBe(255);
    }
  });

  it("is a bright, greyish snow: many greys, a light mean, and no near-black dots", () => {
    const data = frame({ seed: 7 });
    const levels = new Set<number>();
    let sum = 0;
    let darkest = 255;
    for (let i = 0; i < data.length; i += 4) {
      levels.add(data[i]);
      sum += data[i];
      darkest = Math.min(darkest, data[i]);
    }
    const mean = sum / (W * H);
    // --- Noise, not a flat level, around a light grey, as a real set's snow is
    expect(levels.size).toBeGreaterThan(120);
    expect(mean).toBeGreaterThan(145);
    expect(mean).toBeLessThan(180);
    expect(darkest).toBeGreaterThanOrEqual(50);
  });

  it("moves on: the state advances, and the next frame is a different one", () => {
    const state: TvNoiseState = { seed: 3 };
    const first = frame(state);
    const seedAfterFirst = state.seed;
    const second = frame(state);
    expect(seedAfterFirst).not.toBe(3);
    expect(state.seed).not.toBe(seedAfterFirst);
    expect(second).not.toEqual(first);
  });

  it("is the same noise for the same seed, and survives a zero seed", () => {
    expect(frame({ seed: 42 })).toEqual(frame({ seed: 42 }));
    // --- xorshift never leaves 0, so a zero seed must not freeze the noise
    const fromZero = frame({ seed: 0 });
    expect(new Set(fromZero).size).toBeGreaterThan(1);
  });
});
