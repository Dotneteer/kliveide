import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";
import type { ISpectrumKeyboardDevice } from "./ISpectrumKeyboardDevice";
import type { IZxSpectrumMachine } from "@emuabstr/IZxSpectrumMachine";

/**
 * This class implements the ZX Spectrum keyboard device.
 */
export class KeyboardDevice implements ISpectrumKeyboardDevice {
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
  constructor (public readonly machine: (IZxSpectrumMachine | IZxNextMachine)) {}

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    for (let i = 0; i < 8; i++) this._lineStatus[i] = 0;
  }

  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down
   */
  setKeyStatus (key: number, isDown: boolean): void {
    const lineIndex = (key / 5) & 0xff;
    const lineMask = 1 << (key % 5 & 0xff);
    this._lineStatus[lineIndex] = isDown
      ? (this._lineStatus[lineIndex] | lineMask) & 0xff
      : this._lineStatus[lineIndex] & ~lineMask & 0xff;
  }

  /**
   * Get the status of the specified Spectrum keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getKeyStatus (key: number): boolean {
    const lineIndex = (key / 5) & 0xff;
    const lineMask = 1 << (key % 5 & 0xff);
    return (this._lineStatus[lineIndex] & lineMask) !== 0;
  }

  /**
   * Gets the value of the specified keyline
   * @param line Key line index
   * @returns Key line value
   */
  getKeyLineValue (line: number): number {
    return this._lineStatus[line & 0x07];
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
}
