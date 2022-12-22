/**
 * This type defines the execution context in which an emulated machine can run its execution loop.
 */
export type ExecutionContext = {
    /**
     * This property defines how the machine's execution loop completes.
     */
    frameTerminationMode: FrameTerminationMode;

    /**
     * This property defines how the machine execution loop should handle the debug mode.
     */
    debugStepMode: DebugStepMode;

    /**
     * The optional termination partition, at which the execution loop should stop when it is in the
     * UntilExecutionPoint loop termination mode. For example, in the case of ZX Spectrum 48K, this property has no
     * meaning. For ZX Spectrum 128K (and above), this value may be the current ROM index.
     */
    terminationPartition?: number;

    /**
     * This optional 16-bit value defines the PC value that is considered the termination point, provided the
     * execution loop is in the UntilExecutionPoint loop termination mode.
     */
    terminationPoint?: number;

    /**
     * This property describes the termination reason of the last machine execution loop. It returns null if the
     * execution loop has not been started at least once.
     */
    lastTerminationReason?: FrameTerminationMode;

    /**
     * Has the last execution loop cancelled?
     */
    canceled: boolean;
    
    /**
     * The object that provides debug support for the machone
     */
    debugSupport?: IDebugSupport;
}

/**
 * This enum defines the termination condition for the machine frame.
 */
export enum FrameTerminationMode
{
    /**
     * Normal mode: the frame terminates when the current frame completes.
     */
    Normal = 0,

    /**
     * The execution completes when a debugger event occurs (e.g., stopping at a breakpoint).
     */
    DebugEvent,

    /**
     * The execution completes when the current PC address (and an optional memory partition) reaches a specified termination point.
     */
    UntilExecutionPoint,
}

/**
 * This enum defines how the machine execution loop should behave in debug mode.
 */
export enum DebugStepMode {
    /**
     * The debug mode is turned off, the machine should ignore breakpoints.
     */
    NoDebug = 0,

    /**
     * The execution loop should terminate as soon as it reaches an active breakpoint.
     */
    StopAtBreakpoint,

    /**
     * The execution loop should stop after completing the subsequent CPU instruction.
     */
    StepInto,

    /**
     * The execution loop should stop after the PC reaches the address of subsequent CPU instruction. If the current
     * instruction is a subroutine call, the execution stops when the subroutine returns. If the instruction is a
     * block instruction, the execution stops when the block completes. Should the instruction be a HALT, the loop
     * terminates as the CPU gets out of the halted mode.
     */
    StepOver,

    /**
     * The execution loop stops after the first RET instruction (conditional or unconditional) when it returns to its caller.
     */
    StepOut
}

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
     * The list of current breakpoints
     */
    breakpoints: BreakpointInfo[];
    
    /**
     * The last breakpoint we stopped in the frame
     */
    lastBreakpoint?: number;
    
    /**
     * Breakpoint used for step-out debugging mode
     */
    imminentBreakpoint?: number;
}

/**
 * Represents a breakpoint
 */
export type BreakpointInfo = {
    /**
     * Breakpoint address
     */
    address: number;
    
    /**
     * Optional partition (reserved for future use)
     */
    partition?: number;

    /**
     * Indicates an execution breakpoint
     */
    exec?: boolean;

    /**
     * Indicates a memory read breakpoint
     */
    memoryRead?: boolean;
    
    /**
     * Indicates a memory write breakpoint
     */
    memoryWrite?: boolean;

    /**
     * Indicates an I/O read breakpoint
     */
    ioRead?: boolean;

    /**
     * Indicates an I/O write breakpoint
     */
    ioWrite?: boolean;

    /**
     * Optional Disassembly
     */
    disassembly?: string;
}