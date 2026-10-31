import { t } from "@common/i18n/i18n";
import { LatestRun, UiController } from "@renderer/mvc";
import type { FilePickerPort } from "@renderer/mvc";
import { fmErrorCodeOf, type FmDriveRef, type FmListing } from "@common/fileManager/fmTypes";
import {
  canGoUp,
  entryAtCursor,
  initialState,
  locationsOf,
  paneRows,
  reduce,
  type FmEvent,
  type FmState,
  type PaneLocation,
  type PaneSide,
  type ReturnPoint,
  type SortKey
} from "./FileManagerModel";
import { selectViewModel, type CrumbTarget, type FileManagerVm } from "./FileManagerViewModel";

/*
 * The File Manager's controller (.plans/FILE_MANAGER_PLAN.md §5.5): user intents to MainApi calls
 * through `FileManagerPort`, and their results to events. Phase 2 browses; nothing is written.
 */

/** What the File Manager needs from the main process (MainApi's `fm*` calls) */
export type FileManagerPort = {
  listDrives(): Promise<FmDriveRef[]>;
  openImage(filePath: string): Promise<FmDriveRef[]>;
  list(driveId: string, dir?: string): Promise<FmListing>;
};

/** Where the document keeps its panes' places */
export type LocationStorePort = {
  save(locations: [PaneLocation | undefined, PaneLocation | undefined]): void;
};

export type FileManagerPorts = {
  fm: FileManagerPort;
  picker: Pick<FilePickerPort, "pickFile">;
  locations: LocationStorePort;
};

export type FileManagerIntent =
  | { type: "activated"; locations?: [PaneLocation | undefined, PaneLocation | undefined] }
  | { type: "paneFocused"; side: PaneSide }
  | { type: "paneSwitched" }
  | { type: "cursorMoved"; side: PaneSide; to: number }
  | { type: "rowActivated"; side: PaneSide; index?: number }
  | { type: "upRequested"; side: PaneSide }
  | { type: "crumbChosen"; side: PaneSide; target: CrumbTarget }
  | { type: "markToggled"; side: PaneSide; advance?: boolean }
  | { type: "allMarked"; side: PaneSide }
  | { type: "marksCleared"; side: PaneSide }
  | { type: "sortChosen"; side: PaneSide; key: SortKey }
  | { type: "hiddenToggled"; side: PaneSide }
  | { type: "refreshRequested"; side: PaneSide }
  | { type: "driveMenuToggled"; side: PaneSide }
  | { type: "driveMenuClosed" }
  | { type: "driveChosen"; side: PaneSide; driveId: string }
  | { type: "openImageRequested"; side: PaneSide };

const IMAGE_FILTER_EXTENSIONS = ["dsk", "trd", "scl", "mdr", "img", "hdf", "cim"];

export class FileManagerController extends UiController<FmState, FileManagerIntent, FmEvent, FileManagerVm> {
  private readonly runs: [LatestRun, LatestRun] = [new LatestRun(), new LatestRun()];

  constructor (private readonly ports: FileManagerPorts, state: FmState = initialState()) {
    super(state, reduce, selectViewModel);
  }

