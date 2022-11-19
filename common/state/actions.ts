import { ActionCreator } from "./Action";

export const uiLoadedAction: ActionCreator = (flag: boolean) => ({
    type: "UI_LOADED",
    payload: { flag },
});
  
export const isWindowsAction: ActionCreator = (flag: boolean) => ({
    type: "IS_WINDOWS",
    payload: { flag },
});

export const emuShowToolbarAction: ActionCreator = (flag: boolean) => ({
    type: "EMU_SHOW_TOOLBAR",
    payload: { flag },
});

export const emuShowStatusBarAction: ActionCreator = (flag: boolean) => ({
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
