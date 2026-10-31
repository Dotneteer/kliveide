import { t } from "@common/i18n/i18n";
import { LatestRun, UiController } from "@renderer/mvc";
import type { FilePickerPort } from "@renderer/mvc";
import { fmErrorCodeOf, type FmDriveRef, type FmListing } from "@common/fileManager/fmTypes";
import type {
  FmConflictDecision,
  FmDeleteResult,
  FmJobResult,
  FmJobStatus,
  FmTransferPlan,
  FmTransferRequest
} from "@common/fileManager/fmJobTypes";
import { freeName, type FmPlanItem, type FmTransferOptions } from "@common/fileManager/fmTransfer";
import {
  canGoUp,
  chosenEntries,
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
  planTransfer(request: FmTransferRequest): Promise<FmTransferPlan>;
  runTransfer(id: string, decisions: Record<number, FmConflictDecision>): Promise<FmJobResult>;
  jobStatus(id: string): Promise<FmJobStatus | undefined>;
  cancelJob(id: string): Promise<void>;
  deleteEntries(driveId: string, paths: string[]): Promise<FmDeleteResult>;
  mkdir(driveId: string, dir: string, name: string): Promise<string>;
  rename(driveId: string, path: string, newName: string): Promise<string>;
};

/** What the copy dialog hands back: the plan to run (re-planned as its options changed) */
export type TransferConfirmation = {
  plan: FmTransferPlan;
  options: FmTransferOptions;
  onExisting: "ask" | "replace" | "skip";
};

export type TransferDialogRequest = {
  plan: FmTransferPlan;
  options: FmTransferOptions;
  sourceLabel: string;
  targetLabel: string;
  /** Plans again with other options; an error is wordable */
  replan(options: FmTransferOptions): Promise<FmTransferPlan>;
};

/** The answer to one conflict, for it alone or for every one left */
export type ConflictAnswer =
  | { kind: "replace" | "skip" | "replaceAll" | "skipAll" | "cancel" }
  | { kind: "rename"; name: string };

/** The dialogs a command asks through */
export type FileManagerDialogPort = {
  confirmTransfer(request: TransferDialogRequest): Promise<TransferConfirmation | undefined>;
  resolveConflict(request: { item: FmPlanItem; suggestion: string; remaining: number }): Promise<ConflictAnswer>;
  confirmDelete(request: { names: string[]; permanent: boolean }): Promise<boolean>;
  askFolderName(request: { where: string; existing: string[] }): Promise<string | undefined>;
  askNewName(request: { oldName: string }): Promise<string | undefined>;
};

/** Where the document keeps its panes' places */
export type LocationStorePort = {
  save(locations: [PaneLocation | undefined, PaneLocation | undefined]): void;
};

