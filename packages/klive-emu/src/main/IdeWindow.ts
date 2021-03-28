import { AppWindow } from "./AppWindow";

/**
 * Represents the singleton IDE window
 */
export class IdeWindow extends AppWindow {
  /**
   * Initializes the window instance
   */
  constructor() {
    super();
    IdeWindow.instance = this;
  }

  get contentFile(): string {
    return "ide-index.html";
  }

  /**
   * The file to store the window state
   */
  get stateFile(): string {
    return "ide-window-state.json";
  }

  // ==========================================================================
  // Static members

  /**
   * Now, we allow only a singleton instance
   */
  static instance: IdeWindow;
}
