/**
 * Keeps the emulator's audio in step with a wall-clock video (D5).
 *
 * The IDE + Emulator recording is paced by the real clock, but the emulator produces sound only
 * while it runs, at its own (emulated) speed. The padder fills the gaps with silence - paused,
 * stopped, slower than real time, not yet started - and drops sound that would run ahead of the
 * video when the emulator is faster than real time.
 *
 * Every count is in stereo *frames* (one left + one right sample); buffers are interleaved f32.
 */
export type AudioPadderOptions = {
  /** Silence is added once the audio lags the clock by more than this */
  padAfterMs?: number;
  /** ... and the audio is then padded up to this far behind the clock (so jitter does not pile up) */
  padToMs?: number;
  /** Incoming sound further ahead of the clock than this is dropped */
  maxLeadMs?: number;
};

export class AudioPadder {
  private _written = 0;
  private readonly _padAfter: number;
  private readonly _padTo: number;
  private readonly _maxLead: number;

  constructor(
    readonly sampleRate: number,
    options: AudioPadderOptions = {}
  ) {
    const perMs = sampleRate / 1000;
    this._padAfter = Math.round((options.padAfterMs ?? 100) * perMs);
    this._padTo = Math.round((options.padToMs ?? 50) * perMs);
    this._maxLead = Math.round((options.maxLeadMs ?? 250) * perMs);
  }

  /** Stereo frames written so far (sound and silence) */
  get framesWritten(): number {
    return this._written;
  }

  /** The stereo frames the clock says should have been written by now */
  due(elapsedMs: number): number {
    return Math.max(0, Math.floor((elapsedMs * this.sampleRate) / 1000));
  }

  /**
   * Accepts emulator sound; returns the part that may be written (possibly all of it, a prefix, or
   * nothing when the audio is already too far ahead of the clock).
   */
  accept(samples: Float32Array, elapsedMs: number): Float32Array {
    const frames = Math.floor(samples.length / 2);
    const room = this.due(elapsedMs) + this._maxLead - this._written;
    if (room <= 0 || frames === 0) return new Float32Array(0);
    const take = Math.min(frames, room);
    this._written += take;
    return take === frames ? samples : samples.subarray(0, take * 2);
  }

  /**
   * Silence for the first `ms` of the recording, written before the clock starts. FFmpeg reads its
   * video and audio inputs interleaved; with no sound at all it would wait on the audio pipe and
   * never take the video frames the clock waits for.
   */
  prefill(ms: number): Float32Array {
    const frames = Math.max(0, Math.round((ms * this.sampleRate) / 1000));
    this._written += frames;
    return new Float32Array(frames * 2);
  }

  /** The silence to write now to catch up with the clock, or null when none is needed */
  padding(elapsedMs: number): Float32Array | null {
    const due = this.due(elapsedMs);
    if (this._written >= due - this._padAfter) return null;
    const frames = due - this._padTo - this._written;
    if (frames <= 0) return null;
    this._written += frames;
    return new Float32Array(frames * 2);
  }
}
