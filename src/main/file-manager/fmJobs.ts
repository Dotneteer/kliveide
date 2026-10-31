import fs from "fs";
import path from "path";

import { diskImageBytes, openDiskFileSystem } from "@common/diskfs/open";
import { FatFileSystem } from "@common/diskfs/fat";
import { DiskFsError, type DiskFileSystem } from "@common/diskfs/types";
import {
  buildPlan,
  fmFileSystemOf,
  isCatalogue,
  type FmOutFile,
  type FmPlanItem,
  type FmPlanSource
} from "@common/fileManager/fmTransfer";
import { FmError, type FmDriveRef, type FmErrorCode } from "@common/fileManager/fmTypes";
import type {
  FmConflictDecision,
  FmDeleteResult,
  FmJobResult,
  FmJobStatus,
  FmTransferPlan,
  FmTransferRequest
} from "@common/fileManager/fmJobTypes";
import { withHardDisk } from "../hard-disk-images";
import type { FmHardDiskAccess } from "./fmDrives";

/*
 * The File Manager's jobs (.plans/FILE_MANAGER_PLAN.md §5.2, Phase 4): copy and move planned first,
 * then run with progress and cancel; delete, new folder and rename. Every write to an image goes
 * through the paths that already keep a mounted disk and the machine's SD card safe:
 *
 * - a floppy or cartridge is edited in memory and committed once, at the end of the job, through the
 *   Disk Explorer's edit path (a paused machine, the file written beside and renamed over, a `.bak`);
 *   a failed or cancelled job commits nothing;
 * - a hard-disk image is written in place, one operation at a time under the SD card's lock;
 * - this computer's files go to the Trash when deleted (D7).
 *
 * Electron is kept out: what needs the running app arrives in `FmJobDeps`.
 */

export type FmImageEditToken = unknown;

export type FmJobDeps = {
  /** Moves a host file or folder to the Trash */
  trash(filePath: string): Promise<void>;
  /** Starts an edit of a floppy or cartridge image: its bytes, and what `commit`/`cancel` need */
  beginImageEdit(filePath: string): Promise<{ contents: Uint8Array; token: FmImageEditToken }>;
  commitImageEdit(filePath: string, contents: Uint8Array, token: FmImageEditToken): Promise<void>;
  cancelImageEdit(token: FmImageEditToken): Promise<void>;
  /** Reads a hard-disk image (the machine's SD card under its lock) */
  hardDiskRead: FmHardDiskAccess;
  /** Writes a hard-disk image (the machine's SD card paused, locked and re-read afterwards) */
  hardDiskWrite: FmHardDiskAccess;
  /** Free space on a host folder */
  space(filePath: string): { free: number; total: number } | undefined;
};

/** Plain deps for an image no machine uses (tests, the CLI) */
export function directJobDeps (over: Partial<FmJobDeps> = {}): FmJobDeps {
  return {
    trash: async (p) => fs.rmSync(p, { recursive: true, force: true }),
    beginImageEdit: async (p) => ({ contents: new Uint8Array(fs.readFileSync(p)), token: undefined }),
    commitImageEdit: async (p, contents) => fs.writeFileSync(p, contents),
    cancelImageEdit: async () => {},
    hardDiskRead: async (_p, op) => op(),
    hardDiskWrite: async (_p, op) => op(),
    space: () => undefined,
    ...over
  };
}

const isHost = (d: FmDriveRef) => d.kind === "host" || d.kind === "project";

// -------------------------------------------------------------------------------------------------
// Errors

function codeOf (err: unknown): FmErrorCode {
  if (err instanceof FmError) return err.code;
  if (err instanceof DiskFsError) {
    switch (err.code) {
      case "exists":
      case "diskFull":
      case "directoryFull":
      case "badName":
      case "readOnly":
      case "notFound":
      case "unformatted":
        return err.code;
      default:
        return "unsupported";
    }
  }
  const sys = (err as NodeJS.ErrnoException)?.code;
  if (sys === "ENOENT") return "notFound";
  if (sys === "EEXIST" || sys === "ENOTEMPTY") return "exists";
  if (sys === "EACCES" || sys === "EPERM" || sys === "EROFS") return "accessDenied";
  if (sys === "ENOSPC") return "diskFull";
  return "failed";
}

function asFmError (err: unknown, name: string): FmError {
  if (err instanceof FmError) return err;
  return new FmError(codeOf(err), (err as Error)?.message ?? String(err), { name });
}

// -------------------------------------------------------------------------------------------------
// Image paths

