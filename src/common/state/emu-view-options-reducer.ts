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
    case "EMU_SET_KEYBOARD_LAYOUT":
      return { ...state, keyboardLayout: payload?.id };
    case "EMU_STAY_ON_TOP":
      return { ...state, stayOnTop: payload?.flag };
    default:
      return state;
  }
}
