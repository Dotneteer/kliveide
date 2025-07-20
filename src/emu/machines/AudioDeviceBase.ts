import type { IAudioDevice } from "@emu/abstractions/IAudioDevice";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * This class represents the functionality of an audio device that can generate audio samples
 */
export class AudioDeviceBase<T extends IAnyMachine> implements IAudioDevice<T> {
  private _audioSampleRate = 0;
  private _audioSampleLength = 0;
  private _audioNextSampleTact = 0;
  private readonly _audioSamples: number[] = [];

  /**
   * Initialize the audio device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: T) {}

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // --- Nothing to dispose
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    this._audioSampleLength = 0;
    this._audioNextSampleTact = 0;
    this._audioSamples.length = 0;
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
   * Renders the subsequent beeper sample according to the current EAR bit value
   */
  setNextAudioSample (): void {
    this.calculateCurrentAudioValue();
    if (this.machine.tacts <= this._audioNextSampleTact) return;

    this._audioSamples.push(this.getCurrentSampleValue());
    this._audioNextSampleTact +=
      this._audioSampleLength * this.machine.clockMultiplier;
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue () {
    return 0.0;
  }
}
