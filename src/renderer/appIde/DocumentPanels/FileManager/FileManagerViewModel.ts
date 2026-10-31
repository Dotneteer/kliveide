import { t, translator } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import type { FmColumnSet, FmDriveRef, FmEntry, FmErrorCode, FmSpectrumFacts } from "@common/fileManager/fmTypes";
import type { FmBecomes } from "@common/fileManager/fmTransfer";
import { isBlocked, paneRows, type FmNotice, type FmState, type PaneSide, type PaneState, type SortKey } from "./FileManagerModel";

/*
 * What the File Manager shows (.plans/FILE_MANAGER_PLAN.md §4): every text and number formatted
 * here, so the view only lays it out.
 */

export type ColumnKey = SortKey | "start" | "attributes" | "user";

export type ColumnVm = {
  key: ColumnKey;
  label: string;
  /** In `ch` (M2: no px column widths); the name column takes the rest */
  width?: number;
  align: "start" | "end";
  sortable: boolean;
  sorted?: "ascending" | "descending";
};

export type RowVm = {
  key: string;
  isUp: boolean;
  isDirectory: boolean;
  isImage: boolean;
  marked: boolean;
  cursor: boolean;
  /** One per column, in the columns' order */
  cells: string[];
};

/** A step of the path: a folder of this drive, or the place an entered image was entered from */
export type CrumbTarget = { kind: "dir"; dir: string } | { kind: "leave"; returnIndex: number };

export type CrumbVm = { label: string; target: CrumbTarget; current: boolean };

export type DriveIcon = "volume" | "home" | "folder" | "project" | "image" | "machine";

export type PaneVm = {
  side: PaneSide;
  active: boolean;
  drive?: { id: string; label: string; icon: DriveIcon; readOnly: boolean; onHost: boolean };
  crumbs: CrumbVm[];
  /** The pane's place in one line, for a tooltip */
  pathText: string;
  columns: ColumnVm[];
  rows: RowVm[];
  cursor: number;
  loading: boolean;
  error?: string;
  /** Shown in an empty folder */
  empty?: string;
  statusLeft: string;
  statusRight: string;
  /** The pane is on a running machine's storage (D4) */
  blocked?: { title: string; text: string; stopLabel: string };
  viewer?: ViewerVm;
  /** The right-click menu's commands, for the row under the cursor */
  context: ContextItemVm[];
};

/** How F3's viewer shows a file */
export type ViewerKind = "basic" | "screen" | "text" | "hex";

export type ViewerVm = {
  title: string;
  facts: string;
  kind: ViewerKind;
  loading: boolean;
  error?: string;
  data?: Uint8Array;
  /** BASIC: where the program ends (the variables follow) */
  basicEnd?: number;
  hexLabel: string;
  listingLabel: string;
  memoryLabel: string;
  closeLabel: string;
  hex: boolean;
  /** The file has a listing, a picture or text to show besides its bytes */
  hasListing: boolean;
};

export type ContextKey = "view" | "edit" | "copy" | "move" | "rename" | "delete" | "moveUp" | "moveDown" | "reveal";

export type ContextItemVm = { key: ContextKey; label: string; keyHint: string; enabled: boolean };

export type DriveMenuItemVm = {
  id: string;
  label: string;
  detail?: string;
  free?: string;
  icon: DriveIcon;
  selected: boolean;
  /** Listed but not usable now (a running machine's storage) */
  disabled: boolean;
};

export type DriveMenuVm = {
  side: PaneSide;
  groups: { title: string; items: DriveMenuItemVm[] }[];
  openImageLabel: string;
};

export type JobVm = {
  text: string;
  /** 0..1 */
  progress: number;
  canCancel: boolean;
};

export type NoticeVm = { tone: "info" | "error"; text: string };

export type CommandKey = "copy" | "move" | "rename" | "mkdir" | "delete" | "drives";

export type CommandVm = { key: CommandKey; label: string; keyHint: string; enabled: boolean };

export type FileManagerVm = {
  panes: [PaneVm, PaneVm];
  menu?: DriveMenuVm;
  drivesError?: string;
  job?: JobVm;
  notice?: NoticeVm;
  commands: CommandVm[];
};

// -------------------------------------------------------------------------------------------------
// Formatting

