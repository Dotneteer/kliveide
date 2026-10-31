import path from "path";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { MEDIA_SD_CARD } from "@common/structs/project-const";
import type { DiskEdit } from "@common/diskfs/edit";
import { mainStore } from "./main-store";
import { withSdCardAccess } from "./sd-card-access";
import { activeSdCardFile, invalidateSdCardHandler } from "./machine-menus/zx-next-menus";
import { copyHostFolderToHardDisk, editHardDisk } from "./hard-disk-images";

/*
 * Edits to a hard-disk image the running machine may be using as its SD card
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D4 for hard disks). The card is read on demand, a
 * sector at a time, so there is nothing to re-insert: the edit takes the card's lock, so no machine
 * read or write runs beside it, pauses a running machine (its operating system may cache what it
 * read), writes, and drops the emulator's open handle to the card so the next read sees the change.
 */

/** Is this image the machine's SD card? */
export function isActiveSdCard (filePath: string): boolean {
  const media = mainStore.getState().media ?? {};
  const card = media[MEDIA_SD_CARD] ? activeSdCardFile() : undefined;
  return !!card && path.resolve(card) === path.resolve(filePath);
}

/** Runs `op` on an image, under the SD card's lock and with a running machine paused when it is the machine's card */
export async function aroundSdCard<T> (filePath: string, op: () => T): Promise<T> {
  if (!isActiveSdCard(filePath)) return op();
  const emulator = mainStore.getState().emulatorState;
  const running = emulator?.machineState === MachineControllerState.Running;
  if (running) await getEmuApi().issueMachineCommand("pause");
  try {
    return await withSdCardAccess(() => {
      invalidateSdCardHandler();
      return op();
    });
  } finally {
    if (running) await getEmuApi().issueMachineCommand(emulator?.isDebugging ? "debug" : "start");
  }
}

export function editHardDiskSafely (filePath: string, edit: DiskEdit, partition?: number): Promise<void> {
  return aroundSdCard(filePath, () => editHardDisk(filePath, edit, partition));
}

export function copyFolderToHardDiskSafely (filePath: string, hostFolder: string, targetDir?: string, partition?: number): Promise<number> {
  return aroundSdCard(filePath, () => copyHostFolderToHardDisk(filePath, hostFolder, targetDir, partition));
}
