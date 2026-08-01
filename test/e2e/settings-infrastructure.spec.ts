import fs from "fs";
import { expect, test } from "@playwright/test";
import { KLIVE_SETTINGS_FILE_ENV } from "../../src/main/settings-path";
import { createE2eSettingsFile } from "./fixtures/settings";

test("an E2E case receives an isolated settings-file environment", () => {
  const settingsFile = createE2eSettingsFile({ theme: "light" });

  try {
    expect(settingsFile.environment[KLIVE_SETTINGS_FILE_ENV]).toBe(settingsFile.settingsFilePath);
    expect(JSON.parse(fs.readFileSync(settingsFile.settingsFilePath, "utf8"))).toMatchObject({
      startScreenDisplayed: true,
      theme: "light"
    });
  } finally {
    settingsFile.cleanup();
  }

  expect(fs.existsSync(settingsFile.settingsFilePath)).toBe(false);
});
