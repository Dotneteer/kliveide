import { BreakpointAddressInfo, BreakpointInfo } from "@abstractions/BreakpointInfo";

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
  readonly execBreakpoints: BreakpointInfo[];

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   * @param partition Breakpoint partition
   */
  getExecBreakpoint(
    address: number,
    partition?: number
  ): BreakpointInfo | undefined;

  /**
   * The list of current memory operation breakpoints
   */
  readonly memoryBreakpoints: BreakpointInfo[];

  /**
   * Gets memory breakpoint information for the specified address/partition
   * @param address Breakpoint address
   * @param partition Breakpoint partition
   */
  getMemoryBreakpoint(
    address: number,
    partition?: number
  ): BreakpointInfo | undefined;

  /**
   * The list of current I/O operation breakpoints
   */
  readonly ioBreakpoints: BreakpointInfo[];

  /**
   * Gets I/O breakpoint information for the specified port address
   * @param address Breakpoint address
   * @param partition Breakpoint partition
   */
  getIoBreakpoint(address: number): BreakpointInfo | undefined;

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
  addExecBreakpoint(breakpoint: BreakpointInfo): boolean;

  /**
   * Removes a breakpoint
   * @param address Breakpoint address
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeExecBreakpoint(breakpoint: BreakpointAddressInfo): boolean;

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   * @returns True, if the breakpoint exists, and it has been updated; otherwise, false
   */
  enableExecBreakpoint(breakpoint: BreakpointAddressInfo, enabled: boolean): boolean;
}
