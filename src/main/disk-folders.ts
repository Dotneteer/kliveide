import fs from "fs";
import path from "path";
import { app } from "electron";

import { CARTRIDGE_FOLDER, DISK_FOLDER } from "@common/structs/project-const";
import { isMdrCartridgeType } from "@emu/machines/microdrive/mdrImage";
import { mainStore } from "./main-store";
import { getKliveHomeBase } from "./portable";
import { KLIVE_HOME_FOLDER } from "./settings";

/** The folder in Klive's home folder new disk images go into when no project is open */
export const KLIVE_DISKS_FOLDER = "Disks";

/** The folder in Klive's home folder new Microdrive cartridges go into when no project is open */
export const KLIVE_CARTRIDGES_FOLDER = "Cartridges";

/**
 * Where a new disk image goes unless the user names a folder (the Create Disk File dialog, `crd`
 * without a folder; `crd -p` uses the project's `disks` folder too):
 * the open project's `disks` folder, or `Klive/Disks` in Klive's home folder (the user's home, or
 * the portable data folder in portable mode)
 */
export function defaultDiskFolder (projectFolder = mainStore.getState()?.project?.folderPath): string {
  return projectFolder
    ? path.join(projectFolder, DISK_FOLDER)
    : path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, KLIVE_DISKS_FOLDER);
}

/**
 * Where a new Microdrive cartridge goes unless the user names a folder (New Blank Cartridge, `crd mdr`
 * without a folder): the open project's `cartridges` folder, or `Klive/Cartridges` in Klive's home
 * folder
 */
export function defaultCartridgeFolder (projectFolder = mainStore.getState()?.project?.folderPath): string {
  return projectFolder
    ? path.join(projectFolder, CARTRIDGE_FOLDER)
    : path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, KLIVE_CARTRIDGES_FOLDER);
}

/** The default folder of a new image of `diskType`: cartridges apart from disks */
export function defaultFolderForDiskType (diskType: string): string {
  return isMdrCartridgeType(diskType) ? defaultCartridgeFolder() : defaultDiskFolder();
}

/**
 * Where the New Blank Cartridge dialog starts: the open project's `cartridges` folder (made when it
 * is missing), else the folder of the last cartridge, else the home folder
 * @param lastFolder The folder the last cartridge came from
 */
export function newCartridgeDialogFolder (
  lastFolder?: string,
  projectFolder = mainStore.getState()?.project?.folderPath
): string {
  if (projectFolder) {
    const folder = defaultCartridgeFolder(projectFolder);
    try {
      fs.mkdirSync(folder, { recursive: true });
      return folder;
    } catch {
      // --- A folder that cannot be made: fall back to the last one used
    }
  }
  return lastFolder || app.getPath("home");
}
