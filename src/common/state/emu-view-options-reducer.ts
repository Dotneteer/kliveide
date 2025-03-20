import { Action } from "./Action";
import { EmuViewOptions } from "./AppState";

/**
 * This reducer is used to manage the emulator view option properties
 */
export function emuViewOptionsReducer(
  state: EmuViewOptions,
  { type, payload }: Action
): EmuViewOptions {
  switch (type) {
    case "SHOW_EMU_TOOLBAR":
      return { ...state, showToolbar: payload?.flag };
    case "SHOW_EMU_STATUSBAR":
      return { ...state, showStatusBar: payload?.flag };
    case "SHOW_KEYBOARD":
      return { ...state, showKeyboard: payload?.flag };
    case "SHOW_SHADOW_SCREEN":
      return { ...state, showInstantScreen: payload?.flag };
    case "EMU_SET_KEYBOARD_LAYOUT":
      return { ...state, keyboardLayout: payload?.id };
    case "EMU_STAY_ON_TOP":
      return { ...state, stayOnTop: payload?.flag };
    default:
      return state;
  }
}
