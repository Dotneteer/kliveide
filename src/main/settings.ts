import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { WindowState } from "./WindowStateManager";

const SETTINGS_FILE_NAME = "klive.settings";
const SETTINGS_FOLDER = "Klive";

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState,
    ideWindow?: WindowState,
    showIdeOnStartup?: boolean;
  },
  folders?: Record<string, string>,
  excludedProjectItems?: string[]
};

export let appSettings: AppSettings = {};

export function saveAppSettings (): void {
  const filename = getSettingsFilePath();
  const filePath = path.dirname(filename);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }
  fs.writeFileSync(getSettingsFilePath(), JSON.stringify(appSettings, null, 2), {
    encoding: "utf8",
    flag: "w"
  });
}

export function loadAppSettings(): void {
  try {
    const contents = fs.readFileSync(getSettingsFilePath(), "utf8");
    appSettings = JSON.parse(contents) as AppSettings;
  } catch {
    appSettings = {};
  }
}

function getSettingsFilePath (): string {
  return path.join(app.getPath("home"), SETTINGS_FOLDER, SETTINGS_FILE_NAME);
}
