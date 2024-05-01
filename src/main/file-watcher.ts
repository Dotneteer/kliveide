import fs from "fs";
import { FSWatcher } from "original-fs";
import { mainStore } from "./main-store";
import { AppState } from "../common/state/AppState";
import { Store } from "../common/state/redux-light";
import { incExploreViewVersionAction } from "../common/state/actions";

class FileChangeWatcher {
  private _watcher: FSWatcher | null = null;

  constructor (private readonly store: Store<AppState>) {}

  /**
   * Start watching the changes in the specified folder
   * @param folder Folder to watch
   */
  startWatching (folder: string): void {
    if (this._watcher) {
      this._watcher.close();
    }
    this._watcher = fs.watch(folder, {
      recursive: true,
      persistent: true
    }, (event) => {
      if (event === "rename") {
        this.store.dispatch(incExploreViewVersionAction(), "main");
      }
    });
  }

  stopWatching (): void {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
  }
}

export const fileChangeWatcher = new FileChangeWatcher(mainStore);
