import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88KeyboardDevice } from "./IZ88KeyboardDevice";
import { INTFlags, STAFlags } from "./IZ88BlinkDevice";

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
  constructor (public readonly machine: IZ88Machine) {
    this.reset();
  }

  /**
   * Indicates if there is any key pressed
   */
  isKeyPressed: boolean;

  /**
   * Indicates if the left shift key is pressed
   */
  isLeftShiftDown: boolean;

  /**
   * Indicates if the right shift key is pressed
   */
  isRightShiftDown: boolean;

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

  /**
   * Set the status of the specified keyboard key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setStatus (key: number, isDown: boolean): void {
    // --- Ignore invalid key codes
    if (key > 63) {
      return;
    }
    // --- Take not of shift keys
    if (key === 63) {
      this.isRightShiftDown = isDown;
    }
    if (key === 54) {
      this.isLeftShiftDown = isDown;
    }

    // --- Calculate line address and mask
    const line = key >>> 3;
    const mask = 1 << (key & 0x07);

    if (isDown) {
      // --- Set the key pressed
      this._lineStatus[line] |= mask;
    } else {
      // --- Set the key released
      this._lineStatus[line] &= ~mask;
    }

    // --- Test if a key is pressed
    this.isKeyPressed = false;
    for (let i = 0; i < 8; i++) {
      this.isKeyPressed ||= !!this._lineStatus[i];
    }

    // --- If a key is pressed, we may need an interrupt
    const blink = this.machine.blinkDevice;
    if (this.isKeyPressed) {
      if (blink.INT & INTFlags.KEY) {
        if (!(blink.STA & STAFlags.KEY)) {
          // --- Yes, sign an interrupt
          blink.setSTA(blink.STA | STAFlags.KEY);
        }
      }

      if (blink.INT & INTFlags.KWAIT) {
        this.machine.awakeCpu();
      }
    }
  }

  /**
   * Get the status of the specified keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getStatus (key: number): boolean {
    // ---Ignore invalid key codes
    if (key > 63) {
      return false;
    }
    return !!(this._lineStatus[key >>> 3] & (1 << (key & 0x07)));
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
   * @param line Port address of the line to query
   * @returns The data byte representing the keyboard status
   */
  getKeyLineStatus (line: number): number {
    let status = 0;
    let lineIndex = 0;
    line ^= 0xff;
    while (lineIndex < 8) {
      if (line & 0x01) {
        status |= this._lineStatus[lineIndex];
      }
      lineIndex += 1;
      line >>= 1;
    }
    return status ^ 0xff;
  }
}
