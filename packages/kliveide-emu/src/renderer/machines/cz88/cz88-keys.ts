import { KeyMapping } from "../keyboard";

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
export const cz88KeyCodes: Record<string, number> = {
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
  ShiftR: 63,
}

Object.freeze(cz88KeyCodes);

/**
 * Maps the physical keyboard to the US keyboard. 
 * Property: Physical key virtual keycodes
 * Value: single string, or an array of strings that represent the
 * primary, secondary, and, ternary Z88 key code
 */
const usMapping: KeyMapping = {
  Escape: "Escape",
  Digit1: "N1",
  Numpad1: "N1",
  Digit2: "N2",
  Numpad2: "N2",
  Digit3: "N3",
  Numpad3: "N3",
  Digit4: "N4",
  Numpad4: "N4",
  Digit5: "N5",
  Numpad5: "N5",
  Digit6: "N6",
  Numpad6: "N6",
  Digit7: "N7",
  Numpad7: "N7",
  Digit8: "N8",
  Numpad8: "N8",
  Digit9: "N9",
  Numpad9: "N9",
  Digit0: "N0",
  Numpad0: "N0",
  Minus: "Minus",
  NumpadAdd: [ "ShiftL", "Equal"],
  NumpadSubtract: "Minus",
  NumpadMultiply: [ "ShiftL", "N8"],
  NumpadDivide: "Slash",
  NumpadDecimal: "Period",
  Equal: "Equal",
  Backslash: "Backslash",
  Delete: "Delete",
  Backspace: "Delete",

  Tab: "Tab",
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
  BracketLeft: "SBracketL",
  BracketRight: "SBracketR",

  ControlLeft: "Diamond",
  ControlRight: "Diamond",
  AltLeft: "Square",
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyF: "F",
  KeyG: "G",
  KeyH: "H",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  Semicolon: "Semicolon",
  Quote: "Quote",
  IntlBackslash: "Pound",

  ShiftLeft: "ShiftL",
  KeyZ: "Z",
  KeyX: "X",
  KeyC: "C",
  KeyV: "V",
  KeyB: "B",
  KeyN: "N",
  KeyM: "M",
  Comma: "Comma",
  Period: "Period",
  Slash: "Slash",
  ShiftRight: "ShiftR",

  Home: "Index",
  ContextMenu: "Menu",
  Space: "Space",
  CapsLock: "CapsLock",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Enter: "Enter",
  NumpadEnter: "Enter",

  F1: "Help",
  F2: "Index",
  F3: "Menu",
  F7: "CapsLock",
  F6: ["ShiftL", "ShiftR"]
}

/**
 * The current key mappings
 */
export const cz88KeyMappings = usMapping;

/**
 * Represents the view of a Z88 key
 */
export interface Cz88KeyView {
  key?: string;
  keyword?: string;
  symbol?: string;
  secondSymbol?: string;
}

/**
 * Represents a keyboard layout
 */
export type Cz88KeyboardLayout = Record<string, Cz88KeyView>;