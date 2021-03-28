import { AppWindow } from "./AppWindow";

/**
 * Represents the singleton emulator window
 */
export class EmuWindow extends AppWindow {
  /**
   * Initializes the window instance
   */
  constructor() {
    super();
    EmuWindow.instance = this;
  }

  get contentFile(): string {
    return "emu-index.html";
  }

  /**
   * The file to store the window state
   */
  get stateFile(): string {
    return "emu-window-state.json";
  }

  // ==========================================================================
  // Static members

  /**
   * Now, we allow only a singleton instance
   */
  static instance: EmuWindow;
}
