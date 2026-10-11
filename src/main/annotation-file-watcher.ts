import fs from "fs";
import path from "path";

/*
 * Tells the IDE when an annotation sidecar it holds open is changed on disk by another program — an
 * editor, a script, an AI assistant editing a ROM working copy in `<Klive home>/RomAnnotations`.
 *
 * The IDE keeps every sidecar it has read in an annotation session and writes that model back on
 * every edit. Without this, an outside change stayed invisible until a restart, and the next edit
 * inside the IDE wrote the stale model over it.
 *
 * The *folder* is watched, not the file: an editor that saves by writing a new file and renaming it
 * over the old one replaces the inode a file watch is attached to, and the watch goes quiet. A folder
 * watch sees both kinds of save. The IDE's own writes are reported too; the renderer tells them apart
 * by comparing what is on disk with the model it holds (`reloadAnnotationSessionFromDisk`).
 */

/** How long a burst of change events for one file is gathered into one notification */
export const ANNOTATION_CHANGE_SETTLE_MS = 120;

type FolderWatch = {
  watcher: fs.FSWatcher;
  /**
   * File names in this folder the IDE follows: how many times each was asked for, and the path as
   * the IDE spelled it — reported back verbatim, since the IDE keys its sessions by that string
   */
  files: Map<string, { count: number; filePath: string }>;
};

export type AnnotationChangeListener = (filePath: string) => void;

export class AnnotationFileWatcher {
  private readonly folders = new Map<string, FolderWatch>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly onChange: AnnotationChangeListener,
    private readonly settleMs = ANNOTATION_CHANGE_SETTLE_MS,
    private readonly watchFolder: typeof fs.watch = fs.watch
  ) {}

  /**
   * Follow a sidecar. Returns false when its folder cannot be watched (it does not exist): nothing
   * outside the IDE can be editing a file there that the IDE has open.
   */
  watch(filePath: string): boolean {
    if (!isSidecarPath(filePath)) return false;
    const folder = path.dirname(filePath);
    const name = path.basename(filePath);
    let entry = this.folders.get(folder);
    if (!entry) {
      let watcher: fs.FSWatcher;
      try {
        // --- Not persistent: a watch must never keep the app from quitting
        watcher = this.watchFolder(folder, { persistent: false }, (_event, changed) =>
          this.changed(folder, changed)
        );
      } catch {
        return false;
      }
      watcher.on("error", () => this.closeFolder(folder));
      entry = { watcher, files: new Map() };
      this.folders.set(folder, entry);
    }
    const followed = entry.files.get(name);
    if (followed) followed.count++;
    else entry.files.set(name, { count: 1, filePath });
    return true;
  }

  /** Stop following a sidecar; the folder's watch closes with its last file */
  unwatch(filePath: string): void {
    if (!isSidecarPath(filePath)) return;
    const folder = path.dirname(filePath);
    const name = path.basename(filePath);
    const entry = this.folders.get(folder);
    const followed = entry?.files.get(name);
    if (!entry || !followed) return;
    if (followed.count > 1) {
      followed.count--;
      return;
    }
    entry.files.delete(name);
    this.cancel(followed.filePath);
    if (entry.files.size === 0) this.closeFolder(folder);
  }

  /** The sidecars followed now, for diagnostics and tests */
  watched(): string[] {
    return [...this.folders.values()].flatMap((entry) =>
      [...entry.files.values()].map((followed) => followed.filePath)
    );
  }

  /** Close every watch (a project or window going away) */
  dispose(): void {
    for (const folder of [...this.folders.keys()]) this.closeFolder(folder);
  }

  private changed(folder: string, changed: string | Buffer | null): void {
    const entry = this.folders.get(folder);
    if (!entry) return;
    // --- Some platforms report a change without a name: any followed file may be the one
    const names = changed ? [changed.toString()] : [...entry.files.keys()];
    for (const name of names) {
      const followed = entry.files.get(name);
      if (followed) this.schedule(followed.filePath);
    }
  }

  /** A save is several events (truncate, write, rename): report the file once they settle */
  private schedule(filePath: string): void {
    this.cancel(filePath);
    this.timers.set(
      filePath,
      setTimeout(() => {
        this.timers.delete(filePath);
        this.onChange(filePath);
      }, this.settleMs)
    );
  }

  private cancel(filePath: string): void {
    const timer = this.timers.get(filePath);
    if (timer) clearTimeout(timer);
    this.timers.delete(filePath);
  }

  private closeFolder(folder: string): void {
    const entry = this.folders.get(folder);
    if (!entry) return;
    for (const followed of entry.files.values()) this.cancel(followed.filePath);
    try {
      entry.watcher.close();
    } catch {
      // --- Already closed
    }
    this.folders.delete(folder);
  }
}

/** Only absolute `.dis` paths: the watch is for annotation sidecars and nothing else */
function isSidecarPath(filePath: unknown): filePath is string {
  return typeof filePath === "string" && path.isAbsolute(filePath) && /\.dis$/i.test(filePath);
}
