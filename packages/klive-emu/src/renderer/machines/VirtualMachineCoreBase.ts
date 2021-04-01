import { IVmController } from "./IVmController";
import {
  ExecuteCycleOptions,
  MachineCoreState,
  MachineCreationOptions,
  MachineSetupOptions,
  MachineState,
} from "./vm-core-types";

/**
 * Represents the core abstraction of a virtual machine.
 *
 * Provides all operations that implements the machine execution
 * loop.
 */
export abstract class VirtualMachineCoreBase {
  private _coreState: MachineCoreState;
  private _controller: IVmController;

  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(protected readonly options: MachineCreationOptions) {}

  /**
   * Attaches this machine core to a controller
   * @param controller Controller instance
   */
  attachToController(controller: IVmController): void {
    this._controller = controller;
  }

  /**
   * Gets the unique model identifier of the machine
   */
  abstract get modelId(): string;

  /**
   * Gets a unique identifier for the particular configuration of the model
   */
  abstract get configurationId(): string;

  /**
   * Friendly name to display
   */
  abstract readonly displayName: string;

  /**
   * Override this property to apply multiple engine loops before
   * Refreshing the UI.
   */
  readonly engineLoops: number = 1;

  /**
   * The current state of the machine core
   */
  get coreState(): MachineCoreState {
    return this._coreState;
  }

  /**
   * Sets up the machine with the specified options
   * @param options Machine options to use for the setup
   *
   * Sets the core state to `Configured`
   */
  setupMachine(options: MachineSetupOptions): void {
    // TODO: Implement this method
  }

  /**
   * Executes the hard reset, as if the nachine has been turned
   * off, and then tuned on. Clears volatile memory.
   */
  turnOn(): void {
    // TODO: Implement this method
  }

  /**
   * Executes soft reset. Uses the hardware's reset signal, generally
   * keeps the state of the volatile memory.
   */
  reset(): void {
    // TODO: Implement this method
  }

  /**
   * Represents the state of the machine, including the CPU, memory, and machine
   * devices
   */
  getMachineState(): MachineState {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Sets the status of the specified key on the keyboard
   * @param key Code of the key
   * @param isDown Pressed/released status of the key
   */
  setKeyStatus(key: number, isDown: boolean): void {
    // TODO: Implement this method
  }

  /**
   * Sets the audio sample rate to use with sound devices
   * @param rate Audio sampe rate to use
   */
  setAudioSampleRate(rate: number): void {
    // TODO: Implement this method
  }

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array {
    // TODO: Implement this method
    throw new Error("Not implemented yet");
  }

  /**
   * Executes a single machine frame
   * @param _options Execution options
   */
  executeFrame(_options: ExecuteCycleOptions): void {
    // TODO: Implement this method
  }

  // ==========================================================================
  // Lifecycle methods

  /**
   * Override this method to define actions when the virtual machine is started
   * from stopped state
   */
  async beforeFirstStart(): Promise<void> {}

  /**
   * Override this method to define an action before the virtual machine has
   * started.
   * @param _debugging Is started in debug mode?
   */
  async beforeStarted(_debugging: boolean): Promise<void> {}

  /**
   * Override this method to define an action after the virtual machine has
   * started.
   * @param _debugging Is started in debug mode?
   * @param _isFirstStart Is the machine started from stopped state?
   */
  async afterStarted(_debugging: boolean): Promise<void> {}

  /**
   * Override this action to define an action when the virtual machine
   * has paused.
   * @param _isFirstPause Is the machine paused the first time?
   */
  async onPaused(_isFirstPause: boolean): Promise<void> {}

  /**
   * Override this action to define an action when the virtual machine
   * has stopped.
   */
  async onStopped(): Promise<void> {}

  /**
   * Override this action to define an action before the step-into
   * operation is executed.
   */
  async beforeStepInto(): Promise<void> {}

  /**
   * Override this action to define an action before the step-over
   * operation is executed.
   */
  async beforeStepOver(): Promise<void> {}

  /**
   * Override this action to define an action before the step-out
   * operation is executed.
   */
  async beforeStepOut(): Promise<void> {}

  /**
   * Override this method in derived classes to define an action when
   * the machine's execution cycle has completed.
   * @param _resultState Machine state on loop completion
   */
  async onEngineCycleCompletion(_resultState: MachineState): Promise<void> {}

  /**
   * Override this method in derived classes to define an action when
   * the UI loop waits for loop state evaluations (whether to continue the
   * cycle of not).
   * @param _resultState Machine state on loop completion
   */
  async beforeEvalLoopCompletion(_resultState: MachineState): Promise<void> {}

  /**
   * Override this method to define an action when the execution cycle has
   * completed after the loop evaluation.
   * @param _resultState Machine state on cycle completion
   */
  async onExecutionCycleCompleted(_resultState: MachineState): Promise<void> {}

  /**
   * Override this method to define an action when an entire frame has been
   * completed within the machine execution cycle.
   * @param _resultState Machine state on frame completion
   * @param _toWait Number of milliseconds to wait for the next frame
   */
  async onFrameCompleted(
    _resultState: MachineState,
    _toWait: number
  ): Promise<void> {}
}
