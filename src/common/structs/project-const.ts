import { BreakpointInfo } from "@abstractions/BreakpointInfo";

export const KLIVE_PROJET_ROOT = "KliveProjects";
export const CODE_FOLDER = "code";
export const PROJECT_FILE = "klive.project";
export const LAST_PROJECT_FOLDER = "lastProjectFolder";
export const TEMPLATES = "project-templates";

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

export interface ViewOptions {
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
export type DebuggerState = {
  breakpoints: BreakpointInfo[];
};

// --- Represents the state of the builder
export type BuilderState = {
  roots: string[];
};
