import { EmuViewOptions } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const emuShowToolbarAction: ActionCreator = () => ({
  type: "EMU_SHOW_TOOLBAR",
});
export const emuHideToolbarAction: ActionCreator = () => ({
  type: "EMU_HIDE_TOOLBAR",
});
export const emuShowStatusbarAction: ActionCreator = () => ({
  type: "EMU_SHOW_STATUSBAR",
});
export const emuHideStatusbarAction: ActionCreator = () => ({
  type: "EMU_HIDE_STATUSBAR",
});
export const emuShowKeyboardAction: ActionCreator = () => ({
  type: "EMU_SHOW_KEYBOARD",
});
export const emuHideKeyboardAction: ActionCreator = () => ({
  type: "EMU_HIDE_KEYBOARD",
});
export const emuShowFrameInfoAction: ActionCreator = () => ({
  type: "EMU_SHOW_FRAME_INFO",
});
export const emuHideFrameInfoAction: ActionCreator = () => ({
  type: "EMU_HIDE_FRAME_INFO",
});

// ============================================================================
// Reducer

const initialState: EmuViewOptions = {};

export default function (
  state = initialState,
  { type }: KliveAction
): EmuViewOptions {
  switch (type) {
    case "EMU_SHOW_TOOLBAR":
      return { ...state, showToolbar: true };
    case "EMU_HIDE_TOOLBAR":
      return { ...state, showToolbar: false };
    case "EMU_SHOW_STATUSBAR":
      return { ...state, showStatusBar: true };
    case "EMU_HIDE_STATUSBAR":
      return { ...state, showStatusBar: false };
    case "EMU_SHOW_KEYBOARD":
      return { ...state, showKeyboard: true };
    case "EMU_HIDE_KEYBOARD":
      return { ...state, showKeyboard: false };
    case "EMU_SHOW_FRAME_INFO":
      return { ...state, showFrameInfo: true };
    case "EMU_HIDE_FRAME_INFO":
      return { ...state, showFrameInfo: false };
    default:
      return state;
  }
}
