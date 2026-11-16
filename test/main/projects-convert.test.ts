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
  })),
  newProjectModelIds: { zxnext: "ks2-30204" }
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
 * Making the open plain folder a Klive project (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.4).
 * Uses the real sp48 `zx-basic` template: `build.ksx`, `code/program.zxbas`, and a merge file
 * whose build root is `code/program.zxbas`.
 */
describe("convertFolderToProject", () => {
  let folder: string;

  const stateFor = (folderPath: string | undefined, isKliveProject = false) => ({
    emulatorState: {},
    globalSettings: {},
    project: folderPath ? { folderPath, isKliveProject, buildRoots: [] } : undefined,
    projectSettings: {},
    workspaceSettings: {}
  });
  const write = (relPath: string, contents: string) => {
    const file = path.join(folder, ...relPath.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  const read = (relPath: string) => fs.readFileSync(path.join(folder, ...relPath.split("/")), "utf8");
  const projectFile = () => JSON.parse(read("klive.project"));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLIC = path.join(process.cwd(), "src/public");
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-convert-project-"));
    write("main.bas", "10 PRINT \"mine\"");
    getState.mockReturnValue(stateFor(folder));
  });

  // --- Decision Q7: the template's build.ksx is what Compile, Run and Debug run
  it("refuses a conversion without a template and writes nothing", async () => {
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({
      folder,
      machineId: "sp48",
      templateId: undefined as unknown as string,
      buildRoot: "main.bas"
    });

    expect(result.errorMessage).toContain("Choose a template");
    expect(fs.readdirSync(folder)).toEqual(["main.bas"]);
  });

  it("writes the template's build.ksx, the machine, the model and the build root", async () => {
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({
      folder,
      machineId: "ht1080z",
      modelId: "ht1080z-s1",
      templateId: "default",
      buildRoot: "main.bas"
    });

    expect(result).toEqual({ written: ["build.ksx", "code/code.kz80.asm"], skipped: [] });
    expect(fs.readdirSync(folder).sort()).toEqual(["build.ksx", "code", "klive.project", "main.bas"]);
    expect(projectFile().machineType).toBe("ht1080z");
    expect(projectFile().modelId).toBe("ht1080z-s1");
    expect(projectFile().builder.roots).toEqual(["main.bas"]);
    expect(listBreakpoints).not.toHaveBeenCalled();
  });

  it("uses the machine's new-project model when none is given", async () => {
    const { convertFolderToProject } = await import("@main/projects");

    await convertFolderToProject({ folder, machineId: "zxnext", templateId: "default" });

    expect(projectFile().modelId).toBe("ks2-30204");
  });

  it("copies the template and keeps its build root when none is chosen", async () => {
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder, machineId: "sp48", templateId: "zx-basic" });

    expect(result.errorMessage).toBeUndefined();
    expect(result.written).toEqual(["build.ksx", "code/program.zxbas"]);
    expect(read("main.bas")).toBe("10 PRINT \"mine\"");
    expect(fs.existsSync(path.join(folder, "__$klive.project"))).toBe(false);
    expect(projectFile().builder.roots).toEqual(["code/program.zxbas"]);
  });

  it("keeps the user's files unless they are ticked, and the chosen build root wins", async () => {
    write("build.ksx", "my build");
    write("code/program.zxbas", "my program");
    const { convertFolderToProject, getProjectConversionConflicts } = await import("@main/projects");

    expect(getProjectConversionConflicts(folder, "sp48", "zx-basic")).toEqual([
      { path: "build.ksx", canOverwrite: true },
      { path: "code/program.zxbas", canOverwrite: true }
    ]);

    const result = await convertFolderToProject({
      folder,
      machineId: "sp48",
      templateId: "zx-basic",
      overwrite: ["build.ksx"],
      buildRoot: "main.bas"
    });

    expect(result).toEqual({ written: ["build.ksx"], skipped: ["code/program.zxbas"] });
    expect(read("build.ksx")).not.toBe("my build");
    expect(read("code/program.zxbas")).toBe("my program");
    expect(projectFile().builder.roots).toEqual(["main.bas"]);
  });

  it("accepts a build root the template writes", async () => {
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({
      folder,
      machineId: "sp48",
      templateId: "zx-basic",
      buildRoot: "code/program.zxbas"
    });

    expect(result.errorMessage).toBeUndefined();
    expect(projectFile().builder.roots).toEqual(["code/program.zxbas"]);
  });

  it.each([
    ["a missing file", "missing.bas"],
    ["a folder", "code"],
    ["a path outside the folder", "../outside.bas"],
    ["an absolute path", "/etc/hosts"],
    ["an empty path", ""]
  ])("refuses %s as build root and writes nothing", async (_, buildRoot) => {
    fs.mkdirSync(path.join(folder, "code"), { recursive: true });
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder, machineId: "sp48", templateId: "zx-basic", buildRoot });

    expect(result.errorMessage).toContain("build root");
    expect(fs.readdirSync(folder).sort()).toEqual(["code", "main.bas"]);
  });

  it("refuses a folder that is not the open one", async () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "klive-convert-other-"));
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder: other, machineId: "sp48", templateId: "default" });

    expect(result.errorMessage).toContain("open folder");
    expect(fs.readdirSync(other)).toEqual([]);
  });

  it("refuses when no folder is open", async () => {
    getState.mockReturnValue(stateFor(undefined));
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder, machineId: "sp48", templateId: "default" });

    expect(result.errorMessage).toBeDefined();
    expect(fs.existsSync(path.join(folder, "klive.project"))).toBe(false);
  });

  it("refuses a folder that is already a project", async () => {
    getState.mockReturnValue(stateFor(folder, true));
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder, machineId: "sp48", templateId: "default" });

    expect(result.errorMessage).toContain("already a Klive project");
    expect(fs.existsSync(path.join(folder, "klive.project"))).toBe(false);
  });

  it("refuses a template that does not exist", async () => {
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder, machineId: "sp48", templateId: "nope" });

    expect(result.errorMessage).toContain("nope");
    expect(fs.existsSync(path.join(folder, "klive.project"))).toBe(false);
  });

  it.each([
    ["sp48", "../zxnext"],
    ["..", "default"],
    ["sp48/../zxnext", "default"]
  ])("refuses template names that leave the templates folder (%s, %s)", async (machineId, templateId) => {
    const { convertFolderToProject, getProjectConversionConflicts } = await import("@main/projects");

    expect(() => getProjectConversionConflicts(folder, machineId, templateId)).toThrow("Invalid template name");
    const result = await convertFolderToProject({ folder, machineId, templateId });
    expect(result.errorMessage).toContain("Invalid template name");
    expect(fs.existsSync(path.join(folder, "klive.project"))).toBe(false);
  });

  it("forgets that the user kept the folder plain", async () => {
    const { rememberPlainFolder, isRememberedPlainFolder } = await import("@main/plain-folders");
    rememberPlainFolder(folder);
    const { convertFolderToProject } = await import("@main/projects");

    await convertFolderToProject({ folder, machineId: "sp48", templateId: "default" });

    expect(isRememberedPlainFolder(folder)).toBe(false);
  });

  it("replaces an invalid project file left in the folder", async () => {
    write("klive.project", "{ \"kliveVersion\": \"0.1.0\" }");
    const { convertFolderToProject } = await import("@main/projects");

    const result = await convertFolderToProject({ folder, machineId: "sp48", templateId: "default" });

    expect(result.errorMessage).toBeUndefined();
    expect(projectFile().machineType).toBe("sp48");
  });
});
