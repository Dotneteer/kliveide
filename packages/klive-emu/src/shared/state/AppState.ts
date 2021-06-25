import { Activity } from "../activity/Activity";

/**
 * Represents the application's entire state vector
 */
export type AppState = {
  emuUiLoaded: boolean;
  ideUiLoaded: boolean;
  emuHasFocus: boolean;
  ideHasFocus: boolean;
  theme: string;
  emuViewOptions: EmuViewOptions;
  machineType?: string;
  emulatorPanel?: EmulatorPanelState;
  spectrumSpecific?: ZxSpectrumSpecificState;
  showIde?: boolean;
  activityBar?: ActivityBarState;
  sideBar?: SideBarState;
  documentFrame?: DocumentFrameState;
  outputFrame?: OutputFrameState;
};

/**
 * Represents the options of the Emulators's View menu
 */
export type EmuViewOptions = {
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showFrameInfo?: boolean;
  showKeyboard?: boolean;
};

/**
 * Represents the state of the emulator panel
 */
export type EmulatorPanelState = {
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
};

/**
 * Represents disgnostics data for machine frames
 */
export type FrameDiagData = {
  lastEngineTime: number;
  avgEngineTime: number;
  lastFrameTime: number;
  avgFrameTime: number;
  renderedFrames: number;
  pcInfo: ProgramCounterInfo;
};

/**
 * Represents the Program Counter information of a virtual machine's CPU
 */
export type ProgramCounterInfo = {
  /**
   * Label of the Program Counter
   */
  label: string;

  /**
   * Program Counter value
   */
  value: number;
};

/**
 * ZX Spectrum specific state information
 */
export type ZxSpectrumSpecificState = {
  fastLoad?: boolean;
  showBeamPosition?: boolean;
  tapeContents?: Uint8Array;
  tapeLoaded?: boolean;
  loadMode?: boolean;
};

/**
 * Represents the state of the activity bar
 */
export type ActivityBarState = {
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
};

/**
 * Represents the state of the side bar
 */
export type SideBarState = Record<string, Record<string, Record<string, any>>>;

/**
 * Represents the state of the document frame
 */
export type DocumentFrameState = Record<string, Record<string, any>>;

/**
 * Represents the state of the output frame
 */
export type OutputFrameState = {
  visible?: boolean;
  maximized?: boolean;
};

/**
 * The initial application state
 */
export function getInitialAppState(): AppState {
  return {
    emuUiLoaded: false,
    ideUiLoaded: false,
    emuHasFocus: false,
    ideHasFocus: false,
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
    sideBar: {},
    documentFrame: {},
    outputFrame: {
      visible: true,
      maximized : false,
    }
  };
}
