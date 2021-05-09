import { AppWindow } from "./AppWindow";
import { mainStore } from "./mainStore";
import { ideHideAction } from "../shared/state/show-ide-reducer";
import { setIdeMessenger } from "./app-menu-state";
import { MainToIdeMessenger } from "./MainToIdeMessenger";
import { Activity } from "../shared/activity/Activity";
import { setActivitiesAction } from "../shared/state/activity-bar-reducer";

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
    this.setupActivityBar();
    mainStore.dispatch(setActivitiesAction(this._activities));
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
   * Sets up the initial activity bar.
   */
  setupActivityBar(): void {
    this._activities = [
      {
        id: "file-view",
        iconName: "files",
      },
      {
        id: "debug-view",
        iconName: "debug-alt",
      },
      {
        id: "test-view",
        iconName: "beaker",
      },
      {
        id: "settings",
        iconName: "settings-gear",
        isSystemActivity: true,
      },
    ];
  }
}
