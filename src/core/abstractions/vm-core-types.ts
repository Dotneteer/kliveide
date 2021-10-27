/**
 * The set of parameters that describe the static (setup-time) options
 * of a virtual machine. While the machine runs, these option cannot
 * be changed
 */
export interface MachineSetupOptions {
  /**
   * The frequency of the clock used as a base for running the hardware.
   * Generally, it is the clock frequency of the CPU.
   */
  baseClockFrequency: number;

  /**
   * The length of a machine cycle frame, given in cpu clock tacts assuming
   * normal frequency.
   */
  tactsInFrame: number;

  /**
   * Optional firmware contents
   */
  firmware?: Uint8Array[];
}

/**
 * Options to create a machine
 */
export type MachineCreationOptions = MachineSetupOptions & Record<string, any>;

/**
 * States of the virtual machine core
 *  |--> WaitForSetup --> Configured --> TurnedOn -->|
 *  |<-----------------------------------------------|
 */
export enum MachineCoreState {
  /**
   * Instantiated but not configured yet
   */
  WaitForSetup = 0,

  /**
   * Configured, ready to turn on
   */
  Configured,

  /**
   * The machine is turned on
   */
  TurnedOn,
}

/**
 * This enumeration defines how the machine execution loop should work
 */
export enum EmulationMode {
  /**
   * Run the virtual machine in debugger mode
   */
  Debugger = 0,

  /**
   * Run the VM until the CPU is halted
   */
  UntilHalt = 1,

  /**
   * Run the CPU until the current frame ends
   */
  UntilFrameEnds = 2,

  /**
   * Run the CPU until a specified execution point is reached
   */
  UntilExecutionPoint = 3,
}

/**
 * The mode the execution cycle should run in debug mode
 */
export enum DebugStepMode {
  /**
   * Do not use debugger
   */
  None = 0,

  /**
   * Execution stops at the next breakpoint
   */
  StopAtBreakpoint = 1,

  /**
   * Execution stops after the next instruction
   */
  StepInto = 2,

  /**
   * Execution stops after the next instruction. If that should
   * be a subroutine call, the execution stops after returning
   * from the subroutine.
   */
  StepOver = 3,

  /**
   * Execution stops after the first RET (unconditional or conditional)
   * returns from the latest subroutine call.
   */
  StepOut = 4,
}

/**
 * This class provides options for the ExecuteCycle function.
 */
export class ExecuteCycleOptions {
  constructor(
    /**
     * Emulation mode to use
     */
    public emulationMode: EmulationMode = EmulationMode.UntilFrameEnds,

    /**
     * Debug step mode to use
     */
    public debugStepMode: DebugStepMode = DebugStepMode.None,

    /**
     * Partition address of the termination point
     */
    public terminationPartition: number = -1,

    /**
     * Address of the termination point
     */
    public terminationAddress: number = -1,

    /**
     * Optional step-over breakpoint
     */
    public stepOverBreakpoint = -1
  ) {}
}

/**
 * This enumeration tells the reason why the execution cycle
 * of the virtual machine completed.
 */
export enum ExecutionCompletionReason {
  /**
   * The machine is still executing
   */
  None = 0,

  /**
   * CPU reached the specified termination point
   */
  TerminationPointReached = 1,

  /**
   * CPU reached any of the specified breakpoints
   */
  BreakpointReached = 2,

  /**
   * CPU reached a HALTed state
   */
  Halted = 3,

  /**
   * The current screen rendering frame has been completed
   */
  FrameCompleted = 4,
}

/**
 * Represents the state of the machine
 */
export interface MachineState {
  /**
   * The frequency of the clock used as a base for running the hardware.
   * Generally, it is the clock frequency of the CPU.
   */
  baseClockFrequency: number;

  /**
   * The length of a machine cycle frame, given in cpu clock tacts assuming
   * normal frequency.
   */
  tactsInFrame: number;

  /**
   * Number of frames executed since the machine has been turned on
   */
  frameCount: number;

  /**
   * Has the last frame just completed?
   */
  frameCompleted: boolean;

  /**
   * The last rendered frame tact
   */
  lastRenderedFrameTact: number;

  /**
   * The completion reason of the last frame
   */
  executionCompletionReason: number;

  /**
   * Width of the screen
   */
  screenWidth: number;

  /**
   * Height of the screen
   */
  screenHeight: number;
}

/**
 * This enum defines the run modes the Z80TestMachine allows
 */
export enum RunMode {
  // Run while the machine is disposed or a break signal arrives.
  Normal = 0,

  // Pause when the next single instruction is executed.
  OneInstruction = 1,

  // Run until a HALT instruction is reached.
  UntilHalt = 2,

  // Run until the whole injected code is executed
  UntilEnd = 3,
}

/**
 * Defines the services of a virtual machine controller.
 * The virtual machines can access this controller.
 */
 export interface IVmControllerService {
  /**
   * Starts the virtual machine and keeps it running
   * @param options Non-mandatory execution options
   */
  start(options?: ExecuteCycleOptions): Promise<void>;

  /**
   * Starts the virtual machine in debugging mode
   */
  startDebug(): Promise<void>;

  /**
   * Pauses the running machine.
   */
  pause(): Promise<void>;

  /**
   * Stops the virtual machine
   */
  stop(): Promise<void>;

  /**
   * Restarts the virtual machine
   */
  restart(): Promise<void>;

  /**
   * Starts the virtual machine in step-into mode
   */
  stepInto(): Promise<void>;

  /**
   * Starts the virtual machine in step-over mode
   */
  stepOver(): Promise<void>;

  /**
   * Starts the virtual machine in step-out mode
   */
  stepOut(): Promise<void>;

  /**
   * Cancels the execution cycle
   */
  cancelRun(): Promise<void>;
}


