import * as path from "path";
import * as fs from "fs";
import { BreakpointDefinition } from "@abstractions/code-runner-service";
import { BuilderState, DebuggerState } from "@state/AppState";

/**
 * The file that stores the Klive Emulator configuration
 */
export const CONFIG_FILE_PATH = "Klive/klive.config";

/**
 * The file that stores the Klive settings
 */
export const SETTINGS_FILE_PATH = "Klive/klive.settings";

/**
 * Represents the Klive configuration that is read during startup
 */
export interface KliveConfiguration {
  port?: number;
  machineType?: string;
  diagnostics?: KliveDiagnostics;
  showDevTools?: boolean;
}

/**
 * Diagnostics settings
 */
export interface KliveDiagnostics {
  soundBufferUnderflow?: boolean;
  longFrameInfo?: boolean;
}

/**
 * View menu options
 */
export interface ViewOptions {
  showDevTools?: boolean;
  showToolbar?: boolean;
  showStatusbar?: boolean;
  showFrameInfo?: boolean;
  showKeyboard?: boolean;
  keyboardHeight?: number;
}

/**
 * Represents the Klive settings to persist
 */
export interface KliveSettings {
  machineType?: string;
  viewOptions?: ViewOptions;
  machineSpecific?: Record<string, Record<string, any>>;
};

/**
 * Represents the Klive project type
 */
export interface KliveProject extends KliveSettings {
  debugger: DebuggerState;
  builder: BuilderState;
}

/**
 * Gets the current home folder
 */
function getHomeFolder(): string {
  return (
    process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"] ?? ""
  );
}

/**
 * Gets the configuration of Klive Emulator from the user folder
 */
function getKliveConfiguration(): KliveConfiguration | null {
  const configFile = path.join(getHomeFolder(), CONFIG_FILE_PATH);
  if (fs.existsSync(configFile)) {
    try {
      const contents = fs.readFileSync(configFile, "utf8");
      const config = JSON.parse(contents);
      return config;
    } catch (err) {
      console.log(`Cannot read and parse Klive configuration file: ${err}`);
    }
  }
  return null;
}

/**
 * Gets the configuration of Klive Emulator from the user folder
 */
export function getKliveSettingsFromFile(
  configFile: string
): KliveSettings | null {
  const folder = path.dirname(configFile);
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, {
        recursive: true,
      });
    }
    if (fs.existsSync(configFile)) {
      const contents = fs.readFileSync(configFile, "utf8");
      const config = JSON.parse(contents);
      return config;
    }
  } catch (err) {
    console.log(`Cannot read and parse Klive settings: ${err}`);
  }
  return null;
}

/**
 * Gets the configuration of Klive Emulator from the user folder
 */
function getKliveSettings(): KliveSettings | null {
  return getKliveSettingsFromFile(
    path.join(getHomeFolder(), SETTINGS_FILE_PATH)
  );
}

/**
 * Saves the current settings
 * @param settings Settings to save
 */
export function saveSettingsToFile(
  settings: KliveSettings,
  settingsFile: string
): void {
  const folder = path.dirname(settingsFile);
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, {
        recursive: true,
      });
    }
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.log(`Cannot save Klive settings: ${err}`);
  }
}

/**
 * Saves the current settings
 * @param settings Settings to save
 */
export function saveKliveSettings(settings: KliveSettings): void {
  const settingsFile = path.join(getHomeFolder(), SETTINGS_FILE_PATH);
  saveSettingsToFile(settings, settingsFile);
}

/**
 * Reloads configuration settings
 */
export function reloadSettings(): void {
  appSettings = getKliveSettings();
}

/**
 * The application configuration instance
 */
export const appConfiguration: KliveConfiguration | null =
  getKliveConfiguration();

/**
 * The application settings instance
 */
export let appSettings: KliveSettings | null = getKliveSettings();
