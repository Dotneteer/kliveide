import { KliveCompilerOutput } from "@abstr/CompilerInfo";
import { KeyMapping } from "@abstr/KeyMapping";
import { MachineControllerState } from "@abstr/MachineControllerState";
import { ScriptRunInfo } from "@abstr/ScriptRunInfo";
import { ToolInfo } from "@abstr/ToolInfo";

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
  os?: string;
  emuFocused?: boolean;
  ideFocused?: boolean;
  globalSettings?: Record<string, any>;
  projectSettings?: Record<string, any>;
  userSettings?: Record<string, any>;
  theme?: string;
  emulatorState?: EmulatorState;
  compilation?: CompilationState;
  project?: IdeProject;
  scripts?: ScriptRunInfo[];
  keyMappingFile?: string;
  keyMappings?: { mapping: KeyMapping; merge: boolean };
  ideView?: IdeView;
  media?: MediaState;
  startScreenDisplayed?: boolean;
};

export type EmulatorState = {
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  machineState?: MachineControllerState;
  pcValue?: number;
  isDebugging?: boolean;
  isProjectDebugging?: boolean;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  clockMultiplier?: number;
  audioSampleRate?: number;
  breakpointsVersion: number;
  emuViewVersion: number;
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
  backgroundInProgress?: boolean;
};

export type IdeProject = {
  folderPath?: string | null;
  isKliveProject?: boolean;
  workspaceLoaded?: boolean;
  buildRoots?: string[];
  projectFileVersion?: number;
  projectViewStateVersion?: number;
  excludedItems?: string[];
  hasBuildFile?: boolean;
  buildFileVersion?: number;
};

export type IdeView = {
  activity?: string;
  sideBarPanels?: Record<string, SideBarPanelState>;
  documentHubState?: Record<number, number>;
  editorVersion?: number;
  explorerViewVersion?: number;
  volatileDocs: Record<string, boolean>;
  tools?: ToolInfo[];
  statusMessage?: string;
  statusSuccess?: boolean;
  toolCommandSeqNo: number;
  dialogToDisplay?: number;
  dialogData?: any;
};

/**
 * The state of a particular site bar panel
 */
export type SideBarPanelState = {
  expanded: boolean;
  size: number;
};

/**
 * The current state of removable media
 */
export type MediaState = Record<string, any>;

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  appPath: "",
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  os: "",
  emuFocused: false,
  ideFocused: false,
  globalSettings: {},
  theme: "light"
};
