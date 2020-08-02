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
   * Emulator command to execute
   */
  emulatorCommand: string;

  /**
   * Data about the running virtual machine
   */
  vmInfo?: VmInfo;
}

/**
 * Represents the state of the emulator panel
 */
export interface EmulatorPanelState {
  width?: number;
  height?: number;
  zoom?: number;
  executionState?: number;
  tapeContents?: Uint8Array;
  keyboardPanel?: boolean;
  shadowScreen?: boolean;
  beamPosition?: boolean;
  fastLoad?: boolean;
  startCount?: number;
  frameCount?: number;
}

/**
 * Represents the data about the running virtual machine
 */
export interface VmInfo {
  registers?: RegisterData
}

