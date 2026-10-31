import path from "path";

import { app } from "electron";

import { FmError, type FmDriveRef, type FmListing } from "@common/fileManager/fmTypes";
import { getProjectDirectoryContentFilter } from "../directory-content";
import { isActiveSdCard } from "../hard-disk-edit";
import { mainStore } from "../main-store";
import { getKliveHomeBase } from "../portable";
import { withSdCardAccess } from "../sd-card-access";
import {
  defaultHostEnv,
  listHostDrives,
  listHostFolder,
  listImageFolder,
  openImageDrives,
  projectDriveOf,
  readDriveFile,
  type FmHardDiskAccess,
  type FmHostEnv
} from "./fmDrives";

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
