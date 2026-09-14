import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";
import type { BreakpointInfo, BreakpointScope } from "@abstractions/BreakpointInfo";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

import { incBreakpointsVersionAction } from "@state/actions";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import {
  bankRelativeAddresses,
  bankRelativePartition,
  breakpointMatchesScope,
  effectiveBankSite,
  isBankRelative,
  withScopeOwner
} from "@common/utils/breakpoint-scope";

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
export const DIS_IOW_BP = 0x800;

/**
 * This class implement support functions for debugging
 */
export class DebugSupport implements IDebugSupport {
  // --- Breakpoint definitions
  breakpointDefs = new Map<string, BreakpointInfo>();
  breakpointFlags = new Uint16Array(0x1_0000);
  breakpointData = new Map<number, BreakpointData>();

  private suspendVersionIncrement = false;

  /**
   * While set, only session-owned breakpoints can stop the machine.
   *
   * This exists for a code-injection flow that ends with the machine already running. Loading a NEX
   * means booting NextZXOS and *typing* `.nexload` into it, and a keystroke is queued with an
   * absolute tact window: a user breakpoint that pauses the machine while strokes are still queued
   * expires every one that has not been pressed, leaving the command line half-written and the
   * program unloaded. Meanwhile the flow's own stop — the one-shot at the program's entry point —
   * still has to fire, which is the distinction this draws.
   *
   * `MachineController` owns the lifetime, and scopes it to the window that is actually exposed:
   * during the flow itself the machine runs in `NoDebug`, where the per-instruction callers skip
   * the stop decision entirely and no breakpoint can fire regardless of this flag.
   *
   * See `.plans/NEX_DEBUGGING_PLAN.md` §10.3.
   */
  suppressUserBreakpoints = false;