function joinImagePath (...parts: string[]): string {
  return parts.flatMap((p) => p.split("/")).filter(Boolean).join("/");
}

function imageLeaf (p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}

// -------------------------------------------------------------------------------------------------
// Sources

type SourceSession = {
  collect(paths: string[], read: boolean): Promise<FmPlanSource[]>;
  read(filePath: string): Promise<Uint8Array>;
};

function hostSource (): SourceSession {
  return {
    async collect (paths, read) {
      const out: FmPlanSource[] = [];
      const walk = (full: string, relDir: string) => {
        const stat = fs.statSync(full);
        const name = path.basename(full);
        if (stat.isDirectory()) {
          out.push({ sourcePath: full, sourceName: name, relDir, isDirectory: true, size: 0 });
          const inner = relDir ? `${relDir}/${name}` : name;
          for (const child of fs.readdirSync(full).sort()) walk(path.join(full, child), inner);
          return;
        }
        out.push({
          sourcePath: full,
          sourceName: name,
          relDir,
          isDirectory: false,
          size: stat.size,
          file: read ? { name, data: new Uint8Array(fs.readFileSync(full)) } : undefined
        });
      };
      for (const p of paths) walk(path.resolve(p), "");
      return out;
    },
    async read (filePath) {
      return new Uint8Array(fs.readFileSync(filePath));
    }
  };
}

function floppySource (drive: FmDriveRef): SourceSession {
  let diskFs: DiskFileSystem | undefined;
  const open = () => (diskFs ??= openDiskFileSystem(new Uint8Array(fs.readFileSync(drive.root)), drive.root));
  return {
    async collect (paths) {
      const entries = open().list();
      return paths.map((p) => {
        const e = entries.find((x) => x.name === p);
        if (!e) throw new FmError("notFound", `${p} is not on ${drive.name}.`, { name: p });
        const data = open().read(p);
        return {
          sourcePath: p,
          sourceName: p,
          relDir: "",
          isDirectory: false,
          size: data.length,
          file: {
            name: p,
            data,
            spectrum: { kind: e.kind, start: e.start, variablesOffset: e.variablesOffset, variableName: e.variableName }
          }
        };
      });
    },
    async read (p) {
      return open().read(p);
    }
  };
}

function hardDiskSource (drive: FmDriveRef, deps: FmJobDeps): SourceSession {
  const withFat = <T>(op: (fat: FatFileSystem) => T) =>
    deps.hardDiskRead(drive.root, () => withHardDisk(drive.root, (device) => op(FatFileSystem.open(device, drive.partition))));
  return {
    async collect (paths, read) {
      return withFat((fat) => {
        const out: FmPlanSource[] = [];
        const walk = (p: string, relDir: string) => {
          const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
          const entry = fat.list({ dir: parent }).find((e) => e.name.toLowerCase() === p.toLowerCase());
          if (!entry) throw new FmError("notFound", `${p} is not on ${drive.name}.`, { name: p });
          const name = imageLeaf(entry.name);
          if (entry.isDirectory) {
            out.push({ sourcePath: entry.name, sourceName: name, relDir, isDirectory: true, size: 0 });
            const inner = relDir ? `${relDir}/${name}` : name;
            for (const child of fat.list({ dir: entry.name })) walk(child.name, inner);
            return;
          }
          out.push({
            sourcePath: entry.name,
            sourceName: name,
            relDir,
            isDirectory: false,
            size: entry.size,
            file: read ? { name, data: fat.read(entry.name) } : undefined
          });
        };
        for (const p of paths) walk(p, "");
        return out;
      });
    },
    async read (p) {
      return withFat((fat) => fat.read(p));
    }
  };
}

function sourceFor (drive: FmDriveRef, deps: FmJobDeps): SourceSession {
  if (isHost(drive)) return hostSource();
  if (drive.kind === "image") return floppySource(drive);
  return hardDiskSource(drive, deps);
}

// -------------------------------------------------------------------------------------------------
// Targets

type TargetSession = {
  existing(relDir: string): Promise<Set<string>>;
  freeBytes(): Promise<{ free?: number; block: number }>;
  mkdir(relDir: string, name: string): Promise<void>;
  write(relDir: string, name: string, data: () => Promise<Uint8Array>, out: FmOutFile | undefined, replace: boolean, copyFrom?: string): Promise<void>;
  /** Writes what the job did (an image's one commit) */
  commit(): Promise<void>;
  /** Drops what the job did, where it can (an image's edit) */
  cancel(): Promise<void>;
  /** A cancelled or failed job leaves nothing behind */
  atomic: boolean;
};

