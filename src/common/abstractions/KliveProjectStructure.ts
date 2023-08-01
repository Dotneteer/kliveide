import { BreakpointInfo } from "./BreakpointInfo";

export type KliveProjectStructure = {
  kliveVersion: string;
  machineType?: string;
  viewOptions?: ViewOptions;
  clockMultiplier?: number;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  tapeFile?: string;
  fastLoad?: boolean;
  machineSpecific?: Record<string, Record<string, any>>;
  ide?: Record<string, any>;
  debugger?: DebuggerState;
  builder?: BuilderState;
};

interface ViewOptions {
  theme?: string;
  showEmuToolbar?: boolean;
  showEmuStatusbar?: boolean;
  showIdeToolbar?: boolean;
  showIdeStatusbar?: boolean;
  showFrameInfo?: boolean;
  showKeyboard?: boolean;
  showSidebar?: boolean;
  keyboardHeight?: number;
  primaryBarOnRight?: boolean;
  showToolPanels?: boolean;
  toolPanelsOnTop?: boolean;
  maximizeTools?: boolean;
  editorFontSize?: number;
}

// --- Represents the state of the debugger
type DebuggerState = {
  breakpoints: BreakpointInfo[];
};

// --- Represents the state of the builder
type BuilderState = {
  roots: string[];
};