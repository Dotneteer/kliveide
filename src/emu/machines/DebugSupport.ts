import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

import { incBreakpointsVersionAction } from "@state/actions";
import { getBreakpointKey } from "@common/utils/breakpoints";

// --- Breakpoint flags
// --- Execution breakpoint
export const EXEC_BP = 0x01;
// --- Has partition information
export const PART_BP = 0x02;
// --- Has hit count information
export const HIT_BP = 0x04;
// --- Memory read breakpoint
export const MEM_READ_BP = 0x08;
// --- Memory write breakpoint
export const MEM_WRITE_BP = 0x10;
// --- I/O read breakpoint
export const IO_READ_BP = 0x20;
// --- I/O write breakpoint
export const IO_WRITE_BP = 0x40;
// --- Execution breakpoint disabled?
export const DIS_EXEC_BP = 0x80;
// --- Memory read breakpoint disabled?
export const DIS_MR_BP = 0x100;
// --- Memory write breakpoint disabled?
export const DIS_MW_BP = 0x200;
// --- I/O read breakpoint disabled?
export const DIS_IOR_BP = 0x400;
// --- I/O write breakpoint disabled?
export const DIS_IOW_BP = 0x400;

/**
 * This class implement support functions for debugging
 */
export class DebugSupport implements IDebugSupport {
  // --- Breakpoint definitions
  breakpointDefs = new Map<string, BreakpointInfo>();
  breakpointFlags = new Uint16Array(0x1_0000);
  breakpointData = new Map<number, BreakpointData>();

