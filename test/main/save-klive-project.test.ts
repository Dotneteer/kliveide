import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getState = vi.fn();
const dispatch = vi.fn();
const listBreakpoints = vi.fn();

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => os.tmpdir()),
    getVersion: vi.fn(() => "0.58.0-test")
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showOpenDialog: vi.fn()
  }
}));

vi.mock("@main/main-store", () => ({
  mainStore: {
    dispatch,
    getState
  }
}));

vi.mock("@messaging/MainToEmuMessenger", () => ({
  getEmuApi: () => ({
    eraseAllBreakpoints: vi.fn(),
    listBreakpoints
  })
}));

vi.mock("@messaging/MainToIdeMessenger", () => ({
  getIdeApi: () => ({
    saveAllBeforeQuit: vi.fn()
  })
}));

vi.mock("@main/settings-utils", () => ({
  appSettings: {},
  getSettingDefinition: vi.fn(() => null),
  saveAppSettings: vi.fn()
}));

vi.mock("@common/machines/machine-registry", () => ({
  getModelConfig: vi.fn((machineId: string, modelId?: string) => ({
    machineId,
    modelId
  }))
}));

vi.mock("@main/build", () => ({
  processBuildFile: vi.fn()
}));

vi.mock("@main/file-watcher", () => ({
  fileChangeWatcher: {
    startWatching: vi.fn(),
    stopWatching: vi.fn()
  }
}));

vi.mock("@main/registeredMachines", () => ({
  setMachineType: vi.fn()
}));

/**
 * The action type dispatched when the project file on disk has changed. Both renderers react to
 * it, and the document layer answers it with another save request - so it must be dispatched only
 * for saves that really wrote something.
 */
const PROJECT_FILE_VERSION_ACTION = "INC_PROJECT_FILE_VERSION";

describe("saveKliveProject", () => {
  let folderPath: string;
  let projectFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    folderPath = fs.mkdtempSync(path.join(os.tmpdir(), "klive-save-project-"));
    projectFile = path.join(folderPath, "klive.project");
    listBreakpoints.mockResolvedValue({ breakpoints: [] });
    getState.mockReturnValue({
      emulatorState: { machineId: "sp48", modelId: "pal", clockMultiplier: 1 },
      globalSettings: {},
      project: { folderPath, buildRoots: [] },
      projectSettings: {},
      workspaceSettings: {}
    });
  });

  const projectFileVersionDispatches = () =>
    dispatch.mock.calls.filter(([action]) => action?.type === PROJECT_FILE_VERSION_ACTION).length;

  it("writes the project file and signs the change on the first save", async () => {
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();

    expect(fs.existsSync(projectFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(projectFile, "utf8")).machineType).toBe("sp48");
    expect(projectFileVersionDispatches()).toBe(1);
  });

  it("does not rewrite the file or sign a change when nothing changed", async () => {
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();
    const contentsAfterFirstSave = fs.readFileSync(projectFile, "utf8");
    dispatch.mockClear();

    const writeSpy = vi.spyOn(fs, "writeFileSync");
    await saveKliveProject();
    await saveKliveProject();
    writeSpy.mockRestore();

    // --- An unconditional save here would re-write identical contents, wake the folder watcher,
    // --- and notify both renderers - which is what kept the save loop cycling once a second.
    expect(writeSpy).not.toHaveBeenCalled();
    expect(projectFileVersionDispatches()).toBe(0);
    expect(fs.readFileSync(projectFile, "utf8")).toBe(contentsAfterFirstSave);
  });

  it("writes and signs the change again once the state really changes", async () => {
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();
    await saveKliveProject();
    dispatch.mockClear();

    getState.mockReturnValue({
      emulatorState: { machineId: "sp128", modelId: "pal", clockMultiplier: 2 },
      globalSettings: {},
      project: { folderPath, buildRoots: ["code/code.kz80.asm"] },
      projectSettings: {},
      workspaceSettings: {}
    });
    await saveKliveProject();

    const contents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    expect(contents.machineType).toBe("sp128");
    expect(contents.builder.roots).toEqual(["code/code.kz80.asm"]);
    expect(projectFileVersionDispatches()).toBe(1);
  });

  it("rewrites the file when it was modified outside the app", async () => {
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();
    const contentsAfterFirstSave = fs.readFileSync(projectFile, "utf8");
    fs.writeFileSync(projectFile, "{ \"hand\": \"edited\" }");
    dispatch.mockClear();

    await saveKliveProject();

    expect(fs.readFileSync(projectFile, "utf8")).toBe(contentsAfterFirstSave);
    expect(projectFileVersionDispatches()).toBe(1);
  });

  it("writes the file when it does not exist yet", async () => {
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();
    fs.rmSync(projectFile);
    dispatch.mockClear();

    await saveKliveProject();

    expect(fs.existsSync(projectFile)).toBe(true);
    expect(projectFileVersionDispatches()).toBe(1);
  });
});
