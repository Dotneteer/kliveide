import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { WindowState } from "./WindowStateManager";
import { mainStore } from "./main-store";

export const KLIVE_HOME_FOLDER = "Klive";
export const SETTINGS_FILE_NAME = "klive.settings";

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState;
    ideWindow?: WindowState;
    showIdeOnStartup?: boolean;
  };
  startScreenDisplayed?: boolean;
  theme?: string;
  showKeyboard?: boolean;
  fastLoad?: boolean;
  machineId?: string;
  clockMultiplier?: number;
  soundLevel?: number;
  lastTapeFile?: string;
  folders?: Record<string, string>;
  excludedProjectItems?: string[];
  keyMappingFile?: string;
  userSettings?: Record<string, any>;
};

export let appSettings: AppSettings = {};

export function saveAppSettings (): void {
  const filename = getSettingsFilePath();
  const filePath = path.dirname(filename);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }

  // --- Get settings from the current state
  const state = mainStore.getState();
  appSettings.startScreenDisplayed = state.startScreenDisplayed;
  appSettings.theme = state.theme;
  appSettings.showKeyboard = state.emuViewOptions?.showKeyboard ?? false;
  appSettings.fastLoad = state.emulatorState?.fastLoad ?? true;
  appSettings.machineId = state.emulatorState?.machineId;
  appSettings.clockMultiplier = state.emulatorState?.clockMultiplier ?? 1;
  appSettings.soundLevel = state.emulatorState?.soundLevel ?? 0.5;
  appSettings.lastTapeFile = state.emulatorState?.tapeFile;
  appSettings.keyMappingFile = state.keyMappingFile;

  fs.writeFileSync("/Users/dotneteer/klive.txt", getSettingsFilePath());

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
  } catch {
    appSettings = {};
  }
}

function getSettingsFilePath (): string {
  return path.join(app.getPath("home"), KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME);
}
