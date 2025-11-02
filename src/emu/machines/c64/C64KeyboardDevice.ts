import { IGenericKeyboardDevice } from "../../abstractions/IGenericKeyboardDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * This class implements the Commodore 64 keyboard device.
 * The C64 keyboard is arranged in an 8×8 matrix, with rows and columns 
 * handled by the CIA #1 chip via Port A (rows) and Port B (columns).
 */
export class C64KeyboardDevice implements IGenericKeyboardDevice<IC64Machine> {
  /**
   * This field stores the status bits of keys. Each element in the array represents a row 
   * in the keyboard matrix, with bits 0-7 representing the 8 columns in that row.
   * A bit value of 1 means the key is pressed; 0 means it is not pressed.
   */
  private _lineStatus: number[] = [];

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
   * Indicates if the Commodore key is pressed
   */
  isCommodoreKeyDown: boolean;
  
  /**
   * Indicates if the Ctrl key is pressed
   */
  isCtrlKeyDown: boolean;

  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public machine: IC64Machine) {
    this.reset();
  }

  /**
   * Set the status of the specified keyboard key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    // --- Ignore invalid key codes
    if (key > 63) {
      return;
    }
    
    // --- Take note of special modifier keys
    if (key === 15) {
      this.isLeftShiftDown = isDown;
    } else if (key === 52) {
      this.isRightShiftDown = isDown;
    } else if (key === 61) {
      this.isCommodoreKeyDown = isDown;
    } else if (key === 58) {
      this.isCtrlKeyDown = isDown;
    }

    // --- Calculate row and column mask
    const row = key >> 3;
    const mask = 1 << (key & 0x07);

    if (isDown) {
      // --- Set the key pressed
      this._lineStatus[row] |= mask;
    } else {
      // --- Set the key released
      this._lineStatus[row] &= ~mask;
    }

    // --- Test if any key is pressed
    this.isKeyPressed = false;
    for (let i = 0; i < 8; i++) {
      this.isKeyPressed ||= !!this._lineStatus[i];
    }
    
    // --- In a full implementation, this would handle keyboard interrupt signaling 
    // --- via the CIA #1 chip if needed
  }

  /**
   * Get the status of the specified keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getKeyStatus(key: number): boolean {
    // --- Ignore invalid key codes
    if (key > 63) {
      return false;
    }
    return !!(this._lineStatus[key >> 3] & (1 << (key & 0x07)));
  }

  /**
   * Gets the value of the specified key row for CIA #1 Port B reading
   * @param row Key row index (0-7)
   * @returns Key row value (active low, so 0 bits indicate pressed keys)
   */
  getKeyLineValue(row: number): number {
    if (row < 0 || row >= 8) return 0xff;
    // --- Return inverted value since C64 keyboard uses active-low signaling
    // --- (0 bit means key is pressed, 1 bit means key is not pressed)
    return ~this._lineStatus[row] & 0xff;
  }

  /**
   * This method queries the status of the keyboard matrix using the row selection value.
   * @param rowSelect Port A value that selects which rows to read (active low)
   * @returns The column data byte representing the keyboard status for Port B (active low)
   */
  getKeyLineStatus(rowSelect: number): number {
    // --- When a bit in rowSelect is 0, that row is selected
    // --- When multiple rows are selected, the results are combined with AND
    // --- (this is how the physical circuit works due to the open-collector outputs)
    let result = 0xff;
    
    for (let row = 0; row < 8; row++) {
      if ((rowSelect & (1 << row)) === 0) {
        // --- This row is selected (bit is 0)
        result &= ~this._lineStatus[row] & 0xff; // Invert for active-low signaling
      }
    }
    return result;
  }

  /**
   * Reset the device to its initial state.
   */
  reset(): void {
    // --- Initialize all rows to 0 (no keys pressed)
    for (let i = 0; i < 8; i++) {
      this._lineStatus[i] = 0;
    }
    
    this.isKeyPressed = false;
    this.isLeftShiftDown = false;
    this.isRightShiftDown = false;
    this.isCommodoreKeyDown = false;
    this.isCtrlKeyDown = false;
  }

  /**
   * Dispose the resources held by the device
   */
  dispose(): void {
    // No resources to clean up in this implementation
  }
}
