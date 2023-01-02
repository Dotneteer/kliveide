import { DocumentState, ToolState } from "../../src/ide/abstractions";
import { MachineControllerState } from "../state/MachineControllerState";
import { ActionCreator } from "./Action";
import { SideBarPanelState } from "./AppState";

export const emuLoadedAction: ActionCreator = () => ({
  type: "EMU_LOADED"
});

export const ideLoadedAction: ActionCreator = () => ({
  type: "IDE_LOADED"
});

export const isWindowsAction: ActionCreator = (flag: boolean) => ({
  type: "IS_WINDOWS",
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

export const showToolbarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_TOOLBAR",
  payload: { flag }
});

export const showStatusBarAction: ActionCreator = (flag: boolean) => ({
  type: "SHOW_STATUSBAR",
  payload: { flag }
});

export const useEmuViewAction: ActionCreator = (flag: boolean) => ({
  type: "USE_EMU_VIEW",
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
  document: DocumentState,
  index: number
) => ({
  type: "CREATE_DOC",
  payload: { document, index }
});

export const changeDocumentAction: ActionCreator = (
  document: DocumentState,
  index: number
) => ({
  type: "CHANGE_DOC",
  payload: { document, index }
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

export const setToolsAction: ActionCreator = (tools: ToolState[]) => ({
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

export const changeToolStateAction: ActionCreator = (tool: ToolState) => ({
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
