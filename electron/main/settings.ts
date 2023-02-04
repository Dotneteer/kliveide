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
  }
};

export function saveAppSettings (settings: AppSettings): void {
  const filename = getSettingsFilePath();
  const filePath = path.dirname(filename);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }
  fs.writeFileSync(getSettingsFilePath(), JSON.stringify(settings, null, 2), {
    encoding: "utf8",
    flag: "w"
  });
}

export function loadAppSettings(): AppSettings {
  try {
    const contents = fs.readFileSync(getSettingsFilePath(), "utf8");
    return JSON.parse(contents) as AppSettings;
  } catch {
    return {} as AppSettings;
  }
}

function getSettingsFilePath (): string {
  return path.join(app.getPath("home"), SETTINGS_FOLDER, SETTINGS_FILE_NAME);
}
