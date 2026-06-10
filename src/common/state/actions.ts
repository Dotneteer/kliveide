import { ActionCreator } from "./Action";
import type { MachineCommand } from "../abstractions/MachineCommand";
import { MachineControllerState } from "../abstractions/MachineControllerState";
import type { MachineConfigSet } from "../machines/info-types";
import type { TapeMediaState } from "./AppState";

export const initGlobalSettingsAction: ActionCreator = (value: Record<string, any>) => ({
  type: "INIT_GLOBAL_SETTINGS",
  payload: { value }
});

export const setAppPathAction: ActionCreator = (value: string) => ({
  type: "SET_APP_PATH",
  payload: { value }
});

export const setGlobalSettingAction: ActionCreator = (id: string, value: any) => ({
  type: "SET_GLOBAL_SETTING",
  payload: { id, value }
});

export const issueMachineCommandAction: ActionCreator = (id: MachineCommand) => ({
  type: "ISSUE_MACHINE_COMMAND",
  payload: { id }
});

export const setMachineStateAction: ActionCreator = (
  state: MachineControllerState,
  numValue = 0
) => ({
  type: "SET_MACHINE_STATE",
  payload: { state, numValue }
});

export const setMachineTypeAction: ActionCreator = (
  machineId: string,
  modelId?: string,
  config?: MachineConfigSet
) => ({
  type: "SET_MACHINE_TYPE",
  payload: { id: machineId, nextId: modelId, value: config ?? {} }
});

export const setSp48FrameInfoAction: ActionCreator = (
  value: {
    frames: number;
    tacts: number;
    audioSampleCount: number;
    lastFrameTimeInMs: number;
    avgFrameTimeInMs: number;
    pc: number;
    baseClockFrequency: number;
  }
) => ({
  type: "SET_SP48_FRAME_INFO",
  payload: { value }
});

export const setTapeMediaAction: ActionCreator = (value: TapeMediaState) => ({
  type: "SET_TAPE_MEDIA",
  payload: { value }
});

export const clearTapeMediaAction: ActionCreator = () => ({
  type: "CLEAR_TAPE_MEDIA"
});

export const muteSoundAction: ActionCreator = (flag: boolean) => ({
  type: "MUTE_SOUND",
  payload: { flag }
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
