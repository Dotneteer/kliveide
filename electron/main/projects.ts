import { TapeDataBlock } from "@/emu/machines/tape/abstractions";
import { closeFolderAction, openFolderAction } from "../../common/state/actions";
import { app, BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import { mainStore } from "./main-store";
import { appSettings, saveAppSettings } from "./settings";

const KLIVE_PROJET_ROOT = "KliveProjects";
const CODE_FOLDER = "code";
const PROJECT_FILE = "klive.project";
const LAST_PROJECT_FOLDER = "lastProjectFolder";

type ProjectCreationResult = {
  path?: string;
  errorMessage?: string;
};

/**
 * Creates a new project in the specified folder
 * @param machineId Machine ID of the project
 * @param projectName Name of the project subfolder
 * @param projectFolder Project home directory
 */
export function createKliveProject (
  machineId: string,
  projectName: string,
  projectFolder?: string
): ProjectCreationResult {
  const projPath = getKliveProjectFolder(projectFolder);
  const fullProjectFolder = path.join(projPath, projectName);
  try {
    // --- Check if the folder exists
    if (fs.existsSync(fullProjectFolder)) {
      return {
        errorMessage: `Cannot create Klive project. Folder ${fullProjectFolder} already exists.`
      };
    }

    // --- Create the project folder
    fs.mkdirSync(fullProjectFolder, { recursive: true });

    // --- Create subfolders
    const codeFolder = path.join(fullProjectFolder, CODE_FOLDER);
    fs.mkdirSync(codeFolder, { recursive: true });

    // --- Create project files
    const projectFile = path.join(fullProjectFolder, PROJECT_FILE);
    const project = {};
    fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
  } catch (err) {
    return {
      errorMessage: err.toString()
    };
  }

  return {
    path: fullProjectFolder
  };
}

/**
 * Opens a folder
 * @param browserWindow Host browser window
 */
export async function openFolder (
  browserWindow: BrowserWindow
): Promise<TapeDataBlock[] | undefined> {
  const lastFile = mainStore.getState()?.emulatorState?.tapeFile;
  const defaultPath =
    appSettings?.folders?.[LAST_PROJECT_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  const dialogResult = await dialog.showOpenDialog(browserWindow, {
    title: "Select Project Folder",
    defaultPath,
    properties: ["openDirectory"]
  });
  if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;

  // --- Get the folder name
  openFolderByPath(dialogResult.filePaths[0]);
}

/**
 * Opens the specified path
 * @param projectFolder
 */
export function openFolderByPath (projectFolder: string): string | null {
  // --- Check if project files exists
  projectFolder = getKliveProjectFolder(projectFolder);
  if (!fs.existsSync(projectFolder)) {
    return `Folder ${projectFolder} does not exists.`;
  }
  const projectFile = path.join(projectFolder, PROJECT_FILE);
  if (fs.existsSync(projectFile)) {
    // TODO: Check, if project file is valid
    mainStore.dispatch(closeFolderAction());
    mainStore.dispatch(openFolderAction(projectFolder, true));
  } else {
    mainStore.dispatch(closeFolderAction());
    mainStore.dispatch(openFolderAction(projectFolder, false));
  }

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[LAST_PROJECT_FOLDER] = projectFolder;
  saveAppSettings();
  return null;
}

function getKliveProjectFolder (projectFolder: string): string {
  return projectFolder
    ? path.isAbsolute(projectFolder)
      ? projectFolder
      : path.join(app.getPath("home"), KLIVE_PROJET_ROOT, projectFolder)
    : path.join(app.getPath("home"), KLIVE_PROJET_ROOT);
}
