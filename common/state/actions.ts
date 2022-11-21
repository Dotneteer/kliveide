import { ActionCreator } from "./Action";

export const uiLoadedAction: ActionCreator = (flag: boolean) => ({
    type: "UI_LOADED",
    payload: { flag },
});
  
export const isWindowsAction: ActionCreator = (flag: boolean) => ({
    type: "IS_WINDOWS",
    payload: { flag },
});

export const showToolbarAction: ActionCreator = (flag: boolean) => ({
    type: "SHOW_TOOLBAR",
    payload: { flag },
});

export const showStatusBarAction: ActionCreator = (flag: boolean) => ({
    type: "SHOW_STATUSBAR",
    payload: { flag },
});

export const useEmuViewAction: ActionCreator = (flag: boolean) => ({
    type: "USE_EMU_VIEW",
    payload: { flag },
});

export const showSideBarAction: ActionCreator = (flag: boolean) => ({
    type: "SHOW_SIDE_BAR",
    payload: { flag },
});

export const primaryBarOnRightAction: ActionCreator = (flag: boolean) => ({
    type: "PRIMARY_BAR_ON_RIGHT",
    payload: { flag },
});

export const showToolPanelsAction: ActionCreator = (flag: boolean) => ({
    type: "SHOW_TOOL_PANELS",
    payload: { flag },
});

export const toolPanelsOnTopAction: ActionCreator = (flag: boolean) => ({
    type: "TOOLS_ON_TOP",
    payload: { flag },
});

export const maximizeToolsAction: ActionCreator = (flag: boolean) => ({
    type: "MAXIMIZE_TOOLS",
    payload: { flag },
});

export const showKeyboardAction: ActionCreator = (flag: boolean) => ({
    type: "SHOW_KEYBOARD",
    payload: { flag },
});

export const showFrameInfoAction: ActionCreator = (flag: boolean) => ({
    type: "SHOW_FRAME_INFO",
    payload: { flag },
});
