import * as path from "path";
import * as fs from "fs";
import {
  KliveConfiguration,
  KliveSettings,
} from "../shared/messaging/emu-configurations";

/**
 * The file that stores the Klive Emulator configuration
 */
export const CONFIG_FILE_PATH = "Klive/klive.config";

/**
 * The file that stores the Klive settings
 */
export const SETTINGS_FILE_PATH = "Klive/klive.settings";

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
function getKliveSettings(): KliveSettings | null {
  const configFile = path.join(getHomeFolder(), SETTINGS_FILE_PATH);
  const folder = path.dirname(configFile);
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, {
        recursive: true,
      });
    }
    const contents = fs.readFileSync(configFile, "utf8");
    const config = JSON.parse(contents);
    return config;
  } catch (err) {
    console.log(`Cannot read and parse Klive settings file: ${err}`);
  }
  return null;
}

/**
 * Reloads the application settings
 */
export function reloadSettings(): void {
  appSettings = getKliveSettings();
}

/**
 * Saves the current settings
 * @param settings Settings to save
 */
export function saveKliveSettings(settings: KliveSettings): void {
  const configFile = path.join(getHomeFolder(), SETTINGS_FILE_PATH);
  try {
    fs.writeFileSync(configFile, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.log(`Cannot save Klive settings file: ${err}`);
  }
}

/**
 * The application configuration instance
 */
export const appConfiguration: KliveConfiguration | null = getKliveConfiguration();

/**
 * The application settings instance
 */
export let appSettings: KliveSettings | null = getKliveSettings();

