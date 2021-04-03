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
      clockMultiplier: 1,
      machineContext: "",
      firmware: [],
    },
    spectrumSpecific: {
      fastLoad: true,
      showBeamPosition: false,
      tapeContents: undefined,
    },
  };
}
