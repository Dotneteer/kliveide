import type { ISpectrumBeeperDevice } from "./zxSpectrum/ISpectrumBeeperDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { BEEPER_LEVELS } from "@emu/abstractions/IGenericBeeperDevice";

import { AudioDeviceBase } from "./AudioDeviceBase";

// --- This class implements the ZX Spectrum beeper device.
export class SpectrumBeeperDevice
  extends AudioDeviceBase<IZxSpectrumMachine | IZxNextMachine>
  implements ISpectrumBeeperDevice
{
  private _earBit = false;
  private _micBit = false;
  private _outputLevel = 0.0;

  // --- Transition tracking for sample-accurate rendering (Phase 2)
  private _lastLevelChangeTact = 0;
  private _accumulatedLevel = 0;
  private _accumulatedTacts = 0;

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
    const newLevel = BEEPER_LEVELS[(micBit ? 1 : 0) | (earBit ? 2 : 0)];
    if (newLevel !== this._outputLevel) {
      // --- Record transition for weighted averaging (Phase 2)
      const currentTact = this.machine.tacts;
      const duration = currentTact - this._lastLevelChangeTact;
      if (duration > 0) {
        this._accumulatedLevel += this._outputLevel * duration;
        this._accumulatedTacts += duration;
      }
      this._lastLevelChangeTact = currentTact;
    }
    this._earBit = earBit;
    this._micBit = micBit;
    this._outputLevel = newLevel;
  }

  /**
   * Gets the current sound sample using transition-weighted averaging.
   * If the level changed multiple times during the current sample period,
   * the output is the time-weighted average of all levels held during that period.
   */
  getCurrentSampleValue(): AudioSample {
    let value: number;

    if (this._accumulatedTacts > 0) {
      // --- Include the final segment up to current tact
      const currentTact = this.machine.tacts;
      const finalDuration = currentTact - this._lastLevelChangeTact;
      const totalLevel = this._accumulatedLevel + this._outputLevel * finalDuration;
      const totalTacts = this._accumulatedTacts + finalDuration;
      value = totalLevel / totalTacts;

      // --- Reset accumulators for the next sample period
      this._accumulatedLevel = 0;
      this._accumulatedTacts = 0;
      this._lastLevelChangeTact = currentTact;
    } else {
      value = this._outputLevel;
    }

    return { left: value, right: value };
  }

  /**
   * Reset the device to its initial state.
   */
  reset(): void {
    super.reset();
    this._accumulatedLevel = 0;
    this._accumulatedTacts = 0;
    this._lastLevelChangeTact = 0;
  }

  /**
   * Called when a new frame starts.
   */
  onNewFrame(): void {
    super.onNewFrame();
    this._accumulatedLevel = 0;
    this._accumulatedTacts = 0;
    this._lastLevelChangeTact = this.machine.tacts;
  }
}
