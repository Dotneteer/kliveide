import { KeyMappingResult } from "../../common/abstractions/KeyMappingResult";
import { KeyMapping } from "../../renderer/abstractions/KeyMapping";
import { SpectrumKeyCode } from "../../renderer/abstractions/SpectrumKeyCode";

/**
 * Parses the specified JSON source to valid key mappings
 * @param source JSON to parse
 * @returns Key mappings
 */
export function parseKeyMappings (source: string): KeyMappingResult {
  // --- Parse the JSON file
  const mappingObj = JSON.parse(source);
  if (!mappingObj || typeof mappingObj !== "object") {
    throw new Error("Parsing keymappings failed.");
  }

  const result: KeyMapping = {};
  let merge = false;
  Object.keys(mappingObj).forEach(key => {
    // --- Test for merging
    if (key === "$merge") {
      merge = true;
      return;
    }

    if (!acceptsKeyboardEventCode(key)) {
      throw new Error(`Unknowm key code: '${key}'`);
    }
    const mapping = mappingObj[key];
    if (typeof mapping === "string") {
      // --- Single key
      if (SpectrumKeyCode[mapping as any] === undefined) {
        throw new Error(`'${key}': Unknown key code: '${mapping}'`);
      }
      result[key] = mapping;
    } else if (Array.isArray(mapping)) {
      // --- One or two keys
      if (mapping.length !== 1 && mapping.length !== 2) {
        throw new Error(
          `'${key}': Mapping value list should contain one or two items and not ${mapping.length}`
        );
      } else {
        const key1 = mapping[0];
        const key2 = mapping[1];
        if (typeof key1 !== "string") {
          throw new Error(
            `'${key}': Mapping value must be a string and not '${typeof key1}'`
          );
        }
        if (SpectrumKeyCode[key1 as any] === undefined) {
          throw new Error(`'${key}': Unknown key code: '${key1}'`);
        }

        if (key2) {
          if (typeof key2 !== "string") {
            throw new Error(
              `'${key}': Mapping value must be a string and not '${typeof key2}'`
            );
          }
          if ((SpectrumKeyCode as any)[key2] === undefined) {
            throw new Error(`'${key}': Unknown key code: '${key2}'`);
          }
        }

        const keys: [string] | [string, string] = [key1];
        if (key2) {
          keys.push(key2);
        }
        result[key] = keys;
      }
    } else {
      throw new Error(
        `'${key}': Mapping value should be a string or a string list with one or two items. ` +
          `Current value is '${typeof mapping}'`
      );
    }
  });
  // --- Done
  return { mapping: result, merge };
}

export function acceptsKeyboardEventCode (code: string): boolean {
  return acceptedKeyboardCodes.includes(code);
}

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
  "Pause",
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
  "LaunchApp1",
  "LaunchMail",
  "MediaSelect"
];
