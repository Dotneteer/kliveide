import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * This enum assigns key codes to the keys of the Cambridge Z88 keyboard.
 * Each number identifies a physical key in the Z88 keyboard matrix, using
 * a code from 0-63. Code sequence:
 * 0: A8/D0,
 * 1: A8/D1,
 * 2: A8/D2,
 * ...
 * 62: A15/D6
 * 63: A15/D7
 *
 * Each propery names a Z88 key in the 8x8 matrix. The property value is
 * the associated code
 */
export const Z88KeyCode: KeyCodeSet = {
  N8: 0,
  N7: 1,
  N: 2,
  H: 3,
  Y: 4,
  N6: 5,
  Enter: 6,
  Delete: 7,

  I: 8,
  U: 9,
  B: 10,
  G: 11,
  T: 12,
  N5: 13,
  Up: 14,
  Backslash: 15,

  O: 16,
  J: 17,
  V: 18,
  F: 19,
  R: 20,
  N4: 21,
  Down: 22,
  Equal: 23,

  N9: 24,
  K: 25,
  C: 26,
  D: 27,
  E: 28,
  N3: 29,
  Right: 30,
  Minus: 31,

  P: 32,
  M: 33,
  X: 34,
  S: 35,
  W: 36,
  N2: 37,
  Left: 38,
  SBracketR: 39,

  N0: 40,
  L: 41,
  Z: 42,
  A: 43,
  Q: 44,
  N1: 45,
  Space: 46,
  SBracketL: 47,

  Quote: 48,
  Semicolon: 49,
  Comma: 50,
  Menu: 51,
  Diamond: 52,
  Tab: 53,
  ShiftL: 54,
  Help: 55,

  Pound: 56,
  Slash: 57,
  Period: 58,
  CapsLock: 59,
  Index: 60,
  Escape: 61,
  Square: 62,
  ShiftR: 63
};
