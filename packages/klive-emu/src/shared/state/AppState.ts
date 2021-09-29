import { Activity } from "@abstractions/activity-service";

/**
 * Represents the application's entire state vector
 */
export type AppState = {
  machines: RegisteredMachine[];
  isWindows: boolean;
  emuUiLoaded: boolean;
  ideUiLoaded: boolean;
  emuHasFocus: boolean;
  ideHasFocus: boolean;
  modalDisplayed: boolean;
  theme: string;
  emuViewOptions: EmuViewOptions;
  machineType?: string;
  emulatorPanel?: EmulatorPanelState;
  spectrumSpecific?: ZxSpectrumSpecificState;
  showIde?: boolean;
  activityBar?: ActivityBarState;
  sideBar?: SideBarState;
  documentFrame?: DocumentFrameState;
  toolFrame?: ToolFrameState;
  project?: ProjectState;
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
export type ToolFrameState = {
  visible?: boolean;
  maximized?: boolean;
  state: Record<string, Record<string, any>>;
};

export type ProjectState = {
  isLoading?: boolean;
  path?: string;
  projectName?: string;
  hasVm?: boolean;
  directoryContents?: DirectoryContent;
}

/**
 * Describes the contents of a directory
 */
 export type DirectoryContent = {
  name: string;
  folders: DirectoryContent[];
  files: string[];
};

// --- Represents a machine in the registry
export type RegisteredMachine = {
  id: string;
  label: string;
}

/**
 * The initial application state
 */
export function getInitialAppState(): AppState {
  return {
    machines: [],
    isWindows: false,
    emuUiLoaded: false,
    ideUiLoaded: false,
    emuHasFocus: false,
    ideHasFocus: false,
    modalDisplayed: false,
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
    toolFrame: {
      visible: true,
      maximized : false,
      state: {}
    },
    project: {
      isLoading: false,
      path: null,
      projectName: null,
      hasVm: false,
    }
  };
}
