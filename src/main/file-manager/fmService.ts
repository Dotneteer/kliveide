import path from "path";

import { app, shell } from "electron";

import { FmError, type FmDriveRef, type FmListing } from "@common/fileManager/fmTypes";
import type {
  FmConflictDecision,
  FmDeleteResult,
  FmJobResult,
  FmJobStatus,
  FmTransferPlan,
  FmTransferRequest
} from "@common/fileManager/fmJobTypes";
import { beginDiskImageEdit, cancelDiskImageEdit, commitDiskImageEdit, type DiskImageEditStart } from "../disk-image-edit";
import { getProjectDirectoryContentFilter } from "../directory-content";
import { aroundSdCard, isActiveSdCard } from "../hard-disk-edit";
import { mainStore } from "../main-store";
import { getKliveHomeBase } from "../portable";
import { withSdCardAccess } from "../sd-card-access";
import {
  defaultHostEnv,
  hostSpace,
  listHostDrives,
  listHostFolder,
  listImageFolder,
  openImageDrives,
  projectDriveOf,
  readDriveFile,
  type FmHardDiskAccess,
  type FmHostEnv
} from "./fmDrives";
import {
  cancelJob,
  deleteEntries,
  jobStatus,
  makeFolder,
  planTransfer,
  renameEntry,
  runTransfer,
  type FmJobDeps
} from "./fmJobs";

/*
 * The File Manager's requests as `MainApi` serves them (.plans/FILE_MANAGER_PLAN.md §5.1, D2). The
 * renderer names a drive by its id; this keeps the drives it handed out, and rebuilds one it does
 * not know from its id (a pane restored from an earlier session).
 */

const known = new Map<string, FmDriveRef>();

function hostEnv (): FmHostEnv {
  return defaultHostEnv(app.getPath("home"), getKliveHomeBase());
}

function remember (drives: FmDriveRef[]): FmDriveRef[] {
  drives.forEach((d) => known.set(d.id, d));
  return drives;
}

/** The machine's SD card is read under its lock, so no emulated sector write runs beside it */
const sdCardAwareAccess: FmHardDiskAccess = (filePath, op) =>
  isActiveSdCard(filePath) ? withSdCardAccess(op) : Promise.resolve().then(op);

/** The drives of this computer and the open project */
export function fmListDrives (): FmDriveRef[] {
  const env = hostEnv();
  const drives = listHostDrives(env);
  const folder = mainStore.getState().project?.folderPath;
  if (folder) drives.push(projectDriveOf(env, folder));
  return remember(drives);
}

/** An image file as drives (one per FAT partition) */
export async function fmOpenImage (filePath: string): Promise<FmDriveRef[]> {
  return remember(await openImageDrives(filePath, sdCardAwareAccess));
}

async function resolveDrive (driveId: string): Promise<FmDriveRef> {
  const drive = known.get(driveId);
  if (drive) return drive;
  const env = hostEnv();
  const [, scheme, rest] = /^([a-z]+):(.*)$/.exec(driveId) ?? [];
  if (scheme === "host" && rest) {
    const found = listHostDrives(env).find((d) => d.id === driveId);
    if (found) return remember([found])[0];
  } else if (scheme === "project" && rest && path.resolve(rest) === path.resolve(mainStore.getState().project?.folderPath ?? "")) {
    return remember([projectDriveOf(env, rest)])[0];
  } else if (scheme === "image" && rest) {
    await fmOpenImage(rest);
  } else if (scheme === "hd" && rest) {
    await fmOpenImage(rest.replace(/#\d+$/, ""));
  }
  const reopened = known.get(driveId);
  if (reopened) return reopened;
  throw new FmError(scheme === "project" ? "noProject" : "notFound", `The drive ${driveId} is not available.`, { name: driveId });
}

/** A folder of a drive */
export async function fmList (driveId: string, dir?: string): Promise<FmListing> {
  const drive = await resolveDrive(driveId);
  if (drive.kind === "host") return listHostFolder(drive, dir, hostEnv());
  if (drive.kind === "project") {
    const filter = await getProjectDirectoryContentFilter();
    return listHostFolder(drive, dir, hostEnv(), filter);
  }
  return listImageFolder(drive, dir, sdCardAwareAccess);
}

/** A file's bytes */
export async function fmRead (driveId: string, filePath: string): Promise<Uint8Array> {
  return readDriveFile(await resolveDrive(driveId), filePath, sdCardAwareAccess);
}

// -------------------------------------------------------------------------------------------------
// Jobs (Phase 4)

/** The running app's side of a job: the Trash, the disk-edit path, the SD card's lock */
const jobDeps: FmJobDeps = {
  trash: (p) => shell.trashItem(p),
  beginImageEdit: async (p) => {
    const { contents, ...token } = await beginDiskImageEdit(p);
    return { contents, token };
  },
  commitImageEdit: (p, contents, token) => commitDiskImageEdit(p, contents, token as Omit<DiskImageEditStart, "contents">),
  cancelImageEdit: (token) => cancelDiskImageEdit(token as Omit<DiskImageEditStart, "contents">),
  hardDiskRead: sdCardAwareAccess,
  hardDiskWrite: (filePath, op) => aroundSdCard(filePath, op),
  space: hostSpace
};

export async function fmPlanTransfer (request: FmTransferRequest): Promise<FmTransferPlan> {
  const source = await resolveDrive(request.sourceDriveId);
  const target = await resolveDrive(request.targetDriveId);
  return planTransfer(request, source, target, jobDeps);
}

export function fmRunTransfer (id: string, decisions: Record<number, FmConflictDecision>): Promise<FmJobResult> {
  return runTransfer(id, decisions, jobDeps);
}

export function fmJobStatus (id: string): FmJobStatus | undefined {
  return jobStatus(id);
}

export function fmCancelJob (id: string): void {
  cancelJob(id);
}

export async function fmDelete (driveId: string, paths: string[]): Promise<FmDeleteResult> {
  return deleteEntries(await resolveDrive(driveId), paths, jobDeps);
}

export async function fmMkdir (driveId: string, dir: string, name: string): Promise<string> {
  return makeFolder(await resolveDrive(driveId), dir, name, jobDeps);
}

export async function fmRename (driveId: string, entryPath: string, newName: string): Promise<string> {
  return renameEntry(await resolveDrive(driveId), entryPath, newName, jobDeps);
}
