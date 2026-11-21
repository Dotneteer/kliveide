import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * The keys of the SAM Coupé's 9 x 8 matrix (SOUND_INPUT_IO.md §3.2, where MAME's and SimCoupé's maps
 * agree), numbered `row * 8 + bit` as the core's `samSetKeyStatus` takes them. Rows 0-7 are selected by
 * A8-A15; bits 0-4 read on FEh (the Spectrum's matrix), bits 5-7 on F9h. Row 8 (CNTRL and the cursor
 * keys) reads on FFFEh.
 */
export const SamKeyCode: KeyCodeSet = {
  // --- Row 0 (A8)
  Shift: 0,
  Z: 1,
  X: 2,
  C: 3,
  V: 4,
  F1: 5,
  F2: 6,
  F3: 7,
  // --- Row 1 (A9)
  A: 8,
  S: 9,
  D: 10,
  F: 11,
  G: 12,
  F4: 13,
  F5: 14,
  F6: 15,
  // --- Row 2 (A10)
  Q: 16,
  W: 17,
  E: 18,
  R: 19,
  T: 20,
  F7: 21,
  F8: 22,
  F9: 23,
  // --- Row 3 (A11)
  N1: 24,
  N2: 25,
  N3: 26,
  N4: 27,
  N5: 28,
  Esc: 29,
  Tab: 30,
  Caps: 31,
  // --- Row 4 (A12)
  N0: 32,
  N9: 33,
  N8: 34,
  N7: 35,
  N6: 36,
  Minus: 37,
  Plus: 38,
  Delete: 39,
  // --- Row 5 (A13)
  P: 40,
  O: 41,
  I: 42,
  U: 43,
  Y: 44,
  Equals: 45,
  Quote: 46,
  F0: 47,
  // --- Row 6 (A14)
  Enter: 48,
  L: 49,
  K: 50,
  J: 51,
  H: 52,
  Semicolon: 53,
  Colon: 54,
  Edit: 55,
  // --- Row 7 (A15)
  Space: 56,
  Symbol: 57,
  M: 58,
  N: 59,
  B: 60,
  Comma: 61,
  Period: 62,
  Inv: 63,
  // --- Row 8 (A8-A15 all high)
  Cntrl: 64,
  Up: 65,
  Down: 66,
  Left: 67,
  Right: 68
};
