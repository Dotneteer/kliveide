import { MachineControllerState } from "@abstractions/MachineControllerState";
import { DocumentInfo } from "@abstractions/DocumentInfo";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { KliveCompilerOutput } from "@main/compiler-integration/compiler-registry";

/**
 * Represents the state of the entire application
 */
export type AppState = {
  appPath?: string;
  emuLoaded?: boolean;
  emuStateSynched?: boolean;
  ideLoaded?: boolean;
  ideStateSynched?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  dimMenu?: boolean;
  theme?: string;
  ideViewOptions?: IdeViewOptions;
  ideView?: IdeView;
  emuViewOptions?: EmuViewOptions;
  emulatorState?: EmulatorState;
  project?: IdeProject;
  compilation?: CompilationState;
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
};

export type IdeView = {
  activity?: string;
  sideBarPanels?: Record<string, SideBarPanelState>;
  documentHubState?: Record<number, number>;
  editorVersion?: number;
  volatileDocs: Record<string, boolean>;
  tools?: ToolInfo[];
  activeTool?: string;
  activeOutputPane?: string;
  statusMessage?: string;
  statusSuccess?: boolean;
  toolCommandSeqNo: number;
  dialogToDisplay?: number;
  restartTarget?: string;
};

export type EmulatorState = {
  machineId?: string;
  machineState?: MachineControllerState;
  isDebugging?: boolean;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  fastLoad?: boolean;
  clockMultiplier?: number;
  audioSampleRate?: number;
  tapeFile?: string;
  breakpointsVersion: number;
  floppyDisks?: FloppyDiskState[];
};

export type FloppyDiskState = {
  diskFile?: string;
  writeProtected?: boolean;
};

export type IdeProject = {
  folderPath?: string;
  isKliveProject?: boolean;
  buildRoots?: string[];
  projectFileVersion: number;
  projectViewStateVersion: number;
  excludedItems?: string[];
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
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  theme: "dark",
  emuFocused: false,
  ideFocused: false,
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
    volatileDocs: {},
    tools: [],
    activeTool: "command",
    activeOutputPane: "emu",
    toolCommandSeqNo: 0
  },
  emuViewOptions: {
    showToolbar: true,
    showStatusBar: true,
    showKeyboard: false,
  },
  emulatorState: {
    soundLevel: 0.8,
    soundMuted: false,
    savedSoundLevel: 0.8,
    fastLoad: true,
    clockMultiplier: 1,
    breakpointsVersion: 0,
    floppyDisks: []
  },
  project: {
    projectFileVersion: 1,
    projectViewStateVersion: 1
  },
  compilation: {
    inProgress: false,
    injectionVersion: 0
  }
};
