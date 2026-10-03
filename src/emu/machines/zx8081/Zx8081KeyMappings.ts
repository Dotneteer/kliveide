import type { KeyMapping } from "@abstractions/KeyMapping";

/**
 * The host keyboard on the ZX80/ZX81 matrix, after CLK's `Sinclair::ZX::Keyboard::KeyboardMapper`
 * (MIT; Copyright (c) 2015 Thomas Harte - the full notice is in THIRD_PARTY_NOTICES.md): both shifts are SHIFT, Enter is NEW LINE, and the
 * editing keys are their SHIFT combinations - Backspace RUBOUT (SHIFT+0), the arrows SHIFT+5..8,
 * Escape BREAK (SHIFT+SPACE), and Comma SHIFT+. (the ZX80/81 have a `.` key of their own).
 */
const commonMapping: KeyMapping = {
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
  KeyZ: "Z",
  KeyX: "X",
  KeyC: "C",
  KeyV: "V",
  KeyB: "B",
  KeyN: "N",
  KeyM: "M",

  Enter: "NewLine",
  NumpadEnter: "NewLine",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  Space: "Space",
  Period: "Period",
  NumpadDecimal: "Period",

  Comma: ["Shift", "Period"],
  Backspace: ["Shift", "N0"],
  Escape: ["Shift", "Space"],
  ArrowLeft: ["Shift", "N5"],
  ArrowDown: ["Shift", "N6"],
  ArrowUp: ["Shift", "N7"],
  ArrowRight: ["Shift", "N8"]
};

/** The ZX81: EDIT is SHIFT+1 (Backquote and F1, as in CLK) */
export const zx81KeyMappings: KeyMapping = {
  ...commonMapping,
  Backquote: ["Shift", "N1"],
  F1: ["Shift", "N1"]
};

/** The ZX80: EDIT is SHIFT+NEW LINE */
export const zx80KeyMappings: KeyMapping = {
  ...commonMapping,
  Backquote: ["Shift", "NewLine"],
  F1: ["Shift", "NewLine"]
};
