import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { SpectrumKeyCode } from "../zxSpectrum/SpectrumKeyCode";

/**
 * The Next's extra membrane keys as `setKeyStatus` codes after the 40 matrix keys: 40 + the key's bit
 * in the membrane's `o_extended_keys` (membrane.vhd: physical row * 2 + 1 for column 6, + 0 for
 * column 5).
 */
export const NextExtraKeyCode = {
  Extend: 40,
  Up: 41,
  CapsLock: 42,
  Graph: 43,
  TrueVideo: 44,
  InvVideo: 45,
  Break: 46,
  Edit: 47,
  Semicolon: 48,
  DoubleQuote: 49,
  Comma: 50,
  Period: 51,
  Delete: 52,
  Right: 53,
  Left: 54,
  Down: 55
} as const;

/**
 * membrane.vhd `matrix_work_ex`: the two matrix keys each extra key also presses (CAPS SHIFT or
 * SYMBOL SHIFT with a key), by extra-key bit. `$68` bit 4 cancels these entries.
 */
const EXTRA_KEY_COMBOS: ReadonlyArray<readonly [number, number]> = [
  [SpectrumKeyCode.CShift, SpectrumKeyCode.SShift], // EXTEND
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N7], // UP
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N2], // CAPS LOCK
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N9], // GRAPH
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N3], // TRUE VIDEO
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N4], // INV VIDEO
  [SpectrumKeyCode.CShift, SpectrumKeyCode.Space], // BREAK
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N1], // EDIT
  [SpectrumKeyCode.SShift, SpectrumKeyCode.O], // ;
  [SpectrumKeyCode.SShift, SpectrumKeyCode.P], // "
  [SpectrumKeyCode.SShift, SpectrumKeyCode.N], // ,
  [SpectrumKeyCode.SShift, SpectrumKeyCode.M], // .
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N0], // DELETE
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N8], // RIGHT
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N5], // LEFT
  [SpectrumKeyCode.CShift, SpectrumKeyCode.N6] // DOWN
];

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

type NextKeyCode = {
  primaryCode: number;
  secondaryCode?: number;
  extMode?: boolean;
};
export function convertAsciiStringToNextKeyCodes(text: string): NextKeyCode[] {
  const result: { primaryCode: number; secondaryCode?: number; extMode?: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const keyCode = asciiToNextKeyCodeMap[text.charAt(i)];
    if (keyCode) {
      result.push(keyCode);
    }
  }
  return result;
}