function hostTarget (dir: string, deps: FmJobDeps): TargetSession {
  const at = (relDir: string) => path.join(dir, ...relDir.split("/").filter(Boolean));
  return {
    atomic: false,
    async existing (relDir) {
      try {
        return new Set(fs.readdirSync(at(relDir)).map((n) => n.toLowerCase()));
      } catch {
        return new Set();
      }
    },
    async freeBytes () {
      return { free: deps.space(dir)?.free, block: 4096 };
    },
    async mkdir (relDir, name) {
      fs.mkdirSync(path.join(at(relDir), name), { recursive: true });
    },
    async write (relDir, name, data, _out, replace, copyFrom) {
      const target = path.join(at(relDir), name);
      if (!replace && fs.existsSync(target)) throw new FmError("exists", `${name} is already there.`, { name });
      fs.mkdirSync(at(relDir), { recursive: true });
      if (copyFrom) fs.copyFileSync(copyFrom, target);
      else fs.writeFileSync(target, await data());
    },
    async commit () {},
    async cancel () {}
  };
}

async function floppyTarget (drive: FmDriveRef, deps: FmJobDeps): Promise<TargetSession> {
  const { contents, token } = await deps.beginImageEdit(drive.root);
  let diskFs: DiskFileSystem;
  try {
    diskFs = openDiskFileSystem(contents, drive.root);
  } catch (err) {
    await deps.cancelImageEdit(token);
    throw asFmError(err, drive.name);
  }
  return {
    atomic: true,
    async existing () {
      return new Set(diskFs.list().map((e) => e.name.toLowerCase()));
    },
    async freeBytes () {
      const info = diskFs.info();
      return { free: info.freeBytes, block: info.blockSize };
    },
    async mkdir () {
      throw new FmError("unsupported", `${drive.name} has no folders.`, { name: drive.name });
    },
    async write (_relDir, name, data, out, replace) {
      if (replace) {
        const same = diskFs.list().find((e) => e.name.toLowerCase() === name.toLowerCase());
        if (same) diskFs.delete(same.name);
      }
      diskFs.write({
        name,
        kind: out?.kind ?? "raw",
        data: await data(),
        start: out?.start,
        variablesOffset: out?.variablesOffset,
        variableName: out?.variableName
      });
    },
    async commit () {
      await deps.commitImageEdit(drive.root, diskImageBytes(diskFs, drive.root), token);
    },
    async cancel () {
      await deps.cancelImageEdit(token);
    }
  };
}

function hardDiskTarget (drive: FmDriveRef, dir: string, deps: FmJobDeps): TargetSession {
  const edit = <T>(op: (fat: FatFileSystem) => T) =>
    deps.hardDiskWrite(drive.root, () => withHardDisk(drive.root, (device) => op(FatFileSystem.open(device, drive.partition))));
  const read = <T>(op: (fat: FatFileSystem) => T) =>
    deps.hardDiskRead(drive.root, () => withHardDisk(drive.root, (device) => op(FatFileSystem.open(device, drive.partition))));
  return {
    atomic: false,
    async existing (relDir) {
      try {
        return await read((fat) => new Set(fat.list({ dir: joinImagePath(dir, relDir) }).map((e) => imageLeaf(e.name).toLowerCase())));
      } catch {
        return new Set<string>();
      }
    },
    async freeBytes () {
      return read((fat) => {
        const info = fat.info();
        return { free: info.freeBytes, block: info.blockSize };
      });
    },
    async mkdir (relDir, name) {
      await edit((fat) => fat.mkdir(joinImagePath(dir, relDir, name)));
    },
    async write (relDir, name, data, _out, replace) {
      const bytes = await data();
      const full = joinImagePath(dir, relDir, name);
      await edit((fat) => {
        if (relDir) fat.mkdir(joinImagePath(dir, relDir));
        if (replace) {
          const same = fat.list({ dir: joinImagePath(dir, relDir) }).find((e) => imageLeaf(e.name).toLowerCase() === name.toLowerCase());
          if (same && !same.isDirectory) fat.delete(same.name);
        }
        fat.write({ name: full, kind: "raw", data: bytes });
      });
    },
    async commit () {},
    async cancel () {}
  };
}

async function targetFor (drive: FmDriveRef, dir: string, deps: FmJobDeps): Promise<TargetSession> {
  if (isHost(drive)) return hostTarget(dir, deps);
  if (drive.kind === "image") return floppyTarget(drive, deps);
  return hardDiskTarget(drive, dir, deps);
}

