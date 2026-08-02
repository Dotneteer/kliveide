import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureSettingsFileDirectory,
  KLIVE_SETTINGS_FILE_ENV,
  resolveSettingsFilePath
} from "../src/main/settings-path";

const createdDirectories: string[] = [];

afterEach(() => {
  createdDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe("settings file path", () => {
  it("keeps the normal settings location when no override is supplied", () => {
    const homePath = path.resolve("test-home");

    expect(resolveSettingsFilePath(homePath, {})).toBe(path.join(homePath, "Klive", "klive.settings"));
  });

  it("uses an absolute test settings-file override", () => {
    const settingsPath = path.join(os.tmpdir(), "klive-e2e-case", "klive.settings");

    expect(resolveSettingsFilePath("/test-home", { [KLIVE_SETTINGS_FILE_ENV]: settingsPath })).toBe(
      settingsPath
    );
  });

  it("rejects a relative settings-file override", () => {
    expect(() =>
      resolveSettingsFilePath("/test-home", { [KLIVE_SETTINGS_FILE_ENV]: "test/klive.settings" })
    ).toThrow(`${KLIVE_SETTINGS_FILE_ENV} must be an absolute path`);
  });

  it("creates the parent directory for an isolated settings file", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "klive-settings-path-"));
    createdDirectories.push(root);
    const settingsPath = path.join(root, "case", "settings", "klive.settings");

    ensureSettingsFileDirectory(settingsPath);

    expect(fs.existsSync(path.dirname(settingsPath))).toBe(true);
  });
});
