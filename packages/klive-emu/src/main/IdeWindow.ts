import { AppWindow } from "./AppWindow";
import { mainStore } from "./mainStore";
import { ideHideAction } from "../shared/state/show-ide-reducer";
import { setIdeMessenger } from "./app-menu-state";
import { MainToIdeMessenger } from "./MainToIdeMessenger";
import { ideFocusAction } from "../shared/state/ide-focus-reducer";

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
    setIdeMessenger(new MainToIdeMessenger(this.window));
    this.window.on("close", (e) => {
      if (this.allowClose) {
        return;
      }
      mainStore.dispatch(ideHideAction());
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
    mainStore.dispatch(ideFocusAction(true));
  }

  /**
   * The window loses the focus
   */
  onBlur() {
    super.onBlur();
    mainStore.dispatch(ideFocusAction(false));
  }
}
