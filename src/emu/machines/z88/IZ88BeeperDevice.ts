import { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";

/**
 * This interface defines the properties and operations of the Cambridge Z88's beeper device.
 */
export interface IZ88BeeperDevice extends IGenericBeeperDevice<IZ88Machine> {
  /**
   * Gets the current value of the oscillator bit
   */
  oscillatorBit: boolean;

  /**
   * Calculates the current value of the oscillator bit
   */
  calculateOscillatorBit(): void;
}