/** A size in bytes: grouped digits below 1 MB, then MB, GB or TB with one decimal */
export function formatSize (bytes: number): string {
  const n = new Intl.NumberFormat(translator.language);
  if (bytes < 1024 * 1024) return n.format(bytes);
  const units: [number, MessageKey][] = [
    [1024 ** 4, "panels.fileManager.size.tb"],
    [1024 ** 3, "panels.fileManager.size.gb"],
    [1024 ** 2, "panels.fileManager.size.mb"]
  ];
  const [unit, key] = units.find(([u]) => bytes >= u)!;
  const one = new Intl.NumberFormat(translator.language, { maximumFractionDigits: 1 });
  return t(key, { value: one.format(bytes / unit) });
}

/** A size with its unit, for a sentence: bytes below 1 MB, then MB, GB or TB */
export function formatSizeWithUnit (bytes: number): string {
  return bytes < 1024 * 1024 ? t("panels.fileManager.size.bytes", { count: bytes }) : formatSize(bytes);
}

/** A date as `YYYY-MM-DD HH:MM`, the same in every language (a column, read across rows) */
export function formatModified (ms: number | undefined): string {
  if (ms === undefined) return "";
  const d = new Date(ms);
  const two = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const KIND_KEYS: Record<FmSpectrumFacts["kind"], MessageKey> = {
  basic: "panels.diskExplorer.kind.basic",
  numberArray: "panels.diskExplorer.kind.numberArray",
  charArray: "panels.diskExplorer.kind.charArray",
  code: "panels.diskExplorer.kind.code",
  raw: "panels.diskExplorer.kind.raw"
};

function spectrumStart (s: FmSpectrumFacts | undefined): string {
  if (!s) return "";
  if (s.kind === "numberArray" || s.kind === "charArray") return s.variableName ?? "";
  return s.start === undefined ? "" : String(s.start);
}

function attributesText (s: FmSpectrumFacts | undefined): string {
  const a = s?.attributes;
  return a ? `${a.readOnly ? "R" : "-"}${a.system ? "S" : "-"}${a.archive ? "A" : "-"}` : "";
}

// -------------------------------------------------------------------------------------------------
// Columns

type ColumnDef = { key: ColumnKey; label: MessageKey; width?: number; align: "start" | "end"; sortable: boolean };

const NAME: ColumnDef = { key: "name", label: "panels.fileManager.col.name", align: "start", sortable: true };
const SIZE: ColumnDef = { key: "size", label: "panels.fileManager.col.size", width: 9, align: "end", sortable: true };
const MODIFIED: ColumnDef = { key: "modified", label: "panels.fileManager.col.modified", width: 17, align: "start", sortable: true };
const KIND: ColumnDef = { key: "kind", label: "panels.fileManager.col.kind", width: 9, align: "start", sortable: true };
const START: ColumnDef = { key: "start", label: "panels.fileManager.col.start", width: 6, align: "end", sortable: false };
const ATTR: ColumnDef = { key: "attributes", label: "panels.fileManager.col.attributes", width: 4, align: "start", sortable: false };
const USER: ColumnDef = { key: "user", label: "panels.fileManager.col.user", width: 4, align: "end", sortable: false };

const COLUMN_SETS: Record<FmColumnSet, ColumnDef[]> = {
  host: [NAME, SIZE, MODIFIED],
  fat: [NAME, SIZE],
  plus3dos: [NAME, KIND, SIZE, START, ATTR, USER],
  trdos: [NAME, KIND, SIZE, START],
  microdrive: [NAME, KIND, SIZE, START],
  tape: [NAME, KIND, SIZE, START]
};

function cellOf (key: ColumnKey, e: FmEntry): string {
  switch (key) {
    case "name":
      return e.name;
    case "size":
      return e.isDirectory ? t("panels.fileManager.dirMarker") : formatSize(e.size);
    case "modified":
      return formatModified(e.modified);
    case "kind":
      return e.spectrum ? t(KIND_KEYS[e.spectrum.kind]) : "";
    case "start":
      return spectrumStart(e.spectrum);
    case "attributes":
      return attributesText(e.spectrum);
    case "user":
      return e.spectrum?.user === undefined ? "" : String(e.spectrum.user);
    case "position":
      return "";
  }
}

// -------------------------------------------------------------------------------------------------
// Drives

export function driveIconOf (drive: FmDriveRef): DriveIcon {
  switch (drive.role) {
    case "root":
    case "volume":
      return "volume";
    case "home":
      return "home";
    case "klive":
    case "kliveProjects":
      return "folder";
    case "project":
      return "project";
    case "machine":
      return "machine";
    default:
      return "image";
  }
}

const SLOT_KEYS: Record<NonNullable<FmDriveRef["slot"]>, MessageKey> = {
  sdCard: "panels.fileManager.drive.sdCard",
  diskA: "panels.fileManager.drive.diskA",
  diskB: "panels.fileManager.drive.diskB",
  microdrive1: "panels.fileManager.drive.microdrive1",
  microdrive2: "panels.fileManager.drive.microdrive2",
  tape: "panels.fileManager.drive.tape"
};

/** A drive's name as the pane and the menu show it */
export function driveLabelOf (drive: FmDriveRef): string {
  switch (drive.role) {
    case "home":
      return t("panels.fileManager.drive.home");
    case "project":
      return t("panels.fileManager.drive.project", { name: drive.name });
    case "partition":
      return t("panels.fileManager.drive.partition", { name: drive.name, index: (drive.partition ?? 0) + 1 });
    case "machine":
      return drive.slot ? t(SLOT_KEYS[drive.slot]) : drive.name;
    default:
      return drive.name;
  }
}

function driveDetailOf (drive: FmDriveRef): string | undefined {
  if (drive.group === "machine") {
    return drive.available === false
      ? t("panels.fileManager.drive.stopToUse", { name: drive.name })
      : t("panels.fileManager.drive.fileAndFs", { name: drive.name, fs: drive.fileSystem });
  }
  if (drive.group === "images") return drive.fileSystem;
  if (drive.role === "volume" || drive.role === "klive" || drive.role === "kliveProjects") return drive.root;
  return undefined;
}

const ERROR_KEYS: Record<FmErrorCode, MessageKey> = {
  notFound: "panels.fileManager.error.notFound",
  notAFolder: "panels.fileManager.error.notAFolder",
  accessDenied: "panels.fileManager.error.accessDenied",
  unsupported: "panels.fileManager.error.unsupported",
  unformatted: "panels.fileManager.error.unformatted",
  noProject: "panels.fileManager.error.noProject",
  exists: "panels.fileManager.error.exists",
  readOnly: "panels.fileManager.error.readOnly",
  diskFull: "panels.fileManager.error.diskFull",
  directoryFull: "panels.fileManager.error.directoryFull",
  badName: "panels.fileManager.error.badName",
  sameFolder: "panels.fileManager.error.sameFolder",
  intoItself: "panels.fileManager.error.intoItself",
  machineRunning: "panels.fileManager.error.machineRunning",
  notProjectFile: "panels.fileManager.error.notProjectFile",
  failed: "panels.fileManager.error.failed"
};

export function errorText (code: FmErrorCode, name?: string): string {
  return t(ERROR_KEYS[code] ?? ERROR_KEYS.failed, { name: name ?? "" });
}

// -------------------------------------------------------------------------------------------------
// The view model

function selectPane (state: FmState, side: PaneSide): PaneVm {
  const pane: PaneState = state.panes[side];
  const columnSet = pane.listing?.columns ?? "host";
  const defs = COLUMN_SETS[columnSet];
  const columns: ColumnVm[] = defs.map((d) => ({
    key: d.key,
    label: t(d.label),
    width: d.width,
    align: d.align,
    sortable: d.sortable,
    sorted: pane.sort.key === d.key ? (pane.sort.descending ? "descending" : "ascending") : undefined
  }));
  const rows: RowVm[] = paneRows(pane).map((row, index) => {
    if (row.kind === "up") {
      return {
        key: "..",
        isUp: true,
        isDirectory: true,
        isImage: false,
        marked: false,
        cursor: index === pane.cursor,
        cells: defs.map((d) => (d.key === "name" ? ".." : d.key === "size" ? t("panels.fileManager.upMarker") : ""))
      };
    }
    const e = row.entry;
    return {
      key: e.path,
      isUp: false,
      isDirectory: e.isDirectory,
      isImage: !!e.imageKind,
      marked: pane.marked.includes(e.path),
      cursor: index === pane.cursor,
      cells: defs.map((d) => cellOf(d.key, e))
    };
  });

  const driveLabel = pane.drive ? driveLabelOf(pane.drive) : "";
  // --- An entered image shows where it was entered from first
  const outer: CrumbVm[] = pane.returnTo.map((r, returnIndex) => ({
    label: driveLabelOf(r.drive),
    target: { kind: "leave", returnIndex },
    current: false
  }));
  const crumbs: CrumbVm[] = (pane.listing?.crumbs ?? []).map((c, i, all) => ({
    label: i === 0 ? topCrumbLabel(pane, driveLabel) : c.label,
    target: { kind: "dir", dir: c.dir },
    current: i === all.length - 1
  }));
  const allCrumbs = [...outer, ...crumbs];

  const entries = pane.listing?.entries ?? [];
  const markedEntries = entries.filter((e) => pane.marked.includes(e.path));
  const statusLeft = markedEntries.length
    ? t("panels.fileManager.status.marked", {
      count: markedEntries.length,
      total: entries.length,
      size: formatSizeWithUnit(markedEntries.reduce((sum, e) => sum + e.size, 0))
    })
    : t("panels.fileManager.status.items", { count: entries.length });
  const drive = pane.listing?.drive ?? pane.drive;
  const fileSystem = drive?.fileSystem ?? "";
  const statusRight = drive?.freeBytes === undefined
    ? fileSystem
    : fileSystem
      ? t("panels.fileManager.status.fsFree", { fs: fileSystem, free: formatSizeWithUnit(drive.freeBytes) })
      : t("panels.fileManager.status.free", { free: formatSizeWithUnit(drive.freeBytes) });

  return {
    side,
    active: state.active === side,
    drive: pane.drive
      ? {
        id: pane.drive.id,
        label: driveLabel,
        icon: driveIconOf(pane.drive),
        readOnly: pane.drive.readOnly,
        onHost: pane.drive.kind === "host" || pane.drive.kind === "project"
      }
      : undefined,
    crumbs: allCrumbs,
    pathText: [...pane.returnTo.map((r) => r.drive.root), pane.dir ?? ""].filter(Boolean).join(" › "),
    columns,
    rows,
    cursor: pane.cursor,
    loading: pane.status === "loading",
    error: pane.status === "error" && pane.error ? errorText(pane.error.code, pane.error.name) : undefined,
    empty: pane.status === "ready" && entries.length === 0 ? t("panels.fileManager.emptyFolder") : undefined,
    statusLeft,
    statusRight,
    viewer: pane.viewer ? selectViewer(pane) : undefined,
    context: selectContext(state, pane),
    blocked: isBlocked(state, side)
      ? {
        title: t("panels.fileManager.blocked.title"),
        text: t("panels.fileManager.blocked.text"),
        stopLabel: t("panels.fileManager.blocked.stop")
      }
      : undefined
  };
}

/** A drive's top in the path: the folder itself on this computer, the file for an image */
function topCrumbLabel (pane: PaneState, driveLabel: string): string {
  const drive = pane.drive;
  if (!drive) return driveLabel;
  // --- A volume or folder of this computer shows where it is; the project, by its name (the drive
  // --- button says it is the project, and its path is the same on every screen it is shown)
  return drive.kind === "host" ? drive.root : drive.name;
}

function selectMenu (state: FmState): DriveMenuVm | undefined {
  if (state.menuFor === undefined) return undefined;
  const pane = state.panes[state.menuFor];
  const item = (d: FmDriveRef): DriveMenuItemVm => ({
    id: d.id,
    label: driveLabelOf(d),
    detail: driveDetailOf(d),
    free: d.freeBytes === undefined ? undefined : formatSizeWithUnit(d.freeBytes),
    icon: driveIconOf(d),
    selected: pane.drive?.id === d.id,
    disabled: d.available === false
  });
  const groups = [
    { title: t("panels.fileManager.group.computer"), items: state.drives.filter((d) => d.group === "computer").map(item) },
    { title: t("panels.fileManager.group.project"), items: state.drives.filter((d) => d.group === "project").map(item) },
    {
      title: t(state.machineStopped ? "panels.fileManager.group.machine" : "panels.fileManager.group.machineRunning"),
      items: state.drives.filter((d) => d.group === "machine").map(item)
    },
    { title: t("panels.fileManager.group.images"), items: state.openedImages.map(item) }
  ].filter((g) => g.items.length > 0);
  return { side: state.menuFor, groups, openImageLabel: t("panels.fileManager.openImage") };
}

/** A job's notice, in whole sentences */
export function noticeText (notice: FmNotice): NoticeVm {
  if (notice.kind === "error") return { tone: "error", text: errorText(notice.code, notice.name) };
  if (notice.kind === "delete") {
    const first = notice.result.failed[0];
    return {
      tone: "error",
      text: t("panels.fileManager.notice.deleteFailed", {
        count: notice.result.failed.length,
        name: first?.name ?? "",
        reason: first ? errorText(first.code, first.name) : ""
      })
    };
  }
  const r = notice.result;
  const sentences: string[] = [];
  if (r.aborted) {
    sentences.push(errorText(r.aborted));
    sentences.push(t(r.written === 0 ? "panels.fileManager.notice.nothingWritten" : "panels.fileManager.notice.partlyWritten", { count: r.written }));
  } else {
    sentences.push(t(notice.move ? "panels.fileManager.notice.moved" : "panels.fileManager.notice.copied", { count: r.written }));
  }
  if (r.cancelled) sentences.push(t("panels.fileManager.notice.cancelled"));
  if (r.skipped) sentences.push(t("panels.fileManager.notice.skipped", { count: r.skipped }));
  if (notice.skippedFolders) sentences.push(t("panels.fileManager.notice.skippedFolders", { count: notice.skippedFolders }));
  if (r.failed.length && !r.aborted) {
    const first = r.failed[0];
    sentences.push(t("panels.fileManager.notice.failed", { count: r.failed.length, name: first.name, reason: errorText(first.code, first.name) }));
  }
  if (r.removeFailed) sentences.push(t("panels.fileManager.notice.removeFailed", { count: r.removeFailed }));
  const trouble = r.cancelled || !!r.aborted || r.failed.length > 0 || !!r.removeFailed;
  return { tone: trouble ? "error" : "info", text: sentences.join(" ") };
}

const COMMANDS: { key: CommandKey; label: MessageKey; keyHint: string; writes: boolean }[] = [
  { key: "copy", label: "panels.fileManager.command.copy", keyHint: "F5", writes: true },
  { key: "move", label: "panels.fileManager.command.move", keyHint: "F6", writes: true },
  { key: "rename", label: "panels.fileManager.command.rename", keyHint: "⇧F6", writes: true },
  { key: "mkdir", label: "panels.fileManager.command.mkdir", keyHint: "F7", writes: true },
  { key: "delete", label: "panels.fileManager.command.delete", keyHint: "F8", writes: true },
  { key: "drives", label: "panels.fileManager.command.drives", keyHint: "Alt+F1", writes: false }
];

function selectJob (state: FmState): JobVm | undefined {
  const job = state.job;
  if (!job) return undefined;
  const key: MessageKey = job.cancelling
    ? "panels.fileManager.job.cancelling"
    : job.kind === "delete"
      ? "panels.fileManager.job.deleting"
      : job.kind === "move"
        ? "panels.fileManager.job.moving"
        : "panels.fileManager.job.copying";
  return {
    text: t(key, { name: job.current ?? "", done: job.done, total: job.total }),
    progress: job.total ? Math.min(1, job.done / job.total) : 0,
    canCancel: job.kind !== "delete" && !!job.id && !job.cancelling
  };
}

export function selectViewModel (state: FmState): FileManagerVm {
  const busy = !!state.job;
  return {
    panes: [selectPane(state, 0), selectPane(state, 1)],
    menu: selectMenu(state),
    drivesError: state.drivesError ? errorText(state.drivesError.code, state.drivesError.name) : undefined,
    job: selectJob(state),
    notice: state.notice ? noticeText(state.notice) : undefined,
    commands: COMMANDS.map((c) => ({ key: c.key, label: t(c.label), keyHint: c.keyHint, enabled: !(busy && c.writes) }))
  };
}

/** What a file becomes on its target, for the copy dialog */
export function becomesText (b: FmBecomes): string {
  switch (b.as) {
    case "asIs":
      return t("panels.fileManager.becomes.asIs");
    case "bytes":
      return t("panels.fileManager.becomes.bytes");
    case "tap":
      return t("panels.fileManager.becomes.tap");
    case "screen":
      return t("panels.fileManager.becomes.screen");
    case "basic":
      return b.line === undefined ? t("panels.fileManager.becomes.basic") : t("panels.fileManager.becomes.basicLine", { line: b.line });
    case "code":
      return t("panels.fileManager.becomes.code", { start: b.start });
    case "numberArray":
    case "charArray":
      return t(b.as === "numberArray" ? "panels.fileManager.becomes.numberArray" : "panels.fileManager.becomes.charArray", { name: b.variableName ?? "" });
  }
}

// -------------------------------------------------------------------------------------------------
// The viewer (Phase 7)

const SCREEN_SIZE = 6912;

/** What a file's bytes are best shown as */
export function viewerKindOf (entry: FmEntry, data: Uint8Array): ViewerKind {
  const kind = entry.spectrum?.kind;
  if (kind === "basic") return "basic";
  if (data.length === SCREEN_SIZE && (entry.spectrum?.start === 16384 || /\.scr$/i.test(entry.name))) return "screen";
  if (kind && kind !== "raw") return "hex";
  return looksLikeText(data) ? "text" : "hex";
}

/** No zero bytes, and nearly all printable or white space, in the first 4K */
export function looksLikeText (data: Uint8Array): boolean {
  if (data.length === 0) return false;
  const sample = data.subarray(0, 4096);
  let odd = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32) || b === 127) odd++;
  }
  return odd / sample.length < 0.02;
}

