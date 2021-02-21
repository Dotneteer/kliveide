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
  keyboardHeight?: number;
}

/**
 * Represents the Klive settings to persist
 */
export interface KliveSettings {
  machineType?: string;
  viewOptions?: ViewOptions;
  machineSpecific?: Record<string, Record<string, any>>
}
