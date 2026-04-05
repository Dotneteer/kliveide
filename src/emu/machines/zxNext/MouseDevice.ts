import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Kempston mouse device for ZX Spectrum Next
 *
 * Ports:
 *   0xFBDF — X position (8-bit wrapping accumulator)
 *   0xFFDF — Y position (8-bit wrapping accumulator, increments up, decrements down)
 *   0xFADF — bits 7:4 = wheel (4-bit wrapping), bit 3 = 1, bit 2 = middle, bit 1 = left, bit 0 = right
 *
 * Buttons are active HIGH (1 = pressed).
 * NR 0x0A controls DPI (bits 1:0) and button swap (bit 3).
 */
export class MouseDevice implements IGenericDevice<IZxNextMachine> {
  // --- NR 0x0A configuration
  swapButtons: boolean;
  dpi: number;

  // --- 8-bit wrapping position accumulators
  xPos: number;
  yPos: number;

  // --- 4-bit wrapping wheel accumulator (only lower 4 bits used)
  wheelZ: number;

  // --- Button state (active HIGH)
  buttonLeft: boolean;
  buttonRight: boolean;
  buttonMiddle: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.xPos = 0;
    this.yPos = 0;
    this.wheelZ = 0;
    this.buttonLeft = false;
    this.buttonRight = false;
    this.buttonMiddle = false;
    // --- swapButtons and dpi are managed by NR 0x0A hard reset (0x01)
    // --- On soft reset, they persist; on hard reset NextRegDevice sets them
    this.swapButtons = false;
    this.dpi = 1; // Default DPI
  }

  /**
   * Add a mouse movement delta. DPI scaling is applied before accumulation.
   * @param dx - Raw X delta (positive = right)
   * @param dy - Raw Y delta (positive = up)
   */
  addDelta(dx: number, dy: number): void {
    // --- Apply DPI scaling (matches FPGA ps2_mouse.v behavior)
    // --- DPI 00: shift left 1 (double speed, "low DPI" = less precise)
    // --- DPI 01: no shift (default)
    // --- DPI 10: shift right 1 (half speed, "medium DPI")
    // --- DPI 11: shift right 2 (quarter speed, "high DPI")
    switch (this.dpi & 0x03) {
      case 0:
        dx = dx << 1;
        dy = dy << 1;
        break;
      case 1:
        // --- Default, no change
        break;
      case 2:
        dx = dx >> 1;
        dy = dy >> 1;
        break;
      case 3:
        dx = dx >> 2;
        dy = dy >> 2;
        break;
    }

    // --- Accumulate with 8-bit wrapping
    this.xPos = (this.xPos + dx) & 0xff;
    this.yPos = (this.yPos + dy) & 0xff;
  }

  /**
   * Add a wheel delta.
   * @param dz - Raw wheel delta (positive = scroll up)
   */
  addWheelDelta(dz: number): void {
    this.wheelZ = (this.wheelZ + dz) & 0x0f;
  }

  /**
   * Set button state.
   * @param left - Left button pressed
   * @param right - Right button pressed
   * @param middle - Middle button pressed
   */
  setButtons(left: boolean, right: boolean, middle: boolean): void {
    this.buttonLeft = left;
    this.buttonRight = right;
    this.buttonMiddle = middle;
  }

  /**
   * Read port 0xFBDF — Mouse X position
   */
  readPortFbdf(): number {
    return this.xPos;
  }

  /**
   * Read port 0xFFDF — Mouse Y position
   */
  readPortFfdf(): number {
    return this.yPos;
  }

  /**
   * Read port 0xFADF — Wheel + buttons
   * bits 7:4 = wheel (4-bit), bit 3 = 1, bit 2 = middle, bit 1 = left, bit 0 = right
   * Button swap (NR 0x0A bit 3) exchanges left and right in the output
   */
  readPortFadf(): number {
    const left = this.swapButtons ? this.buttonRight : this.buttonLeft;
    const right = this.swapButtons ? this.buttonLeft : this.buttonRight;

    return (
      ((this.wheelZ & 0x0f) << 4) |
      0x08 | // bit 3 always 1
      (this.buttonMiddle ? 0x04 : 0x00) |
      (left ? 0x02 : 0x00) |
      (right ? 0x01 : 0x00)
    );
  }
}
