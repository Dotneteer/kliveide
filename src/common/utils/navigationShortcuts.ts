import type { AppState } from "../state/AppState";
import { createSettingsReader } from "./SettingsReader";

/*
 * Go Back / Go Forward shortcuts, shared by the main-process menu (which shows them and handles them
 * while the emulator window has focus) and the IDE renderer (which handles them first while the IDE
 * window has focus — see `useNavigationShortcuts`).
 *
 * Accelerators use Electron's syntax ("Ctrl+-", "Alt+Left") and can be overridden with the
 * `shortcuts.navigateBack` / `shortcuts.navigateForward` user settings, like the stepping shortcuts.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §5.
 */

export const SHORTCUT_NAVIGATE_BACK = "shortcuts.navigateBack";
export const SHORTCUT_NAVIGATE_FORWARD = "shortcuts.navigateForward";

export type NavigationShortcuts = { back: string; forward: string };

/** VS Code's defaults. */
export function defaultNavigationShortcuts(isMac: boolean): NavigationShortcuts {
  return isMac
    ? { back: "Ctrl+-", forward: "Ctrl+Shift+-" }
    : { back: "Alt+Left", forward: "Alt+Right" };
}

/** The configured shortcuts, falling back to the defaults. */
export function readNavigationShortcuts(
  state: AppState | undefined,
  isMac: boolean
): NavigationShortcuts {
  const reader = createSettingsReader(state);
  const defaults = defaultNavigationShortcuts(isMac);
  const back = reader.readSetting(SHORTCUT_NAVIGATE_BACK);
  const forward = reader.readSetting(SHORTCUT_NAVIGATE_FORWARD);
  return {
    back: typeof back === "string" && back.trim() ? back.trim() : defaults.back,
    forward: typeof forward === "string" && forward.trim() ? forward.trim() : defaults.forward
  };
}

/** The parts of a DOM `KeyboardEvent` the matcher reads. */
export type KeyEventLike = {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

type ParsedAccelerator = {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  /** The `KeyboardEvent.code` values the key may arrive as. */
  codes: string[];
};

// --- Keyed by `code`, not `key`: with Shift held, "-" arrives as key "_", and on some layouts Alt
// --- changes the character too. The physical key is what an accelerator names.
const NAMED_KEY_CODES: Record<string, string[]> = {
  "-": ["Minus", "NumpadSubtract"],
  "=": ["Equal"],
  plus: ["Equal", "NumpadAdd"],
  "[": ["BracketLeft"],
  "]": ["BracketRight"],
  ",": ["Comma"],
  ".": ["Period"],
  "/": ["Slash"],
  "\\": ["Backslash"],
  ";": ["Semicolon"],
  "'": ["Quote"],
  "`": ["Backquote"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  home: ["Home"],
  end: ["End"],
  pageup: ["PageUp"],
  pagedown: ["PageDown"],
  backspace: ["Backspace"],
  delete: ["Delete"],
  space: ["Space"],
  tab: ["Tab"],
  enter: ["Enter", "NumpadEnter"],
  return: ["Enter", "NumpadEnter"]
};

/**
 * Parses an Electron accelerator. Undefined for one it does not understand, which then never matches.
 */
export function parseAccelerator(accelerator: string, isMac: boolean): ParsedAccelerator | undefined {
  if (!accelerator) return undefined;
  // --- "Ctrl+-" splits cleanly; "Ctrl++" would not, so Electron spells that key "Plus".
  const parts = accelerator.split("+").map((p) => p.trim());
  const keyPart = parts.pop();
  if (!keyPart) return undefined;

  const parsed: ParsedAccelerator = { ctrl: false, shift: false, alt: false, meta: false, codes: [] };
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "ctrl":
      case "control":
        parsed.ctrl = true;
        break;
      case "shift":
        parsed.shift = true;
        break;
      case "alt":
      case "option":
      case "altgr":
        parsed.alt = true;
        break;
      case "cmd":
      case "command":
      case "meta":
      case "super":
        parsed.meta = true;
        break;
      case "cmdorctrl":
      case "commandorcontrol":
        if (isMac) parsed.meta = true;
        else parsed.ctrl = true;
        break;
      default:
        return undefined;
    }
  }

  const key = keyPart.toLowerCase();
  if (/^[a-z]$/.test(key)) parsed.codes = [`Key${key.toUpperCase()}`];
  else if (/^[0-9]$/.test(key)) parsed.codes = [`Digit${key}`, `Numpad${key}`];
  else if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key)) parsed.codes = [key.toUpperCase()];
  else if (NAMED_KEY_CODES[key]) parsed.codes = NAMED_KEY_CODES[key];
  else return undefined;
  return parsed;
}

/** Whether a key event is the accelerator — all of its modifiers and no others. */
export function matchesAccelerator(event: KeyEventLike, accelerator: string, isMac: boolean): boolean {
  const parsed = parseAccelerator(accelerator, isMac);
  if (!parsed) return false;
  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta &&
    parsed.codes.includes(event.code)
  );
}
