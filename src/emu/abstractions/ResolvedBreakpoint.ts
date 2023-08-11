/**
 * Represents a resolved source code breakpoint
 */
export type ResolvedBreakpoint = {
  /**
   * Source code file resource name
   */
  resource: string;

  /**
   * Line number of the source code file
   */
  line: number;

  /**
   * Breakpoint address
   */
  address: number;
};
