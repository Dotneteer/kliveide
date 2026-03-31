import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { SpectrumKeyCode } from "../zxSpectrum/SpectrumKeyCode";

export enum NextExtendedKey {
  Semicolon = 0,
  DoubleQuote = 1,
  Comma = 2,
  Dot = 3,
  Up = 4,
  Down = 5,
  Left = 6,
  Right = 7,
  Delete = 8,
  Edit = 9,
  Break = 10,
  InvVideo = 11,
  TrueVideo = 12,
  Graph = 13,
  CapsLock = 14,
  Extend = 15
}

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

  setExtendedKeyStatus(extKey: NextExtendedKey, isDown: boolean): void {
    switch (extKey) {
      case NextExtendedKey.Semicolon: this.semicolonPressed = isDown; break;
      case NextExtendedKey.DoubleQuote: this.doubleQuotePressed = isDown; break;
      case NextExtendedKey.Comma: this.commaPressed = isDown; break;
      case NextExtendedKey.Dot: this.dotPressed = isDown; break;
      case NextExtendedKey.Up: this.upPressed = isDown; break;
      case NextExtendedKey.Down: this.downPressed = isDown; break;
      case NextExtendedKey.Left: this.leftPressed = isDown; break;
      case NextExtendedKey.Right: this.rightPressed = isDown; break;
      case NextExtendedKey.Delete: this.deletePressed = isDown; break;
      case NextExtendedKey.Edit: this.editPressed = isDown; break;
      case NextExtendedKey.Break: this.breakPressed = isDown; break;
      case NextExtendedKey.InvVideo: this.invVideoPressed = isDown; break;
      case NextExtendedKey.TrueVideo: this.trueVideoPressed = isDown; break;
      case NextExtendedKey.Graph: this.graphPressed = isDown; break;
      case NextExtendedKey.CapsLock: this.capsLockPressed = isDown; break;
      case NextExtendedKey.Extend: this.extendPressed = isDown; break;
    }
  }

  override getKeyLineStatus(address: number): number {
    let status = 0;
    const lines = ~(address >> 8) & 0xff;
    const joy = this.machine.joystickDevice;

    for (let line = 0; line < 8; line++) {
      if ((lines & (1 << line)) !== 0) {
        let lineVal = this.getKeyLineValue(line);

        // --- Inject extended key matrix equivalents (unless cancelled by reg 0x68 bit 4)
        if (!this.cancelExtendedKeyEntries) {
          lineVal |= this.getExtendedKeyOverlay(line);
        }

        // --- Merge joystick state into keyboard rows 3 and 4
        if (line === 3) lineVal |= joy.joy2State & 0x1f;
        if (line === 4) lineVal |= joy.joy1State & 0x1f;

        status |= lineVal;
      }
    }
    return ~status & 0xff;
  }

  private getExtendedKeyOverlay(line: number): number {
    let overlay = 0;
    switch (line) {
      case 0: // CShift row — all CShift-based extended keys force CShift
        if (this.upPressed || this.downPressed || this.leftPressed || this.rightPressed ||
            this.deletePressed || this.editPressed || this.breakPressed ||
            this.invVideoPressed || this.trueVideoPressed || this.graphPressed ||
            this.capsLockPressed || this.extendPressed) {
          overlay |= 0x01; // CShift = bit 0
        }
        break;
      case 3: // N1, N2, N3, N4, N5
        if (this.editPressed) overlay |= 0x01;      // N1 = bit 0
        if (this.capsLockPressed) overlay |= 0x02;   // N2 = bit 1
        if (this.trueVideoPressed) overlay |= 0x04;  // N3 = bit 2
        if (this.invVideoPressed) overlay |= 0x08;   // N4 = bit 3
        if (this.leftPressed) overlay |= 0x10;        // N5 = bit 4
        break;
      case 4: // N0, N9, N8, N7, N6
        if (this.deletePressed) overlay |= 0x01;     // N0 = bit 0
        if (this.graphPressed) overlay |= 0x02;       // N9 = bit 1
        if (this.rightPressed) overlay |= 0x04;       // N8 = bit 2
        if (this.upPressed) overlay |= 0x08;           // N7 = bit 3
        if (this.downPressed) overlay |= 0x10;         // N6 = bit 4
        break;
      case 5: // P, O, I, U, Y
        if (this.doubleQuotePressed) overlay |= 0x01; // P = bit 0
        if (this.semicolonPressed) overlay |= 0x02;   // O = bit 1
        break;
      case 7: // Space, SShift, M, N, B
        if (this.breakPressed) overlay |= 0x01;       // Space = bit 0
        // SShift for SShift-based extended keys
        if (this.semicolonPressed || this.doubleQuotePressed || this.commaPressed ||
            this.dotPressed || this.extendPressed) {
          overlay |= 0x02; // SShift = bit 1
        }
        if (this.dotPressed) overlay |= 0x04;         // M = bit 2
        if (this.commaPressed) overlay |= 0x08;       // N = bit 3
        break;
    }
    return overlay;
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
    const joy = this.machine.joystickDevice;
    return ((joy.joy2MdPadState & 0x0f) << 4) | (joy.joy1MdPadState & 0x0f);
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
