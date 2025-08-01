import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import type { IGenericDevice } from "./IGenericDevice";

export type KeyCodeSet = Record<string, number>;

/**
 * This interface defines the properties and operations of the ZX Spectrum's keyboard device.
 */
export interface IGenericKeyboardDevice<TMachine extends IAnyMachine>
  extends IGenericDevice<TMachine> {
  /**
   * Set the status of the specified keyboard key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setKeyStatus(key: number, isDown: boolean): void;

  /**
   * Get the status of the specified keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getKeyStatus(key: number): boolean;

  /**
   * Gets the value of the specified keyline
   * @param line Key line index
   * @returns Key line value
   */
  getKeyLineValue(line: number): number;

  /**
   * This method queries the status of the keyboard keys using the specified port address.
   * @param address Port address of the line to query
   * @returns The data byte representing the keyboard status
   */
  getKeyLineStatus(address: number): number;
}
