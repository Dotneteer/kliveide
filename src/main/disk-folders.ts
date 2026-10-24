import path from "path";

import { DISK_FOLDER } from "@common/structs/project-const";
import { mainStore } from "./main-store";
import { getKliveHomeBase } from "./portable";
import { KLIVE_HOME_FOLDER } from "./settings";

/** The folder in Klive's home folder new disk images go into when no project is open */
export const KLIVE_DISKS_FOLDER = "Disks";

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
