/**
 * Represents the Klive configuration that is read during startup
 */
export interface KliveConfiguration {
  port?: number;
  machineType?: string;
  diagnostics?: KliveDiagnostics;
  viewOptions?: ViewOptions;
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
}