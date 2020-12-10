import { VmKeyCode } from "./wa-api";

/**
 * Provides an association between JavaScript key codes and keys
 */
export enum KeyCode {
  Break = 0x03,
  Backspace = 0x08,
  Tab = 0x09,
  NumEqual = 0x0c,
  Enter = 0x0d,
  Shift = 0x10,
  Ctrl = 0x11,
  Alt = 0x12,
  Pause = 0x13,
  CapsLock = 0x14,
  Esc = 0x1b,
  Space = 0x20,
  PageUp = 0x21,
  PageDown = 0x22,
  End = 0x23,
  Home = 0x24,
  ArrowLeft = 0x25,
  ArrowUp = 0x26,
  ArrowRight = 0x27,
  ArrowDown = 0x28,
  Insert = 0x2d,
  Delete = 0x2e,
  D0 = 0x30,
  D1 = 0x31,
  D2 = 0x32,
  D3 = 0x33,
  D4 = 0x34,
  D5 = 0x35,
  D6 = 0x36,
  D7 = 0x37,
  D8 = 0x38,
  D9 = 0x39,
  A = 0x41,
  B = 0x42,
  C = 0x43,
  D = 0x44,
  E = 0x45,
  F = 0x46,
  G = 0x47,
  H = 0x48,
  I = 0x49,
  J = 0x4a,
  K = 0x4b,
  L = 0x4c,
  M = 0x4d,
  N = 0x4e,
  O = 0x4f,
  P = 0x50,
  Q = 0x51,
  R = 0x52,
  S = 0x53,
  T = 0x54,
  U = 0x55,
  V = 0x56,
  W = 0x57,
  X = 0x58,
  Y = 0x59,
  Z = 0x5a,
  OSLeft = 0x5b,
  OSRight = 0x5c,
  ContextMenu = 0x5d,
  N0 = 0x60,
  N1 = 0x61,
  N2 = 0x62,
  N3 = 0x63,
  N4 = 0x64,
  N5 = 0x65,
  N6 = 0x66,
  N7 = 0x67,
  N8 = 0x68,
  N9 = 0x69,
  NumMul = 0x6a,
  NumAdd = 0x6b,
  NumSubtr = 0x6d,
  NumDec = 0x6e,
  NumDiv = 0x6f,
  NumLock = 0x90,
  Semicolon = 0xba,
  Equal = 0xbb,
  Comma = 0xbc,
  Minus = 0xbd,
  Period = 0xbe,
  Backquote = 0xc0,
  NumComma = 0xc2,
  BracketLeft = 0xdb,
  Backslash = 0xdc,
  BracketRight = 0xdd,
  Quote = 0xde,
  NumEnter = 0x100,
}

/**
 * Represents an emulated keystroke
 */
export class EmulatedKeyStroke {
  /**
   * Creates a keystroke emulation record
   * @param startFrame Start frame counter (inclusive)
   * @param endFrame End frame counter (exclusive)
   * @param primaryKey Primary key to emulate
   * @param secondaryKey Optional secondary key to emulate
   */
  constructor(
    public startFrame: number,
    public endFrame: number,
    public primaryKey: VmKeyCode,
    public secondaryKey?: VmKeyCode
  ) {}
}
