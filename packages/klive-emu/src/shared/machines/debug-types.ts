/**
 * A single segment of the code compilation
 */
export interface BinarySegment {
  startAddress: number;
  bank?: number;
  bankOffset: number;
  emittedCode: number[];
}

/**
 * The code to inject into the virtual machine
 */
export interface CodeToInject {
  model: string;
  entryAddress?: number;
  subroutine?: boolean;
  segments: BinarySegment[];
  options: { [key: string]: boolean };
}

/**
 * Breakpoint types supported by Klive
 * - memory read
 * - memory write
 * - I/O read
 * * I/O write
 */
export type BreakpointType = "mr" | "mw" | "ir" | "iw";

/**
 * Represents a Klive breakpoint
 */
export interface BreakpointDefinition {
  /**
   * Optional breakpoint mode
   */
  mode?: BreakpointType;

  /**
   * Partition (bank, page, etc.) value
   */
  partition?: number;

  /**
   * Breakpoint address
   */
  address: number;

  /**
   * Optional hit counter
   */
  hit?: number;

  /**
   * Optional value condition
   */
  value?: number;
}
