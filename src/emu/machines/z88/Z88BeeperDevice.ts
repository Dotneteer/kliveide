import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import type { IZ88BeeperDevice } from "./IZ88BeeperDevice";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import { AudioDeviceBase } from "../AudioDeviceBase";
import { COMFlags } from "./IZ88BlinkDevice";

// --- This class implements the ZX Spectrum beeper device.
export class Z88BeeperDevice extends AudioDeviceBase<IZ88Machine> implements IZ88BeeperDevice {
  private _earBit = false;
  private _oscillatorBit = false;

  /// <summary>
  /// Initialize the beeper device and assign it to its host machine.
  /// </summary>
  /// <param name="machine">The machine hosting this device</param>
  constructor(public readonly machine: IZ88Machine) {
    super(machine);
  }

  /**
   * The current value of the EAR bit
   */
  get earBit(): boolean {
    return this._earBit;
  }

  /**
   * This method sets the EAR bit value to generate sound with the beeper.
   * @param value EAR bit value to set
   */
  setEarBit(value: boolean): void {
    this._earBit = value;
  }

  /**
   * Gets the current value of the oscillator bit
   */
  get oscillatorBit(): boolean {
    return this._oscillatorBit;
  }

  /**
   * Calculates the current value of the oscillator bit
   */
  calculateOscillatorBit(): void {
    const m = this.machine;
    this._oscillatorBit = !!(
      (m.tacts / Math.floor((m.baseClockFrequency * m.clockMultiplier) / 6400)) &
      0x01
    );
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue(): AudioSample {
    const blink = this.machine.blinkDevice;
    let sampleBit =
      blink.COM & COMFlags.SRUN
        ? blink.COM & COMFlags.SBIT
          ? false
          : this._oscillatorBit
        : this._earBit;
    const value = sampleBit ? 1.0 : 0.0;
    return { left: value, right: value };
  }
}
