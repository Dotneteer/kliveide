import { KeyMapping } from "@renderer/abstractions/KeyMapping";

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
  Home: ["CShift", "N1"]
};

/**
 * The current key mappings
 */
export const spectrumKeyMappings = usMapping;
