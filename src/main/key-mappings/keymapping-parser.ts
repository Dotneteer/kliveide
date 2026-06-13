import type { KeyMapping, KeyMappingSet, KeySet } from "../../common/abstractions/KeyMapping";

/**
 * Parses the specified JSON source to valid key mappings.
 */
export function parseKeyMappings(source: string): KeyMappingSet {
  const mappingObj = JSON.parse(source);
  if (!mappingObj || typeof mappingObj !== "object" || Array.isArray(mappingObj)) {
    throw new Error("Parsing keymappings failed.");
  }

  const result: KeyMapping = {};
  let merge = false;
  Object.keys(mappingObj as Record<string, unknown>).forEach((key) => {
    if (key === "$merge") {
      merge = true;
      return;
    }

    if (!acceptsKeyboardEventCode(key)) {
      throw new Error(`Unknown key code: '${key}'`);
    }

    const mapping = (mappingObj as Record<string, unknown>)[key];
    if (typeof mapping === "string") {
      assertSpectrumKeyName(key, mapping);
      result[key] = mapping;
      return;
    }

    if (!Array.isArray(mapping)) {
      throw new Error(
        `'${key}': Mapping value should be a string or a string list with one or two items. ` +
          `Current value is '${typeof mapping}'`
      );
    }

    if (mapping.length < 1 || mapping.length > 2) {
      throw new Error(
        `'${key}': Mapping value list should contain one or two items and not ${mapping.length}`
      );
    }

    const keys: string[] = [];
    for (const item of mapping) {
      if (typeof item !== "string") {
        throw new Error(`'${key}': Mapping value must be a string and not '${typeof item}'`);
      }
      assertSpectrumKeyName(key, item);
      keys.push(item);
    }
    result[key] = keys as KeySet;
  });

  return { mapping: result, merge };
}

export function acceptsKeyboardEventCode(code: string): boolean {
  return acceptedKeyboardCodes.includes(code);
}

function assertSpectrumKeyName(physicalKey: string, spectrumKey: string): void {
  if (!spectrumKeyNames.has(spectrumKey)) {
    throw new Error(`'${physicalKey}': Unknown key code: '${spectrumKey}'`);
  }
}

const spectrumKeyNames = new Set([
  "CShift",
  "Z",
  "X",
  "C",
  "V",
  "A",
  "S",
  "D",
  "F",
  "G",
  "Q",
  "W",
  "E",
  "R",
  "T",
  "N1",
  "N2",
  "N3",
  "N4",
  "N5",
  "N0",
  "N9",
  "N8",
  "N7",
  "N6",
  "P",
  "O",
  "I",
  "U",
  "Y",
  "Enter",
  "L",
  "K",
  "J",
  "H",
  "Space",
  "SShift",
  "M",
  "N",
  "B"
]);

const acceptedKeyboardCodes: string[] = [
  "Escape",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
  "Minus",
  "Equal",
  "Backspace",
  "Tab",
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
  "BracketLeft",
  "BracketRight",
  "Enter",
  "ControlLeft",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyH",
  "KeyJ",
  "KeyK",
  "KeyL",
  "Semicolon",
  "Quote",
  "Backquote",
  "ShiftLeft",
  "Backslash",
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
  "KeyB",
  "KeyN",
  "KeyM",
  "Comma",
  "Period",
  "Slash",
  "ShiftRight",
  "NumpadMultiply",
  "AltLeft",
  "Space",
  "CapsLock",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "Pause",
  "ScrollLock",
  "Numpad7",
  "Numpad8",
  "Numpad9",
  "NumpadSubtract",
  "Numpad4",
  "Numpad5",
  "Numpad6",
  "NumpadAdd",
  "Numpad1",
  "Numpad2",
  "Numpad3",
  "Numpad0",
  "NumpadDecimal",
  "IntlBackslash",
  "F11",
  "F12",
  "NumpadEqual",
  "KanaMode",
  "Lang2",
  "Lang1",
  "IntlRo",
  "Convert",
  "NonConvert",
  "IntlYen",
  "NumpadComma",
  "MediaTrackPrevious",
  "MediaTrackNext",
  "NumpadEnter",
  "ControlRight",
  "AudioVolumeMute",
  "LaunchApp2",
  "MediaPlayPause",
  "MediaStop",
  "VolumeDown",
  "VolumeUp",
  "BrowserHome",
  "NumpadDivide",
  "PrintScreen",
  "AltRight",
  "NumLock",
  "Home",
  "ArrowUp",
  "PageUp",
  "ArrowLeft",
  "ArrowRight",
  "End",
  "ArrowDown",
  "PageDown",
  "Insert",
  "Delete",
  "MetaLeft",
  "MetaRight",
  "ContextMenu",
  "Power",
  "BrowserSearch",
  "BrowserFavorites",
  "BrowserRefresh",
  "BrowserStop",
  "BrowserForward",
  "BrowserBack",
  "LaunchApp1"
];
