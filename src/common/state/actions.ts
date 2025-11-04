import { MachineControllerState } from "../abstractions/MachineControllerState";
import { ActionCreator } from "./Action";

export const emuLoadedAction: ActionCreator = () => ({
  type: "EMU_LOADED"
});

export const emuSynchedAction: ActionCreator = () => ({
  type: "EMU_STATE_SYNCHED"
});

export const ideLoadedAction: ActionCreator = () => ({
  type: "IDE_LOADED"
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

export const setOsAction: ActionCreator = (os: string) => ({
  type: "SET_OS",
  payload: { os }
});

export const setAppPathAction: ActionCreator = (appPath: string) => ({
  type: "SET_APP_PATH",
  payload: { appPath }
});

export const setGlobalSettingAction: ActionCreator = (id: string, value: any) => ({
  type: "SET_GLOBAL_SETTING",
  payload: { id, value }
});

export const toggleGlobalSettingAction: ActionCreator = (id: string) => ({
  type: "TOGGLE_GLOBAL_SETTING",
  payload: { id }
});

export const incBreakpointsVersionAction: ActionCreator = () => ({
  type: "INC_BPS_VERSION"
});

export const setDebuggingAction: ActionCreator = (flag) => ({
  type: "SET_DEBUGGING",
  payload: { flag }
});

export const setMachineStateAction: ActionCreator = (
  state: MachineControllerState,
  numValue: number
) => ({
  type: "SET_MACHINE_STATE",
  payload: { state, numValue }
});

export const setProjectDebuggingAction: ActionCreator = (flag) => ({
  type: "SET_PROJECT_DEBUGGING",
  payload: { flag }
});

export const setScriptsStatusAction: ActionCreator = (value: any) => ({
  type: "SET_SCRIPTS_STATUS",
  payload: { value }
});

