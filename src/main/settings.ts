import path from "path";
import fs from "fs";

import type { WindowState } from "./WindowStateManager";

import { app } from "electron";
import { mainStore } from "./main-store";
import { getRecentProjects, setRecentProjects } from "./projects";
import { IdeProject } from "@common/state/AppState";

export const KLIVE_HOME_FOLDER = "Klive";
export const SETTINGS_FILE_NAME = "klive.settings";

export type ExportDialogSettings = {
  formatId?: string;
  exportName?: string;
  exportFolder?: string;
  programName?: string;
  border?: number;
  screenFilename?: string;
  startBlock?: boolean;
  addClear?: boolean;
  addPause?: boolean;
  singleBlock?: boolean;
  startAddress?: number;
}

export type IdeSettings = {
  disableAutoOpenProject?: boolean;
  disableAutoComplete?: boolean;
  closeEmulatorWithIde?: boolean;
}

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState;
    ideWindow?: WindowState;
    showIdeOnStartup?: boolean;
    emuZoomFactor?: number;
    ideZoomFactor?: number;
  };
  ideSettings?: IdeSettings;
  startScreenDisplayed?: boolean;
  theme?: string;
  showKeyboard?: boolean;
  showInstantScreen?: boolean;
  keyboardLayout?: string;
  showIdeToolbar?: boolean;
  showIdeStatusBar?: boolean;
  showEmuToolbar?: boolean;
  showEmuStatusBar?: boolean;
  emuStayOnTop?: boolean;
  primaryBarRight?: boolean;
  toolPanelsTop?: boolean;
  maximizeTools?: boolean;

  fastLoad?: boolean;
  machineId?: string;
  modelId?: string;
  config?: Record<string, any>;
  machineSpecific?: Record<string, any>;
  clockMultiplier?: number;
  soundLevel?: number;
  media?: Record<string, any>;
  folders?: Record<string, string>;
  excludedProjectItems?: string[];
  keyMappingFile?: string;
  userSettings?: Record<string, any>;
  project?: IdeProject;
  recentProjects?: string[];
};

let finalSaveDone = false;

export let appSettings: AppSettings = {};

export function saveAppSettings (): void {
  if (finalSaveDone) return;

  const filename = getSettingsFilePath();
  const filePath = path.dirname(filename);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }

  // --- Do not refresh state after the final save
  if (!finalSaveDone) {
    // --- Get settings from the current state
    const state = mainStore.getState();
    appSettings.startScreenDisplayed = state.startScreenDisplayed;
    appSettings.theme = state.theme;
    appSettings.ideSettings = state.ideSettings;
    appSettings.showKeyboard = state.emuViewOptions?.showKeyboard ?? false;
    appSettings.showInstantScreen = state.emuViewOptions?.showInstantScreen ?? false;
    appSettings.keyboardLayout = state.emuViewOptions?.keyboardLayout;
    appSettings.showIdeToolbar = state.ideViewOptions?.showToolbar ?? false;
    appSettings.showIdeStatusBar = state.ideViewOptions?.showStatusBar ?? false;
    appSettings.showEmuToolbar = state.emuViewOptions?.showToolbar ?? false;
    appSettings.showEmuStatusBar = state.emuViewOptions?.showStatusBar ?? false;
    appSettings.emuStayOnTop = state.emuViewOptions?.stayOnTop ?? false;
    appSettings.primaryBarRight = state.ideViewOptions?.primaryBarOnRight ?? false;
    appSettings.toolPanelsTop = state.ideViewOptions?.toolPanelsOnTop ?? false;
    appSettings.maximizeTools = state.ideViewOptions?.maximizeTools ?? false;
    appSettings.fastLoad = state.emulatorState?.fastLoad ?? true;
    appSettings.machineId = state.emulatorState?.machineId;
    appSettings.modelId = state.emulatorState?.modelId;
    appSettings.config = state.emulatorState?.config;
    appSettings.machineSpecific = state.emulatorState?.machineSpecific;
    appSettings.clockMultiplier = state.emulatorState?.clockMultiplier ?? 1;
    appSettings.soundLevel = state.emulatorState?.soundLevel ?? 0.5;
    appSettings.media = state.media ?? {};
    appSettings.keyMappingFile = state.keyMappingFile;
    appSettings.project = { folderPath: state.project?.folderPath };
    appSettings.recentProjects = getRecentProjects();    
  }

  // --- Save to the settings file
  fs.writeFileSync(
    getSettingsFilePath(),
    JSON.stringify(appSettings, null, 2),
    {
      encoding: "utf8",
      flag: "w"
    }
  );
}

export function loadAppSettings (): void {
  try {
    const contents = fs.readFileSync(getSettingsFilePath(), "utf8");
    appSettings = JSON.parse(contents) as AppSettings;

    // --- Apply settings to the current main-only state
    setRecentProjects(appSettings.recentProjects ?? []);
  } catch {
    appSettings = {};
  }
}

export function signFinalSave (): void {
  finalSaveDone = true;
}

function getSettingsFilePath (): string {
  return path.join(app.getPath("home"), KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME);
}