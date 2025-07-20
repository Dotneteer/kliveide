import type { IAudioDevice } from "./IAudioDevice";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface IGenericBeeperDevice<T extends IAnyMachine> extends IAudioDevice<T> {
  /**
   * The current value of the EAR bit
   */
  earBit: boolean;

  /**
   * This method sets the EAR bit value to generate sound with the beeper.
   * @param value EAR bit value to set
   */
  setEarBit(value: boolean): void;
}
