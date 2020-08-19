import * as path from "path";
import * as fs from "fs";

/**
 * The file that stores the Klive Emulator configuration
 */
export const CONFIG_FILE_PATH = "Klive/klive.config";

/**
 * Represents the Klive configuration that is read during startup
 */
export interface KliveConfiguration {
  port?: number;
}

/**
 * Gets the configuration of Klive Emulator from the user folder
 */
function getConfiguration(): KliveConfiguration | null {
  const home =
    process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"] ?? "";
  const configFile = path.join(home, CONFIG_FILE_PATH);
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
 * The application configuration instance
 */
export const appConfiguration: KliveConfiguration | null = getConfiguration();