// -------------------------------------------------------------------------------------------------
// Plans and jobs

type Job = {
  request: FmTransferRequest;
  source: FmDriveRef;
  target: FmDriveRef;
  items: FmPlanItem[];
  outputs: Map<number, FmOutFile>;
  status: FmJobStatus;
  cancelled: boolean;
};

const jobs = new Map<string, Job>();
let nextJob = 1;

/** Plans a copy or move: what it will write, and whether it fits */
export async function planTransfer (
  request: FmTransferRequest,
  source: FmDriveRef,
  target: FmDriveRef,
  deps: FmJobDeps
): Promise<FmTransferPlan> {
  if (target.readOnly) throw new FmError("readOnly", `${target.name} cannot be written.`, { name: target.name });
  if (request.paths.length === 0) throw new FmError("notFound", "Nothing to copy.");
  const from = fmFileSystemOf(source);
  const to = fmFileSystemOf(target);
  const sourceDir = commonDir(source, request.paths);
  if (source.id === target.id && (source.kind === "image" || sameDir(source, sourceDir, request.targetDir))) {
    throw new FmError("sameFolder", "The source and the target are the same folder.", { name: request.targetDir });
  }
  if (isHost(source) && isHost(target)) {
    const into = request.paths.find((p) => isInside(path.resolve(request.targetDir), path.resolve(p)));
    if (into) throw new FmError("intoItself", `${into} cannot be copied into itself.`, { name: path.basename(into) });
  } else if (source.id === target.id && source.kind === "hardDisk") {
    const into = request.paths.find((p) => (`${request.targetDir}/`).toLowerCase().startsWith(`${p}/`.toLowerCase()));
    if (into) throw new FmError("intoItself", `${into} cannot be copied into itself.`, { name: imageLeaf(into) });
  }

  const read = isCatalogue(from) || isCatalogue(to);
  let sources: FmPlanSource[];
  try {
    sources = await sourceFor(source, deps).collect(request.paths, read);
  } catch (err) {
    throw asFmError(err, source.name);
  }
  const existingByDir = new Map<string, Set<string>>();
  const probe = await targetFor(target, request.targetDir, deps);
  let free: { free?: number; block: number } = { block: 4096 };
  try {
    const relDirs = new Set(sources.map((s) => (isCatalogue(to) ? "" : s.relDir)));
    for (const rel of relDirs) existingByDir.set(rel, await probe.existing(rel));
    free = await probe.freeBytes();
  } finally {
    await probe.cancel();
  }
  const built = buildPlan(sources, from, to, request.options, (rel) => existingByDir.get(rel) ?? new Set());
  const needBytes = built.items.reduce((sum, i) => sum + (i.isDirectory ? 0 : Math.ceil(i.size / free.block) * free.block), 0);

  const id = `fm-job-${nextJob++}`;
  // --- Only the latest few plans are kept: a dialog that re-plans on every option leaves the rest
  for (const [key, job] of jobs) if (job.status.state === "planned" && jobs.size > 8) jobs.delete(key);
  jobs.set(id, {
    request,
    source,
    target,
    items: built.items,
    outputs: built.outputs,
    status: { state: "planned", done: 0, total: built.items.length, bytesDone: 0, bytesTotal: needBytes },
    cancelled: false
  });
  return {
    id,
    move: request.move,
    from,
    to,
    items: built.items,
    skippedFolders: built.skippedFolders,
    needBytes,
    freeBytes: free.free,
    fits: free.free === undefined || needBytes <= free.free
  };
}

export function jobStatus (id: string): FmJobStatus | undefined {
  return jobs.get(id)?.status;
}

export function cancelJob (id: string): void {
  const job = jobs.get(id);
  if (job) job.cancelled = true;
}

