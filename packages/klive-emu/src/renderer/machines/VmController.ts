import { IVmController } from "./IVmController";
import { VirtualMachineCoreBase } from "./VirtualMachineCoreBase";
import {
  ExecuteCycleOptions,
  ExecutionCompletionReason,
} from "./vm-core-types";

/**
 * This class controls the core of a virtual machine. It also takes the
 * responsibility for binding the machine core with the emulator UI.
 */
export class VmController implements IVmController {
  // --- Current controller state
  private _vmState: VmState = VmState.None;
  private _cancelled: boolean = false;
  private _isFirstPause: boolean = false;

  /**
   * Initializes this engine with the specified machine core
   * @param machineCore
   */
  constructor(public readonly machineCore: VirtualMachineCoreBase) {}

  /**
   * Signs that the screen has been refreshed
   */
  signScreenRefreshed(): void {
    // TODO: Implement this method
  }

  /**
   * Waits while the execution cycle terminates
   */
  async waitForCycleTermination(): Promise<boolean> {
    // TODO: Implement this method
    return false;
  }

  /**
   * Puts a keystroke into the queue of emulated keystrokes and delays it
   * @param primary Primary key
   * @param secodary Optional secondary key
   * @param ternaryKey Optional ternary key
   */
  async delayKey(
    primaryKey: number,
    secondaryKey?: number,
    ternaryKey?: number
  ): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Gets the current UI message
   */
  getUiMessage(): string | null {
    // TODO: Implement this method
    return null;
  }

  /**
   * Sets a UI message to display
   * @param message Message to display
   */
  setUiMessage(message: string | null): void {
    // TODO: Implement this method
  }

  /**
   * Width of the screen
   */
  get screenWidth(): number {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Height of the screen
   */
  get screenHeight(): number {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Get the type of the keyboard to display
   */
  get keyboardType(): string {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * The current state of the virtual machine
   */
  get executionState(): VmState {
    return this._vmState;
  }
  set executionState(newState: VmState) {
    const oldState = this._vmState;
    this._vmState = newState;
    // TODO: Change the system state accordingly
  }

  /**
   * Puts a keystroke into the queue of emulated keystrokes
   * @param startFrame Start frame when the key is pressed
   * @param frames End frame when the key is released
   * @param primary Primary key
   * @param secodary Optional secondary key
   * @param ternaryKey Optional ternary key
   */
  queueKeyStroke(
    startFrame: number,
    frames: number,
    primaryKey: number,
    secondaryKey?: number,
    ternaryKey?: number
  ): void {
    // TODO: Implement this method
  }

  /**
   * Emulates the next keystroke waiting in the queue
   * @param frame Current screen frame
   */
  emulateKeyStroke(frame: number): void {
    // TODO: Implement this method
  }

  // ==========================================================================
  // Machine control methods

  /**
   * Starts the virtual machine and keeps it running
   * @param options Non-mandatory execution options
   */
  async start(options?: ExecuteCycleOptions): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Starts the virtual machine in debugging mode
   */
  async startDebug(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Pauses the running machine.
   */
  async pause(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Stops the virtual machine
   */
  async stop(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Restarts the virtual machine (hard reset)
   */
  async restart(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Restarts the virtual machine (hard reset)
   */
  async reset(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Starts the virtual machine in step-into mode
   */
  async stepInto(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Starts the virtual machine in step-over mode
   */
  async stepOver(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Starts the virtual machine in step-out mode
   */
  async stepOut(): Promise<void> {
    // TODO: Implement this method
  }

  /**
   * Cancels the execution cycle
   */
  async cancelRun(): Promise<void> {
    // TODO: Implement this method
  }

  // ==========================================================================
  // The execution loop

  /**
   * Executes the cycle of the Spectrum virtual machine
   * @param machine The virtual machine
   * @param options Execution options
   */
  async executeMachineLoop(options: ExecuteCycleOptions): Promise<void> {
    const core = this.machineCore;
    const state = core.getMachineState();
    // --- Store the start time of the frame
    const nextFrameGap =
      (state.tactsInFrame / state.baseClockFrequency) * 1000 * core.engineLoops;
    let nextFrameTime = performance.now() + nextFrameGap;
    let toWait = 0;

    // --- Execute the cycle until completed
    while (true) {
      for (let i = 0; i < core.engineLoops; i++) {
        core.executeFrame(options);
        const resultState = core.getMachineState();
        core.onEngineCycleCompletion(resultState);
        if (
          resultState.executionCompletionReason !==
          ExecutionCompletionReason.FrameCompleted
        ) {
          break;
        }
      }

      const resultState = core.getMachineState();
      // TODO: Save the internal state

      // --- Check for user cancellation
      if (this._cancelled) return;

      // --- Get data
      await core.beforeEvalLoopCompletion(resultState);

      // --- Branch according the completion reason
      const reason = resultState.executionCompletionReason;
      if (reason !== ExecutionCompletionReason.FrameCompleted) {
        // --- No more frame to execute
        if (
          reason === ExecutionCompletionReason.BreakpointReached ||
          reason === ExecutionCompletionReason.TerminationPointReached
        ) {
          this.executionState = VmState.Paused;
          core.onPaused(this._isFirstPause);
        }

        // --- Complete the cycle
        await core.onExecutionCycleCompleted(resultState);
        return;
      }

      // --- Handle key strokes
      this.emulateKeyStroke(resultState.frameCount);

      // --- Let the machine complete the frame
      await core.onFrameCompleted(resultState, toWait);

      // --- Frame time information
      const curTime = performance.now();
      toWait = Math.floor(nextFrameTime - curTime);

      // --- Wait for the next screen frame
      await delay(toWait - 2);
      nextFrameTime += nextFrameGap;

      // TODO: Set the clock multiplier for the next state
    }

    /**
     * Delay for the specified amount of milliseconds
     * @param milliseconds Amount of milliseconds to delay
     */
    function delay(milliseconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        if (milliseconds < 0) {
          milliseconds = 0;
        }
        setTimeout(() => {
          resolve();
        }, milliseconds);
      });
    }
  }
}

/**
 * This class represents the states of the virtual machine as
 * managed by the SpectrumVmController
 */
enum VmState {
  /**
   * The virtual machine has just been created, but has not run yet
   */
  None = 0,

  /**
   * The virtual machine is successfully started
   */
  Running = 1,

  /**
   * The virtual machine is being paused
   */
  Pausing = 2,

  /**
   * The virtual machine has been paused
   */
  Paused = 3,

  /**
   * The virtual machine is being stopped
   */
  Stopping = 4,

  /**
   * The virtual machine has been stopped
   */
  Stopped = 5,
}

/**
 * This class represents the arguments of the event that signs that
 * the state of the virtual machine changes
 */
class VmStateChangedArgs {
  /**
   * Initializes the event arguments
   * @param oldState Old virtual machine state
   * @param newState New virtual machione state
   */
  constructor(
    public oldState: VmState,
    public newState: VmState,
    public isDebug: boolean
  ) {}
}
