import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * NextReg `$05` joystick modes (zxnext.vhd ~3426; the key assignments are those of
 * src/ram/init/keyjoy_64_6.coe as membrane_stick.vhd uses them).
 */
export enum JoystickMode {
  Sinclair2 = 0b000, // --- keys 1 2 3 4 5 (left right down up fire)
  Kempston1 = 0b001, // --- port 0x1f
  Cursor = 0b010, // --- keys 5 8 6 7 0
  Sinclair1 = 0b011, // --- keys 6 7 8 9 0
  Kempston2 = 0b100, // --- port 0x37
  MD1 = 0b101, // --- 3 or 6 button pad, port 0x1f
  MD2 = 0b110, // --- 3 or 6 button pad, port 0x37
  UserDefined = 0b111 // --- keys from the joymap RAM
}

/**
 * The joystick connector's output (md6_joystick_connector_x2.vhd), active high:
 * bits 11-0 = MODE X Z Y START A C B U D L R.
 */
export const JOY_RIGHT = 0x001;
export const JOY_LEFT = 0x002;
export const JOY_DOWN = 0x004;
export const JOY_UP = 0x008;
export const JOY_B = 0x010;
export const JOY_C = 0x020;
export const JOY_A = 0x040;
export const JOY_START = 0x080;
export const JOY_Y = 0x100;
export const JOY_Z = 0x200;
export const JOY_X = 0x400;
export const JOY_MODE = 0x800;

/**
 * src/ram/init/keyjoy_64_6.coe: the joymap RAM at power-on. Entry = membrane row (5-3) & column (2-0);
 * column 7 does not exist (no key). Addresses 0-31 serve the left connector, 32-63 the right: 0-4
 * Sinclair ("011"), 5-9 Sinclair ("000"), 10-14 Cursor, 16-27 the user-defined keys of bits 0-11.
 */
const JOYMAP_INIT_HALF = [
  0o43, 0o44, 0o42, 0o41, 0o40, 0o31, 0o30, 0o32, 0o33, 0o34, 0o42, 0o34, 0o44, 0o43, 0o40, 0o77,
  0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07, 0o07
];

/** membrane_stick.vhd: the first joymap address and the joystick bits a mode scans. */
function keyjoyRange(mode: number): [start: number, firstBit: number, lastBit: number] {
  switch (mode) {
    case 0b011:
      return [0, 0, 4];
    case 0b000:
      return [5, 0, 4];
    case 0b010:
      return [10, 0, 4];
    case 0b111:
      return [16, 0, 11];
    case 0b001:
    case 0b100:
      // --- Kempston: bits 5-11 through the user-defined entries 21-27
      return [21, 5, 11];
    default:
      // --- MD pad: bits 8-11 through the user-defined entries 24-27
      return [24, 8, 11];
  }
}

/** The keys the joysticks press on the membrane: matrix rows (5 bits each) and extra-key bits. */
export type JoystickKeys = { lines: number[]; extended: number };

export class JoystickDevice implements IGenericDevice<IZxNextMachine> {
  // --- Configuration from NR 0x05
  joystick1Mode: JoystickMode = JoystickMode.Kempston1;
  joystick2Mode: JoystickMode = JoystickMode.Sinclair2;

  // --- I/O mode from NR 0x0B
  ioModeEnabled: boolean;
  ioMode: number;
  ioModeParam: boolean;

  // --- The connectors (12 bits, active high: MODE X Z Y START A C B U D L R)
  leftState = 0;
  rightState = 0;

  /** The joymap RAM (membrane_stick.vhd udk_map); a core load initialises it, resets keep it. */
  readonly joymap = new Uint8Array(64);
  /** NextReg $28 bit 7 / $28 bit 0 + $29: the joymap write address ($2B writes advance it). */
  keymapSelectJoy = false;
  keymapAddress = 0;

  constructor(public readonly machine: IZxNextMachine) {
    this.hardReset();
  }

  /** zxnext.vhd ~4917: I/O mode off, mode 00, parameter 1. $05 has no reset branch. */
  reset(): void {
    this.ioModeEnabled = false;
    this.ioMode = 0;
    this.ioModeParam = true;
  }

  hardReset(): void {
    this.joymap.set(JOYMAP_INIT_HALF, 0);
    this.joymap.set(JOYMAP_INIT_HALF, 32);
    this.keymapSelectJoy = false;
    this.keymapAddress = 0;
    this.reset();
  }

  setLeftState(state: number): void {
    this.leftState = state & 0xfff;
  }

