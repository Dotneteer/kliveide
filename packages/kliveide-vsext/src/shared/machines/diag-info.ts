/**
 * Defines the union type for diagnostics view frames
 */
export type DiagViewFrame =
  | Sp48DiagViewFrame
  | Sp128DiagViewFrame
  | Cz88DiagViewFrame;

/**
 * Defines the common structure of the diagnostics view frame
 */
export interface DiagViewFrameBase {
  startCount?: number;
  frameCount?: number;
  executionState?: number;
  pc?: number;
  runsInDebug?: boolean;
  machineType?: string;
}

/**
 * Diagnostics view for ZX Spectrum 48
 */
export interface Sp48DiagViewFrame extends DiagViewFrameBase {}

/**
 * Diagnostics view for ZX Spectrum 128
 */
export interface Sp128DiagViewFrame extends DiagViewFrameBase {
  selectedRom: number;
  selectedBank: number;
}

/**
 * Diagnostics view for Cambridge Z88
 */
export interface Cz88DiagViewFrame extends DiagViewFrameBase {}
