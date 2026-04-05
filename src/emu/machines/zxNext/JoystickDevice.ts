import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export enum JoystickMode {
  Sinclair2 = 0b000, // --- 12345
  Kempston1 = 0b001, // --- port 0x1f
  Cursor = 0b010, // --- 56780
  Sinclair1 = 0b011, // --- 67890
  Kempston2 = 0b100, // --- port 0x37
  MD1 = 0b101, // --- 3 or 6 button joystick, port 0x1f
  MD2 = 0b110, // --- 3 or 6 button joystick, port 0x37
  UserDefined = 0b111 // --- User-defined keys joystick
}

/**
 * Kempston joystick port bit layout (active high):
 *   bit 0 = right
 *   bit 1 = left
 *   bit 2 = down
 *   bit 3 = up
 *   bit 4 = fire 1 / B
 *   bit 5 = fire 2 / C
 *   bit 6 = A (MD mode only, 0 in standard Kempston)
 *   bit 7 = Start (MD mode only, 0 in standard Kempston)
 */
export class JoystickDevice implements IGenericDevice<IZxNextMachine> {
  // --- Configuration from NR 0x05
  joystick1Mode: JoystickMode;
  joystick2Mode: JoystickMode;

  // --- I/O mode from NR 0x0B
  ioModeEnabled: boolean;
  ioMode: number;
  ioModeParam: boolean;

  // --- Left connector state (active high, bits 7:0 = Start A C B Up Down Left Right)
  leftState: number;

  // --- Right connector state (active high, bits 7:0 = Start A C B Up Down Left Right)
  rightState: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.joystick1Mode = JoystickMode.Sinclair2;
    this.joystick2Mode = JoystickMode.Sinclair2;
    this.ioModeEnabled = false;
    this.ioMode = 0;
    this.ioModeParam = true;
    this.leftState = 0x00;
    this.rightState = 0x00;
  }

  /**
   * Set the full 8-bit state for the left connector
   */
  setLeftState(state: number): void {
    this.leftState = state & 0xff;
  }

  /**
   * Set the full 8-bit state for the right connector
   */
  setRightState(state: number): void {
    this.rightState = state & 0xff;
  }

  /**
   * Read port 0x1F (Kempston joy 1 / MD pad 1)
   * FPGA: port_1f_dat = joyL_1f | joyR_1f
   */
  readPort1f(): number {
    const joy1 = this.joystick1Mode;
    const joy2 = this.joystick2Mode;

    // --- Left connector contribution to port 0x1F
    const mdL_1f = joy1 === JoystickMode.MD1;
    const joyL_1f = joy1 === JoystickMode.Kempston1 || mdL_1f;

    let left = 0x00;
    if (joyL_1f) {
      left = this.leftState & 0x3f;
    }
    if (mdL_1f) {
      left |= this.leftState & 0xc0;
    }

    // --- Right connector contribution to port 0x1F
    const mdR_1f = joy2 === JoystickMode.MD1;
    const joyR_1f = joy2 === JoystickMode.Kempston1 || mdR_1f;

    let right = 0x00;
    if (joyR_1f) {
      right = this.rightState & 0x3f;
    }
    if (mdR_1f) {
      right |= this.rightState & 0xc0;
    }

    return left | right;
  }

  /**
   * Read port 0x37 (Kempston joy 2 / MD pad 2)
   * FPGA: port_37_dat = joyL_37 | joyR_37
   */
  readPort37(): number {
    const joy1 = this.joystick1Mode;
    const joy2 = this.joystick2Mode;

    // --- Left connector contribution to port 0x37
    const mdL_37 = joy1 === JoystickMode.MD2;
    const joyL_37 = joy1 === JoystickMode.Kempston2 || mdL_37;

    let left = 0x00;
    if (joyL_37) {
      left = this.leftState & 0x3f;
    }
    if (mdL_37) {
      left |= this.leftState & 0xc0;
    }

    // --- Right connector contribution to port 0x37
    const mdR_37 = joy2 === JoystickMode.MD2;
    const joyR_37 = joy2 === JoystickMode.Kempston2 || mdR_37;

    let right = 0x00;
    if (joyR_37) {
      right = this.rightState & 0x3f;
    }
    if (mdR_37) {
      right |= this.rightState & 0xc0;
    }

    return left | right;
  }
}
