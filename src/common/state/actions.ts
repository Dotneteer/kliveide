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

export const setDebuggingAction: ActionCreator = flag => ({
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

export const setProjectDebuggingAction: ActionCreator = flag => ({
  type: "SET_PROJECT_DEBUGGING",
  payload: { flag }
});

export const setScriptsStatusAction: ActionCreator = (value: any) => ({
  type: "SET_SCRIPTS_STATUS",
  payload: { value }
});

export const setClockMultiplierAction: ActionCreator = (numValue: number) => ({
  type: "SET_CLOCK_MULTIPLIER",
  payload: { numValue }
});

export const setSoundLevelAction: ActionCreator = (numValue: number) => ({
  type: "SET_SOUND_LEVEL",
  payload: { numValue }
});

export const setKeyMappingsAction: ActionCreator = (file, value) => ({
  type: "SET_KEY_MAPPINGS",
  payload: { file, value }
});

export const setVolatileDocStateAction: ActionCreator = (id, flag) => ({
  type: "SET_VOLATILE_DOC_STATE",
  payload: { id, flag }
});

export const setMediaAction: ActionCreator = (id: string, value: any) => ({
  type: "SET_MEDIA",
  payload: { id, value }
});

export const incMenuVersionAction: ActionCreator = () => ({
  type: "START_SCREEN_DISPLAYED"
});

export const setMachineConfigAction: ActionCreator = (value: any) => ({
  type: "SET_MACHINE_CONFIG",
  payload: { value }
});

export const setMachineTypeAction: ActionCreator = (id: string) => ({
  type: "SET_MACHINE_TYPE",
  payload: { id }
});

export const setModelTypeAction: ActionCreator = (id: string) => ({
  type: "SET_MODEL_TYPE",
  payload: { id }
});
