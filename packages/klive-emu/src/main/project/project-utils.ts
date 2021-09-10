import * as path from "path";
import * as syncFs from "fs";
import { promises as fs } from "fs";

import { dialog } from "electron";
import { AppWindow } from "../app/app-window";
import { getFolderContents, getHomeFolder } from "../utils/file-utils";
import { machineRegistry } from "../../extensibility/main/machine-registry";
import { mainStore } from "../main-state/main-store";
import {
  projectOpenedAction,
  projectLoadingAction,
} from "../../shared/state/project-reducer";
import { KliveProject } from "../main-state/klive-configuration";

/**
 * Name of the project file within the project directory
 */
export const PROJECT_FILE = "klive.project";

/**
 * Name of the project folder storing code
 */
export const CODE_DIR_NAME = "code";

/**
 * Opens the specified folder as a project
 */
export async function openProject(projectPath: string): Promise<void> {
  // --- Close the current project, and wait for a little while
  mainStore.dispatch(projectLoadingAction());

  // --- Now, open the project
  const projectName = path.basename(projectPath);
  const projectFile = path.join(projectPath, PROJECT_FILE);

  // --- Check for project file
  const project = getProjectFile(projectFile);
  const hasVm = project != null;
  const directoryContents = await getFolderContents(projectPath);

  // --- Set the state accordingly
  mainStore.dispatch(
    projectOpenedAction(projectPath, projectName, hasVm, directoryContents)
  );
  console.log("Project opened");
}

/**
 * Selects a folder form the dialog
 */
export async function selectFolder(
  title: string,
  defaultPath?: string
): Promise<string | null> {
  const result = await dialog.showOpenDialog(AppWindow.focusedWindow.window, {
    title,
    defaultPath,
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
}

/**
 * Selects a project folder and opens it
 */
export async function openProjectFolder(): Promise<void> {
  const result = await selectFolder("Open project folder");
  if (result) {
    await openProject(result);
  }
}

/**
 * Gets the configuration of Klive Emulator from the user folder
 */
export function getProjectFile(projectFile: string): KliveProject | null {
  try {
    if (syncFs.existsSync(projectFile)) {
      const contents = syncFs.readFileSync(projectFile, "utf8");
      console.log(contents);
      const project = JSON.parse(contents) as KliveProject;
      return project.machineType && machineRegistry.has(project.machineType)
        ? project
        : null;
    }
  } catch (err) {
    console.log(`Cannot read and parse project file: ${err}`);
  }
  return null;
}

/**
 * Gets the configuration of the loaded project
 */
export function getLoadedProjectFile(): KliveProject | null {
  const projectPath = mainStore.getState().project?.path;
  return projectPath
    ? getProjectFile(path.join(projectPath, PROJECT_FILE))
    : null;
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
  } else if (!path.isAbsolute(rootFolder)) {
    rootFolder = path.join(getHomeFolder(), rootFolder);
  }
  const targetFolder = path.resolve(path.join(rootFolder, projectFolder));
  try {
    // --- Create the project folder
    if (syncFs.existsSync(targetFolder)) {
      return { error: `Target directory '${targetFolder}' already exists` };
    }
    console.log(targetFolder);
    await fs.mkdir(targetFolder);

    // --- Create the code subfolder
    await fs.mkdir(path.join(targetFolder, CODE_DIR_NAME));

    // --- Create the project file
    const project: KliveProject = {
      machineType,
    };
    await fs.writeFile(
      path.join(targetFolder, PROJECT_FILE),
      JSON.stringify(project, null, 2)
    );

    // --- Done
    return { targetFolder };
  } catch {
    return { error: `Cannot create Klive project in '${targetFolder}'` };
  }
}
