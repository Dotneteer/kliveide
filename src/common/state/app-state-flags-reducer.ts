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
      return { ...state, emuLoaded: true };

    case "IDE_LOADED":
      return { ...state, ideLoaded: true };

    case "INIT_GLOBAL_SETTINGS":
      return { ...state, globalSettings: payload.value };

    case "IS_WINDOWS":
      return { ...state, isWindows: payload?.flag };

    case "SET_THEME":
      return { ...state, theme: payload?.id };

    case "SET_ACCENT":
      return { ...state, accent: payload?.id };

    case "EMU_FOCUSED":
      return { ...state, emuFocused: payload?.flag };

    case "IDE_FOCUSED":
      return { ...state, ideFocused: payload?.flag };

    case "DIM_MENU":
      return { ...state, dimMenu: payload?.flag };

    case "SET_AUTOMATION_STATUS":
      return { ...state, automation: payload?.value?.listening ? payload.value : undefined };

    case "APPLY_PROJECT_SETTING":
      return { ...state, projectSettings: withSetting(state?.projectSettings, payload?.id, payload?.value) };

    case "APPLY_USER_SETTING":
      return { ...state, userSettings: withSetting(state?.userSettings, payload?.id, payload?.value) };

    case "SAVE_USER_SETTINGS":
      return { ...state, userSettings: payload?.value };

    case "SAVE_PROJECT_SETTINGS":
      return { ...state, projectSettings: payload?.value };

    case "START_SCREEN_DISPLAYED":
      return { ...state, startScreenDisplayed: true };

    case "SET_KEY_MAPPINGS":
      return {
        ...state,
        keyMappingFile: payload?.file,
        keyMappings: payload?.value
      };

    case "INC_MENU_VERSION":
      return { ...state, menuVersion: (state?.menuVersion ?? 0) + 1 };

    default:
      return state;
  }
}

/**
 * A copy of a settings object with one dotted key set (or removed, for undefined). The copy is deep:
 * a shallow one shared the nested objects with the previous state and `_.set` then changed them in
 * place, so a component selecting the settings saw an unchanged value (`useSelector` compares
 * shallowly) and never showed a changed nested setting such as `zxbasic.compiler`.
 */
function withSetting(settings: Record<string, any> | undefined, id: string | undefined, value: any): Record<string, any> {
  const next = _.cloneDeep(settings ?? {});
  if (id) {
    if (value === undefined) {
      _.unset(next, id);
    } else {
      _.set(next, id, value);
    }
  }
  return next;
}
