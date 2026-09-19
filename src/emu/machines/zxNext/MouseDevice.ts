import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/** Mouse buttons in a PS/2 packet (and `receivePacket`): bit 0 left, bit 1 right, bit 2 middle. */
export const MOUSE_LEFT = 0x01;
export const MOUSE_RIGHT = 0x02;
export const MOUSE_MIDDLE = 0x04;

/**
 * The Kempston mouse (input/ps2_mouse.v behind zxnext.vhd ~2622-2626, ~3538-3557). The PS/2 mouse
 * sends packets; each one latches the buttons and adds its X, Y and wheel deltas to 8-bit counters.
 * NextReg `$0A` bit 3 (button reverse) and bits 1-0 (DPI) act on each packet as it arrives - not on
 * what was counted before. The counters clear only at power-on (`m_reset`), not on a Next reset.
 * zxnext-input.c implements the same model in the WASM core.
 *
 * Ports: $xBDF X, $xFDF Y, $xADF = wheel (7-4) & 1 & not middle & not left & not right.
 */
export class MouseDevice implements IGenericDevice<IZxNextMachine> {
  // --- NR 0x0A configuration (no reset branch: zxnext.vhd initial values)
  swapButtons = false;
  dpi = 1;

  // --- ps2_mouse.v xcount / ycount / zcount (8 bits; the port shows zcount's low nibble)
  xPos = 0;
  yPos = 0;
  wheelZ = 0;

  // --- {mthird, mright, mleft} as latched from the last packet (1 = pressed)
  buttonLeft = false;
  buttonRight = false;
  buttonMiddle = false;

  constructor(public readonly machine: IZxNextMachine) {}

  /** A Next reset does not reach the mouse (its reset is the power-on `m_reset`). */
  reset(): void {}

  hardReset(): void {
    this.xPos = 0;
    this.yPos = 0;
    this.wheelZ = 0;
    this.buttonLeft = this.buttonRight = this.buttonMiddle = false;
  }

  /**
   * ps2_mouse.v `xydelta`: the packet's 8-bit data byte by DPI - 00 doubled, 01 as is, 10 and 11
   * arithmetic shifts of that byte by 1 and 2 (its bit 7 is the sign; the 9th bit of the PS/2 delta is
   * not used).
   */
  private scaled(delta: number): number {
    const b = delta & 0xff;
    switch (this.dpi & 0x03) {
      case 0:
        return (b << 1) & 0xff;
      case 1:
        return b;
      case 2:
        return (b & 0x80) | (b >> 1);
      default:
        return ((b & 0x80) ? 0xc0 : 0x00) | (b >> 2);
    }
  }

  /**
   * One PS/2 packet: `buttons` (MOUSE_LEFT | MOUSE_RIGHT | MOUSE_MIDDLE), X and Y deltas (-255..255,
   * positive = right / up) and the 4-bit wheel delta.
   */
  receivePacket(buttons: number, dx: number, dy: number, dz: number): void {
    const left = (buttons & MOUSE_LEFT) !== 0;
    const right = (buttons & MOUSE_RIGHT) !== 0;
    // --- mbutton: with the reverse bit set, left and right trade places as the packet is taken
    this.buttonLeft = this.swapButtons ? right : left;
    this.buttonRight = this.swapButtons ? left : right;
    this.buttonMiddle = (buttons & MOUSE_MIDDLE) !== 0;
    this.xPos = (this.xPos + this.scaled(dx)) & 0xff;
    this.yPos = (this.yPos + this.scaled(dy)) & 0xff;
    const nibble = dz & 0x0f;
    this.wheelZ = (this.wheelZ + (nibble & 0x08 ? nibble | 0xf0 : nibble)) & 0xff;
  }

  readPortFbdf(): number {
    return this.xPos;
  }

  readPortFfdf(): number {
    return this.yPos;
  }

  /** zxnext.vhd ~3557: wheel & '1' & not middle & not left & not right (0 = pressed). */
  readPortFadf(): number {
    return (
      ((this.wheelZ & 0x0f) << 4) |
      0x08 |
      (this.buttonMiddle ? 0x00 : 0x04) |
      (this.buttonLeft ? 0x00 : 0x02) |
      (this.buttonRight ? 0x00 : 0x01)
    );
  }
}
