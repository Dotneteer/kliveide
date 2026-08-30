import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getState = vi.fn();
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
    dispatch: vi.fn(),
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

describe("createKliveProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getState.mockReturnValue({
      emulatorState: {},
      globalSettings: {},
      project: undefined,
      projectSettings: {},
      workspaceSettings: {}
    });
    process.env.PUBLIC = path.join(process.cwd(), "src/public");
  });

  it("writes the project file without waiting for emulator breakpoints", async () => {
    const { createKliveProject } = await import("@main/projects");
    const parentFolder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-create-project-"));

    listBreakpoints.mockReturnValue(new Promise(() => {}));

    const result = await createKliveProject(
      "spp3e",
      "nofdd",
      "default",
      "Plus2EProject",
      parentFolder
    );

    const projectFile = path.join(parentFolder, "Plus2EProject", "klive.project");
    const projectContents = JSON.parse(fs.readFileSync(projectFile, "utf8"));

    expect(result.errorMessage).toBeUndefined();
    expect(result.path).toBe(path.join(parentFolder, "Plus2EProject"));
    expect(listBreakpoints).not.toHaveBeenCalled();
    expect(projectContents.machineType).toBe("spp3e");
    expect(projectContents.modelId).toBe("nofdd");
    expect(projectContents.builder.roots).toEqual(["code/code.kz80.asm"]);
  });

  it("creates a ZX Spectrum +3E default project without current app state or emulator breakpoints", async () => {
    const { createKliveProject } = await import("@main/projects");
    const parentFolder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-create-project-"));

    getState.mockReturnValue(undefined);
    listBreakpoints.mockReturnValue(new Promise(() => {}));

    const result = await createKliveProject(
      "spp3e",
      "fdd2",
      undefined as any,
      "Plus3EDefaultProject",
      parentFolder
    );

    const projectFolder = path.join(parentFolder, "Plus3EDefaultProject");
    const projectFile = path.join(projectFolder, "klive.project");
    const projectContents = JSON.parse(fs.readFileSync(projectFile, "utf8"));

    expect(result.errorMessage).toBeUndefined();
    expect(result.path).toBe(projectFolder);
    expect(listBreakpoints).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(projectFolder, "build.ksx"))).toBe(true);
    expect(fs.existsSync(path.join(projectFolder, "code", "code.kz80.asm"))).toBe(true);
    expect(projectContents.machineType).toBe("spp3e");
    expect(projectContents.modelId).toBe("fdd2");
    expect(projectContents.builder.roots).toEqual(["code/code.kz80.asm"]);
  });

  it("creates a ZX Spectrum +2E sjasmplus project from the template", async () => {
    const { createKliveProject } = await import("@main/projects");
    const parentFolder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-create-project-"));

    const result = await createKliveProject(
      "spp3e",
      "nofdd",
      "sjasmplus",
      "Plus2ESjasmProject",
      parentFolder
    );

    const projectFolder = path.join(parentFolder, "Plus2ESjasmProject");
    const projectFile = path.join(projectFolder, "klive.project");
    const sourceFile = path.join(projectFolder, "code", "code.asm");
    const projectContents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    const sourceContents = fs.readFileSync(sourceFile, "utf8");

    expect(result.errorMessage).toBeUndefined();
    expect(fs.existsSync(path.join(projectFolder, "build.ksx"))).toBe(true);
    expect(fs.existsSync(sourceFile)).toBe(true);
    expect(sourceContents).toContain("device zxspectrum128");
    expect(sourceContents).not.toContain("zxspectrum+3e");
    expect(projectContents.machineType).toBe("spp3e");
    expect(projectContents.modelId).toBe("nofdd");
    expect(projectContents.builder.roots).toEqual(["code/code.asm"]);
    expect(projectContents.settings.languages.sjasmp).toBe(".asm|.sjasm");
  });
});
