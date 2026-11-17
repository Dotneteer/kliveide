import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getState = vi.fn();
const dispatch = vi.fn();
const restoreBreakpoints = vi.fn();
const setMachineType = vi.fn();
const showMessageBox = vi.fn();
const displayDialog = vi.fn();
const appSettings: Record<string, any> = {};

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => os.tmpdir()),
    getVersion: vi.fn(() => "0.64.0-test")
  },
  BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBox
  }
}));

vi.mock("@main/main-store", () => ({
  mainStore: { dispatch, getState }
}));

vi.mock("@messaging/MainToEmuMessenger", () => ({
  getEmuApi: () => ({ restoreBreakpoints })
}));

vi.mock("@messaging/MainToIdeMessenger", () => ({
  getIdeApi: () => ({ saveAllBeforeQuit: vi.fn(async () => true), displayDialog })
}));

vi.mock("@main/settings-utils", () => ({
  appSettings,
  getSettingDefinition: vi.fn(() => null),
  saveAppSettings: vi.fn()
}));

vi.mock("@main/build", () => ({ processBuildFile: vi.fn() }));

vi.mock("@main/file-watcher", () => ({
  fileChangeWatcher: { startWatching: vi.fn(), stopWatching: vi.fn() }
}));

vi.mock("@main/registeredMachines", () => ({
  setMachineType,
  // --- Opening a project goes through changeMachineType (NEXT_SD_CARDS_PLAN phase 5)
  changeMachineType: async (...args: any[]) => ((await setMachineType(...args)) ? "applied" : "superseded")
}));

/** The action that marks the folder open; its payload says whether it is a valid project */
const openFolderDispatch = () =>
  dispatch.mock.calls.map(([action]) => action).find((action) => action?.type === "OPEN_FOLDER");

describe("openFolderByPath", () => {
  let folderPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    folderPath = fs.mkdtempSync(path.join(os.tmpdir(), "klive-open-project-"));
    fs.writeFileSync(
      path.join(folderPath, "klive.project"),
      JSON.stringify({ kliveVersion: "0.64.0", machineType: "zxnext", modelId: "standard" })
    );
    getState.mockReturnValue({ project: {} });
    showMessageBox.mockResolvedValue({ response: 0 });
    setMachineType.mockResolvedValue(true);
    restoreBreakpoints.mockResolvedValue(undefined);
    displayDialog.mockResolvedValue(undefined);
    delete appSettings.plainFolders;
  });

  it("opens a loadable project without reporting anything", async () => {
    const { openFolderByPath } = await import("@main/projects");

    expect(await openFolderByPath(folderPath)).toBeNull();
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it("reports a failure while loading the project instead of swallowing it", async () => {
    // --- What a stale machine core produces: the emulator cannot create the machine
    setMachineType.mockRejectedValue(
      new Error("ZX Spectrum Next WASM v2 artifact is missing export 'zxnextSetLayerDebug'.")
    );
    const { openFolderByPath } = await import("@main/projects");

    const result = await openFolderByPath(folderPath);

    expect(result).toContain(folderPath);
    expect(result).toContain("zxnextSetLayerDebug");
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(showMessageBox.mock.calls[0][0]).toMatchObject({ type: "error", detail: result });
    // --- The folder still opens, so the user can reach its files and fix the project
    expect(openFolderDispatch()).toBeDefined();
  });

  it("reports a project file that is not valid JSON", async () => {
    fs.writeFileSync(path.join(folderPath, "klive.project"), "{ not json");
    const { openFolderByPath } = await import("@main/projects");

    const result = await openFolderByPath(folderPath);

    expect(result).toContain("was not loaded completely");
    expect(showMessageBox).toHaveBeenCalledTimes(1);
  });

  // --- `dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.2
  describe("the offer to make a plain folder a project", () => {
    const MAKE_PROJECT_DIALOG = 12;
    beforeEach(() => fs.rmSync(path.join(folderPath, "klive.project")));

    it("is made when the user opened a plain folder", async () => {
      const { openFolderByPath } = await import("@main/projects");

      expect(await openFolderByPath(folderPath, { offerConversion: true })).toBeNull();

      expect(displayDialog).toHaveBeenCalledWith(MAKE_PROJECT_DIALOG, { folder: folderPath, offer: true });
      expect(openFolderDispatch().payload.flag).toBe(false);
      // --- Opening writes nothing into the folder
      expect(fs.readdirSync(folderPath)).toEqual([]);
    });

    // --- The IDE's startup reopen asks for it too (decision Q2); New Project, automation and the
    // --- CLI do not
    it("is not made when the caller does not ask for it", async () => {
      const { openFolderByPath } = await import("@main/projects");

      await openFolderByPath(folderPath);

      expect(displayDialog).not.toHaveBeenCalled();
    });

    it("is not made for a folder the user keeps plain", async () => {
      const { rememberPlainFolder } = await import("@main/plain-folders");
      rememberPlainFolder(folderPath);
      const { openFolderByPath } = await import("@main/projects");

      await openFolderByPath(folderPath, { offerConversion: true });

      expect(displayDialog).not.toHaveBeenCalled();
    });

    it("is not made for a project, nor for a project file that failed to load", async () => {
      const { openFolderByPath } = await import("@main/projects");
      fs.writeFileSync(
        path.join(folderPath, "klive.project"),
        JSON.stringify({ kliveVersion: "0.64.0", machineType: "zxnext" })
      );
      await openFolderByPath(folderPath, { offerConversion: true });

      fs.writeFileSync(path.join(folderPath, "klive.project"), "{ not json");
      await openFolderByPath(folderPath, { offerConversion: true });

      expect(displayDialog).not.toHaveBeenCalled();
    });

    it("is made for a project file without a machine (not a valid project)", async () => {
      fs.writeFileSync(path.join(folderPath, "klive.project"), JSON.stringify({ kliveVersion: "0.1.0" }));
      const { openFolderByPath } = await import("@main/projects");

      await openFolderByPath(folderPath, { offerConversion: true });

      expect(displayDialog).toHaveBeenCalledTimes(1);
    });
  });
});