  setRightState(state: number): void {
    this.rightState = state & 0xfff;
  }

  /** What a connector reports: in I/O mode its six raw pins (C B U D L R) only. */
  private connector(state: number): number {
    return this.ioModeEnabled ? state & 0x3f : state;
  }

  /** Port $1F answers while a joystick is in Kempston 1 or MD 1 mode (zxnext.vhd ~2410, ~2630). */
  get port1fDecoded(): boolean {
    const m = [this.joystick1Mode, this.joystick2Mode];
    return m.includes(JoystickMode.Kempston1) || m.includes(JoystickMode.MD1);
  }

  /** Port $37 answers while a joystick is in Kempston 2 or MD 2 mode. */
  get port37Decoded(): boolean {
    const m = [this.joystick1Mode, this.joystick2Mode];
    return m.includes(JoystickMode.Kempston2) || m.includes(JoystickMode.MD2);
  }

  /** zxnext.vhd ~3469-3496: Kempston modes give bits 5-0, MD modes also START (7) and A (6). */
  private portContribution(mode: JoystickMode, state: number, kempston: JoystickMode, md: JoystickMode): number {
    const s = this.connector(state);
    if (mode === md) return s & 0xff;
    if (mode === kempston) return s & 0x3f;
    return 0;
  }

  readPort1f(): number {
    return (
      this.portContribution(this.joystick1Mode, this.leftState, JoystickMode.Kempston1, JoystickMode.MD1) |
      this.portContribution(this.joystick2Mode, this.rightState, JoystickMode.Kempston1, JoystickMode.MD1)
    );
  }

  readPort37(): number {
    return (
      this.portContribution(this.joystick1Mode, this.leftState, JoystickMode.Kempston2, JoystickMode.MD2) |
      this.portContribution(this.joystick2Mode, this.rightState, JoystickMode.Kempston2, JoystickMode.MD2)
    );
  }

  /** zxnext.vhd ~6161: right X Z Y MODE, left X Z Y MODE. */
  get nextRegB2Value(): number {
    const l = this.connector(this.leftState);
    const r = this.connector(this.rightState);
    return (((r >> 8) & 0x07) << 5) | (((r >> 11) & 0x01) << 4) | (((l >> 8) & 0x07) << 1) | ((l >> 11) & 0x01);
  }

  /** $28 write: bit 7 selects the joymap (1) or the PS/2 keymap (0), bit 0 is address bit 8. */
  writeKeymapSelect(value: number): void {
    this.keymapSelectJoy = (value & 0x80) !== 0;
    this.keymapAddress = ((value & 0x01) << 8) | (this.keymapAddress & 0xff);
  }

  /** $29 write: address bits 7-0. */
  writeKeymapAddress(value: number): void {
    this.keymapAddress = (this.keymapAddress & 0x100) | (value & 0xff);
  }

  /**
   * $2B write: with the joymap selected, row (5-3) & column (2-0) for joymap entry
   * addr(4) & '1' & addr(3-0) - connector (0 left) and joystick bit; the address advances either way.
   */
  writeKeymapData(value: number): void {
    if (this.keymapSelectJoy) {
      const a = this.keymapAddress;
      this.joymap[((a & 0x10) << 1) | 0x10 | (a & 0x0f)] = value & 0x3f;
    }
    this.keymapAddress = (this.keymapAddress + 1) & 0x1ff;
  }

  /**
   * membrane_stick.vhd: the keys the two joysticks hold down on the membrane, per their modes and the
   * joymap. Nothing while the joystick I/O mode is on (i_joy_en_n).
   */
  keysPressed(): JoystickKeys {
    const keys: JoystickKeys = { lines: [0, 0, 0, 0, 0, 0, 0, 0], extended: 0 };
    if (this.ioModeEnabled) return keys;
    const sides: Array<[number, number, number]> = [
      [0, this.joystick1Mode, this.leftState],
      [32, this.joystick2Mode, this.rightState]
    ];
    for (const [base, mode, state] of sides) {
      if (!state) continue;
      const [start, first, last] = keyjoyRange(mode);
      for (let bit = first; bit <= last; bit++) {
        if (!(state & (1 << bit))) continue;
        const entry = this.joymap[base + start + bit - first];
        const row = (entry >> 3) & 0x07;
        const col = entry & 0x07;
        if (col < 5) keys.lines[row] |= 1 << col;
        else if (col < 7) keys.extended |= 1 << (row * 2 + (col === 6 ? 1 : 0));
      }
    }
    return keys;
  }
}