  /**
   * Initializes the service using the specified store
   * @param store Application state store
   */
  constructor(
    private readonly store?: Store<AppState>,
    bps?: BreakpointInfo[]
  ) {
    this.suspendVersionIncrement = true;
    try {
      if (bps) {
        bps.forEach((bp) => this.addBreakpoint(bp));
      }
    } finally {
      this.suspendVersionIncrement = false;
    }
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

  /**
   * The list of current execution breakpoints
   */
  get breakpoints(): BreakpointInfo[] {
    return Array.from(this.breakpointDefs.values());
  }

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   */
  shouldStopAt(
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

    // --- During a launch flow only the flow's own stop may fire; see `suppressUserBreakpoints`.
    if (this.suppressUserBreakpoints && !this.hasSessionStopAt(address)) {
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

    // --- Get the current partition and test if it has a breakpoint.
    //
    // --- `some`, not `find`: two entries can now share a partition at one address — a user's
    // --- `bp-set <partition>:<address>` and a bank-relative breakpoint projected onto it. Taking
    // --- the *first* would let a disabled one mask an enabled one. The question is whether any
    // --- enabled entry matches, which is also what the single-entry case always meant.
    const partition = partitionResolver(address);
    return bpData.partitions.some((p) => p[0] === partition && !p[1]);
  }

  /**
   * Gets memory read breakpoint information for the specified address/partition
   * @param reads Addresses read during the current instruction
   * @param length Number of bytes read
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryRead(
    reads: ArrayLike<number>,
    length: number,
    partitionResolver: (address: number) => number | undefined
  ): boolean {
    for (let i = 0; i < length; i++) {
      const read = reads[i];
      const flags = this.breakpointFlags[read];
      if (flags & MEM_READ_BP) {
        if (flags & DIS_MR_BP) {
          return false;
        }
        const bpData = this.breakpointData.get(read);
        if (!bpData?.partitions || bpData.partitions.length === 0) {
          return true;
        }
        const partition = partitionResolver(read);
        if (bpData.partitions.some((p) => p[0] === partition && !p[1])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Gets memory write breakpoint information for the specified address/partition
   * @param writes Addresses written during the current instruction
   * @param length Number of bytes written
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryWrite(
    writes: ArrayLike<number>,
    length: number,
    partitionResolver: (address: number) => number | undefined
  ): boolean {
    for (let i = 0; i < length; i++) {
      const write = writes[i];
      const flags = this.breakpointFlags[write];
      if (flags & MEM_WRITE_BP) {
        if (flags & DIS_MW_BP) {
          return false;
        }
        const bpData = this.breakpointData.get(write);
        if (!bpData?.partitions || bpData.partitions.length === 0) {
          return true;
        }
        const partition = partitionResolver(write);
        if (bpData.partitions.some((p) => p[0] === partition && !p[1])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Does any breakpoint in this set watch memory or I/O access?
   *
   * The per-instruction debug loops of the WASM-backed machines call this once per entry to decide
   * whether they have to mirror the core's bus activity after every instruction. `breakpointDefs`
   * holds a handful of entries in practice, so this stays cheaper than the ~7 WASM boundary
   * crossings per instruction it lets the caller skip.
   */
  hasAccessBreakpoints(): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets I/O read breakpoint information for the specified address
   * @param address I/O address read during the current instruction
   */
  hasIoRead(address: number): boolean {
    if (address === undefined) {
      return false;
    }
    const flags = this.breakpointFlags[address];
    return (flags & IO_READ_BP) !== 0 && (flags & DIS_IOR_BP) === 0;
  }

  /**
   * Gets I/O write breakpoint information for the specified address
   * @param address I/O address written during the current instruction
   */
  hasIoWrite(address: number): boolean {
    if (address === undefined) {
      return false;
    }
    const flags = this.breakpointFlags[address];
    return (flags & IO_WRITE_BP) !== 0 && (flags & DIS_IOW_BP) === 0;
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
  eraseAllBreakpoints(): void {
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
  addBreakpoint(bp: BreakpointInfo): boolean {
    // --- Store the breakpoint definition
    const bpKey = getBreakpointStorageKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    try {
      this.breakpointDefs.set(bpKey, {
        address: bp.address,
        partition: bp.partition,
        // --- Must be carried across: this literal rebuilds the definition field by field, so an
        // --- omitted `owner` would make every breakpoint project-owned the moment it was added,
        // --- and a project save would adopt breakpoints belonging to a `.nex` sidecar.
        owner: bp.owner,
        // --- Same reason as `owner`: this literal rebuilds the definition field by field, so a
        // --- bank-relative breakpoint would lose the very fields that make it one.
        bank: bp.bank,
        bankOffset: bp.bankOffset,
        oneShot: bp.oneShot,
        resource: bp.resource,
        line: bp.line,
        exec: !(bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite),
        resolvedAddress: bp.resolvedAddress,
        resolvedPartition: bp.resolvedPartition,
        // --- Same reason as `owner` and `bank` above: this literal rebuilds the definition field
        // --- by field, so a label-anchored breakpoint would lose the label that identifies it and
        // --- the resolution that arms it. Resolution works by rewriting the whole set through
        // --- `resetBreakpointsTo`, so a dropped `resolvedBank` would be dropped on every refresh.
        label: bp.label,
        labelFile: bp.labelFile,
        resolvedBank: bp.resolvedBank,
        resolvedBankOffset: bp.resolvedBankOffset,
        memoryRead: bp.memoryRead,
        memoryWrite: bp.memoryWrite,
        ioRead: bp.ioRead,
        ioWrite: bp.ioWrite,
        ioMask: bp.ioMask ?? 0xffff,
        /*
         * `disabled` and `hitCount`, for the same reason as `owner` and `bank` above — and these
         * two were being dropped.
         *
         * It went unnoticed while the flags were assigned from the *incoming* breakpoint: the
         * machine behaved correctly and only the stored definition was short, so `listBreakpoints`
         * reported a breakpoint with no hit count (which is why the breakpoint dialog never showed
         * one) and `resetBreakpointsTo` had to re-apply `disabled` through `enableBreakpoint`
         * afterwards to make the definition match the flags.
         *
         * Now that `refreshFlagsAt` derives the flags *from* the definitions, an omitted `disabled`
         * would arm a breakpoint that was added disabled. The definition has to be complete.
         */
        disabled: bp.disabled,
        hitCount: bp.hitCount
      });
    } catch (err) {
      console.log("err in addBreakpoint", err.toString());
    }

    // --- A bank-relative breakpoint has no single address: it is armed at every address its bank
    // --- could be paged to, and the partition test at fire time picks the real one.
    if (isBankRelative(bp)) {
      this.armBankRelative(bp, this.collectBpFlags(bp));
      if (!this.suspendVersionIncrement) {
        this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      }
      return !oldBp;
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
          if ((i & (bp.ioMask ?? 0xffff)) === bp.address) {
            this.breakpointFlags[i] |= bpFlags;
          }
        }
      } else {
        // --- Derived, not assigned: the flags word belongs to every breakpoint at this address.
        this.refreshFlagsAt(address);
        if (partition !== undefined || bp.hitCount !== undefined) {
          // --- We have extra breakpoint data
          let bpData = this.breakpointData.get(address);
          if (!bpData) {
            bpData = {};
            this.breakpointData.set(address, bpData);
          }
          // --- `!== undefined`, not truthiness: partition 0 is a real partition on every banked
          // --- machine (bank `B0` on the 128K, bank `00` on the ZX Next), and a truthiness test
          // --- skipped it. `collectBpFlags` has already withheld `EXEC_BP` and set `PART_BP` for
          // --- any breakpoint carrying a partition, so leaving `partitions` empty made
          // --- `shouldStopAt` fall through to `false` — the breakpoint could never fire. Removal
          // --- (`removeBreakpoint`) and enabling (`enableBreakpoint`) both test `!== undefined`,
          // --- so this was also an add/remove asymmetry.
          if (partition !== undefined) {
            // --- No tag: this entry belongs to the user's own breakpoint, not to a bank-relative
            // --- one. Dedupe is on partition *and* tag, so the two can share an address.
            this.addPartitionEntry(address, partition, undefined, !!bp.disabled);
          }
          if (bp.hitCount !== undefined) {
            bpData.currentHitCount = 0;
            bpData.targetHitCount = bp.hitCount;
          }
        }
      }
    }

    // --- Done, sign the change
    if (!this.suspendVersionIncrement) {
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    }
    return !oldBp;
  }

  /**
   * Removes a breakpoint
   * @param bp Breakpoint to remove
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeBreakpoint(bp: BreakpointInfo): boolean {
    // --- Remove definition
    const bpKey = getBreakpointStorageKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    if (!oldBp) {
      return false;
    }
    this.breakpointDefs.delete(bpKey);

    // --- A bank-relative breakpoint owns entries at eight addresses, tagged with its key, so it
    // --- takes only its own away.
    if (isBankRelative(oldBp)) {
      this.disarmBankRelative(oldBp, this.collectBpFlags(oldBp));
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      return true;
    }

    // --- Remove breakpoint flags
    const address = oldBp.address ?? oldBp.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, process it
      const partition = bp.partition ?? bp.resolvedPartition;
      // --- Derived from what is left, rather than by clearing this breakpoint's own bits: another
      // --- breakpoint at the same address may still want them. The definition has already been
      // --- deleted above, so it contributes nothing here.
      this.refreshFlagsAt(address);

      if (bp.ioRead || bp.ioWrite) {
        for (let i = 0; i < 0x1_0000; i++) {
          if ((i & (bp.ioMask ?? 0xffff)) === bp.address) {
            if (bp.ioRead) {
              this.breakpointFlags[i] &= ~(IO_READ_BP | DIS_IOR_BP);
            } else {
              this.breakpointFlags[i] &= ~(IO_WRITE_BP | DIS_IOW_BP);
            }
          }
        }
      }

      if (this.breakpointData.has(address)) {
        // --- Handle the additional data
        const prevData = this.breakpointData.get(address);
        if (partition !== undefined) {
          // --- `p[2] === undefined` keeps a bank-relative breakpoint's tagged entry for the same
          // --- partition: removing one kind must not remove the other's.
          prevData.partitions = prevData.partitions.filter(
            (p) => !(p[0] === partition && p[2] === undefined)
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
  enableBreakpoint(bp: BreakpointInfo, enabled: boolean): boolean {
    // --- Adjust breakpoint definition
    const bpKey = getBreakpointStorageKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    if (!oldBp) return false;
    oldBp.disabled = !enabled;

    // --- A bank-relative breakpoint's disabled flag lives on its own tagged entries, at each of the
    // --- eight addresses it armed.
    if (isBankRelative(oldBp)) {
      const owningKey = bpKey;
      for (const address of bankRelativeAddresses(effectiveBankSite(oldBp)!.bankOffset)) {
        const bpData = this.breakpointData.get(address);
        for (const entry of bpData?.partitions ?? []) {
          if (entry[2] === owningKey) {
            entry[1] = !enabled;
          }
        }
      }
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      return true;
    }

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

        // --- Get partition info. `p[2] === undefined` so that toggling a user's breakpoint does
        // --- not toggle a bank-relative one sharing the address and partition.
        const partInfo = bpData.partitions.find(
          (p) => p[0] === partition && p[2] === undefined
        );
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

        if (bp.ioRead || bp.ioWrite) {
          // --- Update I/O breakpoints
          for (let i = 0; i < 0x1_0000; i++) {
            if ((i & (bp.ioMask ?? 0xffff)) === bp.address) {
              if (enabled) {
                this.breakpointFlags[i] &= ~flag;
              } else {
                this.breakpointFlags[i] |= flag;
              }
            }
          }
        } else {
          // --- Set (disabled) or reset the flag
          if (enabled) {
            this.breakpointFlags[address] &= ~flag;
          } else {
            this.breakpointFlags[address] |= flag;
          }
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
   * @param lowerBound Lower bound of area to remove breakpoints from
   * @param upperBound Upper bound of area to remove breakpoints from
   */
  scrollBreakpoints(
    def: BreakpointInfo,
    shift: number,
    lowerBound?: number,
    upperBound?: number
  ): void {
    let changed = false;
    const values: BreakpointInfo[] = [];
    for (const value of this.breakpointDefs.values()) {
      values.push(value);
    }
    values.forEach((bp) => {
      if (lowerBound !== undefined && upperBound !== undefined) {
        // --- Remove breakpoints in the specified area
        if (bp.resource === def.resource && bp.line >= lowerBound && bp.line < upperBound) {
          const oldKey = getBreakpointStorageKey(bp);
          this.breakpointDefs.delete(oldKey);
          return;
        }
      }

      if (bp.resource === def.resource && bp.line >= def.line) {
        // --- Shift the breakpoint
        const oldKey = getBreakpointStorageKey(bp);
        this.breakpointDefs.delete(oldKey);
        bp.line += shift;
        this.breakpointDefs.set(getBreakpointStorageKey(bp), bp);
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
  normalizeBreakpoints(resource: string, lineCount: number): void {
    const mapped = new Set<string>();
    const toDelete = new Set<string>();

    // --- Iterate through the breakpoints to find the ones to delete
    this.breakpointDefs.forEach((bp) => {
      const bpKey = getBreakpointStorageKey(bp);
      if (bp.resource === resource) {
        if (bp.line <= 0 || bp.line > lineCount) {
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
  resetBreakpointResolution(): void {
    /*
     * The addresses have to be refreshed, not just the definitions cleared.
     *
     * This used to delete `resolvedAddress` and stop. The flags it had set stayed behind, so a
     * rebuild that moved a line's code — reset, then resolve to the new address — left the machine
     * stopping at the old address as well as the new one, with nothing in the Breakpoints panel to
     * explain the phantom.
     */
    const wasResolved = new Set<number>();
    for (const bp of this.breakpointDefs.values()) {
      if (bp.resolvedAddress !== undefined) {
        wasResolved.add(bp.resolvedAddress);
        // --- The partition entry goes with the resolution that created it. An untagged entry at
        // --- the old address for the old partition would keep firing there after a rebuild moved
        // --- the line into a different bank.
        if (bp.resolvedPartition !== undefined) {
          this.removeUntaggedPartitionEntry(bp.resolvedAddress, bp.resolvedPartition);
        }
      }
      delete bp.resolvedAddress;
      delete bp.resolvedPartition;
    }
    for (const address of wasResolved) {
      this.refreshFlagsAt(address);
    }
  }

  /**
   * Resolves the specified resouce breakpoint to an address
   */
  resolveBreakpoint(
    resource: string,
    line: number,
    address: number,
    partition?: number
  ): void {
    const bpKey = getBreakpointStorageKey({ resource, line });
    const bp = this.breakpointDefs.get(bpKey);
    if (!bp || !bp.exec) {
      return;
    }
    bp.resolvedAddress = address;
    bp.resolvedPartition = partition;

    /*
     * A resolved partition needs its *entry*, not just the field.
     *
     * `collectBpFlags` withholds `EXEC_BP` from anything carrying a partition and sets `PART_BP`
     * instead, and `shouldStopAt` then looks the partition up in `breakpointData`. Setting the
     * field without the entry leaves `PART_BP` with an empty list, which reads as "no breakpoint
     * here" — the breakpoint would be listed, shown in the gutter, and unable to fire. This is the
     * same trap Phase 0 documents for `addBreakpoint`'s partition path.
     */
    if (partition !== undefined) {
      this.addPartitionEntry(address, partition, undefined, !!bp.disabled);
    }

    // --- Derived: assigning `EXEC_BP` here erased the `PART_BP` of any bank-relative breakpoint
    // --- already armed at this address, which is one of the eight a single bank breakpoint takes.
    this.refreshFlagsAt(address);
  }

  /**
   * Renames breakpoints when the source file is renamed
   */
  renameBreakpoints(oldResource: string, newResource: string): void {
    const values: BreakpointInfo[] = [];
    for (const value of this.breakpointDefs.values()) {
      values.push(value);
    }
    values.forEach((bp) => {
      if (bp.resource === oldResource) {
        // --- Shift the breakpoint
        const oldKey = getBreakpointStorageKey(bp);
        this.breakpointDefs.delete(oldKey);
        bp.resource = newResource;
        this.breakpointDefs.set(getBreakpointStorageKey(bp), bp);
      }
    });
  }

  /**
   * Replace the breakpoints owned by `scope`, leaving every other owner's alone.
   *
   * This used to replace the *whole* set, which is why opening a project destroyed any breakpoint
   * the project did not itself hold. The scope is a required parameter rather than an optional one
   * with an "everything" default, for the same reason `getBreakpointDisplayKey` requires its label
   * map: an omitted argument would silently restore exactly the behaviour this exists to fix.
   *
   * Breakpoints in `bps` are stamped with the owner the scope implies (`withScopeOwner`), so a
   * caller cannot install a breakpoint under one scope and have it owned by another.
   *
   * @param bps The breakpoints to install for this scope
   * @param scope Which existing breakpoints this call may remove
   */
  resetBreakpointsTo(bps: BreakpointInfo[], scope: BreakpointScope): void {
    // --- Everything this call is *not* allowed to touch, captured before the rebuild.
    const survivors = this.breakpoints.filter((bp) => !breakpointMatchesScope(bp.owner, scope));
    const installing = (bps ?? []).map((bp) => withScopeOwner(bp, scope));

    this.breakpointDefs = new Map<string, BreakpointInfo>();
    this.breakpointFlags = new Uint16Array(0x1_0000);
    this.breakpointData = new Map<number, BreakpointData>();
    this.suspendVersionIncrement = true;
    try {
      for (const bp of [...survivors, ...installing]) {
        this.addBreakpoint(bp);
        if (bp.disabled) {
          // --- `addBreakpoint` gets the *flags* right (`collectBpFlags` reads `disabled`) but
          // --- rebuilds the stored definition without carrying `disabled` across, so the breakpoint
          // --- would behave as disabled while `listBreakpoints` reported it armed. Re-applying it
          // --- here means every caller gets a faithful round trip instead of having to know this.
          this.enableBreakpoint(bp, false);
        }
      }
    } finally {
      this.suspendVersionIncrement = false;
    }
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * Remove every one-shot breakpoint that has just fired at `address`.
   *
   * A one-shot exists to stop the machine once — a run-to-cursor target, or the NEX entry-point
   * stop — and must not survive its own hit. Removal goes through `removeBreakpoint`, so it also
   * bumps `breakpointsVersion`: without that the panel and the disassembly gutter would keep
   * showing a breakpoint that no longer exists.
   *
   * `partition` is the partition currently paged in at `address`, so a one-shot scoped to a bank
   * that is *not* paged there is left alone — it did not fire.
   *
   * **Not yet called from the execution loop.** The hit is recorded in `DebugStepDecision.ts`,
   * which is being rewritten concurrently; the call lands with the features that need it (the entry
   * stop and run-to-cursor). See `.plans/NEX_DEBUGGING_PLAN.md` §7.3 and §19.
   *
   * @returns The number of one-shots removed.
   */
  consumeOneShotsAt(address: number, partition: number | undefined): number {
    const spent = this.breakpoints.filter((bp) => {
      if (!bp.oneShot || bp.disabled) return false;
      const site = effectiveBankSite(bp);
      if (site) {
        return (
          bankRelativePartition(site.bank, site.bankOffset) === partition &&
          bankRelativeAddresses(site.bankOffset).includes(address)
        );
      }
      const bpAddress = bp.address ?? bp.resolvedAddress;
      if (bpAddress !== address) return false;
      const bpPartition = bp.partition ?? bp.resolvedPartition;
      return bpPartition === undefined || bpPartition === partition;
    });
    for (const bp of spent) {
      this.removeBreakpoint(bp);
    }
    return spent.length;
  }

  /**
   * The execution/access kinds a single address can carry, each with its "disabled" marker.
   *
   * Paired, because a kind is only disabled when *every* breakpoint providing it is: two
   * breakpoints at one address, one disabled, must leave the address armed.
   */
  private static readonly FLAG_KINDS: readonly (readonly [number, number])[] = [
    [EXEC_BP, DIS_EXEC_BP],
    [MEM_READ_BP, DIS_MR_BP],
    [MEM_WRITE_BP, DIS_MW_BP],
    [IO_READ_BP, DIS_IOR_BP],
    [IO_WRITE_BP, DIS_IOW_BP]
  ];

  /**
   * Rebuild one address's flags from the breakpoint definitions.
   *
   * **The single authority on what `breakpointFlags[address]` should be**, replacing three places
   * that each mutated it in their own way — and each got it wrong, in ways proved by the tests in
   * `test/debug/BreakpointFlagIntegrity.test.ts`:
   *
   * - `addBreakpoint` **assigned** (`= bpFlags`), so adding a plain breakpoint at an address a
   *   bank-relative one had armed erased its `PART_BP`. The address still stopped the machine while
   *   the new breakpoint was there, and stopped stopping for good once it was removed.
   * - `resolveBreakpoint` assigned too, so a source breakpoint resolving onto a bank breakpoint's
   *   address silently disarmed it.
   * - `resetBreakpointResolution` deleted `resolvedAddress` from the definitions and left the flags
   *   behind, so a rebuild that moved a line's code left the machine stopping at **both** the old
   *   address and the new one.
   * - `removeBreakpoint` cleared its own bits (`&= ~bpFlags | PART_BP`), which also cleared them
   *   for any *other* breakpoint at the same address that still wanted them.
   *
   * The common cause is that a flags word is shared by every breakpoint at an address while each
   * site treated it as its own. Deriving it is the only approach where that cannot be got wrong:
   * the definitions are the truth, `collectBpFlags` already says what one breakpoint contributes,
   * and this ORs them.
   *
   * I/O breakpoints are included — they claim every address their port mask matches — so an address
   * that is both a port and a code address comes out right. The *bulk* I/O paths stay as they are:
   * they touch up to 65536 addresses, and recomputing each from every definition would turn setting
   * one masked port breakpoint into a quadratic scan.
   */
  private refreshFlagsAt(address: number): void {
    let extra = 0; // --- PART_BP / HIT_BP: not kinds, and not separately disable-able
    let present = 0; // --- kinds any breakpoint here provides
    let armed = 0; // --- kinds at least one *enabled* breakpoint here provides

    for (const bp of this.breakpointDefs.values()) {
      if (!this.claimsAddress(bp, address)) continue;

      const bpFlags = this.collectBpFlags(bp);
      extra |= bpFlags & (PART_BP | HIT_BP);
      for (const [kind] of DebugSupport.FLAG_KINDS) {
        if (!(bpFlags & kind)) continue;
        present |= kind;
        if (!bp.disabled) armed |= kind;
      }
    }

    let flags = extra | present;
    for (const [kind, disabledBit] of DebugSupport.FLAG_KINDS) {
      if (present & kind && !(armed & kind)) flags |= disabledBit;
    }
    this.breakpointFlags[address] = flags;
  }

  /** Does this breakpoint put flags on `address`? */
  private claimsAddress(bp: BreakpointInfo, address: number): boolean {
    if (bp.ioRead || bp.ioWrite) {
      // --- A port breakpoint claims every address the mask leaves matching its port.
      return (address & (bp.ioMask ?? 0xffff)) === bp.address;
    }
    const site = effectiveBankSite(bp);
    if (site) {
      // --- All eight addresses its bank could be paged to, the same ones `armBankRelative` set.
      return bankRelativeAddresses(site.bankOffset).includes(address);
    }
    return (bp.address ?? bp.resolvedAddress) === address;
  }

  /**
   * Is a **session-owned** breakpoint armed at `address`?
   *
   * Derived from the definitions rather than cached: a cache would have to be invalidated at every
   * one of the eleven places the definitions change, including `enableBreakpoint` and the resource
   * renames, and a missed one fails in the worst possible direction — a breakpoint that silently
   * stops mattering. The scan is affordable because it runs only while `suppressUserBreakpoints`
   * is set (the few seconds of a launch flow) *and* only at an address whose flags already say a
   * breakpoint is there.
   *
   * The address test mirrors how each shape was armed: a bank-relative breakpoint occupies all
   * eight addresses its bank could be paged to, so any of them counts. The bank itself is not
   * checked here — `shouldStopAt` goes on to do the partition test for real, and this predicate
   * only decides whether it is allowed to.
   */
  private hasSessionStopAt(address: number): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (bp.owner?.kind !== "session" || bp.disabled) continue;
      const site = effectiveBankSite(bp);
      if (site) {
        if (bankRelativeAddresses(site.bankOffset).includes(address)) return true;
        continue;
      }
      if ((bp.address ?? bp.resolvedAddress) === address) return true;
    }
    return false;
  }

  /**
   * Record that `partition` has a breakpoint at `address`, tagged with its provenance.
   *
   * Deduplicates on partition *and* tag, so a bank-relative breakpoint and a user's own
   * partition-scoped one can coexist at the same address and partition, and each can be removed
   * without disturbing the other.
   */
  private addPartitionEntry(
    address: number,
    partition: number,
    owningKey?: string,
    disabled = false
  ): void {
    let bpData = this.breakpointData.get(address);
    if (!bpData) {
      bpData = {};
      this.breakpointData.set(address, bpData);
    }
    bpData.partitions ??= [];
    if (!bpData.partitions.some((p) => p[0] === partition && p[2] === owningKey)) {
      // --- `disabled` was hardcoded `false` here, so a partition-scoped or bank-relative
      // --- breakpoint *added* disabled came out armed. Every caller happened to work around it by
      // --- calling `enableBreakpoint` afterwards — `applyBreakpointEdit` and `resetBreakpointsTo`
      // --- both do, and both say in a comment that they have to — so the flags and the definition
      // --- only agreed by way of a second call that could be forgotten.
      bpData.partitions.push([partition, disabled, owningKey]);
    }
  }

  /**
   * Drop the untagged partition entry for `partition` at `address`.
   *
   * Untagged only: a tagged entry belongs to a bank-relative breakpoint, which owns its own
   * lifetime through `disarmBankRelative`. The two can share an address *and* a partition, so
   * matching on the partition alone would disarm someone else's breakpoint.
   */
  private removeUntaggedPartitionEntry(address: number, partition: number): void {
    const bpData = this.breakpointData.get(address);
    if (!bpData?.partitions) return;

    bpData.partitions = bpData.partitions.filter(
      (p) => !(p[0] === partition && p[2] === undefined)
    );
    if (bpData.partitions.length === 0 && !(this.breakpointFlags[address] & HIT_BP)) {
      this.breakpointData.delete(address);
    }
  }

  /**
   * Arm a bank-relative breakpoint: the same flags at all eight addresses its bank could appear at,
   * each carrying the 8K partition the bank's offset resolves to.
   *
   * Flags are OR-ed rather than assigned, so arming one breakpoint cannot clear another's at a
   * shared address.
   */
  private armBankRelative(bp: BreakpointInfo, bpFlags: number): void {
    // --- The *effective* site: stated by the breakpoint, or filled in by resolution for a
    // --- label-anchored one. The arming cannot tell the difference, and must not.
    const site = effectiveBankSite(bp)!;
    const partition = bankRelativePartition(site.bank, site.bankOffset);
    const owningKey = getBreakpointStorageKey(bp);
    for (const address of bankRelativeAddresses(site.bankOffset)) {
      this.breakpointFlags[address] |= bpFlags;
      this.addPartitionEntry(address, partition, owningKey, !!bp.disabled);
    }
  }

  /** Drop a bank-relative breakpoint's own entries and flags from all eight of its addresses. */
  private disarmBankRelative(bp: BreakpointInfo, bpFlags: number): void {
    const owningKey = getBreakpointStorageKey(bp);
    for (const address of bankRelativeAddresses(effectiveBankSite(bp)!.bankOffset)) {
      const bpData = this.breakpointData.get(address);
      if (bpData?.partitions) {
        bpData.partitions = bpData.partitions.filter((p) => p[2] !== owningKey);
        if (bpData.partitions.length === 0) {
          this.breakpointFlags[address] &= ~(bpFlags | PART_BP);
          if (!(this.breakpointFlags[address] & HIT_BP)) {
            this.breakpointData.delete(address);
          }
        }
      }
    }
  }

  // --- Get the breakpoint flags from the definition
  private collectBpFlags(bp: BreakpointInfo): number {
    // --- Collect breakpoint flags
    let bpFlags = 0x00;
    // --- `EXEC_BP` means "fires whatever is paged in here", so it must be withheld from any
    // --- breakpoint that carries a partition — a bank-relative one included, whose partition is
    // --- derived from its bank and offset rather than stated.
    const bankRelative = isBankRelative(bp);
    if (
      bp.exec &&
      !bankRelative &&
      bp.partition === undefined &&
      bp.resolvedPartition === undefined
    ) {
      bpFlags |= EXEC_BP;
      if (bp.disabled) {
        bpFlags |= DIS_EXEC_BP;
      }
    }
    /*
     * `resolvedPartition` counts, not just `partition`.
     *
     * The test above already withholds `EXEC_BP` for a resolved partition, but this one did not
     * grant `PART_BP` for it — so a breakpoint carrying only a *resolved* partition came out with
     * no execution flag of either kind and could never fire. It went unnoticed because
     * `resolvedPartition` was read in five places and written in none until source breakpoints
     * started carrying their `.bank`'s partition (§13.4); `resolveBreakpoint` hardcoded `EXEC_BP`
     * and so never consulted this.
     */
    if (bp.partition !== undefined || bp.resolvedPartition !== undefined || bankRelative) {
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
  /**
   * The partitions with a breakpoint at this address: `[partition, disabled, owningKey?]`.
   *
   * Positions 0 and 1 are unchanged, which is what keeps the per-instruction test in `shouldStopAt`
   * — `partitions.find((p) => p[0] === partition)` and `p[1]` — untouched.
   *
   * The third element is the storage key of the **bank-relative** breakpoint that contributed the
   * entry, and is absent for a user's own `bp-set <partition>:<address>`. It exists because one
   * bank-relative breakpoint arms eight addresses, and at any of them a user breakpoint may already
   * claim the same partition; without the tag, removing one would remove the other's entry too.
   */
  partitions?: [number, boolean, string?][];
};
