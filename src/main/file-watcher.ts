import fs from "fs";
import * as path from "path";
import { FSWatcher } from "original-fs";
import { BrowserWindow } from "electron";
import { mainStore } from "./main-store";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { incExploreViewVersionAction } from "@state/actions";

class FileChangeWatcher {
  private _watcher: FSWatcher | null = null;
  private _fileWatchers: Map<string, FSWatcher> = new Map();
  private _watchedFiles: Map<string, number> = new Map(); // path -> mtime
  private _ideWindow: BrowserWindow | null = null;

  constructor(private readonly store: Store<AppState>) {}

  /**
   * Sets the IDE window for sending file change notifications
   */
  setIdeWindow(window: BrowserWindow | null): void {
    this._ideWindow = window;
  }

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
      (event) => {
        if (event === "rename") {
          this.store.dispatch(incExploreViewVersionAction(), "main");
        }
      }
    );
  }

  /**
   * Start watching a specific file for changes
   * @param filePath Path to the file to watch
   */
  startWatchingFile(filePath: string): void {
    // Stop watching if already watching
    this.stopWatchingFile(filePath);

    try {
      // Get initial modification time
      const stats = fs.statSync(filePath);
      this._watchedFiles.set(filePath, stats.mtimeMs);

      // Watch the file's directory and check the specific file
      const dirPath = path.dirname(filePath);
      const fileName = path.basename(filePath);

      const watcher = fs.watch(
        dirPath,
        {
          persistent: true
        },
        (eventType, changedFileName) => {
          // Only process if the changed file matches our watched file
          if (changedFileName === fileName) {
            try {
              const newStats = fs.statSync(filePath);
              const oldMtime = this._watchedFiles.get(filePath) || 0;

              // Check if file was actually modified (not just accessed)
              if (newStats.mtimeMs > oldMtime) {
                this._watchedFiles.set(filePath, newStats.mtimeMs);

                // Notify the IDE window
                if (this._ideWindow && !this._ideWindow.isDestroyed()) {
                  this._ideWindow.webContents.send("file-changed-externally", {
                    path: filePath,
                    mtime: newStats.mtimeMs
                  });
                }
              }
            } catch (err) {
              // File might have been deleted, ignore
              console.warn(`Error checking file ${filePath}:`, err);
            }
          }
        }
      );

      this._fileWatchers.set(filePath, watcher);
    } catch (err) {
      console.warn(`Error watching file ${filePath}:`, err);
    }
  }

  /**
   * Stop watching a specific file
   * @param filePath Path to the file to stop watching
   */
  stopWatchingFile(filePath: string): void {
    const watcher = this._fileWatchers.get(filePath);
    if (watcher) {
      watcher.close();
      this._fileWatchers.delete(filePath);
      this._watchedFiles.delete(filePath);
    }
  }

  /**
   * Stop watching all files
   */
  stopWatchingAllFiles(): void {
    for (const [filePath, watcher] of this._fileWatchers) {
      watcher.close();
    }
    this._fileWatchers.clear();
    this._watchedFiles.clear();
  }

  stopWatching(): void {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
    this.stopWatchingAllFiles();
  }
}

export const fileChangeWatcher = new FileChangeWatcher(mainStore);
