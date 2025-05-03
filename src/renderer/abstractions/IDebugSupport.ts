import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

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
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryRead(reads: number[], partitionResolver: (address: number) => number | undefined): boolean;

  /**
   * Gets memory write breakpoint information for the specified address/partition
   * @param writes Addresses written during the current instruction
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryWrite(writes: number[], partitionResolver: (address: number) => number | undefined): boolean;

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
   * Resolves the specified resouce breakpoint to an address
   */
  resolveBreakpoint(resource: string, line: number, address: number): void;

  /**
   * Renames breakpoints when the source file is renamed
   */
  renameBreakpoints(oldResource: string, newResource: string): void;

  /**
   * Changes the list of existing breakpoints to the provided ones.
   * @param breakpoints Breakpoints to set
   */
  resetBreakpointsTo(breakpoints: BreakpointInfo[]): void;
}
