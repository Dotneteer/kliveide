import { EmuViewOptions } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const emuShowToolbarAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_SHOW_TOOLBAR",
  payload: { flag },
});
export const emuShowStatusbarAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_SHOW_STATUSBAR",
  payload: { flag },
});
export const emuShowKeyboardAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_SHOW_KEYBOARD",
  payload: { flag },
});
export const emuShowFrameInfoAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_SHOW_FRAME_INFO",
  payload: { flag },
});
export const emuShowSidebarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_SIDEBAR",
  payload: { flag },
});

// ============================================================================
// Reducer

const initialState: EmuViewOptions = {};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): EmuViewOptions {
  switch (type) {
    case "EMU_SHOW_TOOLBAR":
      return { ...state, showToolbar: payload.flag };
    case "EMU_SHOW_STATUSBAR":
      return { ...state, showStatusBar: payload.flag };
    case "EMU_SHOW_KEYBOARD":
      return { ...state, showKeyboard: payload.flag };
    case "EMU_SHOW_FRAME_INFO":
      return { ...state, showFrameInfo: payload.flag };
    case "SHOW_SIDEBAR":
      return { ...state, showSidebar: payload.flag };
    default:
      return state;
  }
}
