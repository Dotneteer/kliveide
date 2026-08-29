import type { ISpectrumBeeperDevice } from "./zxSpectrum/ISpectrumBeeperDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { BEEPER_LEVELS } from "@emu/abstractions/IGenericBeeperDevice";

import { AudioDeviceBase } from "./AudioDeviceBase";

export type BeeperTransition = {
  tact: number;
  ear: boolean;
  mic: boolean;
};

// --- This class implements the ZX Spectrum beeper device.
export class SpectrumBeeperDevice
  extends AudioDeviceBase<IZxSpectrumMachine | IZxNextMachine>
  implements ISpectrumBeeperDevice
{
  private _earBit = false;
  private _micBit = false;
  private _outputLevel = 0.0;  // Kept for backward-compat outputLevel getter

  // --- Separate EAR and MIC transition tracking (FPGA model: independent binary signals).
  // left channel = EAR (time-weighted), right channel = MIC (time-weighted).
  private _sampleWindowStartTact = 0;
  private _sampleWindowStartEar = false;
  private _sampleWindowStartMic = false;
  private readonly _transitions: BeeperTransition[] = [];

  constructor(public readonly machine: IZxSpectrumMachine | IZxNextMachine) {
    super(machine);
  }

  /**
   * The current value of the EAR bit
   */
  get earBit(): boolean {
    return this._earBit;
  }

  /**
   * The current speaker output level (0.0, 0.33, 0.66, or 1.0)
   */
  get outputLevel(): number {
    return this._outputLevel;
  }

  /**
   * This method sets the EAR bit value to generate sound with the beeper.
   * For backward compatibility, sets the output level using the EAR bit alone
   * (MIC bit remains at its last value).
   * @param value EAR bit value to set
   */
  setEarBit(value: boolean): void {
    this.setOutputLevel(value, this._micBit);
  }

  /**
   * Sets the speaker output level using both EAR (bit 4) and MIC (bit 3) of port 0xFE.
   * Combines the two bits into a 2-bit index selecting one of 4 amplitude levels,
   * matching the real Spectrum hardware resistor mixer (as in MAME):
   *   (mic=0, ear=0) → 0.00
   *   (mic=1, ear=0) → 0.33
   *   (mic=0, ear=1) → 0.66
   *   (mic=1, ear=1) → 1.00
   * @param earBit EAR output (bit 4 of port 0xFE)
   * @param micBit MIC output (bit 3 of port 0xFE)
   */
  setOutputLevel(earBit: boolean, micBit: boolean): void {
    this._outputLevel = BEEPER_LEVELS[(micBit ? 1 : 0) | (earBit ? 2 : 0)]; // backward compat
    if (earBit !== this._earBit || micBit !== this._micBit) {
      this._transitions.push({ tact: this.machine.tacts, ear: earBit, mic: micBit });
    }
    this._earBit = earBit;
    this._micBit = micBit;
  }

  /**
   * Gets the current sound sample using transition-weighted averaging.
   * ZX Next returns independent EAR/MIC duties. Classic Spectrum machines return
   * the resistor-mixed mono beeper level duplicated to both channels.
   */
  getCurrentSampleValue(sampleEndTact = this.machine.tacts): AudioSample {
    const keepSignalsSeparate = this.machine.machineId === "zxnext";
    const sampleStartTact = this._sampleWindowStartTact;
    if (sampleEndTact <= sampleStartTact) {
      if (keepSignalsSeparate) {
        return { left: this._earBit ? 1.0 : 0.0, right: this._micBit ? 1.0 : 0.0 };
      }
      return { left: this._outputLevel, right: this._outputLevel };
    }

    let cursor = sampleStartTact;
    let ear = this._sampleWindowStartEar;
    let mic = this._sampleWindowStartMic;
    let totalEar = 0.0;
    let totalMic = 0.0;
    let totalMixed = 0.0;
    let consumed = 0;

    while (consumed < this._transitions.length) {
      const transition = this._transitions[consumed];
      if (transition.tact >= sampleEndTact) break;

      const transitionTact = Math.max(cursor, transition.tact);
      const duration = transitionTact - cursor;
      if (duration > 0) {
        totalEar += (ear ? 1.0 : 0.0) * duration;
        totalMic += (mic ? 1.0 : 0.0) * duration;
        totalMixed += BEEPER_LEVELS[(mic ? 1 : 0) | (ear ? 2 : 0)] * duration;
      }
      cursor = transitionTact;
      ear = transition.ear;
      mic = transition.mic;
      consumed++;
    }

    const finalDuration = sampleEndTact - cursor;
    if (finalDuration > 0) {
      totalEar += (ear ? 1.0 : 0.0) * finalDuration;
      totalMic += (mic ? 1.0 : 0.0) * finalDuration;
      totalMixed += BEEPER_LEVELS[(mic ? 1 : 0) | (ear ? 2 : 0)] * finalDuration;
    }

    if (consumed > 0) {
      this._transitions.splice(0, consumed);
    }

    this._sampleWindowStartTact = sampleEndTact;
    this._sampleWindowStartEar = ear;
    this._sampleWindowStartMic = mic;

    const totalTacts = sampleEndTact - sampleStartTact;
    if (!keepSignalsSeparate) {
      const mixed = totalTacts > 0 ? totalMixed / totalTacts : BEEPER_LEVELS[(mic ? 1 : 0) | (ear ? 2 : 0)];
      return { left: mixed, right: mixed };
    }

    return {
      left: totalTacts > 0 ? totalEar / totalTacts : (ear ? 1.0 : 0.0),
      right: totalTacts > 0 ? totalMic / totalTacts : (mic ? 1.0 : 0.0)
    };
  }

  /**
   * Replays a tact-ordered EAR/MIC transition trace and renders audio samples
   * through the same time-weighted beeper model used by the TypeScript backend.
   * @param transitions Frame-relative transition records
   * @param frameStartTact Absolute tact at which the C execution slice started
   * @param frameStartOffset Frame tact at which the C execution slice started
   * @param frameTacts Number of tacts in a full frame
   * @param frameEndTact Absolute tact reached after C execution
   */
  renderTransitionTrace(
    transitions: readonly BeeperTransition[],
    frameStartTact: number,
    frameStartOffset: number,
    frameTacts: number,
    frameEndTact: number
  ): void {
    const savedTact = this.machine.tacts;
    let previousAbsoluteTact = frameStartTact;

    for (const transition of transitions) {
      const relativeTact =
        frameTacts <= 0
          ? transition.tact
          : (transition.tact - frameStartOffset + frameTacts) % frameTacts;
      let absoluteTact = frameStartTact + relativeTact;
      while (absoluteTact < previousAbsoluteTact) {
        absoluteTact += frameTacts;
      }
      this.renderSamplesUntilTact(absoluteTact);
      this.machine.setTacts(absoluteTact);
      this.setOutputLevel(transition.ear, transition.mic);
      previousAbsoluteTact = absoluteTact;
    }

    this.renderSamplesUntilTact(Math.max(frameEndTact, previousAbsoluteTact));
    this.machine.setTacts(savedTact);
  }

  /**
   * Reset the device to its initial state.
   */
  reset(): void {
    super.reset();
    this._transitions.length = 0;
    this._sampleWindowStartTact = 0;
    this._sampleWindowStartEar = this._earBit;
    this._sampleWindowStartMic = this._micBit;
  }

  /**
   * Called when a new frame starts.
   */
  onNewFrame(): void {
    super.onNewFrame();
    this._transitions.length = 0;
    this._sampleWindowStartTact = this.machine.tacts;
    this._sampleWindowStartEar = this._earBit;
    this._sampleWindowStartMic = this._micBit;
  }
}
