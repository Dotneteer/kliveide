import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * The 40 keys of the ZX80/ZX81 matrix, numbered `line * 5 + bit` like `SpectrumKeyCode`: the matrix
 * is the Spectrum's, read through port $FE with the high address byte selecting the line. The ZX81's
 * `.` sits where the Spectrum has SYMBOL SHIFT; the ZX80 and ZX81 differ only in their legends.
 */
export const Zx8081KeyCode: KeyCodeSet = {
  Shift: 0,
  Z: 1,
  X: 2,
  C: 3,
  V: 4,

  A: 5,
  S: 6,
  D: 7,
  F: 8,
  G: 9,

  Q: 10,
  W: 11,
  E: 12,
  R: 13,
  T: 14,

  N1: 15,
  N2: 16,
  N3: 17,
  N4: 18,
  N5: 19,

  N0: 20,
  N9: 21,
  N8: 22,
  N7: 23,
  N6: 24,

  P: 25,
  O: 26,
  I: 27,
  U: 28,
  Y: 29,

  NewLine: 30,
  L: 31,
  K: 32,
  J: 33,
  H: 34,

  Space: 35,
  Period: 36,
  M: 37,
  N: 38,
  B: 39
};

/** Key codes by name, for code that needs numbers (the typer, the virtual keyboard) */
export const ZX8081_KEY = Zx8081KeyCode as Record<string, number>;
