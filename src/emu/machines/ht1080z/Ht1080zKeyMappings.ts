import type { KeyMapping } from "@abstractions/KeyMapping";

/**
 * The host keyboard on the HT-1080Z matrix, by key position (`.plans/HT1080Z_PLAN.md` §7): letters
 * and digits on their keys, Enter is NEW LINE, Escape BREAK, Home CLEAR, the arrows the four arrow
 * keys, Backspace the left arrow (which deletes the last character), both shifts SHIFT.
 *
 * The punctuation keys sit where the HT has them: `- =` on Minus, `; +` on Semicolon, `: *` on
 * Quote, `@` on Backslash. Host keys go by position, as on the ZX80/81: SHIFT with a key gives the
 * HT's shifted symbol of that key (SHIFT+2 is `"`), not the host's. Text typed by the IDE goes by
 * character instead (`Ht1080zTyper.ts`). Page Up or Page Down is the latching PAGE key.
 */
export const ht1080zKeyMappings: KeyMapping = {
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

  Minus: "Minus",
  NumpadSubtract: "Minus",
  Semicolon: "Semicolon",
  Quote: "Colon",
  Backslash: "At",
  Comma: "Comma",
  Period: "Period",
  NumpadDecimal: "Period",
  Slash: "Slash",
  NumpadDivide: "Slash",

  Enter: "Enter",
  NumpadEnter: "Enter",
  Escape: "Break",
  Home: "Clear",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Backspace: "Left",
  Space: "Space",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  PageUp: "Page",
  PageDown: "Page"
};
