import * as path from "path";
import * as syncFs from "fs";
import { promises as fs } from "fs";
import { dialog } from "electron";

import { dispatch, getState } from "@core/service-registry";

import { AppWindow } from "../app/app-window";
import { getFolderContents, getHomeFolder } from "../utils/file-utils";
import { machineRegistry } from "@core/main/machine-registry";
import {
  projectOpenedAction,
  projectLoadingAction,
} from "@state/project-reducer";
import { KliveProject } from "@abstractions/klive-configuration";
import {
  addBreakpointAction,
  clearBreakpointsAction,
} from "@state/debugger-reducer";
import { addBuildRootAction, clearBuildRootsAction } from "@state/builder-reducer";
import { emuWindow } from "../app/emu-window";

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
  dispatch(projectLoadingAction());

  // --- Now, open the project
  const projectName = path.basename(projectPath);
  const projectFile = path.join(projectPath, PROJECT_FILE);

  // --- Check for project file
  const project = getProjectFile(projectFile);
  const hasVm = project != null;
  const directoryContents = await getFolderContents(projectPath);

  if (hasVm) {
    // --- Set up the debugger
    const breakpoints = project?.debugger?.breakpoints;
    if (breakpoints) {
      dispatch(clearBreakpointsAction());
      breakpoints.forEach((bp) => dispatch(addBreakpointAction(bp)));
    }

    // --- Set up the builder
    const roots = project?.builder?.roots;
    if (roots) {
      dispatch(clearBuildRootsAction());
      roots.forEach(r => dispatch(addBuildRootAction(r)));
    }

    // --- Last step: setup the loaded machine
    const settings = project.machineSpecific;
    await emuWindow.requestMachineType(
      project.machineType,
      undefined,
      settings
    );
  }

  // --- Set the state accordingly
  dispatch(
    projectOpenedAction(projectPath, projectName, hasVm, directoryContents)
  );
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
  const projectPath = getState().project?.path;
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
    await fs.mkdir(targetFolder);

    // --- Create the code subfolder
    await fs.mkdir(path.join(targetFolder, CODE_DIR_NAME));

    // --- Create the project file
    const project: KliveProject = {
      machineType,
      debugger: {
        breakpoints: [],
      },
      builder: {
        roots: []
      }
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