function selectViewer (pane: PaneState): ViewerVm {
  const v = pane.viewer!;
  const e = v.entry;
  const natural = v.data ? viewerKindOf(e, v.data) : "hex";
  const facts = [
    e.spectrum ? t(KIND_KEYS[e.spectrum.kind]) : "",
    formatSizeWithUnit(v.data?.length ?? e.size),
    e.spectrum?.start !== undefined && e.spectrum.kind !== "basic" ? t("panels.fileManager.viewer.start", { start: e.spectrum.start }) : "",
    e.spectrum?.kind === "basic" && e.spectrum.start !== undefined ? t("panels.fileManager.viewer.line", { line: e.spectrum.start }) : ""
  ].filter(Boolean).join(" · ");
  return {
    title: e.name,
    facts,
    kind: v.hex ? "hex" : natural,
    loading: v.status === "loading",
    error: v.status === "error" && v.error ? errorText(v.error.code, v.error.name) : undefined,
    data: v.data,
    basicEnd: e.spectrum?.variablesOffset,
    hexLabel: t("panels.fileManager.viewer.hex"),
    listingLabel: t(natural === "screen" ? "panels.fileManager.viewer.picture" : natural === "text" ? "panels.fileManager.viewer.text" : "panels.fileManager.viewer.listing"),
    memoryLabel: t("panels.fileManager.viewer.memory"),
    closeLabel: t("panels.fileManager.viewer.close"),
    hex: v.hex,
    hasListing: natural !== "hex"
  };
}

