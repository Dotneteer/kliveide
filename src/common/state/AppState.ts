import type { KeyMapping } from "@abstractions/KeyMapping";
import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { KliveCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { PANE_ID_EMU } from "../../common/integration/constants";

/**
 * Represents the state of the entire application
 */
export type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  emuStateSynched?: boolean;
  ideLoaded?: boolean;
  ideStateSynched?: boolean;
  startScreenDisplayed?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  dimMenu?: boolean;
  theme?: string;
  ideViewOptions?: IdeViewOptions;
  ideView?: IdeView;
  emuViewOptions?: EmuViewOptions;
  emulatorState?: EmulatorState;
  media?: MediaState;
  project?: IdeProject;
  compilation?: CompilationState;
  projectSettings?: Record<string, any>;
  keyMappingFile?: string;
  keyMappings?: { mapping: KeyMapping; merge: boolean };
  userSettings?: Record<string, any>;
  menuVersion?: number;
  scripts?: ScriptRunInfo[];
};

/**
 * Represents the state of the IDE view options
 */
export type IdeViewOptions = {
  showToolbar?: boolean;
  showStatusBar?: boolean;
  primaryBarOnRight?: boolean;
  showToolPanels?: boolean;
  toolPanelsOnTop?: boolean;
  maximizeTools?: boolean;
  showFrameInfo?: boolean;
  showSidebar?: boolean;
  editorFontSize?: number;
  syncSourceBreakpoints?: boolean;
};

/**
 * Represents the state of the EMU view options
 */
export type EmuViewOptions = {
  showKeyboard?: boolean;
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showShadowScreen?: boolean;
  keyboardLayout?: string;
};

export type IdeView = {
  activity?: string;
  sideBarPanels?: Record<string, SideBarPanelState>;
  documentHubState?: Record<number, number>;
  editorVersion?: number;
  explorerViewVersion?: number;
  volatileDocs: Record<string, boolean>;
  tools?: ToolInfo[];
  activeTool?: string;
  activeOutputPane?: string;
  statusMessage?: string;
  statusSuccess?: boolean;
  toolCommandSeqNo: number;
  dialogToDisplay?: number;
  dialogData?: any;
  restartTarget?: string;
};

export type EmulatorState = {
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  machineState?: MachineControllerState;
  isDebugging?: boolean;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  fastLoad?: boolean;
  clockMultiplier?: number;
  audioSampleRate?: number;
  breakpointsVersion: number;
};

export type FloppyDiskState = {
  diskFile?: string;
  writeProtected?: boolean;
};

export type IdeProject = {
  folderPath?: string | null;
  isKliveProject?: boolean;
  buildRoots?: string[];
  projectFileVersion: number;
  projectViewStateVersion: number;
  excludedItems?: string[];
  hasBuildFile?:boolean;
  buildFileVersion: number;
};

/**
 * The state of a particular site bar panel
 */
export type SideBarPanelState = {
  expanded: boolean;
  size: number;
};

/**
 * The current state of compilation
 */
export type CompilationState = {
  inProgress?: boolean;
  filename?: string;
  result?: KliveCompilerOutput;
  failed?: string;
  injectionVersion?: number;
};

/**
 * The current state of removable media
 */
export type MediaState = Record<string, any>;

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  theme: "dark",
  emuFocused: false,
  ideFocused: false,
  menuVersion: 0,
  ideViewOptions: {
    showToolbar: true,
    showStatusBar: true,
    primaryBarOnRight: false,
    showToolPanels: true,
    toolPanelsOnTop: false,
    maximizeTools: false,
    showFrameInfo: true,
    showSidebar: true,
    editorFontSize: 16,
    syncSourceBreakpoints: true
  },
  ideView: {
    sideBarPanels: {},
    documentHubState: {},
    editorVersion: 1,
    explorerViewVersion: 1,
    volatileDocs: {},
    tools: [],
    activeTool: "command",
    activeOutputPane: PANE_ID_EMU,
    toolCommandSeqNo: 0
  },
  emuViewOptions: {
    showToolbar: true,
    showStatusBar: true,
    showKeyboard: false
  },
  emulatorState: {
    config: {},
    machineSpecific: {},
    soundLevel: 0.8,
    soundMuted: false,
    savedSoundLevel: 0.8,
    fastLoad: true,
    clockMultiplier: 1,
    breakpointsVersion: 0
  },
  media: {},
  project: {
    projectFileVersion: 1,
    projectViewStateVersion: 1,
    buildFileVersion: 1
  },
  compilation: {
    inProgress: false,
    injectionVersion: 0
  },
  scripts: []
};
