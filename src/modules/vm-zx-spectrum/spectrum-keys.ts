import { KeyMapping } from "@modules-core/keyboard";

/**
 * Object that defines ZX Spectrum key codes
 */
export const spectrumKeyCodes: Record<string, number> = {
  CShift: 0,
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

  Enter: 30,
  L: 31,
  K: 32,
  J: 33,
  H: 34,

  Space: 35,
  SShift: 36,
  M: 37,
  N: 38,
  B: 39,
};

// --- Do not allow the modification of key codes
Object.freeze(spectrumKeyCodes);

/**
 * US keyboard mappings
 */
const usMapping: KeyMapping = {
  Digit1: "N1",
  Digit2: "N2",
  Digit3: "N3",
  Digit4: "N4",
  Digit5: "N5",
  Digit6: "N6",
  Digit7: "N7",
  Digit8: "N8",
  Digit9: "N9",
  Digit0: "N0",

  Numpad1: "N1",
  Numpad2: "N2",
  Numpad3: "N3",
  Numpad4: "N4",
  Numpad5: "N5",
  Numpad6: "N6",
  Numpad7: "N7",
  Numpad8: "N8",
  Numpad9: "N9",
  Numpad0: "N0",

  KeyQ: "Q",
  KeyW: "W",
  KeyE: "E",
  KeyR: "R",
  KeyT: "T",
  KeyY: "Y",
  KeyU: "U",
  KeyI: "I",
  KeyO: "O",
  KeyP: "P",

  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyF: "F",
  KeyG: "G",
  KeyH: "H",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  Enter: "Enter",
  NumpadEnter: "Enter",

  ShiftLeft: "CShift",
  ShiftRight: "CShift",
  KeyZ: "Z",
  KeyX: "X",
  KeyC: "C",
  KeyV: "V",
  KeyB: "B",
  KeyN: "N",
  KeyM: "M",
  Space: "Space",
  AltRight: "SShift",

  Comma: ["SShift", "N"],
  NumpadDecimal: ["SShift", "M"],
  Period: ["SShift", "M"],
  NumpadDivide: ["SShift", "V"],
  NumpadMultiply: ["SShift", "B"],
  NumpadAdd: ["SShift", "K"],
  NumpadSubtract: ["SShift", "J"],
  Backspace: ["CShift", "N0"],
  ArrowLeft: ["CShift", "N5"],
  ArrowDown: ["CShift", "N6"],
  ArrowUp: ["CShift", "N7"],
  ArrowRight: ["CShift", "N8"],
  Home: ["CShift", "N1"],
};

/**
 * The current key mappings
 */
export const spectrumKeyMappings = usMapping;
