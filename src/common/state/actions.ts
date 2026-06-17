import { ActionCreator } from "./Action";
import type { MachineCommand } from "../abstractions/MachineCommand";
import { MachineControllerState } from "../abstractions/MachineControllerState";
import type { MachineConfigSet } from "../machines/info-types";
import type {
  RecordingFormat,
  RecordingFps,
  RecordingQuality,
  ScreenRecordingState,
  TapeMediaState
} from "./AppState";

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
    clockMultiplier: number;
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

export const setKeyMappingsAction: ActionCreator = (file?: string, value?: unknown) => ({
  type: "SET_KEY_MAPPINGS",
  payload: { file, value }
});

export const muteSoundAction: ActionCreator = (flag: boolean) => ({
  type: "MUTE_SOUND",
  payload: { flag }
});

export const setSoundLevelAction: ActionCreator = (numValue: number, savedSoundLevel?: number) => ({
  type: "SET_SOUND_LEVEL",
  payload: { numValue, value: savedSoundLevel }
});

export const setClockMultiplierAction: ActionCreator = (numValue: number) => ({
  type: "SET_CLOCK_MULTIPLIER",
  payload: { numValue }
});

export const setScreenRecordingAvailableAction: ActionCreator = (available: boolean) => ({
  type: "SET_SCREEN_RECORDING_AVAILABLE",
  payload: { flag: available }
});

export const setScreenRecordingStateAction: ActionCreator = (
  recordingState: ScreenRecordingState,
  file?: string,
  fps?: RecordingFps
) => ({
  type: "SET_SCREEN_RECORDING_STATE",
  payload: { id: recordingState, value: file, text: fps }
});

export const setScreenRecordingQualityAction: ActionCreator = (quality: RecordingQuality) => ({
  type: "SET_SCREEN_RECORDING_QUALITY",
  payload: { id: quality }
});

export const setScreenRecordingFormatAction: ActionCreator = (format: RecordingFormat) => ({
  type: "SET_SCREEN_RECORDING_FORMAT",
  payload: { id: format }
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

export const initIdePanelLayoutAction: ActionCreator = (value: unknown) => ({
  type: "INIT_IDE_PANEL_LAYOUT",
  payload: { value }
});

export const setPanelExpandedAction: ActionCreator = (id: string, flag: boolean) => ({
  type: "SET_PANEL_EXPANDED",
  payload: { id, flag }
});

export const setPanelSizeAction: ActionCreator = (id: string, numValue: number) => ({
  type: "SET_PANEL_SIZE",
  payload: { id, numValue }
});

export const movePanelInstanceAction: ActionCreator = (
  id: string,
  placement: string,
  activityId?: string,
  groupId?: string,
  orderIndex?: number
) => ({
  type: "MOVE_PANEL_INSTANCE",
  payload: { id, text: placement, nextId: activityId, value: { groupId, orderIndex } }
});

export const createPanelInstanceAction: ActionCreator = (
  id: string,
  contributionId: string,
  rendererId: string,
  placement: string,
  activityId?: string,
  groupId?: string,
  orderIndex?: number
) => ({
  type: "CREATE_PANEL_INSTANCE",
  payload: {
    id,
    text: contributionId,
    nextId: rendererId,
    value: { placement, activityId, groupId, orderIndex }
  }
});

export const closePanelInstanceAction: ActionCreator = (id: string) => ({
  type: "CLOSE_PANEL_INSTANCE",
  payload: { id }
});

export const resetPanelLayoutAction: ActionCreator = () => ({
  type: "RESET_PANEL_LAYOUT"
});

export const setWorkspaceSettingsAction: ActionCreator = (value: Record<string, any>) => ({
  type: "SET_WORKSPACE_SETTINGS",
  payload: { value }
});

export const patchPanelViewStateAction: ActionCreator = (
  id: string,
  value: Record<string, unknown>
) => ({
  type: "PATCH_PANEL_VIEW_STATE",
  payload: { id, value }
});

export const setPanelInstanceStateAction: ActionCreator = (
  id: string,
  key: string,
  value: unknown
) => ({
  type: "SET_PANEL_INSTANCE_STATE",
  payload: { id, text: key, value }
});

export const setPanelContributionStateAction: ActionCreator = (
  id: string,
  key: string,
  value: unknown
) => ({
  type: "SET_PANEL_CONTRIBUTION_STATE",
  payload: { id, text: key, value }
});
