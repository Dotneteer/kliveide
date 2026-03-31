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

export class JoystickDevice implements IGenericDevice<IZxNextMachine> {
  joystick1Mode: JoystickMode;
  joystick2Mode: JoystickMode;
  ioModeEnabled: boolean;
  ioMode: number;
  ioModeParam: boolean;

  // --- Joystick state (active high: bit0=right, bit1=left, bit2=down, bit3=up, bit4=fire, bits5-7=extra)
  joy1State: number;
  joy2State: number;

  // --- MD pad extra button state (bit3=X, bit2=Z, bit1=Y, bit0=Mode)
  joy1MdPadState: number;
  joy2MdPadState: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.joystick1Mode = JoystickMode.Sinclair2;
    this.joystick2Mode = JoystickMode.Sinclair2;
    this.ioModeEnabled = false;
    this.ioMode = 0;
    this.ioModeParam = true;
    this.joy1State = 0;
    this.joy2State = 0;
    this.joy1MdPadState = 0;
    this.joy2MdPadState = 0;
  }
}
