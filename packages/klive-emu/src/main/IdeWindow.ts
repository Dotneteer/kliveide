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
  }

  /**
   * The name of the file that provides the window's contents
   */
  get contentFile(): string {
    return "ide-index.html";
  }

  /**
   * The file to store the window state
   */
  get stateFile(): string {
    return "ide-window-state.json";
  }
}
