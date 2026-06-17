import { Action } from "./Action";
import { AppState } from "./AppState";
import { selectPersistedIdePanelLayout } from "./ide-panel-layout-persistence";

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

    case "SET_APP_PATH":
      return { ...state, appPath: payload?.value };

    case "EMU_LOADED":
      return { ...state, emuLoaded: true, emuStateSynched: false };

    case "EMU_STATE_SYNCHED":
      return { ...state, emuStateSynched: true };

    case "IDE_LOADED":
      return { ...state, ideLoaded: true, ideStateSynched: false };

    case "INIT_GLOBAL_SETTINGS":
      return {
        ...state,
        ideStateSynched: true,
        globalSettings: payload?.value,
        idePanelLayout: selectPersistedIdePanelLayout(
          payload?.value,
          state.workspaceSettings,
          state.idePanelLayout
        )
      };

    case "SET_WORKSPACE_SETTINGS":
      return {
        ...state,
        workspaceSettings: payload?.value,
        idePanelLayout: selectPersistedIdePanelLayout(
          state.globalSettings,
          payload?.value,
          state.idePanelLayout
        )
      };

    case "IS_WINDOWS":
      return { ...state, isWindows: payload?.flag };

    case "SET_THEME":
      return { ...state, theme: payload?.id };

    case "SET_ACTIVITY":
      return { ...state, activeActivity: payload?.id ?? "explorer" };

    case "EMU_FOCUSED":
      return { ...state, emuFocused: payload?.flag };

    case "IDE_FOCUSED":
      return { ...state, ideFocused: payload?.flag };

    case "DIM_MENU":
      return { ...state, dimMenu: payload?.flag };

    case "START_SCREEN_DISPLAYED":
      return { ...state, startScreenDisplayed: true };

    case "SET_KEY_MAPPINGS":
      return {
        ...state,
        keyMappingFile: payload?.file,
        keyMappings: payload?.value
      };

    default:
      return state;
  }
}
