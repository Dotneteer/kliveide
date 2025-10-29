import _ from "lodash";
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
    case "EMU_LOADED":
      return { ...state, emuLoaded: true, emuStateSynched: false };

    case "EMU_STATE_SYNCHED":
      return { ...state, emuStateSynched: true };

    case "IDE_LOADED":
      return { ...state, ideLoaded: true, ideStateSynched: false };

    case "IS_WINDOWS":
      return { ...state, isWindows: payload?.flag };

    case "EMU_FOCUSED":
      console.log('[appStateFlagsReducer] EMU_FOCUSED');
      return { ...state, emuFocused: payload?.flag };

    case "IDE_FOCUSED":
      return { ...state, ideFocused: payload?.flag };

    default:
      return state;
  }
}
