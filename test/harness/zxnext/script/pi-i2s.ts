import type { PiI2sSource } from "@emu/machines/zxNext/piI2s/PiI2sSource";

/*
 * The Raspberry Pi's end of the Next's I2S link, for the session (`.plans/PI_I2S_AUDIO_PLAN.md`): a
 * sample source the machine feeds into the core frame by frame, exactly as the IDE does.
 */

/** A stream given as a function of the sample index: `[left, right]`, signed 16-bit */
export type PiI2sSamples = {
  rate: number;
  /** The number of samples; left out, the stream is endless */
  length?: number;
  sample: (index: number) => readonly [number, number];
};

/** A `PiI2sSamples` as a source */
export function piI2sSourceOf(stream: PiI2sSource | PiI2sSamples): PiI2sSource {
  if ("fill" in stream) return stream;
  return {
    name: "test stream",
    rate: stream.rate,
    length: stream.length,
    fill(from: number, count: number, out: Int16Array): number {
      const n = stream.length === undefined ? count : Math.max(0, Math.min(count, stream.length - from));
      for (let i = 0; i < n; i++) {
        const [left, right] = stream.sample(from + i);
        out[i * 2] = left;
        out[i * 2 + 1] = right;
      }
      return n;
    }
  };
}

/** What the Next's receiver makes of a signed 16-bit sample: 10-bit offset binary (i2s.vhd) */
export const piI2sWord = (sample: number): number => (((sample & 0xffff) >> 6) & 0x3ff) ^ 0x200;