  protected async handle (intent: FileManagerIntent): Promise<void> {
    switch (intent.type) {
      case "activated":
        return this.start(intent.locations);
      case "paneFocused":
        this.emit({ type: "activeSet", side: intent.side });
        return;
      case "paneSwitched":
        this.emit({ type: "activeSet", side: this.state.active === 0 ? 1 : 0 });
        return;
      case "cursorMoved":
        this.emit({ type: "activeSet", side: intent.side });
        this.emit({ type: "cursorMoved", side: intent.side, to: intent.to });
        return;
      case "rowActivated":
        return this.activateRow(intent.side, intent.index);
      case "upRequested":
        return this.goUp(intent.side);
      case "crumbChosen":
        return this.chooseCrumb(intent.side, intent.target);
      case "markToggled": {
        const pane = this.state.panes[intent.side];
        const entry = entryAtCursor(pane);
        if (entry) this.emit({ type: "markToggled", side: intent.side, path: entry.path });
        if (intent.advance) this.emit({ type: "cursorMoved", side: intent.side, to: pane.cursor + 1 });
        return;
      }
      case "allMarked":
        this.emit({ type: "allMarked", side: intent.side });
        return;
      case "marksCleared":
        this.emit({ type: "marksCleared", side: intent.side });
        return;
      case "sortChosen":
        this.emit({ type: "sortSet", side: intent.side, key: intent.key });
        return;
      case "hiddenToggled":
        this.emit({ type: "hiddenToggled", side: intent.side });
        return;
      case "refreshRequested": {
        const pane = this.state.panes[intent.side];
        if (pane.drive) await this.load(intent.side, pane.drive, pane.dir);
        return;
      }
      case "driveMenuToggled":
        if (this.state.menuFor === intent.side) {
          this.emit({ type: "menuClosed" });
        } else {
          this.emit({ type: "menuOpened", side: intent.side });
          // --- The menu shows free space as it is now, and a project opened since
          await this.loadDrives();
        }
        return;
      case "driveMenuClosed":
        this.emit({ type: "menuClosed" });
        return;
      case "driveChosen": {
        this.emit({ type: "menuClosed" });
        const drive = [...this.state.drives, ...this.state.openedImages].find((d) => d.id === intent.driveId);
        if (drive) await this.load(intent.side, drive, undefined, { returnTo: [] });
        return;
      }
      case "openImageRequested": {
        this.emit({ type: "menuClosed" });
        const file = await this.ports.picker.pickFile([{ name: t("panels.fileManager.imageFilter"), extensions: IMAGE_FILTER_EXTENSIONS }], "fileManager.openImage");
        if (!file) return;
        const drives = await this.openImage(intent.side, file);
        if (drives?.[0]) await this.load(intent.side, drives[0], undefined, { returnTo: [] });
        return;
      }
    }
  }

  dispose (): void {
    this.runs.forEach((r) => r.cancelAll());
    super.dispose();
  }

  // -----------------------------------------------------------------------------------------------

  private async start (locations?: [PaneLocation | undefined, PaneLocation | undefined]): Promise<void> {
    const drives = await this.loadDrives();
    const project = drives.find((d) => d.group === "project");
    const home = drives.find((d) => d.role === "home") ?? drives[0];
    const defaults = [project ?? home, home];
    await Promise.all(([0, 1] as PaneSide[]).map(async (side) => {
      const saved = locations?.[side];
      if (saved) {
        const ok = await this.loadById(side, saved.driveId, saved.dir);
        if (ok) return;
      }
      if (defaults[side]) await this.load(side, defaults[side], undefined, { returnTo: [] });
    }));
  }

  private async loadDrives (): Promise<FmDriveRef[]> {
    try {
      const drives = await this.ports.fm.listDrives();
      this.emit({ type: "drivesLoaded", drives });
      return drives;
    } catch (err) {
      this.emit({ type: "drivesFailed", error: { code: fmErrorCodeOf(err) } });
      return [];
    }
  }

  /** A saved place: a drive this session knows, or one the main process can rebuild from its id */
  private async loadById (side: PaneSide, driveId: string, dir?: string): Promise<boolean> {
    const drive = [...this.state.drives, ...this.state.openedImages].find((d) => d.id === driveId);
    if (drive) return this.load(side, drive, dir, { returnTo: [] });
    const run = this.runs[side].begin();
    try {
      const listing = await this.ports.fm.list(driveId, dir);
      if (!run.isCurrent()) return true;
      if (listing.drive.group === "images") this.emit({ type: "imagesOpened", drives: [listing.drive] });
      this.emit({ type: "paneLoadStarted", side, drive: listing.drive, dir: listing.dir, returnTo: [] });
      this.emit({ type: "paneLoaded", side, listing });
      this.saveLocations();
      return true;
    } catch {
      return false;
    }
  }

