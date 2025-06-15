import path from "path";
import fs from "fs";
import { Setting } from "@abstractions/Setting";
import { mainStore } from "@main/main-store";
import { get } from "lodash";
import { KliveGlobalSettings } from "../common/settings/setting-definitions";
import { getRecentProjects, saveKliveProject, setRecentProjects } from "./projects";
import { app } from "electron";
import { AppSettings, KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME } from "./settings";

/**
 * Get the specified seeting definition.
 * @param id Setting identifier
 * @returns The setting definition, if found; otherwise, null.
 */
export function getSettingDefinition(id: string): Setting | null {
  const setting = KliveGlobalSettings[id];
  return setting ? { ...setting } : null;
}

/**
 * Gets the value of the specified setting from the main store.
 * @param id Setting identifier
 * @returns The value of the setting, or null if the setting does not exist.
 */
export function getSettingValue(id: string): any {
  const setting = getSettingDefinition(id);
  if (!setting) {
    // --- This setting does not exist
    return null;
  }

  const state = mainStore.getState()?.globalSettings || {};
  return get(state, setting.id, setting.defaultValue);
}

export function setSettingValue(id: string, value: any): void {
  const setting = getSettingDefinition(id);
  if (!setting) {
    // --- This setting does not exist
    return;
  }

  const state = mainStore.getState();
  const currentValue = get(state.globalSettings, setting.id);
  if (currentValue === value) {
    // --- No change
    return;
  }

  // --- Check if the value is valid
  switch (setting.type) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`Invalid value for setting ${id}: expected string, got ${typeof value}`);
      }
      break;
    case "number":
      if (typeof value !== "number") {
        throw new Error(`Invalid value for setting ${id}: expected number, got ${typeof value}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Invalid value for setting ${id}: expected boolean, got ${typeof value}`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        throw new Error(`Invalid value for setting ${id}: expected array, got ${typeof value}`);
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Invalid value for setting ${id}: expected object, got ${typeof value}`);
      }
      break;
    case "any":
      // --- No validation for "any" type
      break;
  }

  // --- Update the state with the new value
  mainStore.dispatch({
    type: "SET_GLOBAL_SETTING",
    payload: { id, value }
  });

  // --- Save the setting if required
  if (setting.saveWithIde) {
    saveAppSettings();
  }
  if (setting.saveWithProject) {
    saveKliveProject();
  }
}

export let appSettings: AppSettings = {};

export function saveAppSettings(): void {
  const filename = getSettingsFilePath();
  const filePath = path.dirname(filename);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }

  // --- Do not refresh state after the final save
  // --- Get settings from the current state
  const state = mainStore.getState();
  appSettings.startScreenDisplayed = state.startScreenDisplayed;
  appSettings.theme = state.theme;
  appSettings.globalSettings = state.globalSettings;
  appSettings.ideSettings = state.ideSettings;
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

  // --- Save to the settings file
  fs.writeFileSync(getSettingsFilePath(), JSON.stringify(appSettings, null, 2), {
    encoding: "utf8",
    flag: "w"
  });
}

export function loadAppSettings(): void {
  try {
    const contents = fs.readFileSync(getSettingsFilePath(), "utf8");
    appSettings = JSON.parse(contents) as AppSettings;

    // --- Apply settings to the current main-only state
    setRecentProjects(appSettings.recentProjects ?? []);
  } catch {
    appSettings = {};
  }
}

function getSettingsFilePath(): string {
  return path.join(app.getPath("home"), KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME);
}
