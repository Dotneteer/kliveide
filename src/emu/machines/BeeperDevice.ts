import { ISpectrumBeeperDevice } from "./zxSpectrum/ISpectrumBeeperDevice";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { AudioDeviceBase } from "./AudioDeviceBase";

// --- This class implements the ZX Spectrum beeper device.
export class SpectrumBeeperDevice extends AudioDeviceBase implements ISpectrumBeeperDevice {
  private _earBit = false;

  /// <summary>
  /// Initialize the beeper device and assign it to its host machine.
  /// </summary>
  /// <param name="machine">The machine hosting this device</param>
  constructor (public readonly machine: IZxSpectrumMachine) {
    super(machine);
  }

  /**
   * The current value of the EAR bit
   */
  get earBit (): boolean {
    return this._earBit;
  }

  /**
   * This method sets the EAR bit value to generate sound with the beeper.
   * @param value EAR bit value to set
   */
  setEarBit (value: boolean): void {
    this._earBit = value;
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue (): number {
    return this._earBit ? 1.0 : 0.0;
  }
}