// -------------------------------------------------------------------------------------------------
// The right-click menu (Phase 7)

const CONTEXT: { key: ContextKey; label: MessageKey; keyHint: string }[] = [
  { key: "view", label: "panels.fileManager.context.view", keyHint: "F3" },
  { key: "edit", label: "panels.fileManager.context.edit", keyHint: "F4" },
  { key: "copy", label: "panels.fileManager.command.copy", keyHint: "F5" },
  { key: "move", label: "panels.fileManager.command.move", keyHint: "F6" },
  { key: "rename", label: "panels.fileManager.command.rename", keyHint: "⇧F6" },
  { key: "delete", label: "panels.fileManager.command.delete", keyHint: "F8" },
  { key: "moveUp", label: "panels.fileManager.context.moveUp", keyHint: "Alt+↑" },
  { key: "moveDown", label: "panels.fileManager.context.moveDown", keyHint: "Alt+↓" },
  { key: "reveal", label: "panels.fileManager.context.reveal", keyHint: "" }
];

function selectContext (state: FmState, pane: PaneState): ContextItemVm[] {
  const row = paneRows(pane)[pane.cursor];
  const entry = row?.kind === "entry" ? row.entry : undefined;
  const onHost = pane.drive?.kind === "host" || pane.drive?.kind === "project";
  const tape = pane.listing?.columns === "tape";
  const writable = !!pane.drive && !pane.drive.readOnly && !state.job;
  const file = !!entry && !entry.isDirectory;
  const enabled: Record<ContextKey, boolean> = {
    view: file,
    edit: file && onHost,
    copy: !!entry && !state.job,
    move: !!entry && writable,
    rename: !!entry && writable,
    delete: !!entry && writable,
    moveUp: tape && file && writable && pane.cursor > 0 && paneRows(pane)[pane.cursor - 1]?.kind === "entry",
    moveDown: tape && file && writable && pane.cursor < paneRows(pane).length - 1,
    reveal: !!entry && onHost
  };
  return CONTEXT.filter((c) => (c.key === "moveUp" || c.key === "moveDown" ? tape : c.key === "reveal" ? onHost : true)).map((c) => ({
    key: c.key,
    label: t(c.label),
    keyHint: c.keyHint,
    enabled: enabled[c.key]
  }));
}
