import type { PiI2sStatus, PiI2sToneChannels } from "@common/zxnext/piI2s";

/*
 * What stands in for the Raspberry Pi on the Next's I2S link (`.plans/PI_I2S_AUDIO_PLAN.md` §3).
 *
 * A source is a stream of stereo signed 16-bit samples at a fixed rate. The machine asks it for the
 * samples a frame needs, by index, and writes them into the core (`ZxNextWasmV2Machine.feedPiI2s`).
 * A source must be a pure function of the sample index: the same index always yields the same sample,
 * whenever and however often it is asked (D4).
 */

/** A stream of stereo signed 16-bit samples */
export interface PiI2sSource {
  /** What the IDE shows for it: a file name, "440 Hz tone", ... */
  readonly name: string;
  /** Samples per second */
  readonly rate: number;
  /** The number of samples, or undefined for an endless stream */
  readonly length?: number;
  /**
   * Writes samples `from` .. `from + count - 1`, interleaved left, right, into `out` from index 0
   * @returns The number of samples written: fewer than `count` only at the end of the stream
   */
  fill(from: number, count: number, out: Int16Array): number;
}

/** The highest rate the core accepts (`ZXNEXT_PI_I2S_MAX_RATE`) */
export const PI_I2S_MAX_RATE = 192000;

/** An endless stream of zeros: a Pi that plays silence (the receiver reads $200) */
export class SilencePiI2sSource implements PiI2sSource {
  readonly name = "silence";
  constructor(readonly rate = 44100) {}

  fill(_from: number, count: number, out: Int16Array): number {
    out.fill(0, 0, count * 2);
    return count;
  }
}

/** An endless sine tone */
export class TonePiI2sSource implements PiI2sSource {
  readonly name: string;
  private readonly amplitude: number;

  /**
   * @param frequency Hz
   * @param level 0 .. 1 of full scale
   * @param channels The side(s) it plays on; the other side is silent
   */
  constructor(
    readonly frequency: number,
    readonly level = 0.5,
    readonly channels: PiI2sToneChannels = "both",
    readonly rate = 44100
  ) {
    this.name = `${frequency} Hz`;
    this.amplitude = Math.round(Math.max(0, Math.min(1, level)) * 32767);
  }

  fill(from: number, count: number, out: Int16Array): number {
    // --- The phase from the index alone (no running accumulator): the same index, the same sample
    const step = (2 * Math.PI * this.frequency) / this.rate;
    for (let i = 0; i < count; i++) {
      const value = Math.round(Math.sin(((from + i) % this.rate) * step) * this.amplitude);
      out[i * 2] = this.channels === "right" ? 0 : value;
      out[i * 2 + 1] = this.channels === "left" ? 0 : value;
    }
    return count;
  }
}

/** Decoded PCM held in memory: a WAV file, a test's samples */
export class PcmPiI2sSource implements PiI2sSource {
  readonly length: number;

  /** `left` and `right` are the same length; a mono stream passes the same array twice */
  constructor(
    readonly name: string,
    readonly rate: number,
    private readonly left: Int16Array,
    private readonly right: Int16Array
  ) {
    if (left.length !== right.length) throw new Error("The two channels differ in length");
    this.length = left.length;
  }

  fill(from: number, count: number, out: Int16Array): number {
    const n = Math.max(0, Math.min(count, this.length - from));
    for (let i = 0; i < n; i++) {
      out[i * 2] = this.left[from + i];
      out[i * 2 + 1] = this.right[from + i];
    }
    return n;
  }
}

/** What the emulator needs of a machine to put a source on its I2S input */
export interface IPiI2sMachine {
  connectPiI2sSource(source: PiI2sSource | undefined): void;
  getPiI2sStatus(): PiI2sStatus | undefined;
}

/** Whether a machine has a Raspberry Pi I2S input (the ZX Spectrum Next) */
export function isPiI2sMachine(machine: unknown): machine is IPiI2sMachine {
  const m = machine as Partial<IPiI2sMachine> | undefined;
  return typeof m?.connectPiI2sSource === "function" && typeof m.getPiI2sStatus === "function";
}
