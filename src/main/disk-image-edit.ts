import fs from "fs";
import path from "path";

import { MEDIA_DISK_A, MEDIA_DISK_B } from "@common/structs/project-const";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { mainStore } from "./main-store";

/*
 * Editing a disk image file from the IDE (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D4/D5).
 *
 * An edit is two calls around the renderer's own change of the bytes:
 *
 * 1. `beginDiskImageEdit` - when the image is in one of the machine's drives and the machine runs,
 *    it is paused first. Pausing publishes the machine's pending disk writes, and the emulator sends
 *    them to the main process before it answers the pause (one message channel, in order), so the
 *    file read next already holds them: the edit starts from the disk as the machine left it.
 * 2. `commitDiskImageEdit` - the new bytes go to a file beside the image, renamed over it, so a
 *    failed write leaves the old disk; the first edit of an image in a session keeps a `.bak` of it.
 *    A mounted disk is inserted again (the core reloads it, the head where it was) and a machine the
 *    edit paused runs on.
 */

/** Images already backed up in this session */
const backedUp = new Set<string>();

export type DiskImageEditStart = {
  contents: Uint8Array;
  /** The drive the image is in (0: A, 1: B), if any */
  drive?: number;
  /** The machine was running and the edit paused it */
  resume?: boolean;
  /** It was running under the debugger */
  debug?: boolean;
};

/** The drive holding the image, if it is in one */
export function mountedDrive (filePath: string): number | undefined {
  const media = mainStore.getState().media ?? {};
  const wanted = path.resolve(filePath);
  const ids = [MEDIA_DISK_A, MEDIA_DISK_B];
  for (let drive = 0; drive < ids.length; drive++) {
    const file = media[ids[drive]]?.diskFile;
    if (typeof file === "string" && path.resolve(file) === wanted) return drive;
  }
  return undefined;
}

export async function beginDiskImageEdit (filePath: string): Promise<DiskImageEditStart> {
  const drive = mountedDrive(filePath);
  let resume = false;
  let debug = false;
  if (drive !== undefined) {
    const emulator = mainStore.getState().emulatorState;
    if (emulator?.machineState === MachineControllerState.Running) {
      debug = !!emulator.isDebugging;
      await getEmuApi().issueMachineCommand("pause");
      resume = true;
    }
  }
  return { contents: new Uint8Array(fs.readFileSync(filePath)), drive, resume, debug };
}

export async function commitDiskImageEdit (
  filePath: string,
  contents: Uint8Array,
  start: Pick<DiskImageEditStart, "drive" | "resume" | "debug"> = {}
): Promise<void> {
  try {
    writeDiskImageSafely(filePath, contents);
    if (start.drive !== undefined) {
      await getEmuApi().setDiskFile(start.drive, filePath, contents);
    }
  } finally {
    if (start.resume) {
      await getEmuApi().issueMachineCommand(start.debug ? "debug" : "start");
    }
  }
}

/** An edit that will not be committed (it failed or was abandoned): a paused machine runs on */
export async function cancelDiskImageEdit (start: Pick<DiskImageEditStart, "resume" | "debug"> = {}): Promise<void> {
  if (start.resume) {
    await getEmuApi().issueMachineCommand(start.debug ? "debug" : "start");
  }
}

/** Writes an image beside the file and renames it over; the session's first write keeps a `.bak` */
export function writeDiskImageSafely (filePath: string, contents: Uint8Array): void {
  const resolved = path.resolve(filePath);
  if (!backedUp.has(resolved) && fs.existsSync(resolved)) {
    fs.copyFileSync(resolved, `${resolved}.bak`);
    backedUp.add(resolved);
  }
  const temporary = `${resolved}.klive-tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, resolved);
}

/** Forgets the session's backups (tests) */
export function resetDiskImageBackups (): void {
  backedUp.clear();
}
