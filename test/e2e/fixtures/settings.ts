import fs from "fs";
import os from "os";
import path from "path";
import type { AppSettings } from "../../../src/main/settings";
import { KLIVE_SETTINGS_FILE_ENV } from "../../../src/main/settings-path";

export type E2eSettingsFile = {
  settingsFilePath: string;
  environment: NodeJS.ProcessEnv;
  cleanup: () => void;
};

/**
 * Creates a settings file owned by one E2E case. Playwright fixtures should pass
 * its environment to electron.launch({ env }) and call cleanup after the app exits.
 */
export function createE2eSettingsFile(
  settings: Partial<AppSettings> = {},
  writeSettingsFile = true
): E2eSettingsFile {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klive-e2e-"));
  const settingsFilePath = path.join(directory, "klive.settings");
  const content: AppSettings = {
    startScreenDisplayed: true,
    windowStates: { showIdeOnStartup: true },
    // Keep the test app behind Playwright's window. This also prevents a local
    // always-on-top preference from leaking into a test run.
    globalSettings: {
      emuOptions: { stayOnTop: false }
    } as AppSettings["globalSettings"],
    ...settings
  };

  if (writeSettingsFile) {
    fs.writeFileSync(settingsFilePath, JSON.stringify(content, null, 2), "utf8");
  }

  return {
    settingsFilePath,
    environment: {
      ...process.env,
      KLIVE_E2E: "1",
      [KLIVE_SETTINGS_FILE_ENV]: settingsFilePath
    },
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true })
  };
}
