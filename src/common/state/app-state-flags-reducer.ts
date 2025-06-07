import _ from "lodash";
import { Action } from "./Action";
import { AppState } from "./AppState";

/**
 * This reducer is used to manage the AppState flags and simple properties
 */
export function appStateFlagsReducer(
  state: AppState,
  { type }: Action
): AppState {
  switch (type) {
    case "EMU_LOADED":
      return { ...state, emuLoaded: true, emuStateSynched: false };

    case "IDE_LOADED":
      return { ...state, ideLoaded: true, ideStateSynched: false };

    default:
      return state;
  }
}
