import { AppState } from "@state/AppState";

/**
 * Defines the responsibilities of a state manager for a ZxSpectrumBase
 * derived virtual machine
 */
export interface IZxSpectrumStateManager {
  /**
   * Gets the current state
   */
  getState(): AppState;

  /**
   * Sets the tape contents
   * @param contents Tape contents
   */
  setTapeContents(contents: Uint8Array): void;

  /**
   * Emulator panel message on the UI
   * @param message Panel message
   */
  setPanelMessage(message: string): void;

  /**
   * Sets the current load mode
   * @param isLoad Is in load mode?
   */
  setLoadMode(isLoad: boolean): void;

  /**
   * Initiates the loading of the tape
   */
  initiateTapeLoading(): void;
}
