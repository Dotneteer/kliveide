/**
 * Defines the responsibilities of a state manager for a Cambridge Z88
 * derived virtual machine
 */
export interface ICambridgeZ88BaseStateManager {
  /**
   * Gets the current state
   */
  getState(): any;
}
