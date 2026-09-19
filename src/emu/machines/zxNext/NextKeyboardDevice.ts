import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { EXTRA_KEY_COMBOS } from "./nextKeyCodes";

export class NextKeyboardDevice extends KeyboardDevice {
  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public readonly machine: IZxNextMachine) {
    super(machine);
  }

  /** The 16 extra keys, pressed = 1, in `o_extended_keys` bit order (NextExtraKeyCode - 40). */
  extendedKeys = 0;

  /** NextReg `$68` bit 4: the extra keys stop pressing their matrix combinations. */
  cancelExtendedKeyEntries: boolean;

  reset(): void {
    super.reset();
    this.extendedKeys = 0;

    this.cancelExtendedKeyEntries = false;
  }

  /** Codes 0-39 are the matrix keys (SpectrumKeyCode), 40-55 the extra keys (NextExtraKeyCode). */
  setKeyStatus(key: number, isDown: boolean): void {
    if (key >= 40 && key < 56) {
      const mask = 1 << (key - 40);
      this.extendedKeys = isDown ? this.extendedKeys | mask : this.extendedKeys & ~mask;
      return;
    }
    super.setKeyStatus(key, isDown);
  }

  getKeyStatus(key: number): boolean {
    if (key >= 40 && key < 56) return (this.extendedKeys & (1 << (key - 40))) !== 0;
    return super.getKeyStatus(key);
  }

  /**
   * The extra keys held on the membrane: the keyboard's and those a joystick presses through its key
   * mapping (membrane_stick.vhd drives the same membrane columns).
   */
  private membraneExtendedKeys(joy = this.machine.joystickDevice?.keysPressed()): number {
    return this.extendedKeys | (joy?.extended ?? 0);
  }

  /**
   * membrane.vhd `o_cols`: the rows A15-A8 select (0 = selected) AND together; each row is its keys
   * (the keyboard's and the joysticks') plus the matrix entries of the pressed extra keys, unless
   * `$68` bit 4 cancels them.
   */
  getKeyLineStatus(address: number): number {
    const joy = this.machine.joystickDevice?.keysPressed();
    const lines: number[] = [];
    for (let line = 0; line < 8; line++) lines.push((this.getKeyLineValue(line) | (joy?.lines[line] ?? 0)) & 0x1f);
    const extended = this.membraneExtendedKeys(joy);
    if (extended && !this.cancelExtendedKeyEntries) {
      for (let bit = 0; bit < 16; bit++) {
        if (!(extended & (1 << bit))) continue;
        for (const code of EXTRA_KEY_COMBOS[bit]) lines[(code / 5) | 0] |= 1 << code % 5;
      }
    }
    let status = 0;
    const selected = ~(address >> 8) & 0xff;
    for (let line = 0; line < 8; line++) if (selected & (1 << line)) status |= lines[line];
    return ~status & 0xff;
  }

  /** zxnext.vhd ~6154: ; " , . UP DOWN LEFT RIGHT (extended keys 8, 9, 10, 11, 1, 15, 14, 13) */
  get nextRegB0Value(): number {
    const e = this.membraneExtendedKeys();
    const b = (bit: number) => (e >> bit) & 0x01;
    return (b(8) << 7) | (b(9) << 6) | (b(10) << 5) | (b(11) << 4) | (b(1) << 3) | (b(15) << 2) | (b(14) << 1) | b(13);
  }

  /** zxnext.vhd ~6158: DELETE EDIT BREAK INV TRUE GRAPH CAPSLOCK EXTEND (extended keys 12, 7-2, 0) */
  get nextRegB1Value(): number {
    const e = this.membraneExtendedKeys();
    return (((e >> 12) & 0x01) << 7) | (((e >> 2) & 0x3f) << 1) | (e & 0x01);
  }
}

