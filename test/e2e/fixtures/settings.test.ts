import fs from "fs";
import { afterEach, describe, expect, it } from "vitest";
import { KLIVE_SETTINGS_FILE_ENV } from "@main/settings-path";
import { createE2eSettingsFile } from "./settings";

const settingsFiles: Array<ReturnType<typeof createE2eSettingsFile>> = [];

afterEach(() => settingsFiles.splice(0).forEach((settingsFile) => settingsFile.cleanup()));

describe("E2E settings fixture", () => {
  it("creates an isolated settings file and exposes it through the launch environment", () => {
    const settingsFile = createE2eSettingsFile({ theme: "light" });
    settingsFiles.push(settingsFile);

    expect(settingsFile.environment[KLIVE_SETTINGS_FILE_ENV]).toBe(settingsFile.settingsFilePath);
    expect(JSON.parse(fs.readFileSync(settingsFile.settingsFilePath, "utf8"))).toMatchObject({
      startScreenDisplayed: true,
      theme: "light",
      windowStates: { showIdeOnStartup: true },
      globalSettings: { emuOptions: { stayOnTop: false } }
    });
  });

  it("can reserve an isolated path without creating a settings file", () => {
    const settingsFile = createE2eSettingsFile({}, false);
    settingsFiles.push(settingsFile);

    expect(fs.existsSync(settingsFile.settingsFilePath)).toBe(false);
    expect(settingsFile.environment[KLIVE_SETTINGS_FILE_ENV]).toBe(settingsFile.settingsFilePath);
  });
});
