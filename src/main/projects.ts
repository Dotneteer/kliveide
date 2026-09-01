import path from "path";
import fs from "fs";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import {
  closeFolderAction,
  dimMenuAction,
  incProjectFileVersionAction,
  openFolderAction,
  resetCompileAction,
  saveProjectSettingAction,
  setBuildRootAction,
  setExcludedProjectItemsAction,
  setMachineSpecificAction,
  setProjectBuildFileAction,
  setExportDialogInfoAction,
  setWorkspaceSettingsAction,
} from "@state/actions";
import { app, BrowserWindow, dialog } from "electron";
import { mainStore } from "./main-store";
import { ExportDialogSettings, KLIVE_HOME_FOLDER } from "./settings";
import {
  PROJECT_TEMPLATES,
  PROJECT_FILE,
  LAST_PROJECT_FOLDER,
  KLIVE_PROJECT_ROOT,
  MEDIA_TAPE,
  PROJECT_MERGE_FILE,
  BUILD_FILE
} from "@common/structs/project-const";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { setMachineType } from "./registeredMachines";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { getModelConfig } from "@common/machines/machine-registry";
import { fileChangeWatcher } from "./file-watcher";
import { processBuildFile } from "./build";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { appSettings, getSettingDefinition, saveAppSettings } from "./settings-utils";
import { get, set } from "lodash";

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
export async function createKliveProject(
  machineId: string,
  modelId: string | undefined,
  templateId: string,
  projectName: string,
  projectFolder?: string
): Promise<ProjectCreationResult> {
  const selectedTemplateId = templateId ?? "default";
  const projPath = getKliveProjectFolder(projectFolder);
  const fullProjectFolder = path.join(projPath, projectName);
  const templateFolder = path.join(
    resolvePublicFilePath(PROJECT_TEMPLATES),
    machineId,
    selectedTemplateId
  );

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

    // --- Check project merge file
    let mergedProps: any = {};
    try {
      const mergeFile = path.join(templateFolder, PROJECT_MERGE_FILE);
      if (fs.existsSync(mergeFile)) {
        const mergeContents = fs.readFileSync(mergeFile, "utf8");
        mergedProps = JSON.parse(mergeContents);
      }
    } catch (err) {
      // --- Intentionally ignored
    }

    // --- Create project files
    const projectFile = path.join(fullProjectFolder, PROJECT_FILE);

    // --- Set up the initial project structure
    const projectStructure = getKliveProjectStructureFromState([]);
    const project = { ...projectStructure, ...mergedProps };
    project.machineType = machineId;
    project.modelId = modelId;
    project.config = getModelConfig(machineId, modelId);
    fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
  } catch (err) {
    return {
      errorMessage: String(err)
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
export async function openFolder(browserWindow: BrowserWindow): Promise<void> {
  const lastFile = mainStore.getState()?.media?.[MEDIA_TAPE];
  const defaultPath =
    appSettings?.folders?.[LAST_PROJECT_FOLDER] ||
    (lastFile ? path.dirname(lastFile) : app.getPath("home"));
  mainStore.dispatch(dimMenuAction(true));

  // --- Open the project
  try {
    const dialogResult = await dialog.showOpenDialog(browserWindow, {
      title: "Select Project Folder",
      defaultPath,
      properties: ["openDirectory"]
    });
    if (dialogResult.canceled || dialogResult.filePaths.length < 1) return;
    await openFolderByPath(dialogResult.filePaths[0]);
  } finally {
    mainStore.dispatch(dimMenuAction(false));
    mainStore.dispatch(resetCompileAction());
  }
}

/**
 * Opens the specified path
 * @param projectFolder Folder to open
 * @returns null, if the operation is successful; otherwise, the error message
 */
export async function openFolderByPath(projectFolder: string): Promise<string | null> {
  // --- Check if project files exists
  projectFolder = getKliveProjectFolder(projectFolder);
  if (!fs.existsSync(projectFolder)) {
    return `Folder ${projectFolder} does not exists.`;
  }
  await getIdeApi().saveAllBeforeQuit();
  const disp = mainStore.dispatch;
  disp(closeFolderAction());

  // --- Check if the folder is a Klive project
  const projectFile = path.join(projectFolder, PROJECT_FILE);
  let isValidProject = false;
  if (fs.existsSync(projectFile)) {
    const projectContents = fs.readFileSync(projectFile, "utf8");
    try {
      const projectStruct = JSON.parse(projectContents) as KliveProjectStructure;
      isValidProject = !!(projectStruct.kliveVersion && projectStruct.machineType);

      // --- Apply the machine type saved in the project
      const machineApplied = await setMachineType(
        projectStruct.machineType,
        projectStruct.modelId,
        projectStruct.config
      );

      // --- Apply settings if the project is valid, merge with current state
      disp(setMachineSpecificAction(projectStruct.machineSpecific));
      disp(setExcludedProjectItemsAction(projectStruct.ide?.excludedProjectItems));
      disp(setBuildRootAction(projectStruct.builder?.roots, !!projectStruct.builder?.roots));
      disp(saveProjectSettingAction(projectStruct.settings));
      disp(setExportDialogInfoAction(projectStruct.exportDialog));
      disp(setWorkspaceSettingsAction(undefined, projectStruct.workspaceSettings));

      // --- Restore breakpoints, but only onto the machine this project actually installed. If a
      // --- concurrent machine change superseded ours, the live machine is somebody else's and
      // --- wiping its breakpoints to install this project's would corrupt that machine's state.
      if (machineApplied) {
        const restoredBreakpoints = (projectStruct.debugger?.breakpoints ?? []).filter(
          (bp) => !(bp.line && bp.line <= 0)
        );
        restoredBreakpoints.forEach((bp) => delete bp.resolvedAddress);

        // --- Install the whole set in one atomic call. The previous erase-then-add-each-one
        // --- sequence spanned many IPC round trips, during which a breakpoint the user toggled
        // --- in the IDE could be wiped or overwritten.
        await getEmuApi().restoreBreakpoints(restoredBreakpoints);
      } else {
        console.warn(
          `Skipped restoring breakpoints for '${projectFolder}': the project's machine was ` +
            `superseded by a concurrent machine change.`
        );
      }

      // --- Start watching project changes in the opened folder
      fileChangeWatcher.stopWatching();
      fileChangeWatcher.startWatching(projectFolder);
    } catch {
      // --- Intentionally ingored
    }
  }

  addRecentProject(projectFolder);
  disp(openFolderAction(projectFolder, isValidProject));

  // --- Chck for a build file
  const buildFile = path.join(projectFolder, BUILD_FILE);
  if (fs.existsSync(buildFile)) {
    disp(setProjectBuildFileAction(true));
    await processBuildFile();
  }

  // --- Save the folder into settings
  appSettings.folders ??= {};
  appSettings.folders[LAST_PROJECT_FOLDER] = projectFolder;
  saveAppSettings();
  return null;
}

/**
 * Copies a file synchronously
 * @param source Source file
 * @param target Target file
 */
function copyFileSync(source: string, target: string) {
  var targetFile = target;
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }
  fs.writeFileSync(targetFile, new Uint8Array(fs.readFileSync(source)));
}

/**
 * Copies the contents of a folder into another synchronously
 * @param source Source folder
 * @param target Target folder
 */
function copyFolderSync(source: string, target: string, copyRoot = true) {
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
      if (file.startsWith("__$")) return;
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
export function resolveHomeFilePath(toResolve: string): string {
  return path.isAbsolute(toResolve) ? toResolve : path.join(app.getPath("home"), toResolve);
}

/**
 * Resolves the specified path using the save folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolveSavedFilePath(toResolve: string): string {
  const project = mainStore.getState().project;
  const isKliveProject = project?.isKliveProject ?? false;
  const projectFolder = project?.folderPath ?? "";
  const finalPath = path.isAbsolute(toResolve)
    ? toResolve
    : isKliveProject
      ? path.join(projectFolder, "SavedFiles", toResolve)
      : path.join(path.join(app.getPath("home"), KLIVE_HOME_FOLDER, "SavedFiles"), toResolve);
  return finalPath;
}

/**
 * Resolves the specified path using the public folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolvePublicFilePath(toResolve: string): string {
  return path.isAbsolute(toResolve) ? toResolve : path.join(process.env.PUBLIC, toResolve);
}

// --- Gets the klive folder for the specified project folder
export function getKliveProjectFolder(projectFolder: string): string {
  return projectFolder
    ? path.isAbsolute(projectFolder)
      ? projectFolder
      : path.join(app.getPath("home"), KLIVE_PROJECT_ROOT, projectFolder)
    : path.join(app.getPath("home"), KLIVE_PROJECT_ROOT);
}

// --- Get the current klive project structure to save
export async function getKliveProjectStructure(options: {
  includeBreakpoints?: boolean;
} = {}): Promise<KliveProjectStructure> {
  const includeBreakpoints = options.includeBreakpoints ?? true;
  const bpResponse = includeBreakpoints
    ? await getEmuApi().listBreakpoints()
    : { breakpoints: [] };
  return getKliveProjectStructureFromState(bpResponse.breakpoints);
}

function getKliveProjectStructureFromState(breakpoints: BreakpointInfo[]): KliveProjectStructure {
  const state = mainStore.getState() ?? {};
  const emulatorState = state.emulatorState ?? {};
  const globalSettings: Record<string, any> = {};
  Object.keys(KliveGlobalSettings).forEach((key) => {
    if (getSettingDefinition(key)?.saveWithProject ?? false) {
      set(globalSettings, key, get(state.globalSettings, key));
    }
  });
  return {
    kliveVersion: app.getVersion(),
    machineType: emulatorState.machineId,
    modelId: emulatorState.modelId,
    config: emulatorState.config,
    clockMultiplier: emulatorState.clockMultiplier,
    soundLevel: emulatorState.soundLevel,
    soundMuted: emulatorState.soundMuted,
    savedSoundLevel: emulatorState.savedSoundLevel,
    media: state.media,
    machineSpecific: emulatorState.machineSpecific,
    ide: {
      excludedProjectItems: state.project?.excludedItems ?? []
    },
    viewOptions: {
      theme: state.theme
    },
    debugger: {
      breakpoints
    },
    builder: {
      roots: state.project?.buildRoots ?? []
    },
    settings: state.projectSettings,
    exportDialog: state.project?.exportSettings,
    workspaceSettings: state.workspaceSettings,
  };
}

/**
 * Serializes project saves.
 *
 * A save is not atomic: it awaits a cross-window IPC round trip (to collect the breakpoints)
 * before writing the whole project file from a state snapshot. Two overlapping saves can
 * therefore finish in a different order than they started, letting an older snapshot be written
 * last and silently revert the newer one. Chaining them guarantees each save observes the state
 * as of its own turn, and that the last save to *start* is also the last to be written.
 */
let saveProjectChain: Promise<void> = Promise.resolve();

// --- Saves the current Klive project
export function saveKliveProject(): Promise<void> {
  const runSave = async () => {
    const projectState = mainStore.getState().project;
    if (!projectState.folderPath) return;

    try {
      const projectFile = path.join(projectState.folderPath, PROJECT_FILE);
      const project = await getKliveProjectStructure();
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
      mainStore.dispatch(incProjectFileVersionAction());
    } catch (err) {
      // --- A failed save must not break the chain for subsequent saves, but it should no longer
      // --- vanish without a trace either.
      console.error("Saving the Klive project failed.", err);
    }
  };

  saveProjectChain = saveProjectChain.then(runSave, runSave);
  return saveProjectChain;
}

let recentProjects: string[] = [];
const MAX_RECENT_PROJECTS = 10;

// --- Retrieve the recent projects
export function getRecentProjects(): string[] {
  return recentProjects;
}

// --- Set the recent projects (after loading the settings)
export function setRecentProjects(projects: string[]): void {
  recentProjects = projects;
}

// --- Add a recent project
function addRecentProject(projectFolder: string): void {
  projectFolder = projectFolder.replace(/\\/g, "/");
  if (recentProjects.includes(projectFolder)) {
    recentProjects = recentProjects.filter((p) => p !== projectFolder);
  }
  recentProjects.unshift(projectFolder);
  recentProjects = recentProjects.slice(0, MAX_RECENT_PROJECTS);
  appSettings.recentProjects = recentProjects;
  saveAppSettings();
}

type KliveProjectStructure = {
  kliveVersion: string;
  machineType?: string;
  modelId?: string;
  config?: Record<string, any>;
  viewOptions?: ViewOptions;
  clockMultiplier?: number;
  soundLevel?: number;
  soundMuted?: boolean;
  savedSoundLevel?: number;
  media?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  keyMappingFile?: string;
  ide?: Record<string, any>;
  debugger?: DebuggerState;
  builder?: BuilderState;
  settings?: Record<string, any>;
  exportDialog?: ExportDialogSettings;
  workspaceSettings?: Record<string, any>;
};

interface ViewOptions {
  theme?: string;
  keyboardHeight?: number;
}

// --- Represents the state of the debugger
type DebuggerState = {
  breakpoints: BreakpointInfo[];
};

// --- Represents the state of the builder
type BuilderState = {
  roots: string[];
};
