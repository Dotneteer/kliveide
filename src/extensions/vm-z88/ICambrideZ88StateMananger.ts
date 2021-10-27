import { AppState } from "@state/AppState";

/**
 * Defines the responsibilities of a state manager for a Cambridge Z88
 * derived virtual machine
 */
export interface ICambridgeZ88StateManager {
  /**
   * Gets the current state
   */
  getState(): AppState;
}
