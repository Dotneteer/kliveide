import { incBreakpointsVersionAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import {
  BreakpointInfo,
  IDebugSupport
} from "../abstractions/ExecutionContext";

/**
 * This class implement support functions for debugging
 */
export class DebugSupport implements IDebugSupport {
  // --- Execution breakpoint definitions
  private _execBps = new Map<string, BreakpointInfo>();

  // --- Memory breakpoint definitions
  private _memoryBps = new Map<string, BreakpointInfo>();

  // --- I/O breakpoint definitions
  private _ioBps: BreakpointInfo[] = [];

  // --- I/O breakpoints
  private _ioBpsMap = new Map<number, BreakpointInfo>();

  /**
   * Initializes the service using the specified store
   * @param store Application state store
   */
  constructor (private readonly store: Store<AppState>) {}

  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

  /**
   * The list of current execution breakpoints
   */
  get execBreakpoints (): BreakpointInfo[] {
    return Array.from(this._execBps.values());
  }

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   * @param partition Breakpoint partition
   */
  getExecBreakpoint (address: number, partition?: number): BreakpointInfo {
    return this._execBps.get(getBpKey(address, partition));
  }

  /**
   * The list of current memory operation breakpoints
   */
  get memoryBreakpoints (): BreakpointInfo[] {
    return Array.from(this._memoryBps.values());
  }

  /**
   * Gets memory breakpoint information for the specified address/partition
   * @param address Breakpoint address
   * @param partition Breakpoint partition
   */
  getMemoryBreakpoint (address: number, partition?: number): BreakpointInfo {
    return this._memoryBps.get(getBpKey(address, partition));
  }

  /**
   * The list of current I/O operation breakpoints
   */
  get ioBreakpoints (): BreakpointInfo[] {
    return Array.from(this._ioBps);
  }

  /**
   * Gets I/O breakpoint information for the specified port address
   * @param address Breakpoint address
   * @param partition Breakpoint partition
   */
  getIoBreakpoint (address: number): BreakpointInfo {
    return this._ioBpsMap.get(address);
  }

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
  eraseAllBreakpoints (): void {
    this._execBps.clear();
    this._memoryBps.clear();
    this._ioBps.length = 0;
    this._ioBpsMap.clear();
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * Adds a breakpoint to the list of existing ones
   * @param breakpoint Breakpoint information
   * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
   */
  addExecBreakpoint (breakpoint: BreakpointInfo): boolean {
    const bpKey = getBpKey(breakpoint.address, breakpoint.partition);
    const oldBp = this._execBps.get(bpKey);
    this._execBps.set(bpKey, {
      address: breakpoint.address,
      partition: breakpoint.partition,
      exec: true
    });
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return !oldBp;
  }

  /**
   * Removes a breakpoint
   * @param address Breakpoint address
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeExecBreakpoint (address: number): boolean {
    const bpKey = getBpKey(address);
    const oldBp = this._execBps.get(bpKey);
    this._execBps.delete(bpKey);
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return !!oldBp;
  }

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   */
  enableExecBreakpoint (address: number, enabled: boolean): boolean {
    const bpKey = getBpKey(address);
    const oldBp = this._execBps.get(bpKey);
    if (!oldBp) return false;
    oldBp.disabled = !enabled;
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return true;
  }
}

/**
 * Gets the storage key for the specified address and partition
 */
function getBpKey (address: number, partition?: number): string {
  return partition !== undefined
    ? `${partition.toString(16)}:${address.toString(16).padStart(4, "0")}`
    : `${address.toString(16).padStart(4, "0")}`;
}
