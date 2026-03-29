import type { IAudioDevice } from "./IAudioDevice";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

/**
 * The 4 discrete amplitude levels for the Spectrum beeper, matching real hardware.
 * The speaker is driven by a resistor mixer combining EAR (bit 4) and MIC (bit 3)
 * of port 0xFE, producing 4 distinct output levels.
 */
export const BEEPER_LEVELS: readonly number[] = [0.0, 0.33, 0.66, 1.0] as const;

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface IGenericBeeperDevice<T extends IAnyMachine> extends IAudioDevice<T> {
  /**
   * The current value of the EAR bit
   */
  earBit: boolean;

  /**
   * The current speaker output level (0.0, 0.33, 0.66, or 1.0)
   */
  readonly outputLevel: number;

  /**
   * This method sets the EAR bit value to generate sound with the beeper.
   * @param value EAR bit value to set
   */
  setEarBit(value: boolean): void;

  /**
   * Sets the speaker output level using both EAR (bit 4) and MIC (bit 3) of port 0xFE.
   * Combines the two bits into a 2-bit index selecting one of 4 amplitude levels,
   * matching the real Spectrum hardware resistor mixer.
   * @param earBit EAR output (bit 4 of port 0xFE)
   * @param micBit MIC output (bit 3 of port 0xFE)
   */
  setOutputLevel(earBit: boolean, micBit: boolean): void;
}
