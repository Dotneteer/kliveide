import { Activity } from "@core/abstractions/activity";
import { BreakpointDefinition } from "@abstractions/code-runner-service";
import { KliveCompilerOutput } from "@abstractions/compiler-registry";

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
  compilation?: CompilationState;
  debugger?: DebuggerState;
  builder?: BuilderState;
  editor?: EditorState;
  ideConfig?: Record<string, any>;
};

/**
 * Represents the options of the Emulators's View menu
 */
export type EmuViewOptions = {
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showFrameInfo?: boolean;
  showKeyboard?: boolean;
  showSidebar?: boolean;
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
  programCounter?: number;
  supportsCodeInjection?: boolean;
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
  tapeContents?: Uint8Array;
  tapeLoaded?: boolean;
  loadMode?: boolean;
  diskAEnabled?: boolean;
  diskBEnabled?: boolean;
  diskAInserted?: boolean;
  diskBInserted?: boolean;
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
};

/**
 * Describes the contents of a directory
 */
export type DirectoryContent = {
  name: string;
  folders: DirectoryContent[];
  files: string[];
};

export type CompilationState = {
  inProgress?: boolean;
  filename?: string;
  result?: KliveCompilerOutput;
  failed?: string;
};

// --- Represents a machine in the registry
export type RegisteredMachine = {
  id: string;
  label: string;
};

// --- Represents the state of the debugger
export type DebuggerState = {
  breakpoints: BreakpointDefinition[];
  resolved?: BreakpointDefinition[];
};

// --- Represents the state of the builder
export type BuilderState = {
  roots: string[];
};

// --- Represents the state of the active code editor
export type EditorState = {
  displayed: boolean;
  line: number;
  column: number;
};

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
      showSidebar: true,
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
      programCounter: null,
    },
    spectrumSpecific: {
      fastLoad: true,
      tapeContents: undefined,
      diskAEnabled: true,
      diskAInserted: true,
      diskBEnabled: true,
      diskBInserted: false,
    },
    sideBar: {},
    documentFrame: {},
    toolFrame: {
      visible: true,
      maximized: false,
      state: {},
    },
    project: {
      isLoading: false,
      path: null,
      projectName: null,
      hasVm: false,
    },
    compilation: {
      inProgress: false,
      filename: null,
      result: null,
    },
    debugger: {
      breakpoints: [],
    },
    builder: {
      roots: [],
    },
    editor: {
      displayed: false,
      line: -1,
      column: -1,
    },
    ideConfig: {}
  };
}
