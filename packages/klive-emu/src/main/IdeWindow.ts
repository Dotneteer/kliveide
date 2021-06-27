import { AppWindow } from "./AppWindow";
import { mainStore } from "./mainStore";
import { ideHideAction } from "../shared/state/show-ide-reducer";
import { setIdeMessenger } from "./app-menu-state";
import { MainToIdeMessenger } from "./MainToIdeMessenger";
import { Activity } from "../shared/activity/Activity";
import {
  changeActivityAction,
  setActivitiesAction,
} from "../shared/state/activity-bar-reducer";
import { ideFocusAction } from "../shared/state/ide-focus-reducer";

/**
 * Represents the singleton IDE window
 */
export class IdeWindow extends AppWindow {
  // --- The available activities
  private _activities: Activity[] | null;

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
    // this.setupActivityBar();
    // mainStore.dispatch(setActivitiesAction(this._activities));
    // mainStore.dispatch(changeActivityAction(0));
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

  // /**
  //  * Sets up the initial activity bar.
  //  */
  // setupActivityBar(): void {
  //   this._activities = [
  //     {
  //       id: "file-view",
  //       title: "Explorer",
  //       iconName: "files",
  //     },
  //     {
  //       id: "debug-view",
  //       title: "Run and debug",
  //       iconName: "debug-alt",
  //     },
  //     {
  //       id: "log-view",
  //       title: "Machine logs",
  //       iconName: "output",
  //     },
  //     {
  //       id: "test-view",
  //       title: "Testing",
  //       iconName: "beaker",
  //     },
  //     {
  //       id: "settings",
  //       title: "Manage",
  //       iconName: "settings-gear",
  //       isSystemActivity: true,
  //     },
  //   ];
  // }
}
