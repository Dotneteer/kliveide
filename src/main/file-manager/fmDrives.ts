import fs from "fs";
import path from "path";

import { openDiskFileSystem } from "@common/diskfs/open";
import { FAT_PARTITION_TYPES, partitionDevice, readPartitions } from "@common/diskfs/blockDevice";
import { FatFileSystem } from "@common/diskfs/fat";
import { DiskFsError, type DiskFileEntry, type DiskFileSystem } from "@common/diskfs/types";
import {
  FmError,
  fmColumnSetOf,
  fmImageKindOf,
  type FmCrumb,
  type FmDriveRef,
  type FmEntry,
  type FmListing
} from "@common/fileManager/fmTypes";
import { withHardDisk } from "../hard-disk-images";

/*
 * The File Manager's drives in the main process (.plans/FILE_MANAGER_PLAN.md §5.1, Phase 1): the
 * host's volumes and folders, the project, floppy and Microdrive images held in memory while read,
 * and hard-disk images read sector by sector. Read-only in this phase; the jobs of Phase 4 write.
 *
 * Nothing here imports Electron: what depends on the running app (the Klive folders, the project's
 * exclusions, the SD card's lock) is handed in, so the module runs under the node test project.
 */

// -------------------------------------------------------------------------------------------------
// The host's drives

/** What listing the host's drives needs from the system: real by default, faked in tests */
export type FmHostEnv = {
  platform: NodeJS.Platform;
  homeDir: string;
  /** The folder holding `Klive` and `KliveProjects` (the home folder, or the portable data folder) */
  kliveBase: string;
  exists(p: string): boolean;
  /** Folder names in a folder; empty when it cannot be read */
  readdir(p: string): string[];
  realpath(p: string): string;
  isWritable(p: string): boolean;
  space(p: string): { free: number; total: number } | undefined;
};

