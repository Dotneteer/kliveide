import { Activity } from "../activity/Activity";

/**
 * Represents the application's entire state vector
 */
export interface AppState {
  emuUiLoaded: boolean;
  ideUiLoaded: boolean;
  theme: string;
  emuViewOptions: EmuViewOptions;
  machineType?: string;
  emulatorPanel?: EmulatorPanelState;
  spectrumSpecific?: ZxSpectrumSpecificState;
  showIde?: boolean;
  activityBar?: ActivityBarState;
  sideBar?: SideBarState;
}

/**
 * Represents the options of the Emulators's View menu
 */
export interface EmuViewOptions {
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showFrameInfo?: boolean;
  showKeyboard?: boolean;
}

/**
 * Represents the state of the emulator panel
 */
export interface EmulatorPanelState {
  width?: number;
  height?: number;
  baseClockFrequency?: number;
  clockMultiplier?: number;
  executionState?: number;
  runsInDebug?: boolean;
  keyboardLayout?: string;
  keyboardHeight?: number;
  startCount?: number;
  frameCount?: number;
  muted?: boolean;
  soundLevel?: number;
  panelMessage?: string;
  machineContext?: string;
  firmware?: Uint8Array[];
  extraFeatures?: string[];
  frameDiagData?: FrameDiagData;
}

/**
 * Represents disgnostics data for machine frames
 */
export interface FrameDiagData {
  lastEngineTime: number;
  avgEngineTime: number;
  lastFrameTime: number;
  avgFrameTime: number;
  renderedFrames: number;
  pcInfo: ProgramCounterInfo;
}

/**
 * Represents the Program Counter information of a virtual machine's CPU
 */
export interface ProgramCounterInfo {
  /**
   * Label of the Program Counter
   */
  label: string;

  /**
   * Program Counter value
   */
  value: number;
}

/**
 * ZX Spectrum specific state information
 */
export interface ZxSpectrumSpecificState {
  fastLoad?: boolean;
  showBeamPosition?: boolean;
  tapeContents?: Uint8Array;
  tapeLoaded?: boolean;
  loadMode?: boolean;
}

/**
 * Represents the state of the activity bar
 */
export interface ActivityBarState {
  /**
   * The list of activities to display
   */
  activities?: Activity[];

  /**
   * The index of the active activity
   */
  activeIndex?: number;

  /**
   * The index of activity the mouse points to
   */
  pointedIndex?: number;
}

/**
 * Represents the state of the side bar
 */
export type SideBarState = Record<string, Record<string, Record<string, any>>>;

/**
 * The initial application state
 */
export function getInitialAppState(): AppState {
  return {
    emuUiLoaded: false,
    ideUiLoaded: false,
    theme: "dark",
    emuViewOptions: {
      showToolbar: true,
      showStatusBar: true,
      showFrameInfo: true,
      showKeyboard: false,
    },
    machineType: undefined,
    emulatorPanel: {
      keyboardLayout: "",
      keyboardHeight: 0,
      executionState: 0,
      runsInDebug: false,
      panelMessage: "",
      muted: false,
      soundLevel: 0.5,
      baseClockFrequency: 0,
      clockMultiplier: 1,
      machineContext: "",
      firmware: [],
      extraFeatures: [],
      frameDiagData: {
        lastFrameTime: 0,
        lastEngineTime: 0,
        avgEngineTime: 0,
        avgFrameTime: 0,
        renderedFrames: 0,
        pcInfo: {
          label: "",
          value: 0,
        },
      },
    },
    spectrumSpecific: {
      fastLoad: true,
      showBeamPosition: false,
      tapeContents: undefined,
    },
    sideBar: {}
  };
}
