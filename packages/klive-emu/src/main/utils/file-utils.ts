import * as path from "path";
import { promises as fs } from "fs";
import * as syncFs from "fs";
import { DirectoryContent } from "../../shared/messaging/message-types";
import { __WIN32__ } from "./electron-utils";
import { KliveProject } from "../main-state/klive-settings";

export const CODE_DIR_NAME = "code";
export const PROJECT_FILE = "klive.project";

/**
 * Gets the current home folder
 */
export function getHomeFolder(): string {
  return process.env[__WIN32__ ? "USERPROFILE" : "HOME"];
}

/**
 * Gets the contents of the specified folder
 * @param folder Folder to query
 * @returns
 */
export async function getFolderContents(
  folder: string
): Promise<DirectoryContent> {
  // --- Contents of folders already queried
  const foldersRead = new Map<string, DirectoryContent>();
  return readFolders(folder);

  // --- Carries out reading the folder contents
  async function readFolders(
    name: string,
    depth = 0
  ): Promise<DirectoryContent> {
    const cached = foldersRead.get(name);
    if (cached) {
      return { ...cached };
    }

    const result: DirectoryContent = {
      name: path.basename(name),
      folders: [],
      files: [],
    };

    // --- Read folders
    try {
      const entries = await fs.readdir(name, { withFileTypes: true });
      for (var entry of entries) {
        if (entry.isDirectory()) {
          result.folders.push({
            name: entry.name,
            folders: [],
            files: [],
          });
        } else {
          result.files.push(entry.name);
        }
      }
    } catch {
      console.log(`Cannot read the contents of ${name}`);
    }

    // --- Now, recursively read folders
    for (var subfolder of result.folders) {
      const subcontents = await readFolders(
        path.join(name, subfolder.name),
        depth + 1
      );
      subfolder.folders = subcontents.folders;
      subfolder.files = subcontents.files;
    }
    return result;
  }
}

/**
 * Creates a Klive project in the specified root folder with the specified name
 * @param machineType Virtual machine identifier
 * @param rootFolder Root folder of the project (home directory, if not specified)
 * @param projectFolder Project subfolder name
 * @returns
 */
export async function createKliveProject(
  machineType: string,
  rootFolder: string | null,
  projectFolder: string
): Promise<{ targetFolder?: string; error?: string }> {
  // --- Creat the project folder
  if (!rootFolder) {
    rootFolder = getHomeFolder();
  }
  const targetFolder = path.resolve(path.join(rootFolder, projectFolder));
  try {
    // --- Create the project folder
    if (syncFs.existsSync(targetFolder)) {
      return { error: `Target directory '${targetFolder}' already exists` };
    }
    await fs.mkdir(targetFolder);

    // --- Create the code subfolder
    await fs.mkdir(path.join(targetFolder, CODE_DIR_NAME));

    // --- Create the project file
    const project: KliveProject = {
      machineType
    }
    await fs.writeFile(path.join(targetFolder, PROJECT_FILE), JSON.stringify(project, null, 2));

    // --- Done
    return { targetFolder };
  } catch {
    return { error: `Cannot create Klive project in '${targetFolder}'` };
  }
}
