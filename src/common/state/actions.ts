import { ActionCreator } from "./Action";

export const initGlobalSettingsAction: ActionCreator = (value: Record<string, any>) => ({
  type: "INIT_GLOBAL_SETTINGS",
  payload: { value }
});

export const setGlobalSettingAction: ActionCreator = (id: string, value: any) => ({
  type: "SET_GLOBAL_SETTING",
  payload: { id, value }
});

export const unloadWindowsAction: ActionCreator = () => ({
  type: "UNLOAD_WINDOWS"
});

export const emuLoadedAction: ActionCreator = () => ({
  type: "EMU_LOADED"
});

export const emuSynchedAction: ActionCreator = () => ({
  type: "EMU_STATE_SYNCHED"
});

export const ideLoadedAction: ActionCreator = () => ({
  type: "IDE_LOADED"
});

export const dimMenuAction: ActionCreator = (flag: boolean) => ({
  type: "DIM_MENU",
  payload: { flag }
});

export const isWindowsAction: ActionCreator = (flag: boolean) => ({
  type: "IS_WINDOWS",
  payload: { flag }
});

export const emuFocusedAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_FOCUSED",
  payload: { flag }
});

export const ideFocusedAction: ActionCreator = (flag: boolean) => ({
  type: "IDE_FOCUSED",
  payload: { flag }
});

export const setThemeAction: ActionCreator = (id: string) => ({
  type: "SET_THEME",
  payload: { id }
});

export const selectActivityAction: ActionCreator = (id: string) => ({
  type: "SET_ACTIVITY",
  payload: { id }
});

export const showFrameInfoAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_FRAME_INFO",
  payload: { flag }
});

export const setSideBarPanelExpandedAction: ActionCreator = (id: string, flag: boolean) => ({
  type: "SET_SIDEBAR_PANEL_EXPANDED",
  payload: { id, flag }
});
