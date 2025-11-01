import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

/**
 * This enumeration assigns integers to the enumerated values representing a particular Commodore 64 key
 * on the keyboard.
 * 
 * The C64 keyboard is arranged in an 8x8 matrix:
 * - Rows are controlled by CIA #1 Port A (0xDC00)
 * - Columns are read from CIA #1 Port B (0xDC01)
 * 
 * The key codes follow the matrix layout:
 * 0-7: Row 0, Columns 0-7
 * 8-15: Row 1, Columns 0-7
 * ...
 * 56-63: Row 7, Columns 0-7
 */
export const C64KeyCode: KeyCodeSet = {
  // Row 0 (binary: 11111110)
  InstDel: 0,  // INST/DEL key
  Return: 1,   // RETURN key
  CRight: 2,   // CRSR RIGHT key
  F7: 3,       // F7 key
  F1: 4,       // F1 key
  F3: 5,       // F3 key
  F5: 6,       // F5 key
  CDown: 7,    // CRSR DOWN key

  // Row 1 (binary: 11111101)
  N3: 8,       // 3 key
  W: 9,        // W key
  A: 10,       // A key
  N4: 11,      // 4 key
  Z: 12,       // Z key
  S: 13,       // S key
  E: 14,       // E key
  ShiftL: 15,  // LEFT SHIFT key

  // Row 2 (binary: 11111011)
  N5: 16,      // 5 key
  R: 17,       // R key
  D: 18,       // D key
  N6: 19,      // 6 key
  C: 20,       // C key
  F: 21,       // F key
  T: 22,       // T key
  X: 23,       // X key

  // Row 3 (binary: 11110111)
  N7: 24,      // 7 key
  Y: 25,       // Y key
  G: 26,       // G key
  N8: 27,      // 8 key
  B: 28,       // B key
  H: 29,       // H key
  U: 30,       // U key
  V: 31,       // V key

  // Row 4 (binary: 11101111)
  N9: 32,      // 9 key
  I: 33,       // I key
  J: 34,       // J key
  N0: 35,      // 0 key
  M: 36,       // M key
  K: 37,       // K key
  O: 38,       // O key
  N: 39,       // N key

  // Row 5 (binary: 11011111)
  Plus: 40,    // + key
  P: 41,       // P key
  L: 42,       // L key
  Minus: 43,   // - key
  Period: 44,  // . key
  Colon: 45,   // : key
  At: 46,      // @ key
  Comma: 47,   // , key

  // Row 6 (binary: 10111111)
  Pound: 48,   // £ key (GBP symbol)
  Asterisk: 49,// * key
  Semicolon: 50,// ; key
  Home: 51,    // HOME/CLR key
  ShiftR: 52,  // RIGHT SHIFT key
  Equal: 53,   // = key
  ArrowUp: 54, // ↑ key (up arrow)
  Slash: 55,   // / key

  // Row 7 (binary: 01111111)
  N1: 56,      // 1 key
  ArrowLeft: 57,// ← key (left arrow)
  Ctrl: 58,    // CTRL key
  N2: 59,      // 2 key
  Space: 60,   // SPACE key
  Commodore: 61,// C= key (Commodore key)
  Q: 62,       // Q key
  RunStop: 63  // RUN/STOP key
};
