import { BuilderState, DebuggerState } from "@core/state/AppState";

export interface KliveConfiguration {
    port?: number;
    machineType?: string;
    diagnostics?: KliveDiagnostics;
    showDevTools?: boolean;
  }
  
  /**
   * Diagnostics settings
   */
  export interface KliveDiagnostics {
    soundBufferUnderflow?: boolean;
    longFrameInfo?: boolean;
  }
  
  /**
   * View menu options
   */
  export interface ViewOptions {
    showDevTools?: boolean;
    showToolbar?: boolean;
    showStatusbar?: boolean;
    showFrameInfo?: boolean;
    showKeyboard?: boolean;
    showSidebar?: boolean;
    keyboardHeight?: number;
  }
  
  /**
   * Represents the Klive settings to persist
   */
  export interface KliveSettings {
    machineType?: string;
    viewOptions?: ViewOptions;
    machineSpecific?: Record<string, Record<string, any>>;
    ide?: Record<string, any>;
  };
  
  /**
   * Represents the Klive project type
   */
  export interface KliveProject extends KliveSettings {
    debugger?: DebuggerState;
    builder?: BuilderState;
  }
  
  