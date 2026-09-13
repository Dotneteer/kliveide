/**
 * Who persists a breakpoint — and therefore who is allowed to replace it wholesale.
 *
 * The emulator's breakpoint set is a **union of sets owned by different persisters**, while every
 * persistence operation used to assume a single owner. That is what let opening a project destroy
 * breakpoints the project did not itself hold, and what would have let a project save silently adopt
 * breakpoints belonging to a `.nex` file.
 *
 * **Absent means the project** (`.kliveproject`), and that is the *only* representation of project
 * ownership — there is deliberately no `{ kind: "project" }` member here, so a breakpoint cannot be
 * project-owned in two distinguishable ways, and existing project files stay byte-identical on disk.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §4.3 and §9.4a of the companion ideas document.
 */
export type BreakpointOwner =
  | {
      /** Owned by a ZX Spectrum Next `.nex` file, persisted in its `.nex.dis` sidecar. */
      kind: "nex";
      /** Full path of the owning sidecar. Identity: two NEX files are different owners. */
      sidecar: string;
    }
  | {
      /**
       * Owned by nobody: never persisted, and dropped when the machine changes. Used for
       * run-to-cursor and the NEX entry-point stop.
       */
      kind: "session";
    };

/**
 * Which subset of the breakpoint set an operation is allowed to replace.
 *
 * Scopes are never stored, so unlike `BreakpointOwner` this *does* name the project explicitly.
 */
export type BreakpointScope =
  | {
      /** Everything, session-owned breakpoints included. Machine teardown only. */
      kind: "all";
    }
  | {
      /** Breakpoints with no owner. */
      kind: "project";
    }
  | {
      /** Breakpoints owned by one `.nex.dis` sidecar. */
      kind: "nex";
      sidecar: string;
    };

/**
 * Represents a breakpoint
 */
export type BreakpointInfo = {
  /**
   * Breakpoint address
   */
  address?: number;

  /**
   * The memory partition this breakpoint is scoped to, as an index into the machine's
   * `getPartitionLabels()` map. Negative indices are ROM and other special pages, zero and above
   * are RAM. When absent, the breakpoint fires whatever is paged in at its address.
   */
  partition?: number;

  /**
   * Who persists this breakpoint. **Absent means the project** — see `BreakpointOwner`.
   */
  owner?: BreakpointOwner;

  /**
   * The ZX Spectrum Next 16K bank this breakpoint is relative to, `0..111`.
   *
   * Deliberately separate from `partition`: a NEX bank is 16K by definition, while a partition index
   * is an **8K page**. The 8K page actually matched is derived as `bank * 2 + (bankOffset >> 13)`.
   * Conflating the two is the bug that made `bp-set 0A:$C000` and the Memory view's bank `0A` name
   * different memory; see `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
   */
  bank?: number;

  /**
   * Offset within that 16K bank, `$0000..$3FFF`.
   *
   * `bank` + `bankOffset` with `address` absent is what makes a breakpoint **bank-relative**: it
   * fires wherever that bank is paged in, rather than at one Z80 address. ZX Spectrum Next only.
   */
  bankOffset?: number;

  /**
   * Removed automatically the first time it fires, and never persisted.
   *
   * Used for run-to-cursor and the NEX entry-point stop. Always paired with
   * `owner: { kind: "session" }`.
   */
  oneShot?: boolean;

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

  /**
   * The optional mask for I/O breakpoints
   */
  ioMask?: number;

  /**
   * Memory breakpoint target hit counter
   */
  hitCount?: number;
};
