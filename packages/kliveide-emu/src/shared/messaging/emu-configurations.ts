/**
 * Represents the Klive configuration that is read during startup
 */
export interface KliveConfiguration {
  port?: number;
  machineType?: string;
  diagnostics?: KliveDiagnostics;
}

/**
 * Diagnostics settings
 */
export interface KliveDiagnostics {
  soundBufferUnderflow?: boolean;
  longFrameInfo?: boolean;
}
