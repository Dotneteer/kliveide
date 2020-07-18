/**
 * This class represents the states of the virtual machine as
 * managed by the SpectrumVmController
 */
export enum ExecutionState {
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
export class ExecutionStateChangedArgs {
  /**
   * Initializes the event arguments
   * @param oldState Old virtual machine state
   * @param newState New virtual machione state
   */
  constructor(public oldState: ExecutionState, public newState: ExecutionState) {}
}
