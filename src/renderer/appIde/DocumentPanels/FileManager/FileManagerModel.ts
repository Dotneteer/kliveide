import type { FmDriveRef, FmEntry, FmErrorCode, FmListing } from "@common/fileManager/fmTypes";
import type { FmDeleteResult, FmJobResult } from "@common/fileManager/fmJobTypes";
import { DEFAULT_TRANSFER_OPTIONS, type FmTransferOptions } from "@common/fileManager/fmTransfer";

/*
 * The File Manager's model (.plans/FILE_MANAGER_PLAN.md §5.5): two panes, each on a drive and a
 * folder of it, with a cursor, marked files and a sort order; the drive menu; the drives known.
 * Pure: no React, no MainApi, no texts.
 */

export type PaneSide = 0 | 1;

/** `position`: the listing's own order (a tape's), which the pane keeps until a column is sorted */
export type SortKey = "name" | "size" | "modified" | "kind" | "position";

export type PaneSort = { key: SortKey; descending: boolean };

/** Where a pane was before it entered an image, to go back there (D9) */
export type ReturnPoint = { drive: FmDriveRef; dir: string; cursorName: string };

/** A pane's place, as the document's view state keeps it */
export type PaneLocation = { driveId: string; dir?: string };

export type PaneError = { code: FmErrorCode; name?: string };

export type PaneState = {
  drive?: FmDriveRef;
  dir?: string;
  listing?: FmListing;
  status: "idle" | "loading" | "ready" | "error";
  error?: PaneError;
  /** The row under the cursor (row 0 is ".." when there is one) */
  cursor: number;
  /** Marked entries, by path */
  marked: readonly string[];
  sort: PaneSort;
  showHidden: boolean;
  /** The images entered, innermost last */
  returnTo: readonly ReturnPoint[];
  /** Put the cursor on this entry once the listing arrives */
  cursorName?: string;
};

/** A job under way (Phase 4) */
export type FmJob = {
  kind: "copy" | "move" | "delete";
  done: number;
  total: number;
  current?: string;
  /** The job's id in the main process, for cancelling it */
  id?: string;
  cancelling?: boolean;
};

/** What the File Manager tells after a job, as data: the view model words it */
export type FmNotice =
  | { kind: "transfer"; move: boolean; result: FmJobResult; skippedFolders: number }
  | { kind: "delete"; result: FmDeleteResult }
  | { kind: "error"; code: FmErrorCode; name?: string };

export type FmState = {
  panes: readonly [PaneState, PaneState];
  active: PaneSide;
  drives: readonly FmDriveRef[];
  /** Images opened as drives this session, for the drive menu */
  openedImages: readonly FmDriveRef[];
  drivesError?: PaneError;
  /** The pane whose drive menu is open */
  menuFor?: PaneSide;
  job?: FmJob;
  notice?: FmNotice;
  /** The copy options used last, offered again */
  transferOptions: FmTransferOptions;
  /** The machine is stopped (or never started): its storage can be used (D4) */
  machineStopped: boolean;
};

export type FmEvent =
  | { type: "drivesLoaded"; drives: FmDriveRef[] }
  | { type: "drivesFailed"; error: PaneError }
  | { type: "imagesOpened"; drives: FmDriveRef[] }
  | { type: "paneLoadStarted"; side: PaneSide; drive: FmDriveRef; dir?: string; cursorName?: string; returnTo?: readonly ReturnPoint[] }
  | { type: "paneLoaded"; side: PaneSide; listing: FmListing }
  | { type: "paneFailed"; side: PaneSide; error: PaneError }
  | { type: "cursorMoved"; side: PaneSide; to: number }
  | { type: "markToggled"; side: PaneSide; path: string }
  | { type: "allMarked"; side: PaneSide }
  | { type: "marksCleared"; side: PaneSide }
  | { type: "activeSet"; side: PaneSide }
  | { type: "sortSet"; side: PaneSide; key: SortKey }
  | { type: "hiddenToggled"; side: PaneSide }
  | { type: "menuOpened"; side: PaneSide }
  | { type: "menuClosed" }
  | { type: "jobStarted"; job: FmJob }
  | { type: "jobProgressed"; done: number; total: number; current?: string; id?: string }
  | { type: "jobCancelling" }
  | { type: "jobFinished" }
  | { type: "noticeShown"; notice: FmNotice }
  | { type: "noticeDismissed" }
  | { type: "transferOptionsSet"; options: FmTransferOptions }
  | { type: "machineStateSet"; stopped: boolean };

export const DEFAULT_SORT: PaneSort = { key: "name", descending: false };

export function emptyPane (): PaneState {
  return { status: "idle", cursor: 0, marked: [], sort: DEFAULT_SORT, showHidden: false, returnTo: [] };
}

export function initialState (): FmState {
  return { panes: [emptyPane(), emptyPane()], active: 0, drives: [], openedImages: [], transferOptions: DEFAULT_TRANSFER_OPTIONS, machineStopped: true };
}

// -------------------------------------------------------------------------------------------------
// Rows