  /**
   * Initializes the service using the specified store
   * @param store Application state store
   */
  constructor (
    private readonly store?: Store<AppState>,
    bps?: BreakpointInfo[]
  ) {
    if (bps) {
      bps.forEach(bp => this.addBreakpoint(bp));
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
    return Array.from(this.breakpointDefs.values());
  }

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   */
  shouldStopAt (
    address: number,
    partitionResolver: (address: number) => number | undefined
  ): boolean {
    // --- Check breakpoint flags
    const flags = this.breakpointFlags[address];
    // --- Any execution breakpoint?
    if (!(flags & (EXEC_BP | PART_BP))) {
      // --- No execution breakpoint
      return false;
    }

    // --- Is there a partitionless breakpoint for this address?
    if (flags & EXEC_BP) {
      // --- Yes, though it may be disabled
      return !(flags & DIS_EXEC_BP);
    }

    // --- Is there any partition breakpoint?
    const bpData = this.breakpointData.get(address);
    if (!bpData?.partitions || bpData.partitions.length === 0) {
      // --- No partition breakpoint
      return false;
    }

    // --- Get the current partition and test if it has a breakpoint
    const partition = partitionResolver(address);
    const partitionEntry = bpData.partitions.find(p => p[0] === partition);
    return !!partitionEntry && !partitionEntry[1];
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
    this.breakpointDefs.clear();
    this.breakpointFlags = new Uint16Array(0x1_0000);
    this.breakpointData.clear();
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * Adds a breakpoint to the list of existing ones
   * @param bp Breakpoint to add
   * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
   */
  addBreakpoint (bp: BreakpointInfo): boolean {
    // --- Store the breakpoint definition
    const bpKey = getBreakpointKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    try {
      this.breakpointDefs.set(bpKey, {
        address: bp.address,
        partition: bp.partition,
        resource: bp.resource,
        line: bp.line,
        exec: true,
        resolvedAddress: bp.resolvedAddress,
        resolvedPartition: bp.resolvedPartition,
        memoryRead: bp.memoryRead,
        memoryWrite: bp.memoryWrite,
      });
    } catch (err) {
      console.log("err in addBreakpoint", err.toString());
    }

    // --- Extract used address and partition
    const address = bp.address ?? bp.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, update breakpoint flags
      const partition = bp.partition ?? bp.resolvedPartition;
      const bpFlags = this.collectBpFlags(bp);
      if (bpFlags & (IO_READ_BP | IO_WRITE_BP)) {
        // --- Update I/O breakpoints
        for (let i = 0; i < 0x1_0000; i++) {
          if ((i & bp.mask) === bp.address) {
            this.breakpointFlags[i] |= bpFlags;
          }
        }
      } else {
        this.breakpointFlags[address] = bpFlags;
        if (partition !== undefined || bp.hitCount !== undefined) {
          // --- We have extra breakpoint data
          let bpData = this.breakpointData.get(address);
          if (!bpData) {
            bpData = {};
            this.breakpointData.set(address, bpData);
          }
          if (partition) {
            bpData.partitions ??= [];
            if (!bpData.partitions.some(p => p[0] === partition)) {
              bpData.partitions.push([partition, false]);
            }
          }
          if (bp.hitCount !== undefined) {
            bpData.currentHitCount = 0;
            bpData.targetHitCount = bp.hitCount;
          }
        }
      }
    }

    // --- Done, sign the change
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    return !oldBp;
  }

  /**
   * Removes a breakpoint
   * @param bp Breakpoint to remove
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeBreakpoint (bp: BreakpointInfo): boolean {
    // --- Remove definition
    const bpKey = getBreakpointKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    if (!oldBp) {
      return false;
    }
    this.breakpointDefs.delete(bpKey);

    // --- Remove breakpoint flags
    const address = oldBp.address ?? oldBp.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, process it
      const partition = bp.partition ?? bp.resolvedPartition;
      const bpFlags = this.collectBpFlags(bp);
      this.breakpointFlags[address] &= ~bpFlags | PART_BP;
      if (this.breakpointData.has(address)) {
        // --- Handle the additional data
        const prevData = this.breakpointData.get(address);
        if (partition !== undefined) {
          prevData.partitions = prevData.partitions.filter(
            p => p[0] !== partition
          );
        }
        if (!prevData.partitions || prevData.partitions.length === 0) {
          // --- No more partition breakpoint for the address
          this.breakpointFlags[address] &= ~PART_BP;
          if (!(this.breakpointFlags[address] & HIT_BP)) {
            // --- No partition, no hit count
            this.breakpointData.delete(address);
          }
        }
      }
    }

    // --- Done, sign the change
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    return true;
  }

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   */
  enableBreakpoint (bp: BreakpointInfo, enabled: boolean): boolean {
    // --- Adjust breakpoint definition
    const bpKey = getBreakpointKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    if (!oldBp) return false;
    oldBp.disabled = !enabled;

    const address = oldBp.address ?? oldBp.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, process it
      const partition = bp.partition ?? bp.resolvedPartition;
      if (partition !== undefined) {
        // --- Enable or disable partitioned breakpoint
        const bpData = this.breakpointData.get(address);
        if (!bpData) {
          // --- Breakpoint does not exist
          return false;
        }

        // --- Get partition info
        const partInfo = bpData.partitions.find(p => p[0] === partition);
        if (!partInfo) {
          // --- Breakpoint does not exist
          return false;
        }

        // --- Partition breakpoint found, enable or disable it
        partInfo[1] = !enabled;
      } else {
        // --- Non-partition breakpoint
        let flag = 0x00;
        if (bp.exec) {
          flag = DIS_EXEC_BP;
        } else if (bp.memoryRead) {
          flag = DIS_MR_BP;
        } else if (bp.memoryWrite) {
          flag = DIS_MW_BP;
        } else if (bp.ioRead) {
          flag = DIS_IOR_BP;
        } else if (bp.ioWrite) {
          flag = DIS_IOW_BP;
        }

        // --- Set (disabled) or reset the flag
        if (enabled) {
          // --- Reset
          this.breakpointFlags[address] &= ~flag;
        } else {
          // --- Set
          this.breakpointFlags[address] |= flag;
        }
      }
    }

    // --- Done, sigh the change
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
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
    for (const value of this.breakpointDefs.values()) {
      values.push(value);
    }
    values.forEach(bp => {
      if (bp.resource === def.resource && bp.line >= def.line) {
        const oldKey = getBreakpointKey(bp);
        this.breakpointDefs.delete(oldKey);
        bp.line += shift;
        this.breakpointDefs.set(getBreakpointKey(bp), bp);
        changed = true;
      }
    });
    if (changed) {
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
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
    this.breakpointDefs.forEach(bp => {
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
          this.breakpointDefs.delete(item);
        }
        this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      }
    });
  }

  /**
   * Resets the resolution of breakpoints
   */
  resetBreakpointResolution (): void {
    for (const bp of this.breakpointDefs.values()) {
      delete bp.resolvedAddress;
    }
  }

  /**
   * Resolves the specified resouce breakpoint to an address
   */
  resolveBreakpoint (resource: string, line: number, address: number): void {
    const bpKey = getBreakpointKey({ resource, line });
    const bp = this.breakpointDefs.get(bpKey);
    if (!bp) {
      return;
    }
    bp.resolvedAddress = address;
    this.breakpointFlags[address] = EXEC_BP;
  }

  // --- Get the breakpoint flags from the definition
  private collectBpFlags (bp: BreakpointInfo): number {
    // --- Collect breakpoint flags
    let bpFlags = 0x00;
    if (
      bp.exec &&
      bp.partition === undefined &&
      bp.resolvedPartition === undefined
    ) {
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
