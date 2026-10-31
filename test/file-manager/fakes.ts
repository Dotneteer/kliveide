import { vi } from "vitest";

import { fmColumnSetOf, FmError, type FmDriveRef, type FmEntry, type FmListing } from "@common/fileManager/fmTypes";
import type {
  FmConflictDecision,
  FmDeleteResult,
  FmJobResult,
  FmJobStatus,
  FmTransferPlan,
  FmTransferRequest
} from "@common/fileManager/fmJobTypes";
import {
  FileManagerController,
  type ConflictAnswer,
  type FileManagerPorts,
  type TransferConfirmation,
  type TransferDialogRequest
} from "@renderer/appIde/DocumentPanels/FileManager/FileManagerController";
import type { PaneLocation } from "@renderer/appIde/DocumentPanels/FileManager/FileManagerModel";
import { harnessFor } from "../mvc/ControllerHarness";

/*
 * A fake main process for the File Manager's controller: a few drives, each a tree of folders, and
 * images that open as drives of their own.
 */

export function drive (over: Partial<FmDriveRef> & Pick<FmDriveRef, "id">): FmDriveRef {
  return {
    kind: "host",
    role: "volume",
    group: "computer",
    name: over.id,
    root: "/",
    fileSystem: "",
    readOnly: false,
    freeBytes: 2 * 1024 * 1024 * 1024,
    ...over
  };
}

export const ROOT = drive({ id: "host:/", role: "root", name: "Macintosh HD", root: "/" });
export const HOME = drive({ id: "host:/home/me", role: "home", name: "me", root: "/home/me" });
export const PROJECT = drive({ id: "project:/home/me/game", kind: "project", role: "project", group: "project", name: "game", root: "/home/me/game" });
export const GAME_DSK = drive({ id: "image:/home/me/game/game.dsk", kind: "image", role: "image", group: "images", name: "game.dsk", root: "/home/me/game/game.dsk", fileSystem: "+3DOS", freeBytes: 120_000 });

export function file (name: string, size: number, over: Partial<FmEntry> = {}): FmEntry {
  return { name, path: `/${name}`, isDirectory: false, size, modified: Date.UTC(2026, 9, 30, 21, 14), ...over };
}

type Tree = Record<string, FmEntry[]>;

/** The folders of each drive: drive id -> folder ("" is the top) -> entries */
export const TREES: Record<string, Tree> = {
  [HOME.id]: {
    "/home/me": [
      file("game", 0, { path: "/home/me/game", isDirectory: true }),
      file("notes.txt", 120, { path: "/home/me/notes.txt" }),
      file(".profile", 30, { path: "/home/me/.profile", hidden: true })
    ],
    "/home/me/game": []
  },
  [PROJECT.id]: {
    "/home/me/game": [
      file("tapes", 0, { path: "/home/me/game/tapes", isDirectory: true }),
      file("game.dsk", 194_816, { path: "/home/me/game/game.dsk", imageKind: "image" }),
      file("b.tap", 12_410, { path: "/home/me/game/b.tap" }),
      file("a.bas", 1_204, { path: "/home/me/game/a.bas", modified: Date.UTC(2026, 9, 1) })
    ],
    "/home/me/game/tapes": [file("music.tzx", 44_031, { path: "/home/me/game/tapes/music.tzx" })]
  },
  [GAME_DSK.id]: {
    "": [
      file("DISK", 214, { path: "DISK", spectrum: { kind: "basic", start: 10, user: 0, attributes: { readOnly: false, system: false, archive: false } } }),
      file("GAME.BIN", 11_900, { path: "GAME.BIN", spectrum: { kind: "code", start: 24000, user: 0, attributes: { readOnly: true, system: false, archive: true } } })
    ]
  }
};

const DRIVES = [ROOT, HOME, PROJECT, GAME_DSK];

function parentOf (driveRef: FmDriveRef, dir: string): string | undefined {
  if (driveRef.kind === "image") return undefined;
  if (dir === driveRef.root) return undefined;
  return dir.slice(0, dir.lastIndexOf("/")) || "/";
}

export function fakeListing (driveId: string, dir?: string): FmListing {
  const d = DRIVES.find((x) => x.id === driveId);
  if (!d) throw new FmError("notFound", `${driveId} is gone`, { name: driveId });
  const folder = dir ?? (d.kind === "image" ? "" : d.root);
  const entries = TREES[driveId]?.[folder];
  if (!entries) throw new FmError("notFound", `${folder} does not exist.`, { name: folder });
  const crumbs = [{ label: "", dir: d.kind === "image" ? "" : d.root }];
  if (folder && folder !== d.root) crumbs.push({ label: folder.slice(folder.lastIndexOf("/") + 1), dir: folder });
  return { drive: d, dir: folder, parentDir: parentOf(d, folder), crumbs, columns: fmColumnSetOf(d.fileSystem), entries };
}