/** A row of a pane: ".." or an entry */
export type PaneRow = { kind: "up" } | { kind: "entry"; entry: FmEntry };

/** Can the pane go up: to a parent folder, or out of an entered image */
export function canGoUp (pane: PaneState): boolean {
  return pane.listing ? pane.listing.parentDir !== undefined || pane.returnTo.length > 0 : false;
}

const rowCache = new WeakMap<PaneState, PaneRow[]>();

/** The rows a pane shows: "..", then folders, then files, in the pane's order */
export function paneRows (pane: PaneState): PaneRow[] {
  const cached = rowCache.get(pane);
  if (cached) return cached;
  const entries = (pane.listing?.entries ?? []).filter((e) => pane.showHidden || !e.hidden);
  const sorted = [...entries].sort(entryComparer(pane.sort));
  const rows: PaneRow[] = [
    ...(canGoUp(pane) ? [{ kind: "up" } as PaneRow] : []),
    ...sorted.map((entry): PaneRow => ({ kind: "entry", entry }))
  ];
  rowCache.set(pane, rows);
  return rows;
}

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Folders before files whatever the order; within each, the sort key, then the name */
export function entryComparer (sort: PaneSort): (a: FmEntry, b: FmEntry) => number {
  const sign = sort.descending ? -1 : 1;
  return (a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    // --- The listing's order: Array.prototype.sort is stable, so equal keeps it
    if (sort.key === "position") return 0;
    let by = 0;
    if (sort.key === "size") by = a.size - b.size;
    else if (sort.key === "modified") by = (a.modified ?? 0) - (b.modified ?? 0);
    else if (sort.key === "kind") by = nameCollator.compare(kindKey(a), kindKey(b));
    return sign * (by || nameCollator.compare(a.name, b.name));
  };
}

function kindKey (e: FmEntry): string {
  if (e.spectrum) return e.spectrum.kind;
  const dot = e.name.lastIndexOf(".");
  return dot > 0 ? e.name.slice(dot + 1) : "";
}

/** The entries a command works on: the marked ones, or else the one under the cursor */
export function chosenEntries (pane: PaneState): FmEntry[] {
  // --- In the order the pane shows them, which is the order they are copied in
  if (pane.marked.length) {
    return paneRows(pane).flatMap((r) => (r.kind === "entry" && pane.marked.includes(r.entry.path) ? [r.entry] : []));
  }
  const at = entryAtCursor(pane);
  return at ? [at] : [];
}

/** The entry under a pane's cursor, if the cursor is on one */
export function entryAtCursor (pane: PaneState): FmEntry | undefined {
  const row = paneRows(pane)[pane.cursor];
  return row?.kind === "entry" ? row.entry : undefined;
}

// -------------------------------------------------------------------------------------------------
// The reducer

function withPane (state: FmState, side: PaneSide, pane: PaneState): FmState {
  if (state.panes[side] === pane) return state;
  const panes: [PaneState, PaneState] = [state.panes[0], state.panes[1]];
  panes[side] = pane;
  return { ...state, panes };
}

function clampCursor (pane: PaneState, to: number): number {
  const count = paneRows(pane).length;
  return count === 0 ? 0 : Math.max(0, Math.min(count - 1, to));
}

function addDrives (known: readonly FmDriveRef[], more: FmDriveRef[]): readonly FmDriveRef[] {
  const fresh = more.filter((d) => !known.some((k) => k.id === d.id));
  return fresh.length ? [...known, ...fresh] : known;
}

