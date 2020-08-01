/**
 * Available action types
 */
export interface ActionTypes {
  // --- Aliased action
  ALIASED: null;

  // --- App focus actions
  APP_GOT_FOCUS: null;
  APP_LOST_FOCUS: null;

  // --- Emulator panel actions
  EMULATOR_SET_ZOOM: null;
  EMULATOR_SET_SIZE: null;
  EMULATOR_SET_EXEC_STATE: null;
  EMULATOR_SET_TAPE_CONTENTS: null;
  EMULATOR_SHOW_KEYBOARD: null;
  EMULATOR_HIDE_KEYBOARD: null;
  EMULATOR_TOGGLE_KEYBOARD: null;
  EMULATOR_SHOW_SHADOW_SCREEN: null;
  EMULATOR_HIDE_SHADOW_SCREEN: null;
  EMULATOR_TOGGLE_SHADOW_SCREEN: null;
  EMULATOR_SHOW_BEAM_POSITION: null;
  EMULATOR_HIDE_BEAM_POSITION: null;
  EMULATOR_TOGGLE_BEAM_POSITION: null;
  EMULATOR_ENABLE_FAST_LOAD: null;
  EMULATOR_DISABLE_FAST_LOAD: null;
  EMULATOR_TOGGLE_FAST_LOAD: null;

  // --- Emulator command actions
  EMULATOR_COMMAND: null;

  // --- Main window state actions
  MAXIMIZE_APP_WINDOW: null;
  MINIMIZE_APP_WINDOW: null;
  RESTORE_APP_WINDOW: null;

  
}