export function defaultHostEnv (homeDir: string, kliveBase = homeDir): FmHostEnv {
  return {
    platform: process.platform,
    homeDir,
    kliveBase,
    exists: (p) => fs.existsSync(p),
    readdir: (p) => {
      try {
        return fs.readdirSync(p);
      } catch {
        return [];
      }
    },
    realpath: (p) => {
      try {
        return fs.realpathSync(p);
      } catch {
        return p;
      }
    },
    isWritable: (p) => {
      try {
        fs.accessSync(p, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    },
    space: hostSpace
  };
}

export function hostSpace (p: string): { free: number; total: number } | undefined {
  try {
    const s = fs.statfsSync(p);
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    return undefined;
  }
}

function hostDrive (env: FmHostEnv, root: string, role: FmDriveRef["role"], name: string): FmDriveRef {
  const space = env.space(root);
  return {
    id: `host:${root}`,
    kind: "host",
    role,
    group: "computer",
    name,
    root,
    fileSystem: "",
    readOnly: !env.isWritable(root),
    freeBytes: space?.free,
    totalBytes: space?.total
  };
}

/** The volumes of this computer, then the home folder and Klive's own folders */
export function listHostDrives (env: FmHostEnv): FmDriveRef[] {
  const drives: FmDriveRef[] = [];
  if (env.platform === "win32") {
    for (let code = 65; code <= 90; code++) {
      const root = `${String.fromCharCode(code)}:\\`;
      if (env.exists(root)) drives.push(hostDrive(env, root, "volume", root.slice(0, 2)));
    }
  } else if (env.platform === "darwin") {
    // --- /Volumes holds every mounted volume; the boot volume is there as a link to "/"
    // --- macOS mounts its own Time Machine snapshots there too (`com.apple.TimeMachine.localsnapshots`)
    const volumes = env.readdir("/Volumes").filter((n) => !n.startsWith(".") && !n.startsWith("com.apple."));
    const boot = volumes.find((n) => env.realpath(`/Volumes/${n}`) === "/");
    drives.push(hostDrive(env, "/", "root", boot ?? "/"));
    for (const name of volumes) {
      if (name !== boot) drives.push(hostDrive(env, `/Volumes/${name}`, "volume", name));
    }
  } else {
    drives.push(hostDrive(env, "/", "root", "/"));
    const user = path.basename(env.homeDir);
    for (const base of [`/media/${user}`, `/run/media/${user}`, "/mnt"]) {
      for (const name of env.readdir(base).filter((n) => !n.startsWith("."))) {
        drives.push(hostDrive(env, `${base}/${name}`, "volume", name));
      }
    }
  }
  drives.push(hostDrive(env, env.homeDir, "home", path.basename(env.homeDir)));
  const klive = path.join(env.kliveBase, "Klive");
  if (env.exists(klive)) drives.push(hostDrive(env, klive, "klive", "Klive"));
  const projects = path.join(env.kliveBase, "KliveProjects");
  if (env.exists(projects)) drives.push(hostDrive(env, projects, "kliveProjects", "KliveProjects"));
  return drives;
}

/** The open project as a drive */
export function projectDriveOf (env: FmHostEnv, folder: string): FmDriveRef {
  const drive = hostDrive(env, path.resolve(folder), "project", path.basename(folder));
  return { ...drive, id: `project:${drive.root}`, kind: "project", group: "project" };
}

// -------------------------------------------------------------------------------------------------
// Host folders

/** Lists a folder of a host or project drive; `filter` gets the path relative to the drive's top */
export function listHostFolder (
  drive: FmDriveRef,
  dir: string | undefined,
  env: Pick<FmHostEnv, "space">,
  filter?: (relative: string) => boolean
): FmListing {
  const root = path.resolve(drive.root);
  const folder = insideOrRoot(root, dir);
  let names: string[];
  try {
    if (!fs.statSync(folder).isDirectory()) throw new FmError("notAFolder", `${folder} is not a folder.`, { name: folder });
    names = fs.readdirSync(folder);
  } catch (err) {
    throw hostError(err, folder);
  }
  const entries: FmEntry[] = [];
  for (const name of names) {
    const full = path.join(folder, name);
    if (filter && !filter(path.relative(root, full))) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      // --- A broken link or a file that vanished while listing: not shown
      continue;
    }
    const isDirectory = stat.isDirectory();
    const entry: FmEntry = {
      name,
      path: full,
      isDirectory,
      size: isDirectory ? 0 : stat.size,
      modified: stat.mtimeMs
    };
    if (name.startsWith(".")) entry.hidden = true;
    const imageKind = isDirectory ? undefined : fmImageKindOf(name);
    if (imageKind) entry.imageKind = imageKind;
    entries.push(entry);
  }
  const space = env.space(root);
  return {
    drive: { ...drive, freeBytes: space?.free ?? drive.freeBytes, totalBytes: space?.total ?? drive.totalBytes },
    dir: folder,
    parentDir: folder === root ? undefined : path.dirname(folder),
    crumbs: hostCrumbs(root, folder),
    columns: "host",
    entries
  };
}

function insideOrRoot (root: string, dir: string | undefined): string {
  if (!dir) return root;
  const resolved = path.resolve(dir);
  const relative = path.relative(root, resolved);
  return relative.startsWith("..") || path.isAbsolute(relative) ? root : resolved;
}

function hostCrumbs (root: string, folder: string): FmCrumb[] {
  const crumbs: FmCrumb[] = [{ label: "", dir: root }];
  const relative = path.relative(root, folder);
  if (!relative) return crumbs;
  let at = root;
  for (const part of relative.split(path.sep)) {
    at = path.join(at, part);
    crumbs.push({ label: part, dir: at });
  }
  return crumbs;
}

function hostError (err: unknown, name: string): Error {
  if (err instanceof FmError) return err;
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return new FmError("notFound", `${name} does not exist.`, { name });
  if (code === "EACCES" || code === "EPERM") return new FmError("accessDenied", `${name} cannot be read.`, { name });
  if (code === "ENOTDIR") return new FmError("notAFolder", `${name} is not a folder.`, { name });
  return new FmError("failed", (err as Error)?.message ?? String(err), { name });
}

// -------------------------------------------------------------------------------------------------
// Images

/** How the File Manager reaches a hard-disk image: with the machine's SD card under its lock */
export type FmHardDiskAccess = <T>(filePath: string, op: () => T) => Promise<T>;

/** Plain access, for an image no machine uses */
export const directHardDiskAccess: FmHardDiskAccess = async (_filePath, op) => op();

/** An image file opened as drives: one for a floppy or cartridge, one per FAT partition of a hard disk */
export async function openImageDrives (filePath: string, access: FmHardDiskAccess = directHardDiskAccess): Promise<FmDriveRef[]> {
  const root = path.resolve(filePath);
  const name = path.basename(root);
  const kind = fmImageKindOf(root);
  if (!kind) throw new FmError("unsupported", `${name} is not an image Klive opens as a drive.`, { name });
  const readOnly = !isWritable(root);
  try {
    if (kind === "image") {
      const diskFs = openDiskFileSystem(readImage(root), root);
      const info = diskFs.info();
      return [{
        id: `image:${root}`,
        kind: "image",
        role: "image",
        group: "images",
        name,
        root,
        fileSystem: info.system,
        readOnly,
        freeBytes: info.freeBytes,
        totalBytes: info.totalBytes
      }];
    }
    return await access(root, () =>
      withHardDisk(root, (device) => {
        const partitions = readPartitions(device).filter((p) => p.whole || FAT_PARTITION_TYPES.has(p.type));
        if (partitions.length === 0) throw new DiskFsError("unformatted", "The disk has no FAT partition.");
        return partitions.map((p): FmDriveRef => {
          const info = new FatFileSystem(partitionDevice(device, p)).info();
          return {
            id: `hd:${root}#${p.index}`,
            kind: "hardDisk",
            role: partitions.length > 1 ? "partition" : "image",
            group: "images",
            name,
            root,
            partition: p.index,
            fileSystem: info.system,
            readOnly,
            freeBytes: info.freeBytes,
            totalBytes: info.totalBytes
          };
        });
      })
    );
  } catch (err) {
    throw imageError(err, name);
  }
}

/** Lists a folder of an image drive ("" is its top; FAT folders are `A/B`) */
export async function listImageFolder (
  drive: FmDriveRef,
  dir: string | undefined,
  access: FmHardDiskAccess = directHardDiskAccess
): Promise<FmListing> {
  const folder = (dir ?? "").replace(/^\/+|\/+$/g, "");
  try {
    if (drive.kind === "image") {
      const diskFs = openDiskFileSystem(readImage(drive.root), drive.root);
      return imageListing(drive, diskFs, "", diskFs.list());
    }
    return await access(drive.root, () =>
      withHardDisk(drive.root, (device) => {
        const fat = FatFileSystem.open(device, drive.partition);
        return imageListing(drive, fat, folder, fat.list({ dir: folder }), false);
      })
    );
  } catch (err) {
    throw imageError(err, folder || drive.name);
  }
}

/** A file's bytes on a drive (its Spectrum header left out) */
export async function readDriveFile (
  drive: FmDriveRef,
  filePath: string,
  access: FmHardDiskAccess = directHardDiskAccess
): Promise<Uint8Array> {
  try {
    if (drive.kind === "host" || drive.kind === "project") {
      const root = path.resolve(drive.root);
      const full = path.resolve(filePath);
      if (path.relative(root, full).startsWith("..")) {
        throw new FmError("notFound", `${filePath} is not on ${drive.name}.`, { name: filePath });
      }
      return new Uint8Array(fs.readFileSync(full));
    }
    if (drive.kind === "image") return openDiskFileSystem(readImage(drive.root), drive.root).read(filePath);
    return await access(drive.root, () =>
      withHardDisk(drive.root, (device) => FatFileSystem.open(device, drive.partition).read(filePath))
    );
  } catch (err) {
    throw drive.kind === "host" || drive.kind === "project" ? hostError(err, filePath) : imageError(err, filePath);
  }
}

function imageListing (drive: FmDriveRef, diskFs: DiskFileSystem, folder: string, files: DiskFileEntry[], withInfo = true): FmListing {
  const entries = files
    .filter((f) => !f.deleted)
    .map((f): FmEntry => {
      const label = f.isDirectory || diskFs.system === "fat" ? f.name.slice(f.name.lastIndexOf("/") + 1) : f.name;
      const entry: FmEntry = {
        name: label,
        path: f.name,
        isDirectory: !!f.isDirectory,
        size: f.size
      };
      if (f.hidden) entry.hidden = true;
      if (diskFs.system !== "fat") {
        entry.spectrum = {
          kind: f.kind,
          start: f.start,
          variablesOffset: f.variablesOffset,
          user: f.user,
          variableName: f.variableName,
          attributes: f.attributes
        };
      } else {
        const imageKind = f.isDirectory ? undefined : fmImageKindOf(label);
        if (imageKind) entry.imageKind = imageKind;
      }
      return entry;
    });
  const crumbs: FmCrumb[] = [{ label: "", dir: "" }];
  let at = "";
  for (const part of folder ? folder.split("/") : []) {
    at = at ? `${at}/${part}` : part;
    crumbs.push({ label: part, dir: at });
  }
  const info = withInfo ? diskFs.info() : undefined;
  return {
    drive: info ? { ...drive, freeBytes: info.freeBytes, totalBytes: info.totalBytes } : drive,
    dir: folder,
    parentDir: folder ? folder.slice(0, Math.max(0, folder.lastIndexOf("/"))) : undefined,
    crumbs,
    columns: fmColumnSetOf(drive.fileSystem),
    entries
  };
}

function readImage (filePath: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(filePath));
}

function isWritable (filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function imageError (err: unknown, name: string): Error {
  if (err instanceof FmError) return err;
  if (err instanceof DiskFsError) {
    if (err.code === "notFound") return new FmError("notFound", err.message, { name });
    if (err.code === "unformatted") return new FmError("unformatted", err.message, { name });
    return new FmError("unsupported", err.message, { name });
  }
  return hostError(err, name);
}
