import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ActionCreator } from "./Action";
import { SideBarPanelState } from "./AppState";
import { KliveCompilerOutput } from "../../main/compiler-integration/compiler-registry";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { ExportDialogSettings } from "@main/settings";

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

export const ideSynchedAction: ActionCreator = () => ({
  type: "IDE_STATE_SYNCHED"
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

export const setSideBarPanelsStateAction: ActionCreator = (
  panelsState: Record<string, SideBarPanelState>
) => ({
  type: "SET_SIDEBAR_PANELS_STATE",
  payload: { panelsState }
});

export const setSideBarPanelSizeAction: ActionCreator = (
  id: string,
  size: number,
  nextId: string,
  nextSize: number
) => ({
  type: "SET_SIDEBAR_PANEL_SIZE",
  payload: { id, size, nextId, nextSize }
});

export const setToolsAction: ActionCreator = (tools: ToolInfo[]) => ({
  type: "SET_TOOLS",
  payload: { tools }
});

export const activateToolAction: ActionCreator = (id: string) => ({
  type: "ACTIVATE_TOOL",
  payload: { id }
});

export const setMachineTypeAction: ActionCreator = (id: string) => ({
  type: "SET_MACHINE_TYPE",
  payload: { id }
});

export const setModelTypeAction: ActionCreator = (id: string) => ({
  type: "SET_MODEL_TYPE",
  payload: { id }
});

export const setMachineConfigAction: ActionCreator = (value: any) => ({
  type: "SET_MACHINE_CONFIG",
  payload: { value }
});

export const setMachineStateAction: ActionCreator = (
  state: MachineControllerState,
  numValue: number
) => ({
  type: "SET_MACHINE_STATE",
  payload: { state, numValue }
});

export const muteSoundAction: ActionCreator = (flag: boolean) => ({
  type: "MUTE_SOUND",
  payload: { flag }
});

export const setSoundLevelAction: ActionCreator = (numValue: number) => ({
  type: "SET_SOUND_LEVEL",
  payload: { numValue }
});

export const setClockMultiplierAction: ActionCreator = (numValue: number) => ({
  type: "SET_CLOCK_MULTIPLIER",
  payload: { numValue }
});

export const setAudioSampleRateAction: ActionCreator = (numValue: number) => ({
  type: "SET_AUDIO_SAMPLE_RATE",
  payload: { numValue }
});

export const setMediaAction: ActionCreator = (id: string, value: any) => ({
  type: "SET_MEDIA",
  payload: { id, value }
});

export const activateOutputPaneAction: ActionCreator = (id: string) => ({
  type: "ACTIVATE_OUTPUT_PANE",
  payload: { id }
});

export const setIdeStatusMessageAction: ActionCreator = (text: string, flag?: boolean) => ({
  type: "SET_IDE_STATUS_MESSAGE",
  payload: { text, flag }
});

export const incBreakpointsVersionAction: ActionCreator = () => ({
  type: "INC_BPS_VERSION"
});

export const incToolCommandSeqNoAction: ActionCreator = () => ({
  type: "INC_TOOL_CMD_SEQ"
});

export const openFolderAction: ActionCreator = (file: string, flag: boolean) => ({
  type: "OPEN_FOLDER",
  payload: { file, flag }
});

export const closeFolderAction: ActionCreator = () => ({
  type: "CLOSE_FOLDER"
});

export const displayDialogAction: ActionCreator = (index?: number, value?: any) => ({
  type: "DISPLAY_DIALOG",
  payload: { index, value }
});

export const setIdeFontSizeAction: ActionCreator = (numValue?: number) => ({
  type: "SET_IDE_FONT_SIZE",
  payload: { numValue }
});

export const setBuildRootAction: ActionCreator = (files: string[], flag: boolean) => ({
  type: "SET_BUILD_ROOT",
  payload: { files, flag }
});

export const incProjectFileVersionAction: ActionCreator = () => ({
  type: "INC_PROJECT_FILE_VERSION"
});

export const incProjectViewStateVersionAction: ActionCreator = () => ({
  type: "INC_PROJECT_VIEWSTATE_VERSION"
});

export const addExcludedProjectItemsAction: ActionCreator = (files: string[]) => ({
  type: "ADD_EXCLUDED_PROJECT_ITEMS",
  payload: { files }
});

export const setExcludedProjectItemsAction: ActionCreator = (files: string[]) => ({
  type: "SET_EXCLUDED_PROJECT_ITEMS",
  payload: { files }
});

export const refreshExcludedProjectItemsAction: ActionCreator = () => ({
  type: "REFRESH_EXCLUDED_PROJECT_ITEMS"
});

export const resetCompileAction: ActionCreator = () => ({
  type: "RESET_COMPILE"
});

export const startCompileAction: ActionCreator = (file: string) => ({
  type: "START_COMPILE",
  payload: { file }
});

export const endCompileAction: ActionCreator = (
  compileResult: KliveCompilerOutput,
  failed?: string
) => ({
  type: "END_COMPILE",
  payload: { compileResult, failed }
});

export const incInjectionVersionAction: ActionCreator = () => ({
  type: "INC_INJECTION_VERSION"
});

export const incDocHubServiceVersionAction: ActionCreator = (index) => ({
  type: "INC_DOC_HUB_SERVICE_VERSION",
  payload: { index }
});

export const setVolatileDocStateAction: ActionCreator = (id, flag) => ({
  type: "SET_VOLATILE_DOC_STATE",
  payload: { id, flag }
});

export const incEditorVersionAction: ActionCreator = () => ({
  type: "INC_EDITOR_VERSION"
});

export const setDebuggingAction: ActionCreator = (flag) => ({
  type: "SET_DEBUGGING",
  payload: { flag }
});

export const applyProjectSettingAction: ActionCreator = (id, value) => ({
  type: "APPLY_PROJECT_SETTING",
  payload: { id, value }
});

export const applyUserSettingAction: ActionCreator = (id, value) => ({
  type: "APPLY_USER_SETTING",
  payload: { id, value }
});

export const saveUserSettingAction: ActionCreator = (value) => ({
  type: "SAVE_USER_SETTINGS",
  payload: { value }
});

export const saveProjectSettingAction: ActionCreator = (value) => ({
  type: "SAVE_PROJECT_SETTINGS",
  payload: { value }
});

export const startScreenDisplayedAction: ActionCreator = () => ({
  type: "START_SCREEN_DISPLAYED"
});

export const setKeyMappingsAction: ActionCreator = (file, value) => ({
  type: "SET_KEY_MAPPINGS",
  payload: { file, value }
});

export const emuSetKeyboardLayoutAction: ActionCreator = (id: string) => ({
  type: "EMU_SET_KEYBOARD_LAYOUT",
  payload: { id }
});

export const incMenuVersionAction: ActionCreator = () => ({
  type: "START_SCREEN_DISPLAYED"
});

export const setMachineSpecificAction: ActionCreator = (value: any) => ({
  type: "SET_MACHINE_SPECIFIC",
  payload: { value }
});

export const incExploreViewVersionAction: ActionCreator = () => ({
  type: "INC_EXPLORER_VIEW_VERSION"
});

export const setScriptsStatusAction: ActionCreator = (value: any) => ({
  type: "SET_SCRIPTS_STATUS",
  payload: { value }
});

export const setProjectBuildFileAction: ActionCreator = (flag) => ({
  type: "SET_PROJECT_BUILD_FILE",
  payload: { flag }
});

export const incBuildFileVersionAction: ActionCreator = () => ({
  type: "INC_BUILD_FILE_VERSION"
});

export const setIdeDisableAutoOpenProjectAction: ActionCreator = (flag: boolean) => ({
  type: "SET_IDE_DISABLE_AUTO_OPEN_PROJECT",
  payload: { flag }
});

export const setIdeDisableAutoCompleteAction: ActionCreator = (flag: boolean) => ({
  type: "SET_IDE_DISABLE_AUTO_COMPLETE",
  payload: { flag }
});

export const setExportDialogInfoAction: ActionCreator = (value: ExportDialogSettings) => ({
  type: "SET_IDE_EXPORT_DIALOG",
  payload: { value }
});

export const setWorkspaceSettingsAction: ActionCreator = (id: string, value: any) => ({
  type: "SET_WORKSPACE_SETTINGS",
  payload: { id, value }
});

export const incEmuViewVersionAction: ActionCreator = () => ({
  type: "INC_EMU_VIEW_VERSION"
});

export const closeEmuWithIdeAction: ActionCreator = (flag: boolean) => ({
  type: "SET_IDE_CLOSE_EMU_WITH_IDE",
  payload: { flag }
});
