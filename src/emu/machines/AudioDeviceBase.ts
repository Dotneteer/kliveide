import type { IAudioDevice, AudioSample } from "@emu/abstractions/IAudioDevice";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * This class represents the functionality of an audio device that can generate audio samples
 */
export class AudioDeviceBase<T extends IAnyMachine> implements IAudioDevice<T> {
  private _audioSampleRate = 0;
  private _audioSampleLength = 0;
  private _audioNextSampleTact = 0;
  private readonly _audioSamples: AudioSample[] = [];

  // --- DC offset high-pass filter state (Phase 3)
  // y[n] = α × (y[n-1] + x[n] - x[n-1]) where α ≈ 0.995
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
   * This method signs that a new machine frame has been started
   */
  onNewFrame (): void {
    this._audioSamples.length = 0;
  }

  /**
   * Calculates the current audio value according to the CPU's clock
   */
  calculateCurrentAudioValue (): void {
    // --- Intentionally empty
  }

  /**
   * Renders the subsequent beeper sample according to the current EAR bit value.
   * Applies a DC offset high-pass filter to remove constant bias.
   */
  setNextAudioSample (): void {
    this.calculateCurrentAudioValue();
    if (this.machine.tacts <= this._audioNextSampleTact) return;

    const raw = this.getCurrentSampleValue();
    const filtered = this.applyDcFilter(raw);
    this._audioSamples.push(filtered);
    this._audioNextSampleTact +=
      this._audioSampleLength * this.machine.clockMultiplier;
  }

  /**
   * Applies a first-order high-pass (AC coupling) filter to remove DC offset.
   * y[n] = α × (y[n-1] + x[n] - x[n-1])
   */
  private applyDcFilter (sample: AudioSample): AudioSample {
    const a = AudioDeviceBase.DC_FILTER_ALPHA;

    const outLeft = a * (this._dcFilterPrevOutputLeft + sample.left - this._dcFilterPrevInputLeft);
    const outRight = a * (this._dcFilterPrevOutputRight + sample.right - this._dcFilterPrevInputRight);

    this._dcFilterPrevInputLeft = sample.left;
    this._dcFilterPrevInputRight = sample.right;
    this._dcFilterPrevOutputLeft = outLeft;
    this._dcFilterPrevOutputRight = outRight;

    return { left: outLeft, right: outRight };
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue (): AudioSample {
    return { left: 0.0, right: 0.0 };
  }
}
