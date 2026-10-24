/*
 * The actions a renderer can ask the main process to run (`MainApi.runUiAction`): the Settings
 * dialog's buttons and app-state values, and the in-window controls (`.plans/MENU_REDESIGN_PLAN.md`
 * §4–§5). `src/main/ui-actions.ts` implements them.
 */
export type UiActionId =
  | "open-settings"
  /** The Settings dialog reports the page it shows, so the next page-less open returns to it */
  | "settings:page-shown"
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
  | "set:basicCompiler"
  | "set:z88dkCompiler"
  | "set:z88dkClib"
  | "set:z88dkOptimise"
  | "rom:sp48:select"
  | "rom:sp48:reset"
  | "rom:trdos:select"
  | "rom:trdos:forget"
  | "rom:esxdos:select"
  | "rom:esxdos:forget"
  | "rom:timex:select"
  | "rom:timex:forget"
  | "rom:scorpion:select"
  | "rom:scorpion:forget"
  | "keymap:select"
  | "keymap:reset"
  | "dialog:joystick-bindings"
  | "dialog:sjasmplus"
  | "dialog:boriel"
  | "dialog:z88dk"
  | "dialog:excluded-items"
  /** Opens the translators' guide in the browser (`.plans/LOCALIZATION_PLAN.md` §7) */
  | "open:translation-guide";
