import type { IGenericBeeperDevice } from "@emuabstr/IGenericBeeperDevice";
import type { IZ88Machine } from "@emuabstr/IZ88Machine";

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
