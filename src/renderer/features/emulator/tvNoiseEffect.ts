/**
 * TV noise ("snow"): what a television shows when the signal has no usable sync.
 *
 * A ZX81 running a program in FAST mode holds its video output at the sync level (VSYNC stuck on),
 * and a ZX80 sends no sync while it computes. The machine's own picture is then flat black; a real
 * set, hunting for sync pulses that never come, showed noise instead. This module draws that noise
 * for the emulator screen. It is purely cosmetic: it is drawn in place of the picture on the
 * canvas, and the machine's pixel buffer (screenshots, recordings, tests) is never touched.
 */

/** The noise generator's state, carried from one frame to the next so the noise keeps moving */
export type TvNoiseState = { seed: number };

/** A non-zero start for the generator: xorshift never leaves 0 */
const DEFAULT_SEED = 0x9e3779b9;

/*
 * The noise's greys. A real set's snow is bright and greyish, with few really dark dots: each pixel
 * is the average of two random bytes (a bell-shaped spread, so extremes are rare) mapped onto
 * NOISE_BASE..NOISE_BASE + NOISE_SPAN. The mean is NOISE_BASE + NOISE_SPAN / 2.
 */
const NOISE_BASE = 72;
const NOISE_SPAN = 180;
/** How far a row may be brighter or darker than the rest: the faint horizontal streaks */
const ROW_BIAS = 16;

/**
 * Fills RGBA pixels with one frame of TV noise: a random light grey for every pixel, with a random
 * brightness bias for every row, which gives the faint horizontal streaks of a real set's noise.
 * Advances `state`, so the next call draws a different frame.
 * @param target RGBA bytes, `width` × `height` pixels
 * @param width Pixels in a row
 * @param height Rows
 * @param state The generator state; updated in place
 */
export function fillTvNoise(target: Uint8ClampedArray, width: number, height: number, state: TvNoiseState): void {
  let x = state.seed >>> 0 || DEFAULT_SEED;
  let i = 0;
  for (let row = 0; row < height; row++) {
    // --- xorshift32: one step for the row's bias ...
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const rowBias = ((x >>> 24) % (2 * ROW_BIAS)) - ROW_BIAS;
    for (let column = 0; column < width; column++) {
      // --- ... and one for every pixel
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      // --- Two random bytes from the one step, averaged; Uint8ClampedArray clamps the result
      const level = NOISE_BASE + ((((x >>> 24) + ((x >>> 16) & 0xff)) * NOISE_SPAN) >> 9) + rowBias;
      target[i] = level;
      target[i + 1] = level;
      target[i + 2] = level;
      target[i + 3] = 255;
      i += 4;
    }
  }
  state.seed = x >>> 0;
}
