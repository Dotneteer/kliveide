import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { AudioDeviceBase } from "../AudioDeviceBase";
import { IZ88BeeperDevice } from "./IZ88BeeperDevice";

// --- This class implements the ZX Spectrum beeper device.
export class Z88BeeperDevice
  extends AudioDeviceBase<IZ88Machine>
  implements IZ88BeeperDevice
{
  private _earBit = false;

  /// <summary>
  /// Initialize the beeper device and assign it to its host machine.
  /// </summary>
  /// <param name="machine">The machine hosting this device</param>
  constructor (public readonly machine: IZ88Machine) {
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
   * Gets the current value of the oscillator bit
   */
  get oscillatorBit (): boolean {
    // TODO: Implement this
    return false;
  }

  /**
   * Gets the current sound sample (according to the current CPU tact)
   */
  getCurrentSampleValue (): number {
    // TODO: Implement this
    return this._earBit ? 1.0 : 0.0;
  }
}
