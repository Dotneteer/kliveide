import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { SpectrumKeyCode } from "../zxSpectrum/SpectrumKeyCode";

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

  A: { primaryCode: SpectrumKeyCode.A, secondaryCode: SpectrumKeyCode.SShift },
  B: { primaryCode: SpectrumKeyCode.B, secondaryCode: SpectrumKeyCode.SShift },
  C: { primaryCode: SpectrumKeyCode.C, secondaryCode: SpectrumKeyCode.SShift },
  D: { primaryCode: SpectrumKeyCode.D, secondaryCode: SpectrumKeyCode.SShift },
  E: { primaryCode: SpectrumKeyCode.E, secondaryCode: SpectrumKeyCode.SShift },
  F: { primaryCode: SpectrumKeyCode.F, secondaryCode: SpectrumKeyCode.SShift },
  G: { primaryCode: SpectrumKeyCode.G, secondaryCode: SpectrumKeyCode.SShift },
  H: { primaryCode: SpectrumKeyCode.H, secondaryCode: SpectrumKeyCode.SShift },
  I: { primaryCode: SpectrumKeyCode.I, secondaryCode: SpectrumKeyCode.SShift },
  J: { primaryCode: SpectrumKeyCode.J, secondaryCode: SpectrumKeyCode.SShift },
  K: { primaryCode: SpectrumKeyCode.K, secondaryCode: SpectrumKeyCode.SShift },
  L: { primaryCode: SpectrumKeyCode.L, secondaryCode: SpectrumKeyCode.SShift },
  M: { primaryCode: SpectrumKeyCode.M, secondaryCode: SpectrumKeyCode.SShift },
  N: { primaryCode: SpectrumKeyCode.N, secondaryCode: SpectrumKeyCode.SShift },
  O: { primaryCode: SpectrumKeyCode.O, secondaryCode: SpectrumKeyCode.SShift },
  P: { primaryCode: SpectrumKeyCode.P, secondaryCode: SpectrumKeyCode.SShift },
  Q: { primaryCode: SpectrumKeyCode.Q, secondaryCode: SpectrumKeyCode.SShift },
  R: { primaryCode: SpectrumKeyCode.R, secondaryCode: SpectrumKeyCode.SShift },
  S: { primaryCode: SpectrumKeyCode.S, secondaryCode: SpectrumKeyCode.SShift },
  T: { primaryCode: SpectrumKeyCode.T, secondaryCode: SpectrumKeyCode.SShift },
  U: { primaryCode: SpectrumKeyCode.U, secondaryCode: SpectrumKeyCode.SShift },
  V: { primaryCode: SpectrumKeyCode.V, secondaryCode: SpectrumKeyCode.SShift },
  W: { primaryCode: SpectrumKeyCode.W, secondaryCode: SpectrumKeyCode.SShift },
  X: { primaryCode: SpectrumKeyCode.X, secondaryCode: SpectrumKeyCode.SShift },
  Y: { primaryCode: SpectrumKeyCode.Y, secondaryCode: SpectrumKeyCode.SShift },
  Z: { primaryCode: SpectrumKeyCode.Z, secondaryCode: SpectrumKeyCode.SShift },

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
