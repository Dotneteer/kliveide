import type { IAudioDevice, AudioSample } from "@emu/abstractions/IAudioDevice";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * This class represents the functionality of an audio device that can generate audio samples
 */
export class AudioDeviceBase<T extends IAnyMachine> implements IAudioDevice<T> {
  private _audioSampleRate = 0;
  private _audioSampleLength = 0;
  private _audioNextSampleTact = 0;
  // Current frame's samples — returned by getAudioSamples()
  private _audioSamples: AudioSample[] = [];
  // Reuse pool — objects recycled from the previous frame to avoid GC pressure
  private _audioSamplePool: AudioSample[] = [];
  private _poolIndex = 0;

  // --- DC offset high-pass filter state (MAME spkrdev.cpp form)
  // y[n] = x[n] - x[n-1] + α × y[n-1] where α ≈ 0.995
  private static readonly DC_FILTER_ALPHA = 0.995;
  private _dcFilterPrevInputLeft = 0;
  private _dcFilterPrevInputRight = 0;
  private _dcFilterPrevOutputLeft = 0;
  private _dcFilterPrevOutputRight = 0;

  /**
   * Initialize the audio device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: T) {}

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    this._audioSampleLength = 0;
    this._audioNextSampleTact = 0;
    this._audioSamples.length = 0;
    this._audioSamplePool.length = 0;
    this._poolIndex = 0;
    this._dcFilterPrevInputLeft = 0;
    this._dcFilterPrevInputRight = 0;
    this._dcFilterPrevOutputLeft = 0;
    this._dcFilterPrevOutputRight = 0;
  }

  /**
   * Gets the audio sample rate
   */
  getAudioSampleRate () {
    return this._audioSampleRate;
  }

  /**
   * Sets up the sample rate to use with this device
   * @param sampleRate Audio sample rate
   */
  setAudioSampleRate (sampleRate: number): void {
    this._audioSampleRate = sampleRate;
    this._audioSampleLength = this.machine.baseClockFrequency / sampleRate;
    this._audioNextSampleTact = 0;
  }

  /**
   * Gets the audio samples rendered in the current frame
   */
  getAudioSamples () {
    return this._audioSamples;
  }

  /**
   * This method signs that a new machine frame has been started.
   * Swaps _audioSamples with _audioSamplePool so the previous frame's objects
   * can be reused in the next frame without GC pressure.
   */
  onNewFrame (): void {
    const tmp = this._audioSamplePool;
    this._audioSamplePool = this._audioSamples;
    this._audioSamples = tmp;
    this._audioSamples.length = 0;
    this._poolIndex = 0;
  }

  /**
   * Calculates the current audio value according to the CPU's clock
   */
  calculateCurrentAudioValue (): void {
    // --- Intentionally empty
  }

  /**
   * Renders the subsequent beeper sample according to the current EAR bit value.
   * Reuses pre-allocated slot objects from the previous frame to reduce GC pressure.
   * Applies a DC offset high-pass filter inline to remove constant bias.
   */
  setNextAudioSample (): void {
    this.calculateCurrentAudioValue();
    if (this.machine.tacts <= this._audioNextSampleTact) return;

    const raw = this.getCurrentSampleValue();

    // Try to reuse a pool object; allocate only when pool is exhausted
    let slot: AudioSample;
    if (this._poolIndex < this._audioSamplePool.length) {
      slot = this._audioSamplePool[this._poolIndex];
    } else {
      slot = { left: 0, right: 0 };
    }
    this._poolIndex++;

    // Apply DC high-pass filter inline into slot (eliminates temporary object allocation)
    const a = AudioDeviceBase.DC_FILTER_ALPHA;
    const outLeft = raw.left - this._dcFilterPrevInputLeft + a * this._dcFilterPrevOutputLeft;
    const outRight = raw.right - this._dcFilterPrevInputRight + a * this._dcFilterPrevOutputRight;
    this._dcFilterPrevInputLeft = raw.left;
    this._dcFilterPrevInputRight = raw.right;
    this._dcFilterPrevOutputLeft = outLeft;
    this._dcFilterPrevOutputRight = outRight;
    slot.left = Math.max(-1.0, Math.min(1.0, outLeft));
    slot.right = Math.max(-1.0, Math.min(1.0, outRight));

    this._audioSamples.push(slot);
    this._audioNextSampleTact +=
      this._audioSampleLength * this.machine.clockMultiplier;
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue (): AudioSample {
    return { left: 0.0, right: 0.0 };
  }
}
