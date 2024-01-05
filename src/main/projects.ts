import {
  closeFolderAction,
  dimMenuAction,
  incProjectFileVersionAction,
  maximizeToolsAction,
  openFolderAction,
  primaryBarOnRightAction,
  resetCompileAction,
  saveProjectSettingAction,
  setBuildRootAction,
  setExcludedProjectItemsAction,
  setIdeFontSizeAction,
  setMachineSpecificAction,
  setModelTypeAction,
  showEmuStatusBarAction,
  showEmuToolbarAction,
  showIdeStatusBarAction,
  showIdeToolbarAction,
  showKeyboardAction,
  showSideBarAction,
  showToolPanelsAction,
  toolPanelsOnTopAction
} from "../common/state/actions";
import { app, BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import { mainStore } from "./main-store";
import { KLIVE_HOME_FOLDER, appSettings, saveAppSettings } from "./settings";
import {
  TEMPLATES,
  PROJECT_FILE,
  LAST_PROJECT_FOLDER,
  KLIVE_PROJECT_ROOT,
  MEDIA_TAPE
} from "../common/structs/project-const";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { EmuListBreakpointsResponse } from "../common/messaging/main-to-emu";
import { KliveProjectStructure } from "../common/abstractions/KliveProjectStructure";
import { setMachineType } from "./registeredMachines";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import { getModelConfig } from "../common/machines/machine-registry";
import { delay } from "../renderer/utils/timing";

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
export async function createKliveProject (
  machineId: string,
  modelId: string | undefined,
  projectName: string,
  projectFolder?: string
): Promise<ProjectCreationResult> {
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

    // --- Set up the initial project structure
    const project = await getKliveProjectStructure();
    project.machineType = machineId;
    project.modelId = modelId;
    project.config = getModelConfig(machineId, modelId);
    project.builder = {
      roots: ["code/code.kz80.asm"]
    };
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
  const lastFile = mainStore.getState()?.media?.[MEDIA_TAPE];
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
    await openFolderByPath(dialogResult.filePaths[0]);
    mainStore.dispatch(resetCompileAction());
  } finally {
    mainStore.dispatch(dimMenuAction(false));
  }
}

/**
 * Opens the specified path
 * @param projectFolder Folder to open
 * @returns null, if the operation is successful; otherwise, the error message
 */
