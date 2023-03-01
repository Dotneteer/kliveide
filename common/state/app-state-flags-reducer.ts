import { Action } from "./Action";
import { AppState } from "./AppState";

/**
 * This reducer is used to manage the AppState flags and simple properties
 */
export function appStateFlagsReducer (
  state: AppState,
  { type, payload }: Action
): AppState {
  switch (type) {
    case "UNLOAD_WINDOWS":
      return { ...state, emuLoaded: false, ideLoaded: false };
    case "EMU_LOADED":
      return { ...state, emuLoaded: true, emuStateSynched: false };
    case "EMU_STATE_SYNCHED":
      return { ...state, emuStateSynched: true };
    case "IDE_LOADED":
      return { ...state, ideLoaded: true, ideStateSynched: false };
    case "IDE_STATE_SYNCHED":
      return { ...state, ideStateSynched: true };
    case "IS_WINDOWS":
      return { ...state, isWindows: payload?.flag };
    case "SET_THEME":
      return { ...state, theme: payload?.id };
    case "EMU_FOCUSED":
      return { ...state, emuFocused: payload.flag };
    case "IDE_FOCUSED":
      return { ...state, ideFocused: payload.flag };
    case "DIM_MENU":
      return { ...state, dimMenu: payload.flag };
    default:
      return state;
  }
}
