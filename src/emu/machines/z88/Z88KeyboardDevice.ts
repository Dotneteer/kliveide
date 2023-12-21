import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88KeyboardDevice } from "./IZ88KeyboardDevice";
import { Z88KeyCode } from "./Z88KeyCode";

/**
 * This class implements the Cambridge Z88 keyboard device.
 */
export class Z88KeyboardDevice implements IZ88KeyboardDevice {
  /**
   * This field stores the status bits of keys. Each byte in the array represents an address line from A8 to A15,
   * and the lower five bits represent the five keys associated with the particular address line. One means the key
   * is pressed; zero stands for an unpressed key.
   */
  private _lineStatus: number[] = [];

  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZ88Machine) {}

  /**
   * Set the status of the specified keyboard key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setStatus (key: Z88KeyCode, isDown: boolean): void {
    // TODO: Implement this
  }

  /**
   * Get the status of the specified keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getStatus (key: Z88KeyCode): boolean {
    // TODO: Implement this
    return false;
  }

  /**
   * Gets the value of the specified keyline
   * @param line Key line index
   * @returns Key line value
   */
  getKeyLineValue (line: number): number {
    // TDOO: Implement this
    return 0xff;
  }

  /**
   * This method queries the status of the keyboard keys using the specified port address.
   * @param address Port address of the line to query
   * @returns The data byte representing the keyboard status
   */
  getKeyLineStatus (address: number): number {
    let status = 0;
    const lines = ~(address >> 8) & 0xff;
    for (let line = 0; line < 8; line++) {
      if ((lines & (1 << line)) !== 0) {
        status |= this._lineStatus[line];
      }
    }
    return ~status & 0xff;
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    for (let i = 0; i < 8; i++) this._lineStatus[i] = 0;
  }

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // --- Nothing to dispose
  }
}
