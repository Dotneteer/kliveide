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

  /**
   * The memory partition the line's code lives in, in the machine's own partition numbering.
   *
   * Absent for unbanked code, which must stay partitionless — such a breakpoint fires whatever is
   * paged in, and that is what every non-banked project depends on.
   *
   * Present for a line inside a `.bank` segment. Without it, a source breakpoint in one `.bank`
   * section fired inside *another* one, because both are assembled at the same Z80 addresses — not
   * an edge case on the ZX Spectrum Next, where sharing addresses is the point of `.bank`.
   * `resolvedPartitionFor` computes it, and it is machine-dependent: an 8K page on the Next, a 16K
   * bank on the 128K and +3.
   */
  partition?: number;
};