/** Runs a planned copy or move; `decisions` answer its conflicts (a conflict without one is skipped) */
export async function runTransfer (
  id: string,
  decisions: Record<number, FmConflictDecision>,
  deps: FmJobDeps
): Promise<FmJobResult> {
  const job = jobs.get(id);
  if (!job) throw new FmError("notFound", "The copy is no longer planned.");
  if (job.status.state !== "planned") throw new FmError("failed", "The copy has already run.");
  job.status = { ...job.status, state: "running" };
  const result: FmJobResult = { written: 0, skipped: 0, failed: [], cancelled: false };
  const source = sourceFor(job.source, deps);
  const written = new Set<number>();
  let target: TargetSession;
  try {
    target = await targetFor(job.target, job.request.targetDir, deps);
  } catch (err) {
    job.status = { ...job.status, state: "done" };
    throw asFmError(err, job.target.name);
  }

  try {
    for (const item of job.items) {
      if (job.cancelled) {
        result.cancelled = true;
        break;
      }
      job.status = { ...job.status, current: item.targetName };
      const decision = item.conflict ? decisions[item.id] ?? { kind: "skip" } : undefined;
      if (decision?.kind === "skip") {
        result.skipped++;
        advance(job, item);
        continue;
      }
      const name = decision?.kind === "rename" ? decision.name : item.targetName;
      try {
        if (item.isDirectory) {
          await target.mkdir(item.relDir, name);
        } else {
          const out = job.outputs.get(item.id);
          const copyFrom = !out && isHost(job.source) && isHost(job.target) ? item.sourcePath : undefined;
          await target.write(
            item.relDir,
            name,
            async () => out?.data ?? (await source.read(item.sourcePath)),
            out,
            decision?.kind === "replace",
            copyFrom
          );
        }
        written.add(item.id);
        result.written += item.isDirectory ? 0 : 1;
      } catch (err) {
        const code = codeOf(err);
        result.failed.push({ name, code });
        // --- A full disk stops the job; on an image nothing of it is kept
        if (code === "diskFull" || code === "directoryFull") {
          result.aborted = code;
          break;
        }
      }
      advance(job, item);
    }

    if (target.atomic && (result.cancelled || result.aborted)) {
      await target.cancel();
      result.written = 0;
      written.clear();
    } else {
      await target.commit();
    }

    if (job.request.move && !result.cancelled && !result.aborted) {
      result.removeFailed = await removeMoved(job, written, deps);
    }
  } catch (err) {
    await target.cancel().catch(() => {});
    throw asFmError(err, job.target.name);
  } finally {
    job.status = { ...job.status, state: "done", current: undefined };
  }
  return result;
}

function advance (job: Job, item: FmPlanItem): void {
  job.status = {
    ...job.status,
    done: job.status.done + 1,
    bytesDone: job.status.bytesDone + (item.isDirectory ? 0 : item.size)
  };
}

/** A move removes each chosen source once everything it became was written */
async function removeMoved (job: Job, written: Set<number>, deps: FmJobDeps): Promise<number> {
  const done = job.request.paths.filter((p) => {
    const own = job.items.filter((i) => i.sourcePath === p || isUnder(job.source, i.sourcePath, p));
    return own.length > 0 && own.every((i) => written.has(i.id));
  });
  if (done.length === 0) return 0;
  // --- What was moved is gone for good, not to the Trash: its copy is the file now
  const removed = await deleteEntries(job.source, done, deps, { permanent: true });
  return removed.failed.length;
}

// -------------------------------------------------------------------------------------------------
// Delete, new folder, rename

/** Deletes files and folders: to the Trash on this computer (unless `permanent`), for good on an image */
export async function deleteEntries (
  drive: FmDriveRef,
  paths: string[],
  deps: FmJobDeps,
  options: { permanent?: boolean } = {}
): Promise<FmDeleteResult> {
  if (drive.readOnly) throw new FmError("readOnly", `${drive.name} cannot be written.`, { name: drive.name });
  const failed: { name: string; code: FmErrorCode }[] = [];
  let deleted = 0;
  if (isHost(drive)) {
    for (const p of paths) {
      try {
        if (options.permanent) fs.rmSync(p, { recursive: true });
        else await deps.trash(p);
        deleted++;
      } catch (err) {
        failed.push({ name: path.basename(p), code: codeOf(err) });
      }
    }
    return { deleted, failed };
  }
  if (drive.kind === "image") {
    const { contents, token } = await deps.beginImageEdit(drive.root);
    try {
      const diskFs = openDiskFileSystem(contents, drive.root);
      for (const p of paths) {
        try {
          diskFs.delete(p);
          deleted++;
        } catch (err) {
          failed.push({ name: p, code: codeOf(err) });
        }
      }
      if (deleted > 0) await deps.commitImageEdit(drive.root, diskImageBytes(diskFs, drive.root), token);
      else await deps.cancelImageEdit(token);
    } catch (err) {
      await deps.cancelImageEdit(token);
      throw asFmError(err, drive.name);
    }
    return { deleted, failed };
  }
  await deps.hardDiskWrite(drive.root, () =>
    withHardDisk(drive.root, (device) => {
      const fat = FatFileSystem.open(device, drive.partition);
      const remove = (p: string) => {
        const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        const entry = fat.list({ dir: parent }).find((e) => e.name.toLowerCase() === p.toLowerCase());
        if (entry?.isDirectory) for (const child of fat.list({ dir: entry.name })) remove(child.name);
        fat.delete(entry?.name ?? p);
      };
      for (const p of paths) {
        try {
          remove(p);
          deleted++;
        } catch (err) {
          failed.push({ name: imageLeaf(p), code: codeOf(err) });
        }
      }
    })
  );
  return { deleted, failed };
}