export function fakePlan (over: Partial<FmTransferPlan> = {}): FmTransferPlan {
  return {
    id: "fm-job-1",
    move: false,
    from: "host",
    to: "host",
    items: [
      { id: 0, sourcePath: "/home/me/game/a.bas", sourceName: "a.bas", relDir: "", isDirectory: false, targetName: "a.bas", size: 1204, becomes: { as: "asIs" }, conflict: false, shortened: false, part: false },
      { id: 1, sourcePath: "/home/me/game/b.tap", sourceName: "b.tap", relDir: "", isDirectory: false, targetName: "b.tap", size: 12410, becomes: { as: "asIs" }, conflict: false, shortened: false, part: false }
    ],
    skippedFolders: [],
    needBytes: 13614,
    freeBytes: 1_000_000,
    fits: true,
    ...over
  };
}

export type PortOptions = {
  listDrives?: FmDriveRef[];
  pickFile?: string;
  plan?: FmTransferPlan;
  result?: FmJobResult;
  confirm?: Partial<TransferConfirmation> | "cancel";
  conflictAnswers?: ConflictAnswer[];
  deleteOk?: boolean;
  newName?: string;
};

export function makePorts (over: PortOptions = {}) {
  const saved: [PaneLocation | undefined, PaneLocation | undefined][] = [];
  const conflictAnswers = [...(over.conflictAnswers ?? [])];
  const ports = {
    fm: {
      listDrives: vi.fn(async () => over.listDrives ?? [ROOT, HOME, PROJECT]),
      openImage: vi.fn(async (filePath: string) => {
        if (filePath === GAME_DSK.root) return [GAME_DSK];
        throw new FmError("unformatted", "no", { name: filePath });
      }),
      list: vi.fn(async (driveId: string, dir?: string) => fakeListing(driveId, dir)),
      planTransfer: vi.fn(async (request: FmTransferRequest) => ({ ...(over.plan ?? fakePlan()), move: request.move })),
      runTransfer: vi.fn(async (_id: string, _decisions: Record<number, FmConflictDecision>): Promise<FmJobResult> =>
        over.result ?? { written: 2, skipped: 0, failed: [], cancelled: false }),
      jobStatus: vi.fn(async (): Promise<FmJobStatus> => ({ state: "running", done: 1, total: 2, bytesDone: 0, bytesTotal: 0, current: "b.tap" })),
      cancelJob: vi.fn(async () => {}),
      deleteEntries: vi.fn(async (_driveId: string, paths: string[]): Promise<FmDeleteResult> => ({ deleted: paths.length, failed: [] })),
      mkdir: vi.fn(async (_d: string, dir: string, name: string) => `${dir}/${name}`),
      rename: vi.fn(async (_d: string, p: string, name: string) => `${p}/../${name}`)
    },
    dialogs: {
      confirmTransfer: vi.fn(async (request: TransferDialogRequest): Promise<TransferConfirmation | undefined> =>
        over.confirm === "cancel" ? undefined : { plan: request.plan, options: request.options, onExisting: "ask", ...over.confirm }),
      resolveConflict: vi.fn(async (): Promise<ConflictAnswer> => conflictAnswers.shift() ?? { kind: "skip" }),
      confirmDelete: vi.fn(async () => over.deleteOk ?? true),
      askFolderName: vi.fn(async () => over.newName),
      askNewName: vi.fn(async () => over.newName)
    },
    wait: vi.fn(async () => {}),
    picker: { pickFile: vi.fn(async () => over.pickFile) },
    locations: { save: vi.fn((l: [PaneLocation | undefined, PaneLocation | undefined]) => void saved.push(l)) }
  } satisfies FileManagerPorts;
  return { ports, saved };
}

export async function openFileManager (
  over: PortOptions = {},
  locations?: [PaneLocation | undefined, PaneLocation | undefined]
) {
  const { ports, saved } = makePorts(over);
  const controller = new FileManagerController(ports);
  const h = harnessFor(controller, { ports, saved });
  await h.dispatch({ type: "activated", locations });
  await h.settle();
  return h;
}
