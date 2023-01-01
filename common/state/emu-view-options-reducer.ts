import { Action } from "./Action";
import { EmuViewOptions } from "./AppState";

/**
 * This reducer is used to manage the emulator view option properties
 */
export function emuViewOptionsReducer (
  state: EmuViewOptions,
  { type, payload }: Action
): EmuViewOptions {
  switch (type) {
    case "SHOW_TOOLBAR":
      return { ...state, showToolbar: payload?.flag };
    case "SHOW_STATUSBAR":
      return { ...state, showStatusBar: payload?.flag };
    case "SHOW_KEYBOARD":
      return { ...state, showKeyboard: payload?.flag };
    default:
      return state;
  }
}
