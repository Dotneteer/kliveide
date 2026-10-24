import type { DiskImageEditStart } from "@common/messaging/MainApi";
import { hostFileToDiskFiles } from "@common/diskfs/importFiles";
import { DiskFsError, type DiskFileEntry } from "@common/diskfs/types";
import { applyDiskEdit, readDiskFile, type DiskEdit } from "@common/diskfs/edit";

/*
 * What the Disk Explorer does with the user's actions (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md,
 * B4), React-free: every edit goes through the main process's begin/commit pair (D4: a running
 * machine with the disk in a drive is paused, the file re-read, the edit written safely and the disk
 * inserted again), and every outside effect is a port, so the flows are tested without rendering.
 */

/** Why an action did not happen, for the view to word */
export type DiskActionFailure = { code: string; args: Record<string, string | number> };

export type DiskExplorerPorts = {
  beginEdit(filePath: string): Promise<DiskImageEditStart>;
  commitEdit(filePath: string, contents: Uint8Array, start: Omit<DiskImageEditStart, "contents">): Promise<void>;
  cancelEdit(start: Omit<DiskImageEditStart, "contents">): Promise<void>;
  /** The explorer shows the file again */
  reload(): Promise<void>;
  pickHostFile(): Promise<string | undefined>;
  readHostFile(path: string): Promise<Uint8Array>;
  pickSavePath(defaultName: string): Promise<string | undefined>;
  writeHostFile(path: string, contents: Uint8Array): Promise<void>;
  confirm(kind: "delete" | "replace" | "compact", names: string[]): Promise<boolean>;
  askName(oldName: string): Promise<string | undefined>;
  /** Where headerless code loads (asked when a plain binary is added) */
  askCodeStart(fileName: string): Promise<number | undefined>;
  reportFailure(failure: DiskActionFailure): void;
};

/** A failure as the view reports it */
export function failureOf (err: unknown): DiskActionFailure {
  if (err instanceof DiskFsError) return { code: err.code, args: err.args };
  return { code: "io", args: { message: String((err as Error)?.message ?? err) } };
}

/**
 * Runs one edit: begin, apply to the file's current bytes, commit; on a refusal the edit is
 * abandoned (the machine runs on) and the failure reported
 * @returns true when the edit was written
 */
export async function runDiskEdit (ports: DiskExplorerPorts, filePath: string, edit: DiskEdit): Promise<boolean> {
  let start: DiskImageEditStart | undefined;
  try {
    start = await ports.beginEdit(filePath);
    const { contents, ...rest } = start;
    const edited = applyDiskEdit(contents, filePath, edit);
    await ports.commitEdit(filePath, edited, rest);
    await ports.reload();
    return true;
  } catch (err) {
    if (start) {
      const { contents: _contents, ...rest } = start;
      await ports.cancelEdit(rest).catch(() => {});
    }
    ports.reportFailure(failureOf(err));
    return false;
  }
}

/** Adds host files: picked when none are given; an existing name is replaced only when confirmed */
export async function addHostFiles (
  ports: DiskExplorerPorts,
  filePath: string,
  system: "+3dos" | "trdos" | "fat",
  existing: DiskFileEntry[],
  hostPaths?: string[]
): Promise<boolean> {
  const paths = hostPaths ?? [await ports.pickHostFile()].filter((p): p is string => !!p);
  if (paths.length === 0) return false;
  const files = [];
  try {
    for (const hostPath of paths) {
      const bytes = await ports.readHostFile(hostPath);
      const lower = hostPath.toLowerCase();
      const plain = !/\.(tap|scr|bas)$/.test(lower) || (lower.endsWith(".scr") && bytes.length !== 6912);
      const codeStart = plain ? await ports.askCodeStart(hostPath) : undefined;
      if (plain && codeStart === undefined) return false;
      files.push(...hostFileToDiskFiles(hostPath, bytes, { system, codeStart }));
    }
  } catch (err) {
    ports.reportFailure(failureOf(err));
    return false;
  }
  const clashes = files.filter((f) => existing.some((e) => e.name.toUpperCase() === f.name.toUpperCase())).map((f) => f.name);
  if (clashes.length > 0 && !(await ports.confirm("replace", clashes))) return false;
  return runDiskEdit(ports, filePath, { kind: "add", files, replace: clashes.length > 0 });
}

/** Saves a file's contents to the host */
export async function extractFile (ports: DiskExplorerPorts, filePath: string, contents: Uint8Array, file: DiskFileEntry) {
  const target = await ports.pickSavePath(file.name.replace(/[\\/:*?"<>|]/g, "_"));
  if (!target) return false;
  try {
    await ports.writeHostFile(target, readDiskFile(contents, filePath, file.name));
    return true;
  } catch (err) {
    ports.reportFailure(failureOf(err));
    return false;
  }
}

export async function deleteFiles (ports: DiskExplorerPorts, filePath: string, names: string[]) {
  if (names.length === 0 || !(await ports.confirm("delete", names))) return false;
  return runDiskEdit(ports, filePath, { kind: "delete", names });
}

export async function renameFile (ports: DiskExplorerPorts, filePath: string, name: string) {
  const newName = await ports.askName(name);
  if (!newName || newName === name) return false;
  return runDiskEdit(ports, filePath, { kind: "rename", name, newName });
}

export async function compactDisk (ports: DiskExplorerPorts, filePath: string) {
  if (!(await ports.confirm("compact", []))) return false;
  return runDiskEdit(ports, filePath, { kind: "compact" });
}
