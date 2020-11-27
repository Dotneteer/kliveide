/**
 * Defines the responsibilities of a state manager for a ZxSpectrumBase
 * derived virtual machine
 */
export interface IZxSpectrumBaseStateManager {
  /**
   * Gets the current state
   */
  getState(): any;

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
   * Selects the specified ROM
   * @param rom ROM index
   */
  selectRom(rom: number): void;

  /**
   * Selects the specified RAM Bank
   * @param bank RAM bank index
   */
  selectBank(bank: number): void;

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
