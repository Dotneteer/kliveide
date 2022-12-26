import { BreakpointInfo, IDebugSupport } from "../abstractions/ExecutionContext";
import { ILiteEvent, LiteEvent } from "../utils/lite-event";

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
     * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
     * instruction of a program.
     */
    lastStartupBreakpoint?: number;

    /**
     * The list of current execution breakpoints
     */
    get execBreakpoints(): BreakpointInfo[] {
        return Array.from(this._execBps.values());
    }

    /**
     * Gets execution breakpoint information for the specified address/partition
     * @param address Breakpoint address
     * @param partition Breakpoint partition
     */
    getExecBreakpoint(address: number, partition?: number): BreakpointInfo {
        return this._execBps.get(getBpKey(address, partition));
    }

    /**
     * The list of current memory operation breakpoints
     */
    get memoryBreakpoints(): BreakpointInfo[] {
        return Array.from(this._memoryBps.values());
    }
    
    /**
     * Gets memory breakpoint information for the specified address/partition
     * @param address Breakpoint address
     * @param partition Breakpoint partition
     */
    getMemoryBreakpoint(address: number, partition?: number): BreakpointInfo {
        return this._memoryBps.get(getBpKey(address, partition));
    }

    /**
     * The list of current I/O operation breakpoints
     */
    get ioBreakpoints(): BreakpointInfo[] {
        return Array.from(this._ioBps);
    }
    
    /**
     * Gets I/O breakpoint information for the specified port address
     * @param address Breakpoint address
     * @param partition Breakpoint partition
     */
    getIoBreakpoint(address: number): BreakpointInfo {
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
    eraseAllBreakpoints(): void {
        throw new Error("Method not implemented.");
    }

    /**
     * Adds a breakpoint to the list of existing ones
     * @param breakpoint Breakpoint information
     * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
     */
    addBreakpoint(breakpoint: BreakpointInfo): boolean {
        throw new Error("Method not implemented.");
    }

    /**
     * Removes a breakpoint
     * @param address Breakpoint address
     * @returns True, if the breakpoint has just been removed; otherwise, false
     */
    removeBreakpoint(address: number): boolean {
        throw new Error("Method not implemented.");
    }
    
    /**
     * This event fires when execution breakpoints have been changed
     */
    execBreakpointsChanged: ILiteEvent = new LiteEvent();
    
    /**
     * This event fires when memory breakpoints have been changed
     */
    memoryBreakpointsChanged: ILiteEvent = new LiteEvent();
    
    /**
     * This event fires when I/O breakpoints have been changed
     */
    ioBreakpointsChanged: ILiteEvent = new LiteEvent();

}

/**
 * Gets the storage key for the specified address and partition
 */
function getBpKey(address: number, partition?: number): string {
    return partition !== undefined
        ? `${partition.toString(16)}:${address.toString(16).padStart(4, "0")}`
        : `${address.toString(16).padStart(4, "0")}`;
}