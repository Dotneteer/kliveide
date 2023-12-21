import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { IAudioDevice } from "./IAudioDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface IGenericBeeperDevice<T extends IZ80Machine> extends IAudioDevice<T> {
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
