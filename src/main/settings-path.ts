import fs from "fs";
import path from "path";
import { KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME } from "./settings";

export const KLIVE_SETTINGS_FILE_ENV = "KLIVE_SETTINGS_FILE";

/**
 * Resolves the settings file used by this Klive process.
 *
 * KLIVE_SETTINGS_FILE is intended for isolated automated-test runs. It must be
 * absolute so that a test never accidentally writes to a path relative to the
 * repository or to a developer's home folder.
 */
export function resolveSettingsFilePath(
  homePath: string,
  environment: NodeJS.ProcessEnv = process.env
): string {
  const override = environment[KLIVE_SETTINGS_FILE_ENV];
  if (override === undefined) {
    return path.join(homePath, KLIVE_HOME_FOLDER, SETTINGS_FILE_NAME);
  }

  if (!path.isAbsolute(override)) {
    throw new Error(`${KLIVE_SETTINGS_FILE_ENV} must be an absolute path: ${override}`);
  }

  return path.normalize(override);
}

export function ensureSettingsFileDirectory(settingsFilePath: string): void {
  fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
}
