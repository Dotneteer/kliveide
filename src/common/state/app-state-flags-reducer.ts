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

    case "APPLY_PROJECT_SETTING": {
      let newSetting = { ...state?.projectSettings };
      if (payload.id) {
        if (payload.value === undefined) {
          _.unset(newSetting, payload.id);
        } else {
          _.set(newSetting, payload.id, payload.value);
        }
      }
      return { ...state, projectSettings: newSetting };
    }

    case "APPLY_USER_SETTING": {
      let newSetting = { ...state?.userSettings };
      if (payload.id) {
        if (payload.value === undefined) {
          _.unset(newSetting, payload.id);
        } else {
          _.set(newSetting, payload.id, payload.value);
        }
      }
      return { ...state, userSettings: newSetting };
    }

    case "SAVE_USER_SETTINGS":
      return { ...state, userSettings: payload.value };

    case "SAVE_PROJECT_SETTINGS":
      return { ...state, projectSettings: payload.value };

    case "START_SCREEN_DISPLAYED":
      return { ...state, startScreenDisplayed: true };

    case "SET_KEY_MAPPINGS":
      return {
        ...state,
        keyMappingFile: payload.file,
        keyMappings: payload.value
      };

    default:
      return state;
  }
}
