import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getState = vi.fn();
const dispatch = vi.fn();
const restoreBreakpoints = vi.fn();
const setMachineType = vi.fn();
const showMessageBox = vi.fn();

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
  getIdeApi: () => ({ saveAllBeforeQuit: vi.fn(async () => true) })
}));

vi.mock("@main/settings-utils", () => ({
  appSettings: {},
  getSettingDefinition: vi.fn(() => null),
  saveAppSettings: vi.fn()
}));

vi.mock("@main/build", () => ({ processBuildFile: vi.fn() }));

vi.mock("@main/file-watcher", () => ({
  fileChangeWatcher: { startWatching: vi.fn(), stopWatching: vi.fn() }
}));

vi.mock("@main/registeredMachines", () => ({ setMachineType }));

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
});
