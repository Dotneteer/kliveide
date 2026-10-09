/*
 * The actions a renderer can ask the main process to run (`MainApi.runUiAction`): the Settings
 * dialog's buttons and app-state values, and the in-window controls (`.plans/MENU_REDESIGN_PLAN.md`
 * §4–§5). `src/main/ui-actions.ts` implements them.
 */
export type UiActionId =
  | "open-settings"
  | "open-machine-selector"
  | "toggle-ide-emu-recording"
  | "set:clockMultiplier"
  | "set:soundLevel"
  | "set:theme"
  | "set:accent"
  | "set:z88Lcd"
  | "set:recordingFps"
  | "set:recordingQuality"
  | "set:recordingFormat"
  | "set:windowRecordingIdePosition"
  | "set:windowRecordingPointer"
  | "set:windowRecordingClicks"
  | "set:windowRecordingHiDpi"
  | "set:automationEnabled"
  | "set:automationLevel"
  | "rom:sp48:select"
  | "rom:sp48:reset"
  | "rom:trdos:select"
  | "rom:trdos:forget"
  | "rom:timex:select"
  | "rom:timex:forget"
  | "rom:scorpion:select"
  | "rom:scorpion:forget"
  | "keymap:select"
  | "keymap:reset"
  | "dialog:joystick-bindings"
  | "dialog:sjasmplus"
  | "dialog:excluded-items";
