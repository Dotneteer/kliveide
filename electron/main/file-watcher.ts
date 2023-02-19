import * as fs from "fs";
import { FSWatcher } from "original-fs";

class FileChangeWatcher {
  private _watcher: FSWatcher | null = null;

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
    }, (event, filename) => {
      console.log(event, filename);
    });
  }

  stopWatching (): void {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
  }
}

export const fileChangeWatcher = new FileChangeWatcher();
