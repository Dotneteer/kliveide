import type { BreakpointInfo, BreakpointScope } from "@abstractions/BreakpointInfo";

/**
 * This interface represents the properties and methods that support debugging an emulated machine.
 */
export interface IDebugSupport {
  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

  readonly breakpointDefs: Map<string, BreakpointInfo>;

  /**
   * The list of current execution breakpoints
   */
  readonly breakpoints: BreakpointInfo[];

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   * @param partitionResolver A function to resolve the current partition
   */
  shouldStopAt(address: number, partitionResolver: (address: number) => number | undefined): boolean;

  /**
   * Gets memory read breakpoint information for the specified address/partition
   * @param reads Addresses read during the current instruction
   * @param length Number of bytes read
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryRead(reads: ArrayLike<number>, length: number, partitionResolver: (address: number) => number | undefined): boolean;

  /**
   * Gets memory write breakpoint information for the specified address/partition
   * @param writes Addresses written during the current instruction
   * @param length Number of bytes written
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryWrite(writes: ArrayLike<number>, length: number, partitionResolver: (address: number) => number | undefined): boolean;

  /**
   * Does any breakpoint in this set watch memory or I/O access?
   *
   * Execution breakpoints are tested against the program counter, which an emulated machine always
   * has to hand. Memory and I/O breakpoints are tested against the bus activity of the *last*
   * instruction, which a WASM-backed machine has to mirror out of its core one accessor at a time.
   * That mirroring is pure overhead when nothing watches for it, so the per-instruction debug loops
   * ask this first and skip the import when it answers false.
   */
  hasAccessBreakpoints(): boolean;

  /**
   * Gets IO read breakpoint information for the specified port
   * @param port Port read during the current instruction
   */
  hasIoRead(port: number): boolean;

  /**
   * Gets IO write breakpoint information for the specified port
   * @param port Port written during the current instruction
   */
  hasIoWrite(port: number): boolean;

  /**
   * The last breakpoint we stopped in the frame
   */
  lastBreakpoint?: number;

  /**
   * Breakpoint used for step-out debugging mode
   */
  imminentBreakpoint?: number;

  /**
   * Erases all breakpoints
   */
  eraseAllBreakpoints(): void;

  /**
   * Adds a breakpoint to the list of existing ones
   * @param breakpoint Breakpoint information
   * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
   */
  addBreakpoint(breakpoint: BreakpointInfo): boolean;

  /**
   * Removes a breakpoint
   * @param address Breakpoint address
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeBreakpoint(breakpoint: BreakpointInfo): boolean;

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   * @returns True, if the breakpoint exists, and it has been updated; otherwise, false
   */
  enableBreakpoint(breakpoint: BreakpointInfo, enabled: boolean): boolean;

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   * @param lowerBound Lower bound of area to remove breakpoints from
   * @param upperBound Upper bound of area to remove breakpoints from
   */
  scrollBreakpoints(def: BreakpointInfo, shift: number, lowerBound?: number,
    upperBound?: number): void;

  /**
   * Normalizes source code breakpoint. Removes the ones that overflow the
   * file and also deletes duplicates.
   * @param lineCount
   * @returns
   */
  normalizeBreakpoints(resource: string, lineCount: number): void;

  /**
   * Resets the resolution of breakpoints
   */
  resetBreakpointResolution(): void;

  /**
   * Resolves the specified resouce breakpoint to an address, and optionally to a partition.
   *
   * @param partition The memory partition the line's code lives in, for a line inside a `.bank`
   * segment. Absent for unbanked code, which stays partitionless.
   */
  resolveBreakpoint(resource: string, line: number, address: number, partition?: number): void;

  /**
   * Renames breakpoints when the source file is renamed
   */
  renameBreakpoints(oldResource: string, newResource: string): void;

  /**
   * While set, only session-owned breakpoints may stop the machine.
   *
   * Set for the window in which an injection flow's keystrokes are still in flight: a user
   * breakpoint pausing the machine there would expire every keystroke that has not landed yet and
   * leave the OS command line half-typed. See `.plans/NEX_DEBUGGING_PLAN.md` §9.5.
   */
  suppressUserBreakpoints: boolean;

  /**
   * Removes every one-shot breakpoint that has just fired at `address`, and returns how many.
   *
   * @param address The address the machine stopped at
   * @param partition The partition paged in at that address, so a one-shot bound to a bank that is
   * not currently paged there is left armed
   */
  consumeOneShotsAt(address: number, partition: number | undefined): number;

  /**
   * Replaces the breakpoints owned by `scope`, leaving every other owner's alone.
   * @param breakpoints Breakpoints to install for this scope
   * @param scope Which existing breakpoints this call may remove
   */
  resetBreakpointsTo(breakpoints: BreakpointInfo[], scope: BreakpointScope): void;
}