  private async load (
    side: PaneSide,
    drive: FmDriveRef,
    dir: string | undefined,
    options: { cursorName?: string; returnTo?: readonly ReturnPoint[] } = {}
  ): Promise<boolean> {
    const run = this.runs[side].begin();
    this.emit({ type: "paneLoadStarted", side, drive, dir, cursorName: options.cursorName, returnTo: options.returnTo });
    try {
      const listing = await this.ports.fm.list(drive.id, dir);
      if (!run.isCurrent()) return true;
      this.emit({ type: "paneLoaded", side, listing });
      this.saveLocations();
      return true;
    } catch (err) {
      if (run.isCurrent()) this.emit({ type: "paneFailed", side, error: { code: fmErrorCodeOf(err), name: dir ?? drive.name } });
      return false;
    }
  }

  private async openImage (side: PaneSide, filePath: string): Promise<FmDriveRef[] | undefined> {
    try {
      const drives = await this.ports.fm.openImage(filePath);
      this.emit({ type: "imagesOpened", drives });
      return drives;
    } catch (err) {
      const name = filePath.replace(/^.*[\\/]/, "");
      this.emit({ type: "paneFailed", side, error: { code: fmErrorCodeOf(err), name } });
      return undefined;
    }
  }

  private async activateRow (side: PaneSide, index?: number): Promise<void> {
    this.emit({ type: "activeSet", side });
    if (index !== undefined) this.emit({ type: "cursorMoved", side, to: index });
    const pane = this.state.panes[side];
    const row = paneRows(pane)[pane.cursor];
    if (!row || !pane.drive) return;
    if (row.kind === "up") return this.goUp(side);
    const entry = row.entry;
    if (entry.isDirectory) {
      await this.load(side, pane.drive, entry.path);
      return;
    }
    if (!entry.imageKind) return;
    // --- An image on the host is entered like a folder (D9); one inside an image needs a host file
    // --- first, which comes with the jobs of Phase 4
    if (pane.drive.kind !== "host" && pane.drive.kind !== "project") return;
    const drives = await this.openImage(side, entry.path);
    if (!drives?.[0]) return;
    const back: ReturnPoint = { drive: pane.drive, dir: pane.dir ?? "", cursorName: entry.name };
    await this.load(side, drives[0], undefined, { returnTo: [...pane.returnTo, back] });
  }

  private async goUp (side: PaneSide): Promise<void> {
    const pane = this.state.panes[side];
    if (!pane.drive || !pane.listing || !canGoUp(pane)) return;
    if (pane.listing.parentDir !== undefined) {
      const current = pane.listing.crumbs[pane.listing.crumbs.length - 1]?.label;
      await this.load(side, pane.drive, pane.listing.parentDir, { cursorName: current });
      return;
    }
    await this.leave(side, pane.returnTo.length - 1);
  }

  /** Goes back to where the image at `returnIndex` was entered from */
  private async leave (side: PaneSide, returnIndex: number): Promise<void> {
    const pane = this.state.panes[side];
    const back = pane.returnTo[returnIndex];
    if (!back) return;
    await this.load(side, back.drive, back.dir || undefined, {
      cursorName: back.cursorName,
      returnTo: pane.returnTo.slice(0, returnIndex)
    });
  }

  private async chooseCrumb (side: PaneSide, target: CrumbTarget): Promise<void> {
    this.emit({ type: "activeSet", side });
    if (target.kind === "leave") return this.leave(side, target.returnIndex);
    const pane = this.state.panes[side];
    if (pane.drive && target.dir !== pane.dir) await this.load(side, pane.drive, target.dir);
  }

  private saveLocations (): void {
    this.ports.locations.save(locationsOf(this.state));
  }
}
