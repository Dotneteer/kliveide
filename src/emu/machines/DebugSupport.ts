import { incBreakpointsVersionAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import {
  BreakpointAddressInfo,
  BreakpointInfo
} from "@abstractions/BreakpointInfo";
import { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import { getBreakpointKey } from "@common/utils/breakpoints";

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
  getExecBreakpoint (
    address: number,
    partition?: number
  ): BreakpointInfo | undefined {
    const binaryBp = this._execBps.get(
      getBreakpointKey({ address, partition })
    );
    if (binaryBp) {
      return binaryBp;
    }
    for (const bpInfo of this._execBps.values()) {
      if (bpInfo.resolvedAddress === address) {
        return bpInfo;
      }
    }
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
    return this._memoryBps.get(getBreakpointKey({ address, partition }));
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
    const bpKey = getBreakpointKey(breakpoint);
    console.log(bpKey);
    const oldBp = this._execBps.get(bpKey);
    try {
      this._execBps.set(bpKey, {
        address: breakpoint.address,
        partition: breakpoint.partition,
        resource: breakpoint.resource,
        line: breakpoint.line,
        exec: true
      });
      console.log(this._execBps);
    } catch (err) {
      console.log("err in addExecBreakpoint", err.toString());
    }

    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return !oldBp;
  }

  /**
   * Removes a breakpoint
   * @param address Breakpoint address
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeExecBreakpoint (bp: BreakpointAddressInfo): boolean {
    const bpKey = getBreakpointKey(bp);
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
  enableExecBreakpoint (bp: BreakpointAddressInfo, enabled: boolean): boolean {
    const bpKey = getBreakpointKey(bp);
    const oldBp = this._execBps.get(bpKey);
    if (!oldBp) return false;
    oldBp.disabled = !enabled;
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return true;
  }

  /**
   * Finds the specified breakpoint
   * @param address Breakpoint address
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  findBreakpoint (
    breakpoint: BreakpointAddressInfo
  ): BreakpointInfo | undefined {
    return this._execBps.get(getBreakpointKey(breakpoint));
  }

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   */
  scrollBreakpoints (def: BreakpointAddressInfo, shift: number): void {
    let changed = false;
    this._execBps.forEach(bp => {
      if (bp.resource === def.resource && bp.line >= def.line) {
        bp.line += shift;
        changed = true;
      }
    });
    if (changed) {
      this.store.dispatch(incBreakpointsVersionAction(), "emu");
    }
  }

  /**
   * Normalizes source code breakpoint. Removes the ones that overflow the
   * file and also deletes duplicates.
   * @param lineCount
   * @returns
   */
  normalizeBreakpoints (resource: string, lineCount: number): void {
    const mapped = new Set<string>();
    const toDelete = new Set<string>();

    // --- Iterate through the breakpoints to find the ones to delete
    this._execBps.forEach(bp => {
      const bpKey = getBreakpointKey(bp);
      if (bp.resource === resource) {
        if (bp.line > lineCount) {
          // --- Delete as it overflows the file
          toDelete.add(bpKey);
        } else if (mapped.has(bpKey)) {
          // --- Deletes as it is a duplicate
          toDelete.add(bpKey);
        } else {
          // --- Map as it exists and want to avoid duplication
          mapped.add(bpKey);
        }
      }

      if (toDelete.size > 0) {
        for (const item of toDelete.values()) {
          this._execBps.delete(item);
        }
        this.store.dispatch(incBreakpointsVersionAction(), "emu");
      }
    });
  }

  /**
   * Resets the resolution of breakpoints
   */
  resetBreakpointResolution (): void {
    for (const bp of this._execBps.values()) {
      delete bp.resolvedAddress;
    }
  }

  /**
   * Resolves the specified resouce breakpoint to an address
   */
  resolveBreakpoint (resource: string, line: number, address: number): void {
    const bpKey = getBreakpointKey({ resource, line });
    const bp = this._execBps.get(bpKey);
    if (bp) {
      bp.resolvedAddress = address;
    }
  }
}
