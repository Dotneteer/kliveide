import type { KeyMapping } from "@abstractions/KeyMapping";
import type { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { KliveCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { PANE_ID_EMU } from "../../common/integration/constants";
import { ExportDialogSettings, IdeSettings } from "@main/settings";

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
  globalSettings?: Record<string, any>;
  ideViewOptions?: IdeViewOptions;
  ideView?: IdeView;
  ideSettings?: IdeSettings;
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
  workspaceSettings?: Record<string, any>;
};

/**
 * Represents the state of the IDE view options
 */
export type IdeViewOptions = {
  editorFontSize?: number;
};

/**
 * Represents the state of the EMU view options
 */
export type EmuViewOptions = {
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
};

export type EmulatorState = {
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  machineState?: MachineControllerState;
  pcValue?: number;
  isDebugging?: boolean;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  clockMultiplier?: number;
  audioSampleRate?: number;
  breakpointsVersion: number;
  emuViewVersion: number;
};

export type FloppyDiskState = {
  diskFile?: string;
  writeProtected?: boolean;
};

export type IdeProject = {
  folderPath?: string | null;
  isKliveProject?: boolean;
  buildRoots?: string[];
  projectFileVersion?: number;
  projectViewStateVersion?: number;
  excludedItems?: string[];
  hasBuildFile?: boolean;
  buildFileVersion?: number;
  exportSettings?: ExportDialogSettings;
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
  globalSettings: {},
  ideViewOptions: {
    editorFontSize: 16,
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
  emuViewOptions: {},
  ideSettings: {},
  emulatorState: {
    config: {},
    machineSpecific: {},
    soundLevel: 0.8,
    soundMuted: false,
    savedSoundLevel: 0.8,
    clockMultiplier: 1,
    breakpointsVersion: 0,
    emuViewVersion: 0
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
  scripts: [],
  workspaceSettings: {}
};
