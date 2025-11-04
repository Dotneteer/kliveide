import { KliveCompilerOutput } from "../abstractions/CompilerInfo";
import { MachineControllerState } from "../abstractions/MachineControllerState";
import { ScriptRunInfo } from "../abstractions/ScriptRunInfo";

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
  emulatorState?: EmulatorState;
  compilation?: CompilationState;
  project?: IdeProject;
  scripts?: ScriptRunInfo[];
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
  globalSettings: {}
};
