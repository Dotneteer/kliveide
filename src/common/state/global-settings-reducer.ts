import { set, get, cloneDeep } from "lodash";
import { Action } from "./Action";
import { AppState } from "./AppState";

/**
 * This reducer is used to manage the global settings
 */
export function globalSettingsReducer(
  state: AppState,
  { type, payload }: Action
): AppState {
  switch (type) {
    case "INIT_GLOBAL_SETTINGS":
      if (payload?.value) {
        return { ...state, ideStateSynched: true, globalSettings: payload.value };
      }
      return state;

    case "SET_GLOBAL_SETTING":
      if (payload?.id && payload.value !== undefined) {
        const currentGlobalSettings = state.globalSettings || {};
        const settingsCopy = cloneDeep(currentGlobalSettings);
        const newGlobalSettings = set(settingsCopy, payload.id, payload.value);
        return {
          ...state,
          globalSettings: newGlobalSettings
        };
      }
      return state;

    case "TOGGLE_GLOBAL_SETTING":
      if (payload?.id) {
        const currentGlobalSettings = state.globalSettings || {};
        const currentValue = get(currentGlobalSettings, payload.id);
        const settingsCopy = cloneDeep(currentGlobalSettings);
        const newGlobalSettings = set(settingsCopy, payload.id, !currentValue);
        return {
          ...state,
          globalSettings: newGlobalSettings
        };
      }
      return state;

    default:
      return state;
  }
}
