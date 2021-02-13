import { CodeToInject, RegisterData } from "../machines/api-data";

/**
 * Represents the state of the application
 */
export interface AppState {
  /**
   * Signs if the application has the focus
   */
  appHasFocus?: boolean;

  /**
   * Emulator panel state
   */
  emulatorPanelState?: EmulatorPanelState;

  /**
   * Data about the running virtual machine
   */
  vmInfo?: VmInfo;

  /**
   * The current IDE configuration
   */
  ideConfiguration?: IdeConfiguration;

  /**
   * The current state of IDE connection
   */
  ideConnection?: IdeConnection;

  /**
   * Machine specific command to execute
   */
  machineCommand?: string;
}

/**
 * Represents the state of the emulator panel
 */
export interface EmulatorPanelState {
  width?: number;
  height?: number;
  engineInitialized?: boolean;
  clockMultiplier?: number;
  executionState?: number;
  runsInDebug?: boolean;
  tapeContents?: Uint8Array;
  tapeLoaded?: boolean;
  keyboardPanel?: boolean;
  keyboardLayout?: string;
  keyboardHeight?: number;
  beamPosition?: boolean;
  fastLoad?: boolean;
  isLoading?: boolean;
  startCount?: number;
  frameCount?: number;
  muted?: boolean;
  soundLevel?: number;
  savedData?: Uint8Array;
  requestedType?: string;
  requestedOptions?: Record<string, any>;
  currentType?: string;
  selectedRom?: number;
  selectedBank?: number;
  panelMessage?: string;
  statusbar?: boolean;
  internalState?: Record<string, any>;
  showFrames?: boolean;
  showToolbar?: boolean;
  machineContext?: string;
}

/**
 * Represents the data about the running virtual machine
 */
export interface VmInfo {
  registers?: RegisterData;
}

/**
 * Represents the configuration data sent by the IDE
 */
export interface IdeConfiguration {
  /**
   * The absolute path of the current project folder
   */
  projectFolder: string;

  /**
   * The current SAVE folder
   */
  saveFolder: string;
}

/**
 * Represents the state of IDE connection
 */
export interface IdeConnection {
  /**
   * Indicates if the IDE is connected
   */
  connected: boolean;

  /**
   * The last time when the IDE sent a heartbeat
   */
  lastHeartBeat: number;
}

/**
 * Represents a code injection command
 */
export interface InjectProgramCommand {
  /**
   * The code to inject into the memory
   */
  codeToInject?: CodeToInject;

  /**
   * Execution error code
   */
  errorCode?: string;
}

/**
 * Represents a code injection command
 */
export interface RunProgramCommand {
  /**
   * The code to inject into the memory
   */
  codeToInject?: CodeToInject;

  /**
   * Use debug mode?
   */
  debug?: boolean;

  /**
   * Execution error code
   */
  errorCode?: string;
}

/**
 * Gets the default application state
 */
export function getDefaultAppState(): AppState {
  return {
    appHasFocus: true,
    emulatorPanelState: {
      engineInitialized: false,
      keyboardLayout: "",
      keyboardPanel: false,
      keyboardHeight: 0,
      beamPosition: false,
      fastLoad: false,
      isLoading: false,
      executionState: 0,
      runsInDebug: false,
      requestedType: "",
      requestedOptions: {},
      currentType: "",
      selectedRom: 0,
      selectedBank: 0,
      panelMessage: "",
      muted: false,
      soundLevel: 0.5,
      statusbar: false,
      internalState: {},
      clockMultiplier: 1,
      showFrames: false,
      showToolbar: false,
      machineContext: "",
    },
    ideConfiguration: {
      projectFolder: "",
      saveFolder: "",
    },
  };
}