export async function openFolderByPath (
  projectFolder: string
): Promise<string | null> {
  // --- Check if project files exists
  projectFolder = getKliveProjectFolder(projectFolder);
  if (!fs.existsSync(projectFolder)) {
    return `Folder ${projectFolder} does not exists.`;
  }
  await sendFromMainToIde({ type: "IdeSaveAllBeforeQuit" });
  const disp = mainStore.dispatch;
  disp(closeFolderAction());

  const projectFile = path.join(projectFolder, PROJECT_FILE);
  let isValidProject = false;
  if (fs.existsSync(projectFile)) {
    const projectContents = fs.readFileSync(projectFile, "utf8");
    try {
      const projectStruct = JSON.parse(
        projectContents
      ) as KliveProjectStructure;
      isValidProject = !!(
        projectStruct.kliveVersion && projectStruct.machineType
      );

      // --- Apply the machine type saved in the project
      await setMachineType(
        projectStruct.machineType,
        projectStruct.modelId,
        projectStruct.config
      );

      // --- Apply settings if the project is valid
      disp(setMachineSpecificAction(projectStruct.machineSpecific));
      disp(
        setExcludedProjectItemsAction(projectStruct.ide?.excludedProjectItems)
      );
      disp(showEmuToolbarAction(projectStruct.viewOptions.showEmuToolbar));
      disp(showEmuStatusBarAction(projectStruct.viewOptions.showEmuStatusbar));
      disp(showIdeToolbarAction(projectStruct.viewOptions.showIdeToolbar));
      disp(showIdeStatusBarAction(projectStruct.viewOptions.showIdeStatusbar));
      disp(showKeyboardAction(projectStruct.viewOptions.showKeyboard));
      disp(showSideBarAction(projectStruct.viewOptions.showSidebar));
      disp(
        primaryBarOnRightAction(projectStruct.viewOptions.primaryBarOnRight)
      );
      disp(showToolPanelsAction(projectStruct.viewOptions.showToolPanels));
      disp(toolPanelsOnTopAction(projectStruct.viewOptions.toolPanelsOnTop));
      disp(maximizeToolsAction(projectStruct.viewOptions.maximizeTools));
      disp(setIdeFontSizeAction(projectStruct.viewOptions.editorFontSize));
      disp(
        setBuildRootAction(
          projectStruct.builder?.roots,
          !!projectStruct.builder?.roots
        )
      );
      disp(saveProjectSettingAction(projectStruct.settings));

      // --- Restore breakpoints
      await sendFromMainToEmu({
        type: "EmuEraseAllBreakpoints"
      });

      if (projectStruct.debugger?.breakpoints) {
        for (const bp of projectStruct.debugger.breakpoints) {
          await sendFromMainToEmu({
            type: "EmuSetBreakpoint",
            breakpoint: bp
          });
        }
      }
    } catch {
      // --- Intentionally ingored
    }
  }

  disp(openFolderAction(projectFolder, isValidProject));

  const emulatorState = mainStore.getState().emulatorState;

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
export function resolveHomeFilePath (toResolve: string): string {
  return path.isAbsolute(toResolve)
    ? toResolve
    : path.join(app.getPath("home"), toResolve);
}

/**
 * Resolves the specified path using the save folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolveSavedFilePath (toResolve: string): string {
  return path.isAbsolute(toResolve)
    ? toResolve
    : path.join(
        path.join(app.getPath("home"), KLIVE_HOME_FOLDER, "SavedFiles"),
        toResolve
      );
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
      : path.join(app.getPath("home"), KLIVE_PROJECT_ROOT, projectFolder)
    : path.join(app.getPath("home"), KLIVE_PROJECT_ROOT);
}

// --- Get the current klive project structure to save
export async function getKliveProjectStructure (): Promise<KliveProjectStructure> {
  const state = mainStore.getState();
  const bpResponse = (await sendFromMainToEmu({
    type: "EmuListBreakpoints"
  })) as EmuListBreakpointsResponse;

  return {
    kliveVersion: app.getVersion(),
    machineType: state.emulatorState.machineId,
    modelId: state.emulatorState.modelId,
    config: state.emulatorState.config,
    clockMultiplier: state.emulatorState.clockMultiplier,
    soundLevel: state.emulatorState.soundLevel,
    soundMuted: state.emulatorState.soundMuted,
    savedSoundLevel: state.emulatorState.savedSoundLevel,
    media: state.media,
    fastLoad: state.emulatorState.fastLoad,
    machineSpecific: state.emulatorState.machineSpecific,
    ide: {
      excludedProjectItems: state.project?.excludedItems ?? []
    },
    viewOptions: {
      theme: state.theme,
      editorFontSize: state.ideViewOptions?.editorFontSize,
      maximizeTools: state.ideViewOptions?.maximizeTools,
      primaryBarOnRight: state.ideViewOptions?.primaryBarOnRight,
      showEmuStatusbar: state.emuViewOptions.showStatusBar,
      showEmuToolbar: state.emuViewOptions.showToolbar,
      showKeyboard: state.emuViewOptions.showKeyboard,
      keyboardLayout: state.emuViewOptions.keyboardLayout,
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
    },
    settings: state.projectSettings
  };
}

// --- Saves the current Klive project
export async function saveKliveProject (): Promise<void> {
  const projectState = mainStore.getState().project;
  if (!projectState.folderPath) return;

  try {
    const projectFile = path.join(projectState.folderPath, PROJECT_FILE);
    const project = await getKliveProjectStructure();
    fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
    mainStore.dispatch(incProjectFileVersionAction());
  } catch {
    // --- Intentionally ignored
  }
}
