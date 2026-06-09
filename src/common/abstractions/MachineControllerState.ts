/**
 * Represents the lifecycle state of the machine controller.
 */
export enum MachineControllerState {
  None = 0,
  Running,
  Pausing,
  Paused,
  Stopping,
  Stopped
}
