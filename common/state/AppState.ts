import { MachineControllerState } from "@state/MachineControllerState";
import { DocumentState, ToolState } from "@/appIde/abstractions";

/**
 * Represents the state of the entire application
 */
export type AppState = {
  emuLoaded?: boolean;
  ideLoaded?: boolean;
  isWindows?: boolean;
  emuFocused?: boolean;
  ideFocused?: boolean;
  theme?: string;
  ideViewOptions?: IdeViewOptions;
  ideView?: IdeView;
  emuViewOptions?: EmuViewOptions;
  emulatorState?: EmulatorState;
};

/**
 * Represents the state of the IDE view options
 */
export type IdeViewOptions = {
  showToolbar?: boolean;
  showStatusBar?: boolean;
  primaryBarOnRight?: boolean;
  showToolPanels?: boolean;
  toolPanelsOnTop?: boolean;
  maximizeTools?: boolean;
  showFrameInfo?: boolean;
  showSidebar?: boolean;
};

/**
 * Represents the state of the EMU view options
 */
export type EmuViewOptions = {
  showKeyboard?: boolean;
  showToolbar?: boolean;
  showStatusBar?: boolean;
};

export type IdeView = {
  activity?: string;
  sideBarPanels?: Record<string, SideBarPanelState>;
  openDocuments?: DocumentState[];
  activeDocumentIndex?: number;
  tools?: ToolState[];
  activeTool?: string;
  activeOutputPane?: string;
  statusMessage?: string;
  statusSuccess?: boolean;
};

export type EmulatorState = {
  machineId?: string;
  machineState?: MachineControllerState;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  fastLoad?: boolean;
  clockMultiplier?: number;
  audioSampleRate?: number;
  tapeFile?: string;
}

/**
 * The state of a particular site bar panel
 */
export type SideBarPanelState = {
  expanded: boolean;
  size: number;
};

/**
 * The initial application state
 */
export const initialAppState: AppState = {
  emuLoaded: false,
  ideLoaded: false,
  isWindows: false,
  theme: "dark",
  emuFocused: false,
  ideFocused: false,
  ideViewOptions: {
    showToolbar: true,
    showStatusBar: true,
    primaryBarOnRight: false,
    showToolPanels: true,
    toolPanelsOnTop: false,
    maximizeTools: false,
    showFrameInfo: true,
    showSidebar: true
  },
  ideView: {
    sideBarPanels: {},
    openDocuments: [],
    activeDocumentIndex: -1,
    tools: [],
    activeTool: "command",
    activeOutputPane: "emu",
  },
  emuViewOptions: {
    showToolbar: true,
    showStatusBar: true,
    showKeyboard: false
  },
  emulatorState: {
    soundLevel: 0.8,
    soundMuted: false,
    savedSoundLevel: 0.8,
    fastLoad: true,
    clockMultiplier: 1,
  }
};
