import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";

export class NextKeyboardDevice extends KeyboardDevice {
  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public readonly machine: IZxNextMachine) {
    super(machine);
  }

  semicolonPressed: boolean;
  doubleQuotePressed: boolean;
  commaPressed: boolean;
  dotPressed: boolean;
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;

  deletePressed: boolean;
  editPressed: boolean;
  breakPressed: boolean;
  invVideoPressed: boolean;
  trueVideoPressed: boolean;
  graphPressed: boolean;
  capsLockPressed: boolean;
  extendPressed: boolean;

  rightPadXPressed: boolean;
  rightPadZPressed: boolean;
  rightPadYPressed: boolean;
  rightPadModePressed: boolean;
  leftPadXPressed: boolean;
  leftPadZPressed: boolean;
  leftPadYPressed: boolean;
  leftPadModePressed: boolean;

  cancelExtendedKeyEntries: boolean;

  reset(): void {
    super.reset();
    this.semicolonPressed = false;
    this.doubleQuotePressed = false;
    this.commaPressed = false;
    this.dotPressed = false;
    this.upPressed = false;
    this.downPressed = false;
    this.leftPressed = false;
    this.rightPressed = false;

    this.deletePressed = false;
    this.editPressed = false;
    this.breakPressed = false;
    this.invVideoPressed = false;
    this.trueVideoPressed = false;
    this.graphPressed = false;
    this.capsLockPressed = false;
    this.extendPressed = false;

    this.rightPadXPressed = false;
    this.rightPadZPressed = false;
    this.rightPadYPressed = false;
    this.rightPadModePressed = false;
    this.leftPadXPressed = false;
    this.leftPadZPressed = false;
    this.leftPadYPressed = false;
    this.leftPadModePressed = false;

    this.cancelExtendedKeyEntries = false;
  }

  get nextRegB0Value(): number {
    return (
      (this.semicolonPressed ? 0x80 : 0x00) |
      (this.doubleQuotePressed ? 0x40 : 0x00) |
      (this.commaPressed ? 0x20 : 0x00) |
      (this.dotPressed ? 0x10 : 0x00) |
      (this.upPressed ? 0x08 : 0x00) |
      (this.downPressed ? 0x04 : 0x00) |
      (this.leftPressed ? 0x02 : 0x00) |
      (this.rightPressed ? 0x01 : 0x00)
    );
  }

  get nextRegB1Value(): number {
    return (
      (this.deletePressed ? 0x80 : 0x00) |
      (this.editPressed ? 0x40 : 0x00) |
      (this.breakPressed ? 0x20 : 0x00) |
      (this.invVideoPressed ? 0x10 : 0x00) |
      (this.trueVideoPressed ? 0x08 : 0x00) |
      (this.graphPressed ? 0x04 : 0x00) |
      (this.capsLockPressed ? 0x02 : 0x00) |
      (this.extendPressed ? 0x01 : 0x00)
    );
  }

  get nextRegB2Value(): number {
    return (
      (this.rightPadXPressed ? 0x80 : 0x00) |
      (this.rightPadZPressed ? 0x40 : 0x00) |
      (this.rightPadYPressed ? 0x20 : 0x00) |
      (this.rightPadModePressed ? 0x10 : 0x00) |
      (this.leftPadXPressed ? 0x08 : 0x00) |
      (this.leftPadZPressed ? 0x04 : 0x00) |
      (this.leftPadYPressed ? 0x02 : 0x00) |
      (this.leftPadModePressed ? 0x01 : 0x00)
    );
  }
}
