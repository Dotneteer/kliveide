import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { WindowState } from "./WindowState";

const SETTINGS_FILE_NAME = "kliveide-shell.settings.json";

export type AppSettings = {
  windowStates?: {
    emuWindow?: WindowState;
    ideWindow?: WindowState;
  };
};

export let appSettings: AppSettings = {};

export function loadAppSettings(): void {
  try {
    const settingsPath = getSettingsFilePath();
    if (!fs.existsSync(settingsPath)) {
      appSettings = {};
      return;
    }

    appSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as AppSettings;
  } catch {
    appSettings = {};
  }
}

export function saveAppSettings(): void {
  try {
    const settingsPath = getSettingsFilePath();
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
  } catch {
    // Settings persistence is best-effort; window closing should never fail on it.
  }
}

function getSettingsFilePath(): string {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}
