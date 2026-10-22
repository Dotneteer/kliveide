import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * The 57 keys of the HT-1080Z matrix (the TRS-80 Model I 8 x 8 matrix at $3800, HARDWARE.md §7.2),
 * numbered `row * 8 + column` as the core's `ht1080zSetKeyStatus` takes them. A key's row is selected
 * by address bit A`row` of a read from $3800-$3BFF and it reads on data bit D`column`.
 *
 * The shifted symbols are the TRS-80's: SHIFT+1 is `!`, SHIFT+: is `*`, SHIFT+; is `+` and so on.
 * PAGE and F1 are not here: they are outside the matrix and software cannot read them.
 */
export const Ht1080zKeyCode: KeyCodeSet = {
  // --- Row 0 ($3801)
  At: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  // --- Row 1 ($3802)
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  // --- Row 2 ($3804)
  P: 16,
  Q: 17,
  R: 18,
  S: 19,
  T: 20,
  U: 21,
  V: 22,
  W: 23,
  // --- Row 3 ($3808): only X, Y, Z
  X: 24,
  Y: 25,
  Z: 26,
  // --- Row 4 ($3810)
  N0: 32,
  N1: 33,
  N2: 34,
  N3: 35,
  N4: 36,
  N5: 37,
  N6: 38,
  N7: 39,
  // --- Row 5 ($3820)
  N8: 40,
  N9: 41,
  Colon: 42,
  Semicolon: 43,
  Comma: 44,
  Minus: 45,
  Period: 46,
  Slash: 47,
  // --- Row 6 ($3840)
  Enter: 48,
  Clear: 49,
  Break: 50,
  Up: 51,
  Down: 52,
  Left: 53,
  Right: 54,
  Space: 55,
  // --- Row 7 ($3880): both SHIFT keys share one contact
  Shift: 56
};