const asciiToNextKeyCodeMap: Record<string, NextKeyCode> = {
  "0": { primaryCode: SpectrumKeyCode.N0 },
  "1": { primaryCode: SpectrumKeyCode.N1 },
  "2": { primaryCode: SpectrumKeyCode.N2 },
  "3": { primaryCode: SpectrumKeyCode.N3 },
  "4": { primaryCode: SpectrumKeyCode.N4 },
  "5": { primaryCode: SpectrumKeyCode.N5 },
  "6": { primaryCode: SpectrumKeyCode.N6 },
  "7": { primaryCode: SpectrumKeyCode.N7 },
  "8": { primaryCode: SpectrumKeyCode.N8 },
  "9": { primaryCode: SpectrumKeyCode.N9 },

  // --- Capitals are CAPS SHIFT + letter. They were SYMBOL SHIFT + letter, which is not a capital
  // --- at all but the symbol printed on the key: SYMBOL SHIFT + N is `,` and SYMBOL SHIFT + M is
  // --- `.`, which is why injecting `.nexload ScrollNutter.nex` typed a comma where the `N` of
  // --- `ScrollNutter` belonged. SYMBOL SHIFT stays correct for the punctuation entries below,
  // --- where the symbol *is* what is wanted. See
  // --- `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.13.
  A: { primaryCode: SpectrumKeyCode.A, secondaryCode: SpectrumKeyCode.CShift },
  B: { primaryCode: SpectrumKeyCode.B, secondaryCode: SpectrumKeyCode.CShift },
  C: { primaryCode: SpectrumKeyCode.C, secondaryCode: SpectrumKeyCode.CShift },
  D: { primaryCode: SpectrumKeyCode.D, secondaryCode: SpectrumKeyCode.CShift },
  E: { primaryCode: SpectrumKeyCode.E, secondaryCode: SpectrumKeyCode.CShift },
  F: { primaryCode: SpectrumKeyCode.F, secondaryCode: SpectrumKeyCode.CShift },
  G: { primaryCode: SpectrumKeyCode.G, secondaryCode: SpectrumKeyCode.CShift },
  H: { primaryCode: SpectrumKeyCode.H, secondaryCode: SpectrumKeyCode.CShift },
  I: { primaryCode: SpectrumKeyCode.I, secondaryCode: SpectrumKeyCode.CShift },
  J: { primaryCode: SpectrumKeyCode.J, secondaryCode: SpectrumKeyCode.CShift },
  K: { primaryCode: SpectrumKeyCode.K, secondaryCode: SpectrumKeyCode.CShift },
  L: { primaryCode: SpectrumKeyCode.L, secondaryCode: SpectrumKeyCode.CShift },
  M: { primaryCode: SpectrumKeyCode.M, secondaryCode: SpectrumKeyCode.CShift },
  N: { primaryCode: SpectrumKeyCode.N, secondaryCode: SpectrumKeyCode.CShift },
  O: { primaryCode: SpectrumKeyCode.O, secondaryCode: SpectrumKeyCode.CShift },
  P: { primaryCode: SpectrumKeyCode.P, secondaryCode: SpectrumKeyCode.CShift },
  Q: { primaryCode: SpectrumKeyCode.Q, secondaryCode: SpectrumKeyCode.CShift },
  R: { primaryCode: SpectrumKeyCode.R, secondaryCode: SpectrumKeyCode.CShift },
  S: { primaryCode: SpectrumKeyCode.S, secondaryCode: SpectrumKeyCode.CShift },
  T: { primaryCode: SpectrumKeyCode.T, secondaryCode: SpectrumKeyCode.CShift },
  U: { primaryCode: SpectrumKeyCode.U, secondaryCode: SpectrumKeyCode.CShift },
  V: { primaryCode: SpectrumKeyCode.V, secondaryCode: SpectrumKeyCode.CShift },
  W: { primaryCode: SpectrumKeyCode.W, secondaryCode: SpectrumKeyCode.CShift },
  X: { primaryCode: SpectrumKeyCode.X, secondaryCode: SpectrumKeyCode.CShift },
  Y: { primaryCode: SpectrumKeyCode.Y, secondaryCode: SpectrumKeyCode.CShift },
  Z: { primaryCode: SpectrumKeyCode.Z, secondaryCode: SpectrumKeyCode.CShift },

  a: { primaryCode: SpectrumKeyCode.A },
  b: { primaryCode: SpectrumKeyCode.B },
  c: { primaryCode: SpectrumKeyCode.C },
  d: { primaryCode: SpectrumKeyCode.D },
  e: { primaryCode: SpectrumKeyCode.E },
  f: { primaryCode: SpectrumKeyCode.F },
  g: { primaryCode: SpectrumKeyCode.G },
  h: { primaryCode: SpectrumKeyCode.H },
  i: { primaryCode: SpectrumKeyCode.I },
  j: { primaryCode: SpectrumKeyCode.J },
  k: { primaryCode: SpectrumKeyCode.K },
  l: { primaryCode: SpectrumKeyCode.L },
  m: { primaryCode: SpectrumKeyCode.M },
  n: { primaryCode: SpectrumKeyCode.N },
  o: { primaryCode: SpectrumKeyCode.O },
  p: { primaryCode: SpectrumKeyCode.P },
  q: { primaryCode: SpectrumKeyCode.Q },
  r: { primaryCode: SpectrumKeyCode.R },
  s: { primaryCode: SpectrumKeyCode.S },
  t: { primaryCode: SpectrumKeyCode.T },
  u: { primaryCode: SpectrumKeyCode.U },
  v: { primaryCode: SpectrumKeyCode.V },
  w: { primaryCode: SpectrumKeyCode.W },
  x: { primaryCode: SpectrumKeyCode.X },
  y: { primaryCode: SpectrumKeyCode.Y },
  z: { primaryCode: SpectrumKeyCode.Z },

  " ": { primaryCode: SpectrumKeyCode.Space },
  "\n": { primaryCode: SpectrumKeyCode.Enter },
  "\r": { primaryCode: SpectrumKeyCode.Enter },
  "!": { primaryCode: SpectrumKeyCode.N1, secondaryCode: SpectrumKeyCode.SShift },
  '"': { primaryCode: SpectrumKeyCode.P, secondaryCode: SpectrumKeyCode.SShift },
  "#": { primaryCode: SpectrumKeyCode.N3, secondaryCode: SpectrumKeyCode.SShift },
  $: { primaryCode: SpectrumKeyCode.N4, secondaryCode: SpectrumKeyCode.SShift },
  "%": { primaryCode: SpectrumKeyCode.N5, secondaryCode: SpectrumKeyCode.SShift },
  "&": { primaryCode: SpectrumKeyCode.N6, secondaryCode: SpectrumKeyCode.SShift },
  "'": { primaryCode: SpectrumKeyCode.N7, secondaryCode: SpectrumKeyCode.SShift },
  "(": { primaryCode: SpectrumKeyCode.N8, secondaryCode: SpectrumKeyCode.SShift },
  ")": { primaryCode: SpectrumKeyCode.N9, secondaryCode: SpectrumKeyCode.SShift },
  "*": { primaryCode: SpectrumKeyCode.B, secondaryCode: SpectrumKeyCode.SShift },
  "+": { primaryCode: SpectrumKeyCode.K, secondaryCode: SpectrumKeyCode.SShift },
  ",": { primaryCode: SpectrumKeyCode.N, secondaryCode: SpectrumKeyCode.SShift },
  "-": { primaryCode: SpectrumKeyCode.J, secondaryCode: SpectrumKeyCode.SShift },
  ".": { primaryCode: SpectrumKeyCode.M, secondaryCode: SpectrumKeyCode.SShift },
  "/": { primaryCode: SpectrumKeyCode.V, secondaryCode: SpectrumKeyCode.SShift },
  ":": { primaryCode: SpectrumKeyCode.Z, secondaryCode: SpectrumKeyCode.SShift },
  ";": { primaryCode: SpectrumKeyCode.O, secondaryCode: SpectrumKeyCode.SShift },
  "<": { primaryCode: SpectrumKeyCode.R, secondaryCode: SpectrumKeyCode.SShift },
  "=": { primaryCode: SpectrumKeyCode.L, secondaryCode: SpectrumKeyCode.SShift },
  ">": { primaryCode: SpectrumKeyCode.T, secondaryCode: SpectrumKeyCode.SShift },
  "?": { primaryCode: SpectrumKeyCode.C, secondaryCode: SpectrumKeyCode.SShift },
  "@": { primaryCode: SpectrumKeyCode.N2, secondaryCode: SpectrumKeyCode.SShift },
  "[": { primaryCode: SpectrumKeyCode.Y, secondaryCode: SpectrumKeyCode.CShift, extMode: true },
  "\\": { primaryCode: SpectrumKeyCode.D, secondaryCode: SpectrumKeyCode.CShift, extMode: true },
  "]": { primaryCode: SpectrumKeyCode.U, secondaryCode: SpectrumKeyCode.CShift, extMode: true },
  "^": { primaryCode: SpectrumKeyCode.H, secondaryCode: SpectrumKeyCode.SShift },
  _: { primaryCode: SpectrumKeyCode.N0, secondaryCode: SpectrumKeyCode.SShift },
  "{": { primaryCode: SpectrumKeyCode.F, secondaryCode: SpectrumKeyCode.CShift, extMode: true },
  "|": { primaryCode: SpectrumKeyCode.S, secondaryCode: SpectrumKeyCode.CShift, extMode: true },
  "}": { primaryCode: SpectrumKeyCode.G, secondaryCode: SpectrumKeyCode.CShift, extMode: true },
  "~": { primaryCode: SpectrumKeyCode.A, secondaryCode: SpectrumKeyCode.CShift, extMode: true }
};
