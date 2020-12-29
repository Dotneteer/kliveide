/**
 * Defines a set of virtual machine keys that can be assigned to a virtual key
 */
export type KeySet =
  | string
  | [string]
  | [string, string]
  | [string, string, string];

/**
 * Defines mappings between the physical keyboard and virtual machine keyboard
 */
export type KeyMapping = Record<string, KeySet>;

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
    public primaryKey: number,
    public secondaryKey?: number
  ) {}
}

/**
 * Available virtual key codes
 */
export const virtualKeyCodes = {
  Escape: 27,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
  PrintScreen: 44,
  ScrollLock: 145,
  Pause: 19,

  NumLock: 144,
  NumpadDivide: 111,
  NumpadMultiply: 18,
  NumpadSubtract: 109,
  NumpadAdd: 107,
  NumpadEnter: 13,
  NumpadDecimal: 110,
  Numpad0: 96,
  Numpad1: 97,
  Numpad2: 98,
  Numpad3: 99,
  Numpad4: 100,
  Numpad5: 101,
  Numpad6: 102,
  Numpad7: 103,
  Numpad8: 104,
  Numpad9: 105,

  Insert: 45,
  Home: 36,
  PageUp: 33,
  Delete: 46,
  End: 35,
  PageDown: 34,

  BackQuote: 48,
  Digit1: 49,
  Digit2: 50,
  Digit3: 51,
  Digit4: 52,
  Digit5: 53,
  Digit6: 54,
  Digit7: 55,
  Digit8: 56,
  Digit9: 57,
  Digit0: 192,
  Minus: 189, 
  Equal: 187,
  Backspace: 8,
  Tab: 9,
  KeyQ: 81,
  KeyW: 87,
  KeyE: 69,
  KeyR: 82,
  KeyT: 84,
  KeyY: 89,
  KeyU: 85,
  KeyI: 73,
  KeyO: 79,
  KeyP: 80, 
  BracketLeft: 219,
  BracketRight: 221,
  Enter: 13,
  CapsLock: 20,
  KeyA: 65,
  KeyS: 83,
  KeyD: 68,
  KeyF: 70,
  KeyG: 71,
  KeyH: 72,
  KeyJ: 74,
  KeyK: 75,
  KeyL: 76,
  Semicolon: 186,
  Quote: 222,
  Backslash: 220,
  ShiftLeft: 16,
  IntlBackslash: 226,
  KeyZ: 90,
  KeyX: 88,
  KeyC: 67,
  KeyV: 86,
  KeyB: 66,
  KeyN: 78,
  KeyM: 77,
  Comma: 188,
  Period: 190, 
  Slash: 191,
  ShiftRight: 16,
  ControlLeft: 17,
  MetaLeft: 91,
  AltLeft: 18,
  Space: 32,
  AltRight: 18,
  MetaRight: 92,
  ContextMenu: 93,
  ControlRight: 17,

  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
}