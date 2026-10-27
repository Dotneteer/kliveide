import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * The keys of the TVC's 11 x 8 matrix (rtvc/info/tvc.md "Keyboard"; HW p.97), numbered
 * `row * 8 + column` as the core's `tvcSetKeyStatus` takes them. Port 03h bits 3-0 select a row and
 * port 58h reads its columns, active low. Rows 9 and 10 are open (`.plans/VIDEOTON_TVC_PLAN.md` Q6).
 *
 * Row 8 holds the cursor keys and Tab, which BASIC's joystick 1 also reads (Tab is its fire).
 */
export const TvcKeyCode: KeyCodeSet = {
  // --- Row 0
  N5: 0,
  N3: 1,
  N2: 2,
  N0: 3,
  N6: 4,
  IAcute: 5,
  N1: 6,
  N4: 7,
  // --- Row 1
  Caret: 8,
  N8: 9,
  N9: 10,
  UUml: 11,
  Asterisk: 12,
  OAcute: 13,
  OUml: 14,
  N7: 15,
  // --- Row 2
  T: 16,
  E: 17,
  W: 18,
  Semicolon: 19,
  Z: 20,
  At: 21,
  Q: 22,
  R: 23,
  // --- Row 3
  RBracket: 24,
  I: 25,
  O: 26,
  ODblAcute: 27,
  LBracket: 28,
  UAcute: 29,
  P: 30,
  U: 31,
  // --- Row 4
  G: 32,
  D: 33,
  S: 34,
  Backslash: 35,
  H: 36,
  Less: 37,
  A: 38,
  F: 39,
  // --- Row 5
  Del: 40,
  K: 41,
  L: 42,
  AAcute: 43,
  Return: 44,
  UDblAcute: 45,
  EAcute: 46,
  J: 47,
  // --- Row 6
  B: 48,
  C: 49,
  X: 50,
  Shift: 51,
  N: 52,
  Lock: 53,
  Y: 54,
  V: 55,
  // --- Row 7
  Alt: 56,
  Comma: 57,
  Period: 58,
  Esc: 59,
  Ctrl: 60,
  Space: 61,
  Minus: 62,
  M: 63,
  // --- Row 8
  Up: 65,
  Down: 66,
  Tab: 67,
  Right: 69,
  Left: 70
};
