import { BreakpointInfo } from "@abstractions/BreakpointInfo";

/**
 * This interface represents the properties and methods that support debugging an emulated machine.
 */
export interface IDebugSupport {
  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

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
   */
  scrollBreakpoints(def: BreakpointInfo, shift: number): void;

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
}
