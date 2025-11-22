import { IAnyMachine } from "./IAnyMachine";

/**
 * This interface represents the operations of a generic device and is intended to be the base interface of all device
 * definitions.
 */
export interface IGenericDevice<TMachine extends IAnyMachine> {
  /**
   * Get the machine that hosts the device.
   */
  machine: TMachine;

  /**
   * Reset the device to its initial state.
   */
  reset(): void;

  /**
   * Optional hard reset operation
   */
  hardReset?: () => void;

  /**
   * Dispose the resources held by the device (optional)
   */
  dispose?(): void;

  /**
   * Check if the device asks for a non-maskable interrupt (NMI).
   */
  requestsNmi?: () => boolean;

  /**
   * Check if the device asks for an interrupt request (IRQ).
   */
  requestsIrq?: () => boolean;
}