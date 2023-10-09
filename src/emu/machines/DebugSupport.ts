import { incBreakpointsVersionAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import { getBreakpointKey } from "@common/utils/breakpoints";

// --- Breakpoint flags
// --- Execution breakpoint
const EXEC_BP = 0x01;
// --- Has partition information
const PART_BP = 0x02;
// --- Has hit count information
const HIT_BP = 0x04;
// --- Memory read breakpoint
const MEM_READ_BP = 0x08;
// --- Memory write breakpoint
const MEM_WRITE_BP = 0x10;
// --- I/O read breakpoint
const IO_READ_BP = 0x20;
// --- I/O write breakpoint
const IO_WRITE_BP = 0x40;
// --- Execution breakpoint disabled?
const DIS_EXEC_BP = 0x80;
// --- Memory read breakpoint disabled?
const DIS_MR_BP = 0x100;
// --- Memory write breakpoint disabled?
const DIS_MW_BP = 0x200;
// --- I/O read breakpoint disabled?
const DIS_IOR_BP = 0x400;
// --- I/O write breakpoint disabled?
const DIS_IOW_BP = 0x400;

/**
 * This class implement support functions for debugging
 */
export class DebugSupport implements IDebugSupport {
  // --- Breakpoint definitions
  private _bpDefs = new Map<string, BreakpointInfo>();
  private _breakpoints = new Uint16Array(0x1_0000);
  private _bpData = new Map<number, BreakpointData>();

  /**
   * Initializes the service using the specified store
   * @param store Application state store
   */
  constructor (private readonly store: Store<AppState>, bps?: BreakpointInfo[]) {
    if (bps) {
      bps.forEach(bp => this.addExecBreakpoint(bp));
    }
  }

  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

  /**
   * The list of current execution breakpoints
   */
  get breakpoints (): BreakpointInfo[] {
    return Array.from(this._bpDefs.values());
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
    const binaryBp = this._bpDefs.get(getBreakpointKey({ address, partition }));
    if (binaryBp) {
      return binaryBp;
    }
    for (const bpInfo of this._bpDefs.values()) {
      if (bpInfo.resolvedAddress === address) {
        return bpInfo;
      }
    }
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
    this._bpDefs.clear();
    this._breakpoints = new Uint16Array(0x1_0000);
    this._bpData.clear();
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * Adds a breakpoint to the list of existing ones
   * @param bp Breakpoint information
   * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
   */
  addExecBreakpoint (bp: BreakpointInfo): boolean {
    // --- Extract used address and partition
    const address = bp.address ?? bp.resolvedAddress;
    const partition = bp.partition ?? bp.resolvedPartition;

    // --- Update breakpoint flags
    const bpFlags = this.collectBpFlags(bp);
    if (bpFlags & (IO_READ_BP | IO_WRITE_BP)) {
      // --- Update I/O breakpoints
      for (let i = 0; i < 0x1_0000; i++) {
        if ((i & bp.mask) === bp.address) {
          this._breakpoints[i] |= bpFlags;
        }
      }
    } else {
      this._breakpoints[address] = bpFlags;
      if (partition !== undefined || bp.hitCount !== undefined) {
        // --- We have extra breakpoint data
        let bpData = this._bpData.get(address);
        if (!bpData) {
          bpData = {};
          this._bpData.set(address, bpData);
        }
        if (partition) {
          bpData.partitions ??= [];
          if (!bpData.partitions.some(p => p[0] === partition)) {
            bpData.partitions.push([partition, true]);
          }
          if (bp.hitCount !== undefined) {
            bpData.currentHitCount = 0;
            bpData.targetHitCount = bp.hitCount;
          }
        }
      }
    }

    // --- Store the breakpoint definition
    const bpKey = getBreakpointKey(bp);
    const oldBp = this._bpDefs.get(bpKey);
    try {
      this._bpDefs.set(bpKey, {
        address: bp.address,
        partition: bp.partition,
        resource: bp.resource,
        line: bp.line,
        exec: true
      });
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
  removeBreakpoint (bp: BreakpointInfo): boolean {
    // --- Remove definition
    const bpKey = getBreakpointKey(bp);
    const oldBp = this._bpDefs.get(bpKey);
    this._bpDefs.delete(bpKey);

    // --- Remove breakpoint flags
    const bpFlags = this.collectBpFlags(bp);
    const address = bp.address ?? bp.resolvedAddress;
    const partition = bp.partition ?? bp.resolvedPartition;
    this._breakpoints[address] &= bpFlags | PART_BP;
    if (partition !== undefined && this._bpData.has(address)) {
      // --- Remove partition info
      const prevData = this._bpData.get(address);
      prevData.partitions = prevData.partitions.filter(p => p[0] !== partition);
      if (prevData.partitions.length === 0) {
        // --- No more partition breakpoint for the address
        this._breakpoints[address] &= ~PART_BP;
        if (!(this._breakpoints[address] & HIT_BP)) {
          // --- No partition, no hit count
          this._bpData.delete(address);
        }
      }
    }

    // --- Done
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return !!oldBp;
  }

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   */
  enableBreakpoint (bp: BreakpointInfo, enabled: boolean): boolean {
    const bpKey = getBreakpointKey(bp);
    const oldBp = this._bpDefs.get(bpKey);
    if (!oldBp) return false;
    oldBp.disabled = !enabled;
    this.store.dispatch(incBreakpointsVersionAction(), "emu");
    return true;
  }

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   */
  scrollBreakpoints (def: BreakpointInfo, shift: number): void {
    let changed = false;
    const values: BreakpointInfo[] = [];
    for (const value of this._bpDefs.values()) {
      values.push(value);
    }
    values.forEach(bp => {
      if (bp.resource === def.resource && bp.line >= def.line) {
        const oldKey = getBreakpointKey(bp);
        this._bpDefs.delete(oldKey);
        bp.line += shift;
        this._bpDefs.set(getBreakpointKey(bp), bp);
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
    this._bpDefs.forEach(bp => {
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
          this._bpDefs.delete(item);
        }
        this.store.dispatch(incBreakpointsVersionAction(), "emu");
      }
    });
  }

  /**
   * Resets the resolution of breakpoints
   */
  resetBreakpointResolution (): void {
    for (const bp of this._bpDefs.values()) {
      delete bp.resolvedAddress;
    }
  }

  /**
   * Resolves the specified resouce breakpoint to an address
   */
  resolveBreakpoint (resource: string, line: number, address: number): void {
    const bpKey = getBreakpointKey({ resource, line });
    const bp = this._bpDefs.get(bpKey);
    if (bp) {
      bp.resolvedAddress = address;
    }
  }

  // --- Get the breakpoint flags from the definition
  private collectBpFlags (bp: BreakpointInfo): number {
    // --- Collect breakpoint flags
    let bpFlags = 0x00;
    if (bp.exec) {
      bpFlags |= EXEC_BP;
      if (bp.disabled) {
        bpFlags |= DIS_EXEC_BP;
      }
    }
    if (bp.partition !== undefined) {
      bpFlags |= PART_BP;
    }
    if (bp.memoryRead) {
      bpFlags |= MEM_READ_BP;
      if (bp.disabled) {
        bpFlags |= DIS_MR_BP;
      }
    }
    if (bp.memoryWrite) {
      bpFlags |= MEM_WRITE_BP;
      if (bp.disabled) {
        bpFlags |= DIS_MW_BP;
      }
    }
    if (bp.ioRead) {
      bpFlags |= IO_READ_BP;
      if (bp.disabled) {
        bpFlags |= DIS_IOR_BP;
      }
    }
    if (bp.ioWrite) {
      bpFlags |= IO_WRITE_BP;
      if (bp.disabled) {
        bpFlags |= DIS_IOW_BP;
      }
    }
    if (bp.hitCount !== undefined) {
      bpFlags |= HIT_BP;
    }

    return bpFlags;
  }
}

// --- Extra data assigned to a particular breakpoint
type BreakpointData = {
  targetHitCount?: number;
  currentHitCount?: number;
  partitions?: [number, boolean][];
};
