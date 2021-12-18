import * as path from "path";
import * as fs from "fs";
import { dialog } from "electron";

import { dispatch, getState } from "@core/service-registry";

import { AppWindow } from "../app/app-window";
import { getFolderContents, getHomeFolder } from "../utils/file-utils";
import { machineRegistry } from "@core/main/machine-registry";
import {
  projectOpenedAction,
  projectLoadingAction,
  closeProjectAction,
} from "@state/project-reducer";
import { KliveProject } from "@abstractions/klive-configuration";
import {
  addBreakpointAction,
  clearBreakpointsAction,
  removeSourceBreakpointsAction,
} from "@state/debugger-reducer";
import {
  addBuildRootAction,
  clearBuildRootsAction,
} from "@state/builder-reducer";
import { emuWindow } from "../app/emu-window";
import { setIdeConfigAction } from "@core/state/ide-config-reducer";
import { appSettings } from "../main-state/klive-configuration";
import { mainProcLogger } from "../utils/MainProcLogger";

/**
 * Name of the project file within the project directory
 */
export const PROJECT_FILE = "klive.project";

/**
 * Opens the specified folder as a project
 */
export async function openProject(projectPath: string): Promise<void> {
  // --- Close the current project, and wait for a little while
  dispatch(closeProjectAction());
  dispatch(removeSourceBreakpointsAction());
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
      roots.forEach((r) => dispatch(addBuildRootAction(r)));
    }

    // --- Set the IDE configuration
    if (project.ide) {
      dispatch(setIdeConfigAction(project.ide));
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
export function getProjectFile(projectFile?: string): KliveProject | null {
  if (!projectFile) {
    const projState = getState().project;
    if (projState?.hasVm) {
      projectFile = path.join(projState.path, PROJECT_FILE);
    } else {
      // --- No project file
      return {};
    }
  }
  try {
    if (fs.existsSync(projectFile)) {
      const contents = fs.readFileSync(projectFile, "utf8");
      const project = JSON.parse(contents) as KliveProject;
      return project.machineType && machineRegistry.has(project.machineType)
        ? project
        : null;
    }
  } catch (err) {
    mainProcLogger.logError("Cannot read and parse project file", err);
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
    if (fs.existsSync(targetFolder)) {
      return { error: `Target directory '${targetFolder}' already exists` };
    }
    try {
      fs.mkdirSync(targetFolder, {
        recursive: true,
      });
    } catch (err) {
      return {
        error: `Target directory '${targetFolder}' cannot be created: ${err}`,
      };
    }

    // --- Copy the project template
    const sourceDir = path.join(__dirname, "templates/project/code");
    try {
      copyFolderSync(sourceDir, targetFolder);
    } catch (err) {
      return {
        error: `Error while copying the template from '${sourceDir}': ${err}`,
      };
    }

    // --- Create the project file
    const project: KliveProject = {
      machineType,
      debugger: {
        breakpoints: [],
      },
      builder: {
        roots: ["/code/code.kz80.asm", "/code/code.zxb.asm", "/code/program.zxbas"],
      },
      ide: appSettings?.ide ?? {},
    };
    try {
      fs.writeFileSync(
        path.join(targetFolder, PROJECT_FILE),
        JSON.stringify(project, null, 2)
      );
    } catch (err) {
      return {
        error: `Error while creating '${PROJECT_FILE}': ${err}`,
      };
    }

    // --- Done
    return { targetFolder };
  } catch (err) {
    return {
      error: `Cannot create Klive project in '${targetFolder}' (${err})`,
    };
  }
}

/**
 * Copies a file synchronously
 * @param source Source file
 * @param target Targer file
 */
export function copyFileSync(source: string, target: string) {
  var targetFile = target;
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

/**
 * Copies the contents of a folder into another synchronously
 * @param source Source folder
 * @param target Target folder
 */
export function copyFolderSync(source: string, target: string) {
  var files = [];

  // --- Check if folder needs to be created or integrated
  var targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // --- Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      var curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}
