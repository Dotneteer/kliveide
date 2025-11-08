import { app, BrowserWindow, screen } from "electron";
import { promises as fs } from "fs";
import { join } from "path";
import { AppSettings } from "../common/abstractions/AppSettings";
import { WindowState } from "../common/abstractions/WindowState";
import { KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME } from "../common/structs/project-const";
import { SettingDescription } from "../common/abstractions/SettingDescription";
import { KliveGlobalSettings } from "../common/settings/setting-definitions";
import { mainStore } from "./mainStore";
import { get } from "lodash";
import { setGlobalSettingAction } from "../common/state/actions";

const SETTINGS_DIR = join(app.getPath("home"), KLIVE_HOME_FOLDER);
const SETTINGS_FILE = join(SETTINGS_DIR, SETTINGS_FILE_NAME);

/**
 * Global application settings object that can be accessed and modified directly
 */
export let appSettings: AppSettings = {};

/**
 * Get the specified seeting definition.
 * @param id Setting identifier
 * @returns The setting definition, if found; otherwise, null.
 */
export function getSettingDefinition(id: string): SettingDescription | null {
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

  mainStore.dispatch(setGlobalSettingAction(id, value), 'main');
}

/**
 * Ensures the settings directory exists
 */
async function ensureSettingsDirectory(): Promise<void> {
  try {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create settings directory:", error);
    throw error;
  }
}

/**
 * Loads settings from the JSON file
 */
export async function loadAppSettings(): Promise<AppSettings> {
  try {
    await ensureSettingsDirectory();
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    appSettings = JSON.parse(data);
    console.log("Settings loaded successfully");
    return appSettings;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.log("No settings file found, using defaults");
      appSettings = {};
      return appSettings;
    }
    console.error("Failed to load settings:", error);
    appSettings = {};
    return appSettings;
  }
}

/**
 * Saves the current appSettings to the JSON file
 */
export async function saveAppSettings(): Promise<void> {
  try {
    await ensureSettingsDirectory();
    const json = JSON.stringify(appSettings, null, 2);
    await fs.writeFile(SETTINGS_FILE, json, "utf-8");
    console.log("Settings saved successfully");
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  }
}

/**
 * Captures the current state of a BrowserWindow
 */
export function captureWindowState(window: BrowserWindow): WindowState {
  const bounds = window.getBounds();
  const display = screen.getDisplayMatching(bounds);

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen(),
    displayBounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    }
  };
}

/**
 * Applies saved window state to a BrowserWindow
 */
export function applyWindowState(window: BrowserWindow, state: WindowState | undefined): void {
  if (!state) {
    return;
  }

  // Check if the saved position is still valid (display might have changed)
  const displays = screen.getAllDisplays();
  const isValidPosition = displays.some(display => {
    return (
      state.x >= display.bounds.x &&
      state.x < display.bounds.x + display.bounds.width &&
      state.y >= display.bounds.y &&
      state.y < display.bounds.y + display.bounds.height
    );
  });

  if (isValidPosition) {
    window.setBounds({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height
    });
  } else {
    // If position is invalid, just set size and let OS position it
    window.setBounds({
      width: state.width,
      height: state.height
    });
  }

  if (state.isMaximized) {
    window.maximize();
  }

  if (state.isFullScreen) {
    window.setFullScreen(true);
  }
}
