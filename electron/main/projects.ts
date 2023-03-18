import {
  closeFolderAction,
  dimMenuAction,
  maximizeToolsAction,
  openFolderAction,
  primaryBarOnRightAction,
  setIdeFontSizeAction,
  showEmuStatusBarAction,
  showEmuToolbarAction,
  showIdeStatusBarAction,
  showIdeToolbarAction,
  showKeyboardAction,
  showSideBarAction,
  showToolPanelsAction,
  toolPanelsOnTopAction,
} from "../../common/state/actions";
import { app, BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import { mainStore } from "./main-store";
import { appSettings, saveAppSettings } from "./settings";
import {
  TEMPLATES,
  PROJECT_FILE,
  LAST_PROJECT_FOLDER,
  KLIVE_PROJET_ROOT,
  KliveProjectStructure
} from "../../common/structs/project-const";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { EmuListBreakpointsResponse } from "../../common/messaging/main-to-emu";

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
  const templateFolder = resolvePublicFilePath(TEMPLATES);

  try {
    // --- Check if the folder exists
    if (fs.existsSync(fullProjectFolder)) {
      return {
        errorMessage: `Cannot create Klive project. Folder ${fullProjectFolder} already exists.`
      };
    }

    // --- Create the project folder
    fs.mkdirSync(fullProjectFolder, { recursive: true });

    // --- Copy templates
    copyFolderSync(templateFolder, fullProjectFolder, false);

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
export async function openFolder (browserWindow: BrowserWindow): Promise<void> {
  const lastFile = mainStore.getState()?.emulatorState?.tapeFile;
  const defaultPath =
    appSettings?.folders?.[LAST_PROJECT_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  mainStore.dispatch(dimMenuAction(true));
  try {
    const dialogResult = await dialog.showOpenDialog(browserWindow, {
      title: "Select Project Folder",
      defaultPath,
      properties: ["openDirectory"]
    });
    if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
    openFolderByPath(dialogResult.filePaths[0]);
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }
}

/**
 * Opens the specified path
 * @param projectFolder Folder to open
 * @returns null, if the operation is successful; otherwise, the error message
 */
export function openFolderByPath (projectFolder: string): string | null {
  // --- Check if project files exists
  projectFolder = getKliveProjectFolder(projectFolder);
  if (!fs.existsSync(projectFolder)) {
    return `Folder ${projectFolder} does not exists.`;
  }
  const projectFile = path.join(projectFolder, PROJECT_FILE);
  let isValidProject = false;
  if (fs.existsSync(projectFile)) {
    const projectContents = fs.readFileSync(projectFile, "utf8");
    try {
      const projectStruct = JSON.parse(projectContents) as KliveProjectStructure;
      isValidProject = !!(projectStruct.kliveVersion && projectStruct.machineType);

      // --- Apply settings if the project is valid
      const disp = mainStore.dispatch;
      disp(showEmuToolbarAction(projectStruct.viewOptions.showEmuToolbar));
      disp(showEmuStatusBarAction(projectStruct.viewOptions.showEmuStatusbar));
      disp(showIdeToolbarAction(projectStruct.viewOptions.showIdeToolbar));
      disp(showIdeStatusBarAction(projectStruct.viewOptions.showIdeStatusbar));
      disp(showKeyboardAction(projectStruct.viewOptions.showKeyboard));
      disp(showSideBarAction(projectStruct.viewOptions.showSidebar));
      disp(primaryBarOnRightAction(projectStruct.viewOptions.primaryBarOnRight));
      disp(showToolPanelsAction(projectStruct.viewOptions.showToolPanels));
      disp(toolPanelsOnTopAction(projectStruct.viewOptions.toolPanelsOnTop));
      disp(maximizeToolsAction(projectStruct.viewOptions.maximizeTools));
      disp(setIdeFontSizeAction(projectStruct.viewOptions.editorFontSize));

    } catch {
      // --- Intentionally ingored
    }
  }
    
  mainStore.dispatch(closeFolderAction());
  mainStore.dispatch(openFolderAction(projectFolder, isValidProject));

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[LAST_PROJECT_FOLDER] = projectFolder;
  saveAppSettings();
  return null;
}

/**
 * Deletes the specified file entry
 * @param name File entry to delete
 * @returns null, if the operation is successful; otherwise, the error message
 */
export function deleteFileEntry (name: string): string | null {
  return null;
}

/**
 * Copies a file synchronously
 * @param source Source file
 * @param target Target file
 */
export function copyFileSync (source: string, target: string) {
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
export function copyFolderSync (
  source: string,
  target: string,
  copyRoot = true
) {
  var files = [];

  // --- Check if folder needs to be created or integrated
  let targetFolder = target;
  if (copyRoot) {
    targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder);
    }
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

/**
 * Resolves the specified path using the public folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolvePublicFilePath (toResolve: string): string {
  return path.isAbsolute(toResolve)
    ? toResolve
    : path.join(process.env.PUBLIC, toResolve);
}

// --- Gets the klive folder for the specified project folder
export function getKliveProjectFolder (projectFolder: string): string {
  return projectFolder
    ? path.isAbsolute(projectFolder)
      ? projectFolder
      : path.join(app.getPath("home"), KLIVE_PROJET_ROOT, projectFolder)
    : path.join(app.getPath("home"), KLIVE_PROJET_ROOT);
}

// --- Get the current klive project structure to save
export async function getKliveProjectStructure(): Promise<KliveProjectStructure> {
  const state = mainStore.getState();
  const bpResponse = (await sendFromMainToEmu({
    type: "EmuListBreakpoints"
  })) as EmuListBreakpointsResponse;

  return {
    kliveVersion: app.getVersion(),
    machineType: state.emulatorState.machineId,
    clockMultiplier: state.emulatorState.clockMultiplier,
    soundLevel: state.emulatorState.soundLevel,
    soundMuted: state.emulatorState.soundMuted,
    savedSoundLevel: state.emulatorState.savedSoundLevel,
    tapeFile: state.emulatorState.tapeFile,
    fastLoad: state.emulatorState.fastLoad,
    machineSpecific: {},
    ide: {},
    viewOptions: {
      theme: state.theme,
      editorFontSize: state.ideViewOptions?.editorFontSize,
      maximizeTools: state.ideViewOptions?.maximizeTools,
      primaryBarOnRight: state.ideViewOptions?.primaryBarOnRight,
      showEmuStatusbar: state.emuViewOptions.showStatusBar,
      showEmuToolbar: state.emuViewOptions.showToolbar,
      showKeyboard: state.emuViewOptions.showKeyboard,
      showFrameInfo: state.ideViewOptions.showFrameInfo,
      showIdeStatusbar: state.ideViewOptions.showStatusBar,
      showIdeToolbar: state.ideViewOptions.showToolbar,
      showSidebar: state.ideViewOptions.showSidebar,
      showToolPanels: state.ideViewOptions.showToolPanels,
      toolPanelsOnTop: state.ideViewOptions.toolPanelsOnTop
    },
    debugger: {
      breakpoints: bpResponse.breakpoints
    },
    builder: {
      roots: state.project?.buildRoots ?? []
    }
  }
}

// --- Saves the current Klive project
export async function saveKliveProject(): Promise<void> {
  const projectState = mainStore.getState().project;
  if (!projectState.folderPath) return;

  try {
    const projectFile = path.join(projectState.folderPath, PROJECT_FILE);
    const project = await getKliveProjectStructure();
    fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
  } catch {
    // --- Intentionally ignored
  }
}