export type FileManagerPorts = {
  fm: FileManagerPort;
  picker: Pick<FilePickerPort, "pickFile">;
  locations: LocationStorePort;
  dialogs: FileManagerDialogPort;
  /** Waits between two looks at a running job's progress */
  wait(ms: number): Promise<void>;
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
  | { type: "openImageRequested"; side: PaneSide }
  | { type: "transferRequested"; move: boolean }
  | { type: "deleteRequested" }
  | { type: "mkdirRequested" }
  | { type: "renameRequested" }
  | { type: "jobCancelRequested" }
  | { type: "noticeDismissed" };

const IMAGE_FILTER_EXTENSIONS = ["dsk", "trd", "scl", "mdr", "img", "hdf", "cim"];

const WRITING_INTENTS = new Set<FileManagerIntent["type"]>([
  "transferRequested",
  "deleteRequested",
  "mkdirRequested",
  "renameRequested",
  "driveChosen",
  "openImageRequested"
]);

/** How often a running job's progress is read */
export const PROGRESS_INTERVAL_MS = 200;

export class FileManagerController extends UiController<FmState, FileManagerIntent, FmEvent, FileManagerVm> {
  private readonly runs: [LatestRun, LatestRun] = [new LatestRun(), new LatestRun()];

  constructor (private readonly ports: FileManagerPorts, state: FmState = initialState()) {
    super(state, reduce, selectViewModel);
  }

  protected async handle (intent: FileManagerIntent): Promise<void> {
    // --- While a job runs, only watching it, cancelling it and moving around are allowed
    if (this.state.job && WRITING_INTENTS.has(intent.type)) return;
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
      case "transferRequested":
        return this.transfer(intent.move);
      case "deleteRequested":
        return this.deleteChosen();
      case "mkdirRequested":
        return this.makeFolder();
      case "renameRequested":
        return this.renameAtCursor();
      case "jobCancelRequested": {
        const job = this.state.job;
        if (!job?.id || job.cancelling) return;
        this.emit({ type: "jobCancelling" });
        await this.ports.fm.cancelJob(job.id);
        return;
      }
      case "noticeDismissed":
        this.emit({ type: "noticeDismissed" });
        return;
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

  // -----------------------------------------------------------------------------------------------
  // Jobs (Phase 4)

  private async transfer (move: boolean): Promise<void> {
    const side = this.state.active;
    const other: PaneSide = side === 0 ? 1 : 0;
    const source = this.state.panes[side];
    const target = this.state.panes[other];
    const chosen = chosenEntries(source);
    if (!source.drive || !target.drive || chosen.length === 0) return;
    const request = (options: FmTransferOptions): FmTransferRequest => ({
      sourceDriveId: source.drive!.id,
      paths: chosen.map((e) => e.path),
      targetDriveId: target.drive!.id,
      targetDir: target.dir ?? "",
      move,
      options
    });

    let plan: FmTransferPlan;
    try {
      plan = await this.ports.fm.planTransfer(request(this.state.transferOptions));
    } catch (err) {
      this.emit({ type: "noticeShown", notice: { kind: "error", code: fmErrorCodeOf(err), name: chosen[0]?.name } });
      return;
    }
    const confirmed = await this.ports.dialogs.confirmTransfer({
      plan,
      options: this.state.transferOptions,
      sourceLabel: chosen.length === 1 ? chosen[0].name : String(chosen.length),
      targetLabel: target.dir || target.drive.name,
      replan: (options) => this.ports.fm.planTransfer(request(options))
    });
    if (!confirmed) return;
    this.emit({ type: "transferOptionsSet", options: confirmed.options });
    plan = confirmed.plan;

    const decisions = await this.decide(plan, confirmed.onExisting, target.listing?.entries.map((e) => e.name) ?? []);
    if (!decisions) return;

    this.emit({ type: "jobStarted", job: { kind: move ? "move" : "copy", done: 0, total: plan.items.length, id: plan.id } });
    let result: FmJobResult | undefined;
    let failure: unknown;
    const run = this.ports.fm.runTransfer(plan.id, decisions).then(
      (r) => (result = r),
      (err) => (failure = err ?? new Error("failed"))
    );
    while (!result && !failure) {
      await Promise.race([run, this.ports.wait(PROGRESS_INTERVAL_MS)]);
      if (result || failure) break;
      const status = await this.ports.fm.jobStatus(plan.id).catch((): undefined => undefined);
      if (status) this.emit({ type: "jobProgressed", done: status.done, total: status.total, current: status.current });
    }
    this.emit({ type: "jobFinished" });
    this.emit({
      type: "noticeShown",
      notice: result
        ? { kind: "transfer", move, result, skippedFolders: plan.skippedFolders.length }
        : { kind: "error", code: fmErrorCodeOf(failure), name: target.drive.name }
    });
    this.emit({ type: "marksCleared", side });
    await Promise.all([this.refresh(side), this.refresh(other)]);
  }

  /** The answers to a plan's conflicts; undefined when the user cancelled */
  private async decide (
    plan: FmTransferPlan,
    onExisting: TransferConfirmation["onExisting"],
    targetNames: string[]
  ): Promise<Record<number, FmConflictDecision> | undefined> {
    const decisions: Record<number, FmConflictDecision> = {};
    const conflicts = plan.items.filter((i) => i.conflict);
    let all: "replace" | "skip" | undefined = onExisting === "ask" ? undefined : onExisting;
    const taken = new Set([...targetNames, ...plan.items.map((i) => i.targetName)].map((n) => n.toLowerCase()));
    for (let i = 0; i < conflicts.length; i++) {
      const item = conflicts[i];
      if (all) {
        decisions[item.id] = { kind: all };
        continue;
      }
      const suggestion = freeName(item.targetName, plan.to, taken);
      const answer = await this.ports.dialogs.resolveConflict({ item, suggestion, remaining: conflicts.length - i - 1 });
      switch (answer.kind) {
        case "cancel":
          return undefined;
        case "rename":
          taken.add(answer.name.toLowerCase());
          decisions[item.id] = { kind: "rename", name: answer.name };
          break;
        case "replaceAll":
          all = "replace";
          decisions[item.id] = { kind: "replace" };
          break;
        case "skipAll":
          all = "skip";
          decisions[item.id] = { kind: "skip" };
          break;
        default:
          decisions[item.id] = { kind: answer.kind };
      }
    }
    return decisions;
  }

  private async deleteChosen (): Promise<void> {
    const side = this.state.active;
    const pane = this.state.panes[side];
    const chosen = chosenEntries(pane);
    if (!pane.drive || chosen.length === 0) return;
    const permanent = pane.drive.kind !== "host" && pane.drive.kind !== "project";
    const ok = await this.ports.dialogs.confirmDelete({ names: chosen.map((e) => e.name), permanent });
    if (!ok) return;
    this.emit({ type: "jobStarted", job: { kind: "delete", done: 0, total: chosen.length } });
    try {
      const result = await this.ports.fm.deleteEntries(pane.drive.id, chosen.map((e) => e.path));
      this.emit({ type: "jobFinished" });
      if (result.failed.length) this.emit({ type: "noticeShown", notice: { kind: "delete", result } });
    } catch (err) {
      this.emit({ type: "jobFinished" });
      this.emit({ type: "noticeShown", notice: { kind: "error", code: fmErrorCodeOf(err), name: pane.drive.name } });
    }
    this.emit({ type: "marksCleared", side });
    await this.refresh(side);
    await this.refreshIfSame(side);
  }

  private async makeFolder (): Promise<void> {
    const side = this.state.active;
    const pane = this.state.panes[side];
    if (!pane.drive || !pane.listing) return;
    const name = await this.ports.dialogs.askFolderName({
      where: pane.dir || pane.drive.name,
      existing: pane.listing.entries.map((e) => e.name)
    });
    if (!name) return;
    try {
      await this.ports.fm.mkdir(pane.drive.id, pane.dir ?? "", name);
    } catch (err) {
      this.emit({ type: "noticeShown", notice: { kind: "error", code: fmErrorCodeOf(err), name } });
      return;
    }
    await this.refresh(side, name);
    await this.refreshIfSame(side);
  }

  private async renameAtCursor (): Promise<void> {
    const side = this.state.active;
    const pane = this.state.panes[side];
    const entry = entryAtCursor(pane);
    if (!pane.drive || !entry) return;
    const name = await this.ports.dialogs.askNewName({ oldName: entry.name });
    if (!name || name === entry.name) return;
    try {
      await this.ports.fm.rename(pane.drive.id, entry.path, name);
    } catch (err) {
      this.emit({ type: "noticeShown", notice: { kind: "error", code: fmErrorCodeOf(err), name } });
      return;
    }
    await this.refresh(side, name);
    await this.refreshIfSame(side);
  }

  /** Reads a pane's folder again, the cursor on `cursorName` when given */
  private async refresh (side: PaneSide, cursorName?: string): Promise<void> {
    const pane = this.state.panes[side];
    if (pane.drive) await this.load(side, pane.drive, pane.dir, { cursorName });
  }

  /** The other pane, when it shows the same folder, sees the change too */
  private async refreshIfSame (side: PaneSide): Promise<void> {
    const other: PaneSide = side === 0 ? 1 : 0;
    const a = this.state.panes[side];
    const b = this.state.panes[other];
    if (a.drive && b.drive && a.drive.id === b.drive.id && a.dir === b.dir) await this.refresh(other);
  }

  private saveLocations (): void {
    this.ports.locations.save(locationsOf(this.state));
  }
}
