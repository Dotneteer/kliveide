import type { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";
import type { IZ88DeviceHost } from "./IZ88DeviceHost";

/**
 * This interface defines the properties and operations of the Cambridge Z88's beeper device.
 */
export interface IZ88BeeperDevice extends IGenericBeeperDevice<IZ88DeviceHost> {
  /**
   * Gets the current value of the oscillator bit
   */
  oscillatorBit: boolean;

  /**
   * Calculates the current value of the oscillator bit
   */
  calculateOscillatorBit(): void;
}
