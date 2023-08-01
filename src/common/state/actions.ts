import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ActionCreator } from "./Action";
import { SideBarPanelState } from "./AppState";
import { KliveCompilerOutput } from "../../main/compiler-integration/compiler-registry";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";

export const setAppPathAction: ActionCreator = (file: string) => ({
  type: "SET_APP_PATH",
  payload: { file }
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

export const showEmuToolbarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_EMU_TOOLBAR",
  payload: { flag }
});

export const showEmuStatusBarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_EMU_STATUSBAR",
  payload: { flag }
});

export const showIdeToolbarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_IDE_TOOLBAR",
  payload: { flag }
});

export const showIdeStatusBarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_IDE_STATUSBAR",
  payload: { flag }
});

export const showSideBarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_SIDE_BAR",
  payload: { flag }
});

export const primaryBarOnRightAction: ActionCreator = (flag: boolean) => ({
  type: "PRIMARY_BAR_ON_RIGHT",
  payload: { flag }
});

export const showToolPanelsAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_TOOL_PANELS",
  payload: { flag }
});

export const toolPanelsOnTopAction: ActionCreator = (flag: boolean) => ({
  type: "TOOLS_ON_TOP",
  payload: { flag }
});

export const maximizeToolsAction: ActionCreator = (flag: boolean) => ({
  type: "MAXIMIZE_TOOLS",
  payload: { flag }
});

export const showKeyboardAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_KEYBOARD",
  payload: { flag }
});

export const showFrameInfoAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_FRAME_INFO",
  payload: { flag }
});

export const setSideBarPanelExpandedAction: ActionCreator = (
  id: string,
  flag: boolean
) => ({
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

export const createDocumentAction: ActionCreator = (
  document: DocumentInfo,
  index: number
) => ({
  type: "CREATE_DOC",
  payload: { document, index }
});

export const changeDocumentAction: ActionCreator = (
  document: DocumentInfo,
  index: number
) => ({
  type: "CHANGE_DOC",
  payload: { document, index }
});

export const incDocumentActivationVersionAction: ActionCreator = () => ({
  type: "INC_DOC_ACTIVATION_VERSION"
});

export const activateDocumentAction: ActionCreator = (id: string) => ({
  type: "ACTIVATE_DOC",
  payload: { id }
});

export const closeDocumentAction: ActionCreator = (id: string) => ({
  type: "CLOSE_DOC",
  payload: { id }
});

export const closeAllDocumentsAction: ActionCreator = () => ({
  type: "CLOSE_ALL_DOCS"
});

export const setToolsAction: ActionCreator = (tools: ToolInfo[]) => ({
  type: "SET_TOOLS",
  payload: { tools }
});

export const changeToolVisibilityAction: ActionCreator = (
  id: string,
  flag: boolean
) => ({
  type: "CHANGE_TOOL_VISIBILITY",
  payload: { id, flag }
});

export const changeToolStateAction: ActionCreator = (tool: ToolInfo) => ({
  type: "CHANGE_TOOL_STATE",
  payload: { tool }
});

export const activateToolAction: ActionCreator = (id: string) => ({
  type: "ACTIVATE_TOOL",
  payload: { id }
});

export const setMachineTypeAction: ActionCreator = (id: string) => ({
  type: "SET_MACHINE_TYPE",
  payload: { id }
});

export const setMachineStateAction: ActionCreator = (
  state: MachineControllerState
) => ({
  type: "SET_MACHINE_STATE",
  payload: { state }
});

export const muteSoundAction: ActionCreator = (flag: boolean) => ({
  type: "MUTE_SOUND",
  payload: { flag }
});

export const setSoundLevelAction: ActionCreator = (numValue: number) => ({
  type: "SET_SOUND_LEVEL",
  payload: { numValue }
});

export const setFastLoadAction: ActionCreator = (flag: boolean) => ({
  type: "SET_FAST_LOAD",
  payload: { flag }
});

export const setClockMultiplierAction: ActionCreator = (numValue: number) => ({
  type: "SET_CLOCK_MULTIPLIER",
  payload: { numValue }
});

export const setAudioSampleRateAction: ActionCreator = (numValue: number) => ({
  type: "SET_AUDIO_SAMPLE_RATE",
  payload: { numValue }
});

export const setTapeFileAction: ActionCreator = (file: string) => ({
  type: "SET_TAPE_FILE",
  payload: { file }
});

export const activateOutputPaneAction: ActionCreator = (id: string) => ({
  type: "ACTIVATE_OUTPUT_PANE",
  payload: { id }
});

export const setIdeStatusMessageAction: ActionCreator = (
  text: string,
  flag?: boolean
) => ({
  type: "SET_IDE_STATUS_MESSAGE",
  payload: { text, flag }
});

export const incBreakpointsVersionAction: ActionCreator = () => ({
  type: "INC_BPS_VERSION"
});

export const incToolCommandSeqNoAction: ActionCreator = () => ({
  type: "INC_TOOL_CMD_SEQ"
});

export const moveDocumentLeftAction: ActionCreator = () => ({
  type: "DOC_MOVE_LEFT"
});

export const moveDocumentRightAction: ActionCreator = () => ({
  type: "DOC_MOVE_RIGHT"
});

export const openFolderAction: ActionCreator = (
  file: string,
  flag: boolean
) => ({
  type: "OPEN_FOLDER",
  payload: { file, flag }
});

export const closeFolderAction: ActionCreator = () => ({
  type: "CLOSE_FOLDER"
});

export const displayDialogAction: ActionCreator = (index?: number) => ({
  type: "DISPLAY_DIALOG",
  payload: { index }
});

export const setIdeFontSizeAction: ActionCreator = (numValue?: number) => ({
  type: "SET_IDE_FONT_SIZE",
  payload: { numValue }
});

export const setBuildRootAction: ActionCreator = (
  file: string,
  flag: boolean
) => ({
  type: "SET_BUILD_ROOT",
  payload: { file, flag }
});

export const incProjectVersionAction: ActionCreator = () => ({
  type: "INC_PROJECT_VERSION"
});

export const resetCompileAction: ActionCreator = () => ({
  type: "RESET_COMPILE",
});

export const startCompileAction: ActionCreator = (file: string) => ({
  type: "START_COMPILE",
  payload: { file },
});

export const endCompileAction: ActionCreator = (
  compileResult: KliveCompilerOutput,
  failed?: string
) => ({
  type: "END_COMPILE",
  payload: { compileResult, failed },
});