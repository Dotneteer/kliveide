/**
 * This class represents the state of the machine controller.
 */
export enum MachineControllerState {
  /**
   * The machine controller has just been initialized.
   */
  None = 0,

  /**
   * The machine has started and is running.
   */
  Running,

  /**
   * The controller is about to pause the machine.
   */
  Pausing,

  /**
   * The controller has paused the machine.
   */
  Paused,

  /**
   * The controller is about to stop the machine.
   */
  Stopping,

  /**
   * The controller has stopped the machine.
   */
  Stopped
}