const BAD_NAME = /[\\/]/;

/** Makes a folder in `dir` */
export async function makeFolder (drive: FmDriveRef, dir: string, name: string, deps: FmJobDeps): Promise<string> {
  if (drive.readOnly) throw new FmError("readOnly", `${drive.name} cannot be written.`, { name: drive.name });
  if (!name.trim() || BAD_NAME.test(name)) throw new FmError("badName", `${name} is not a folder name.`, { name });
  if (isHost(drive)) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) throw new FmError("exists", `${name} is already there.`, { name });
    try {
      fs.mkdirSync(full);
    } catch (err) {
      throw asFmError(err, name);
    }
    return full;
  }
  if (drive.kind === "image") throw new FmError("unsupported", `${drive.name} has no folders.`, { name: drive.name });
  const full = joinImagePath(dir, name);
  await deps.hardDiskWrite(drive.root, () =>
    withHardDisk(drive.root, (device) => {
      const fat = FatFileSystem.open(device, drive.partition);
      if (fat.list({ dir }).some((e) => imageLeaf(e.name).toLowerCase() === name.toLowerCase())) {
        throw new FmError("exists", `${name} is already there.`, { name });
      }
      fat.mkdir(full);
    })
  ).catch((err) => {
    throw asFmError(err, name);
  });
  return full;
}

/** Renames a file or folder in its folder */
export async function renameEntry (drive: FmDriveRef, entryPath: string, newName: string, deps: FmJobDeps): Promise<string> {
  if (drive.readOnly) throw new FmError("readOnly", `${drive.name} cannot be written.`, { name: drive.name });
  if (!newName.trim() || BAD_NAME.test(newName)) throw new FmError("badName", `${newName} is not a file name.`, { name: newName });
  if (isHost(drive)) {
    const target = path.join(path.dirname(entryPath), newName);
    const caseOnly = target.toLowerCase() === entryPath.toLowerCase();
    if (!caseOnly && fs.existsSync(target)) throw new FmError("exists", `${newName} is already there.`, { name: newName });
    try {
      fs.renameSync(entryPath, target);
    } catch (err) {
      throw asFmError(err, newName);
    }
    return target;
  }
  if (drive.kind === "image") {
    const { contents, token } = await deps.beginImageEdit(drive.root);
    try {
      const diskFs = openDiskFileSystem(contents, drive.root);
      diskFs.rename(entryPath, newName);
      await deps.commitImageEdit(drive.root, diskImageBytes(diskFs, drive.root), token);
    } catch (err) {
      await deps.cancelImageEdit(token);
      throw asFmError(err, newName);
    }
    return newName;
  }
  await deps.hardDiskWrite(drive.root, () =>
    withHardDisk(drive.root, (device) => FatFileSystem.open(device, drive.partition).rename(entryPath, newName))
  ).catch((err) => {
    throw asFmError(err, newName);
  });
  const parent = entryPath.includes("/") ? entryPath.slice(0, entryPath.lastIndexOf("/")) : "";
  return joinImagePath(parent, newName);
}

// -------------------------------------------------------------------------------------------------
// Paths

function commonDir (drive: FmDriveRef, paths: string[]): string {
  const first = paths[0] ?? "";
  if (isHost(drive)) return path.dirname(path.resolve(first));
  return first.includes("/") ? first.slice(0, first.lastIndexOf("/")) : "";
}

function sameDir (drive: FmDriveRef, a: string, b: string): boolean {
  if (isHost(drive)) return path.resolve(a) === path.resolve(b);
  return joinImagePath(a).toLowerCase() === joinImagePath(b).toLowerCase();
}

function isInside (child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isUnder (drive: FmDriveRef, p: string, parent: string): boolean {
  if (isHost(drive)) return isInside(path.resolve(p), path.resolve(parent)) && path.resolve(p) !== path.resolve(parent);
  return p.toLowerCase().startsWith(`${parent.toLowerCase()}/`);
}
