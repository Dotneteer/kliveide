/**
 * Represents a breakpoint
 */
export type BreakpointInfo = {
  /**
   * Breakpoint address
   */
  address: number;

  /**
   * Optional partition (reserved for future use)
   */
  partition?: number;

  /**
   * Indicates if a particular breakpoint is disabled
   */
  disabled?: boolean;

  /**
   * Optional mask for I/O addresses
   */
  mask?: number;

  /**
   * Indicates an execution breakpoint
   */
  exec?: boolean;

  /**
   * Indicates a memory read breakpoint
   */
  memoryRead?: boolean;

  /**
   * Indicates a memory write breakpoint
   */
  memoryWrite?: boolean;

  /**
   * Indicates an I/O read breakpoint
   */
  ioRead?: boolean;

  /**
   * Indicates an I/O write breakpoint
   */
  ioWrite?: boolean;
};
