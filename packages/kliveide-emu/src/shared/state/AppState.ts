import { RegisterData } from "../spectrum/api-data";

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
   * Emulator command to execute
   */
  emulatorCommand?: string;

  /**
   * Breakpoints
   */
  breakpoints?: number[];

  /**
   * The current IDE configuration
   */
  ideConfiguration?: IdeConfiguration;

  /**
   * The current state of IDE connection
   */
  ideConnection?: IdeConnection;

  /**
   * Memory command to execute
   */
  memoryCommand?: MemoryCommand;
}

/**
 * Represents the state of the emulator panel
 */
export interface EmulatorPanelState {
  width?: number;
  height?: number;
  engineInitialized?: boolean;
  executionState?: number;
  runsInDebug?: boolean;
  tapeContents?: Uint8Array;
  tapeLoaded?: boolean;
  keyboardPanel?: boolean;
  shadowScreen?: boolean;
  beamPosition?: boolean;
  fastLoad?: boolean;
  startCount?: number;
  frameCount?: number;
  muted?: boolean;
  memoryContents?: Uint8Array;
  memWriteMap?: Uint8Array;
  savedData?: Uint8Array;
  requestedType?: string;
  currentType?: string;
  selectedRom?: number;
  selectedBank?: number;
}

/**
 * Represents the data about the running virtual machine
 */
export interface VmInfo {
  registers?: RegisterData
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
 * Represents a memory command to execute
 */
export interface MemoryCommand {
  /**
   * Command sequence number
   */
  seqNo: number;

  /**
   * Command type
   */
  command: MemoryCommandType;

  /**
   * Command index
   */
  index?: number;

  /**
   * The result of the memory command;
   */
  memoryCommandResult?: Uint8Array;
}

/**
 * Available memory command types
 */
export type MemoryCommandType = "" | "rom" | "bank";
