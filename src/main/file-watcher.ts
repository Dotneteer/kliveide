import fs from "fs";
import { FSWatcher } from "original-fs";
import { mainStore } from "./main-store";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { incExploreViewVersionAction } from "@state/actions";

class FileChangeWatcher {
  private _watcher: FSWatcher | null = null;

  constructor(private readonly store: Store<AppState>) {}

  /**
   * Start watching the changes in the specified folder
   * @param folder Folder to watch
   */
  startWatching(folder: string): void {
    if (this._watcher) {
      this._watcher.close();
    }
    this._watcher = fs.watch(
      folder,
      {
        recursive: true,
        persistent: true
      },
      (event, filename) => {
        // --- A .bas rewritten in place may have changed between source text and a tokenised HT-1080Z
        // --- program: the refreshed tree sniffs it again (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D2)
        if (event === "rename" || (event === "change" && /\.bas$/i.test(String(filename ?? "")))) {
          this.store.dispatch(incExploreViewVersionAction(), "main");
        }
      }
    );
  }

  stopWatching(): void {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
  }
}

export const fileChangeWatcher = new FileChangeWatcher(mainStore);
