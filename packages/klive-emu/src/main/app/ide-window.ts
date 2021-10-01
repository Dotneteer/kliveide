import { AppWindow } from "./app-window";
import { ideFocusAction } from "@state/ide-focus-reducer";
import { MainToIdeMessenger } from "../communication/MainToIdeMessenger";
import { dispatch } from "../main-state/main-store";
import { registerMainToIdeMessenger } from "@messaging/message-sending";
import { executeKliveCommand } from "@shared/command/common-commands";

/**
 * Represents the singleton IDE window
 */
export class IdeWindow extends AppWindow {
  allowClose = false;
  /**
   * Initializes the window instance
   */
  constructor() {
    super(false);
    registerMainToIdeMessenger(new MainToIdeMessenger(this.window));
    this.window.on("close", (e) => {
      if (this.allowClose) {
        return;
      }
      executeKliveCommand("hideIde");
      e.preventDefault();
    });
    this.allowClose = false;
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

  /**
   * The window receives the focus
   */
  onFocus() {
    super.onFocus();
    dispatch(ideFocusAction(true));
  }

  /**
   * The window loses the focus
   */
  onBlur() {
    super.onBlur();
    dispatch(ideFocusAction(false));
  }
}
