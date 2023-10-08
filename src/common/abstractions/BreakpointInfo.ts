/**
 * Represents a breakpoint
 */
export type BreakpointInfo = {
  /**
   * Breakpoint address
   */
  address?: number;

  /**
   * Optional partition (reserved for future use)
   */
  partition?: number;

  /**
   * Indicates if a particular breakpoint is disabled
   */
  disabled?: boolean;

  /**
   * File that holds a source code breakpoint
   */
  resource?: string;

  /**
   * Line number within a file
   */
  line?: number;

  /**
   * Indicates that a source-bound breakpoint has been resolved
   */
  resolvedAddress?: number;

  /**
   * Indicates that a source-bound breakpoint is at this partition
   */
  resolvedPartition?: number;

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

export type BreakpointAddressInfo = {
  address?: number;
  partition?: number;
  resource?: string;
  line?: number;
};

