import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * The keys of the Enterprise's 10 x 8 matrix (DAVE_MEMORY_IO.md §6.2, the same in ep128emu, MAME,
 * Xep128, the EXOS book and CLK), numbered `row * 8 + column` as the core's `epSetKeyStatus` takes
 * them. B5h bits 3-0 select a row and a B5h read returns its columns, active low.
 *
 * The built-in joystick is the cursor keys (row 7); its fire is SPACE. The key cap EXOS calls PAUSE
 * reads HOLD.
 */
export const EpKeyCode: KeyCodeSet = {
  // --- Row 0
  N: 0,
  Backslash: 1,
  B: 2,
  C: 3,
  V: 4,
  X: 5,
  Z: 6,
  LShift: 7,
  // --- Row 1
  H: 8,
  Lock: 9,
  G: 10,
  D: 11,
  F: 12,
  S: 13,
  A: 14,
  Ctrl: 15,
  // --- Row 2
  U: 16,
  Q: 17,
  Y: 18,
  R: 19,
  T: 20,
  E: 21,
  W: 22,
  Tab: 23,
  // --- Row 3
  N7: 24,
  N1: 25,
  N6: 26,
  N4: 27,
  N5: 28,
  N3: 29,
  N2: 30,
  Esc: 31,
  // --- Row 4
  F4: 32,
  F8: 33,
  F3: 34,
  F6: 35,
  F5: 36,
  F7: 37,
  F2: 38,
  F1: 39,
  // --- Row 5
  N8: 40,
  N9: 42,
  Minus: 43,
  N0: 44,
  Caret: 45,
  Erase: 46,
  // --- Row 6
  J: 48,
  K: 50,
  Semicolon: 51,
  L: 52,
  Colon: 53,
  RBracket: 54,
  // --- Row 7
  Stop: 56,
  Down: 57,
  Right: 58,
  Up: 59,
  Hold: 60,
  Left: 61,
  Enter: 62,
  Alt: 63,
  // --- Row 8
  M: 64,
  Del: 65,
  Comma: 66,
  Slash: 67,
  Period: 68,
  RShift: 69,
  Space: 70,
  Ins: 71,
  // --- Row 9
  I: 72,
  O: 74,
  At: 75,
  P: 76,
  LBracket: 77
};
