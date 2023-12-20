import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { Z88KeyCode } from "./Z88KeyCode";

/**
 * This interface defines the properties and operations of the Cambridge Z88 keyboard device.
 */
export interface IZ88KeyboardDevice extends IGenericDevice<IZ88Machine> {
  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setStatus(key: Z88KeyCode, isDown: boolean): void;

  /**
   * Get the status of the specified Spectrum keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getStatus(key: Z88KeyCode): boolean;

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
