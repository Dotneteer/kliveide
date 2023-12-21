import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";

/**
 * This interface represents the operations of a generic device and is intended to be the base interface of all device
 * definitions.
 */
export interface IGenericDevice<TMachine extends IZ80Machine> {
  /**
   * Get the machine that hosts the device.
   */
  machine: TMachine;

  /**
   * Reset the device to its initial state.
   */
  reset(): void;

  /**
   * Dispose the resources held by the device
   */
  dispose(): void;
}
