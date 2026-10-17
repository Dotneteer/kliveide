import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A settings save before main has restored the settings into its store (a window-state save while
 * the windows open) must not copy the store's defaults over the loaded settings: it wiped every
 * global setting, the display language among them, at start-up.
 */
const store = vi.hoisted(() => ({ state: {} as any }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => store.state, dispatch: vi.fn() } }));
vi.mock("@main/portable", () => ({ getKliveHomeBase: () => tmpdir() }));
vi.mock("@main/projects", () => ({
  getRecentProjects: () => [],
  setRecentProjects: vi.fn(),
  saveKliveProject: vi.fn()
}));

let dir: string;
let settingsFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "klive-settings-"));
  settingsFile = join(dir, "klive.settings");
  process.env.KLIVE_SETTINGS_FILE = settingsFile;
  store.state = { globalSettings: {}, theme: "dark" };
  vi.resetModules();
});

afterEach(() => {
  delete process.env.KLIVE_SETTINGS_FILE;
  rmSync(dir, { recursive: true, force: true });
});

const saved = () => JSON.parse(readFileSync(settingsFile, "utf8"));

describe("saveAppSettings at start-up", () => {
  it("keeps the loaded global settings until the store holds them", async () => {
    writeFileSync(settingsFile, JSON.stringify({ theme: "light", globalSettings: { ideViewOptions: { language: "de" } } }));
    const utils = await import("@main/settings-utils");
    utils.loadAppSettings();

    // --- A window-state save while the windows open: the store still has its defaults
    utils.appSettings.windowStates = { showIdeOnStartup: true };
    utils.saveAppSettings();
    expect(saved().globalSettings).toEqual({ ideViewOptions: { language: "de" } });
    expect(saved().theme).toBe("light");
    expect(saved().windowStates).toEqual({ showIdeOnStartup: true });

    // --- Once restored, the store is the source of what is saved
    store.state = { globalSettings: { ideViewOptions: { language: "hu" } }, theme: "light" };
    utils.markAppStateRestored();
    utils.saveAppSettings();
    expect(saved().globalSettings).toEqual({ ideViewOptions: { language: "hu" } });
  });
});