export function reduce (state: FmState, event: FmEvent): FmState {
  switch (event.type) {
    case "drivesLoaded":
      return { ...state, drives: event.drives, drivesError: undefined };
    case "drivesFailed":
      return { ...state, drivesError: event.error };
    case "imagesOpened": {
      const openedImages = addDrives(state.openedImages, event.drives);
      return openedImages === state.openedImages ? state : { ...state, openedImages };
    }
    case "paneLoadStarted": {
      const pane = state.panes[event.side];
      const sameFolder = pane.drive?.id === event.drive.id && pane.dir === event.dir;
      return withPane(state, event.side, {
        ...pane,
        drive: event.drive,
        dir: event.dir,
        status: "loading",
        error: undefined,
        cursorName: event.cursorName,
        marked: sameFolder ? pane.marked : [],
        returnTo: event.returnTo ?? pane.returnTo,
        // --- A new folder starts at the top; a refresh keeps the cursor where it was
        cursor: sameFolder ? pane.cursor : 0,
        listing: sameFolder ? pane.listing : undefined
      });
    }
    case "paneLoaded": {
      const pane = state.panes[event.side];
      // --- A tape lists in tape order until a column is chosen; leaving it, names sort again
      const sortFor = (current: PaneSort): PaneSort =>
        event.listing.ordered
          ? (current.key === DEFAULT_SORT.key && !current.descending ? { key: "position", descending: false } : current)
          : (current.key === "position" ? DEFAULT_SORT : current);
      const loaded: PaneState = {
        ...pane,
        sort: sortFor(pane.sort),
        drive: event.listing.drive,
        dir: event.listing.dir,
        listing: event.listing,
        status: "ready",
        error: undefined,
        cursorName: undefined,
        // --- A refresh keeps only the marks whose files are still there
        marked: pane.marked.filter((p) => event.listing.entries.some((e) => e.path === p))
      };
      const rows = paneRows(loaded);
      const named = pane.cursorName
        ? rows.findIndex((r) => r.kind === "entry" && r.entry.name === pane.cursorName)
        : -1;
      // --- A refresh keeps the cursor on its file, wherever new files put it, not on its row number
      const before = pane.listing ? paneRows(pane)[pane.cursor] : undefined;
      const same = named < 0 && before ? rows.findIndex((r) => sameRow(r, before)) : -1;
      const cursor = named >= 0 ? named : same >= 0 ? same : clampCursor(loaded, pane.cursor);
      return withPane(state, event.side, { ...loaded, cursor });
    }
    case "paneFailed": {
      const pane = state.panes[event.side];
      return withPane(state, event.side, { ...pane, status: "error", error: event.error, listing: undefined, cursor: 0, marked: [] });
    }
    case "cursorMoved": {
      const pane = state.panes[event.side];
      const cursor = clampCursor(pane, event.to);
      return cursor === pane.cursor ? state : withPane(state, event.side, { ...pane, cursor });
    }
    case "markToggled": {
      const pane = state.panes[event.side];
      const marked = pane.marked.includes(event.path)
        ? pane.marked.filter((p) => p !== event.path)
        : [...pane.marked, event.path];
      return withPane(state, event.side, { ...pane, marked });
    }
    case "allMarked": {
      const pane = state.panes[event.side];
      const marked = paneRows(pane).flatMap((r) => (r.kind === "entry" && !r.entry.isDirectory ? [r.entry.path] : []));
      return withPane(state, event.side, { ...pane, marked });
    }
    case "marksCleared": {
      const pane = state.panes[event.side];
      return pane.marked.length ? withPane(state, event.side, { ...pane, marked: [] }) : state;
    }
    case "activeSet":
      return state.active === event.side ? state : { ...state, active: event.side };
    case "sortSet": {
      const pane = state.panes[event.side];
      const current = paneRows(pane)[pane.cursor];
      const sort: PaneSort = pane.sort.key === event.key
        ? { key: event.key, descending: !pane.sort.descending }
        : { key: event.key, descending: false };
      const sorted: PaneState = { ...pane, sort };
      // --- The cursor stays on its row
      const at = current ? paneRows(sorted).findIndex((r) => sameRow(r, current)) : 0;
      return withPane(state, event.side, { ...sorted, cursor: Math.max(0, at) });
    }
    case "hiddenToggled": {
      const pane = state.panes[event.side];
      const current = paneRows(pane)[pane.cursor];
      const toggled: PaneState = { ...pane, showHidden: !pane.showHidden };
      const at = current ? paneRows(toggled).findIndex((r) => sameRow(r, current)) : -1;
      return withPane(state, event.side, { ...toggled, cursor: at >= 0 ? at : clampCursor(toggled, pane.cursor) });
    }
    case "menuOpened":
      return state.menuFor === event.side ? state : { ...state, menuFor: event.side, active: event.side };
    case "menuClosed":
      return state.menuFor === undefined ? state : { ...state, menuFor: undefined };
    case "jobStarted":
      return { ...state, job: event.job, notice: undefined };
    case "jobProgressed":
      return state.job
        ? { ...state, job: { ...state.job, done: event.done, total: event.total, current: event.current, id: event.id ?? state.job.id } }
        : state;
    case "jobCancelling":
      return state.job ? { ...state, job: { ...state.job, cancelling: true } } : state;
    case "jobFinished":
      return state.job ? { ...state, job: undefined } : state;
    case "noticeShown":
      return { ...state, notice: event.notice };
    case "noticeDismissed":
      return state.notice ? { ...state, notice: undefined } : state;
    case "transferOptionsSet":
      return { ...state, transferOptions: event.options };
    case "machineStateSet":
      return state.machineStopped === event.stopped ? state : { ...state, machineStopped: event.stopped };
  }
}

function sameRow (a: PaneRow, b: PaneRow): boolean {
  if (a.kind === "up" || b.kind === "up") return a.kind === b.kind;
  return a.entry.path === b.entry.path;
}

/** The panes' places, for the document's view state */
export function locationsOf (state: FmState): [PaneLocation | undefined, PaneLocation | undefined] {
  const at = (pane: PaneState): PaneLocation | undefined => {
    // --- An entered image is left on restore: the pane comes back where the image was
    const base = pane.returnTo[0];
    if (base) return { driveId: base.drive.id, dir: base.dir };
    return pane.drive ? { driveId: pane.drive.id, dir: pane.dir } : undefined;
  };
  return [at(state.panes[0]), at(state.panes[1])];
}

/** A pane on the machine's storage while the machine runs: blocked until it stops (D4) */
export function isBlocked (state: FmState, side: PaneSide): boolean {
  return !state.machineStopped && state.panes[side].drive?.group === "machine";
}
