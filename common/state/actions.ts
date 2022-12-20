import { DocumentState } from "@/ide/abstractions";
import { ActionCreator } from "./Action";
import { SideBarPanelState } from "./AppState";

export const uiLoadedAction: ActionCreator = (flag: boolean) => ({
    type: "UI_LOADED",
    payload: { flag },
});
  
export const isWindowsAction: ActionCreator = (flag: boolean) => ({
    type: "IS_WINDOWS",
    payload: { flag },
});

export const setThemeAction: ActionCreator = (id: string) => ({
    type: "SET_THEME",
    payload: { id },
});

export const selectActivityAction: ActionCreator = (id: string) => ({
    type: "SET_ACTIVITY",
    payload: { id },
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

export const setSideBarPanelExpandedAction: ActionCreator = (id: string, flag: boolean) => ({
    type: "SET_SIDEBAR_PANEL_EXPANDED",
    payload: { id, flag },
});

export const setSideBarPanelsStateAction: ActionCreator = (panelsState: Record<string, SideBarPanelState>) => ({
    type: "SET_SIDEBAR_PANELS_STATE",
    payload: { panelsState },
});

export const setSideBarPanelSizeAction: ActionCreator = (
    id: string, 
    size: number, 
    nextId: string,
    nextSize: number) => ({
    type: "SET_SIDEBAR_PANEL_SIZE",
    payload: { id, size, nextId, nextSize },
});

export const createDocumentAction: ActionCreator = (document: DocumentState, index: number) => ({
    type: "CREATE_DOC",
    payload: { document, index },
});

export const changeDocumentAction: ActionCreator = (document: DocumentState, index: number) => ({
    type: "CHANGE_DOC",
    payload: { document, index },
});

export const activateDocumentAction: ActionCreator = (id: string) => ({
    type: "ACTIVATE_DOC",
    payload: { id },
});

export const closeDocumentAction: ActionCreator = (id: string) => ({
    type: "CLOSE_DOC",
    payload: { id },
});

export const closeAllDocumentsAction: ActionCreator = () => ({type: "CLOSE_ALL_DOCS"});

