import type { KeyMapping } from "@abstr/KeyMapping";

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

  Insert: ["Diamond", "V"],
  Delete: ["ShiftR", "Delete"],
  Home: ["Diamond", "Left"],
  End: ["Diamond", "Right"],
  PageUp: ["ShiftR", "Up"],
  PageDown: ["ShiftR", "Down"],

  NumpadAdd: ["ShiftL", "Equal"],
  NumpadSubtract: "Minus",
  NumpadMultiply: ["ShiftL", "N8"],
  NumpadDivide: "Slash",
  NumpadDecimal: "Period",
  Equal: "Equal",
  Backslash: "Backslash",
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
};

/**
 * The current Z88 key mappings
 */
export const z88KeyMappings = usMapping;
