import { Activity } from "@core/abstractions/activity";
import { BreakpointDefinition } from "@abstractions/code-runner-service";
import {
  AppState,
  DirectoryContent,
  DocumentFrameState,
  FrameDiagData,
  RegisteredMachine,
  SideBarState,
} from "./AppState";
import { CompilerOutput } from "@abstractions/z80-compiler-service";

/**
 * Available action types
 */
export interface ActionTypes {
  EMU_UI_LOADED: null;
  IDE_UI_LOADED: null;
  EMU_FOCUS: null;
  IDE_FOCUS: null;
  DISPLAY_MODAL: null;

  SET_THEME: null;
  SET_WINDOWS: null;

  REGISTER_MACHINE: null;

  EMU_SHOW_TOOLBAR: null;
  EMU_SHOW_STATUSBAR: null;
  EMU_SHOW_KEYBOARD: null;
  EMU_SHOW_FRAME_INFO: null;

  EMU_SET_MACINE_TYPE: null;

  // --- Emulator panel actions
  EMU_SET_SIZE: null;
  EMU_SET_EXEC_STATE: null;
  EMU_SET_FRAME_ID: null;
  EMU_MUTE: null;
  EMU_SET_DEBUG: null;
  EMU_SET_MESSAGE: null;
  EMU_SET_SOUND_LEVEL: null;
  EMU_SET_BASE_FREQ: null;
  EMU_SET_CLOCK_MULTIPLIER: null;
  EMU_SET_KEYBOARD: null;
  EMU_MACHINE_CONTEXT: null;
  EMU_KEYBOARD_HEIGHT: null;
  EMU_SET_FIRMWARE: null;
  EMU_SET_EXTRA: null;
  EMU_SET_DIAG_DATA: null;

  // --- ZX Spectrum specific action
  SPECTRUM_FAST_LOAD: null;
  SPECTRUM_BEAM_POSITION: null;
  SPECTRUM_TAPE_CONTENTS: null;
  SPECTRUM_TAPE_LOADED: null;
  SPECTRUM_LOAD_MODE: null;

  // --- IDE window actions
  IDE_SHOW: null;
  IDE_SYNC: null;

  // --- Activities
  SET_ACTIVITIES: null;
  CHANGE_ACTIVITY: null;
  POINT_ACTIVITY: null;

  // --- Side bar
  SET_SIDEBAR_STATE: null;

  // --- Document frame
  SET_DOCUMENT_FRAME_STATE: null;

  // --- Output frame
  TOOL_FRAME_SHOW: null;
  TOOL_FRAME_MAXIMIZE: null;
  SET_TOOL_FRAME_STATE: null;

  // --- Project actions
  PROJECT_LOADING: null;
  PROJECT_OPENED: null;
  PROJECT_CLOSED: null;

  // --- Compilation
  RESET_COMPILE: null;
  START_COMPILE: null;
  END_COMPILE: null;

  // --- Breakpoints
  CLEAR_BREAKPOINTS: null;
  ADD_BREAKPOINT: null;
  REMOVE_BREAKPOINT: null;
  UNREACHABLE_BREAKPOINT: null;
  REACHABLE_BREAKPOINT: null;
  ALL_REACHABLE_BREAKPOINTS: null;
  SCROLL_BREAKPOINTS: null;
  NORMALIZE_BREAKPOINTS: null;

  // --- Builders
  CLEAR_BUILD_ROOTS: null;
  ADD_BUILD_ROOT: null;
  REMOVE_BUILD_ROOT: null;
}

/**
 * Represents payload properties
 */
export interface Payload {
  theme?: string;
  machineType?: string;
  width?: number;
  height?: number;
  executionState?: number;
  startCount?: number;
  frameCount?: number;
  runsInDebug?: boolean;
  panelMessage?: string;
  soundLevel?: number;
  clockMultiplier?: number;
  keyboardLayout?: string;
  machineContext?: string;
  keyboardHeight?: number;
  fastLoad?: boolean;
  showBeamPosition?: boolean;
  tapeContents?: Uint8Array;
  firmware?: Uint8Array[];
  tapeLoaded?: boolean;
  loadMode?: boolean;
  extraFeatures?: string[];
  baseClockFrequency?: number;
  frameDiagData?: FrameDiagData;
  appState?: AppState;
  activities?: Activity[];
  itemIndex?: number;
  sideBar?: SideBarState;
  documentFrame?: DocumentFrameState;
  hasFocus?: boolean;
  visible?: boolean;
  maximized?: boolean;
  toolState?: Record<string, Record<string, any>>;
  isWindows?: boolean;
  path?: string;
  projectName?: string;
  hasVm?: boolean;
  isLoading?: boolean;
  directoryContents?: DirectoryContent;
  machine?: RegisteredMachine;
  modalDisplayed?: boolean;
  flag?: boolean;
  filename?: string;
  compileResult?: CompilerOutput;
  breakpoint?: BreakpointDefinition;
  lineCount?: number;
  shift?: number;
  resource?: string;
}

/**
 * This interface represents an action that can be used within this project.
 */
export interface KliveAction {
  type: keyof ActionTypes;
  payload?: Payload;
}

/**
 * The signature of an action creator function.
 */
export type ActionCreator = (...args: any) => KliveAction;
