/**
 * Available action types
 */
export interface ActionTypes {
  EMU_LOADED: null;
  EMU_STATE_SYNCHED: null;
  IDE_LOADED: null;
  IDE_STATE_SYNCHED: null;
  IS_WINDOWS: null;
  SET_THEME: null;
  IDE_FOCUSED: null;
  EMU_FOCUSED: null;
  SET_OS: null;
  SET_APP_PATH: null;

  // --- Globa setting now use this action type
  INIT_GLOBAL_SETTINGS: null;
  SET_GLOBAL_SETTING: null;
  TOGGLE_GLOBAL_SETTING: null;

  INC_BPS_VERSION: null;
  SET_DEBUGGING: null;
  SET_MACHINE_STATE: null;
  SET_PROJECT_DEBUGGING: null;
}
