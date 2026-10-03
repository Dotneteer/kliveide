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

  /*
   * The project file may only hold the breakpoints the project owns. `listBreakpoints` returns the
   * emulator's whole set, which is a union of sets owned by different persisters: a `.nex.dis`
   * sidecar's bank breakpoints and a debug session's one-shots are in there too. Writing those here
   * would store them in two places that then diverge.
   */
  it("saves only project-owned breakpoints", async () => {
    listBreakpoints.mockResolvedValue({
      breakpoints: [
        // --- No owner: the project's own, and the only representation of project ownership
        { address: 0x8000, exec: true },
        { address: 0x8001, exec: true, owner: { kind: "nex", sidecar: "/p/Game.nex.dis" } },
        { address: 0x8002, exec: true, owner: { kind: "session" } }
      ]
    });
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();

    const contents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    expect(contents.debugger.breakpoints).toEqual([{ address: 0x8000, exec: true }]);
  });

  it("saves a breakpoint written by a build that predates ownership", async () => {
    // --- Backward compatibility: an absent `owner` must be read as project ownership, not as
    // --- "unknown" and dropped.
    listBreakpoints.mockResolvedValue({
      breakpoints: [{ address: 0x9000, partition: 3, exec: true }]
    });
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();

    const contents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    expect(contents.debugger.breakpoints).toEqual([
      { address: 0x9000, partition: 3, exec: true }
    ]);
  });

  it("saves a breakpoint's condition and hit rule, but not its runtime state", async () => {
    // --- `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.1: the live counter restarts with the machine,
    // --- and storing it would also make every save after a run rewrite the file for nothing.
    listBreakpoints.mockResolvedValue({
      breakpoints: [
        {
          resource: "main.asm",
          line: 42,
          exec: true,
          condition: "A == $FF && !ZF",
          hitMode: "every",
          hitCount: 4,
          currentHits: 9,
          conditionError: "stale",
          conditionInactive: "unknown label score"
        }
      ]
    });
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();

    const contents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    expect(contents.debugger.breakpoints).toEqual([
      {
        resource: "main.asm",
        line: 42,
        exec: true,
        condition: "A == $FF && !ZF",
        hitMode: "every",
        hitCount: 4
      }
    ]);
  });

  it("does not rewrite the file when only a hit counter moved", async () => {
    const bp = { address: 0x8000, exec: true, hitCount: 3 };
    listBreakpoints.mockResolvedValue({ breakpoints: [{ ...bp, currentHits: 1 }] });
    const { saveKliveProject } = await import("@main/projects");
    await saveKliveProject();
    dispatch.mockClear();

    listBreakpoints.mockResolvedValue({ breakpoints: [{ ...bp, currentHits: 2 }] });
    const writeSpy = vi.spyOn(fs, "writeFileSync");
    await saveKliveProject();
    writeSpy.mockRestore();

    expect(writeSpy).not.toHaveBeenCalled();
    expect(projectFileVersionDispatches()).toBe(0);
  });

  it("stamps the breakpoint schema it wrote", async () => {
    /*
     * A forward-looking marker. The one semantic change so far — a positive ZX Next partition being
     * an 8K page — is not migratable, so this exists for the *next* one, and so a project written by
     * a newer Klive announces itself instead of loading breakpoints that quietly mean something
     * else. See `.plans/NEX_DEBUGGING_PLAN.md` §18, item 0.
     */
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();

    const contents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    expect(contents.debugger.schemaVersion).toEqual(1);
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

  // --- `.plans/LOGPOINTS_PLAN.md` Phase 1 (§4.6)
  it("saves a logpoint's template and dialect, but neither its error nor the build's LOGPOINT comments", async () => {
    listBreakpoints.mockResolvedValue({
      breakpoints: [
        { address: 0x8000, exec: true, logMessage: "[G] A={A}", logError: "stale", currentHits: 3 },
        {
          address: 0x8001,
          exec: true,
          owner: { kind: "annotation" },
          resource: "main.asm",
          line: 4,
          logMessage: "${A}",
          logDialect: "dezog"
        }
      ]
    });
    const { saveKliveProject } = await import("@main/projects");

    await saveKliveProject();

    const contents = JSON.parse(fs.readFileSync(projectFile, "utf8"));
    expect(contents.debugger.breakpoints).toEqual([
      { address: 0x8000, exec: true, logMessage: "[G] A={A}" }
    ]);
  });

  it("stores the logpoint group switch only when it is not 'everything on'", async () => {
    const { saveKliveProject } = await import("@main/projects");
    const state = (logpointGroups: unknown) => ({
      emulatorState: { machineId: "sp48", modelId: "pal", clockMultiplier: 1 },
      globalSettings: {},
      project: { folderPath, buildRoots: [] },
      projectSettings: {},
      workspaceSettings: {},
      logpointGroups
    });

    getState.mockReturnValue(state({ enabled: true }));
    await saveKliveProject();
    expect(JSON.parse(fs.readFileSync(projectFile, "utf8")).debugger.logpointGroups).toBeUndefined();

    getState.mockReturnValue(state({ enabled: true, groups: ["LOOP"] }));
    await saveKliveProject();
    expect(JSON.parse(fs.readFileSync(projectFile, "utf8")).debugger.logpointGroups).toEqual({
      enabled: true,
      groups: ["LOOP"]
    });
  });

  it("stores the ASSERTION / WPMEM switches only when one is off (S6)", async () => {
    const { saveKliveProject, readSourceComments } = await import("@main/projects");
    const state = (sourceComments: unknown) => ({
      emulatorState: { machineId: "sp48", modelId: "pal", clockMultiplier: 1 },
      globalSettings: {},
      project: { folderPath, buildRoots: [] },
      projectSettings: {},
      workspaceSettings: {},
      sourceComments
    });
    getState.mockReturnValue(state({}));
    await saveKliveProject();
    expect(JSON.parse(fs.readFileSync(projectFile, "utf8")).debugger.sourceComments).toBeUndefined();
    getState.mockReturnValue(state({ wpmem: false }));
    await saveKliveProject();
    expect(JSON.parse(fs.readFileSync(projectFile, "utf8")).debugger.sourceComments).toEqual({ wpmem: false });
    expect(readSourceComments({ assertion: false, wpmem: "no" })).toEqual({ assertion: false });
    expect(readSourceComments(undefined)).toBeUndefined();
  });

  it("reads a stored group switch, treating a malformed one as 'everything on'", async () => {
    const { readLogpointGroups } = await import("@main/projects");
    expect(readLogpointGroups(undefined)).toBeUndefined();
    expect(readLogpointGroups({ enabled: false })).toEqual({ enabled: false });
    expect(readLogpointGroups({ enabled: true, groups: ["A"] })).toEqual({ enabled: true, groups: ["A"] });
    expect(readLogpointGroups({ enabled: "yes" })).toBeUndefined();
    expect(readLogpointGroups({ enabled: true, groups: [1] })).toEqual({ enabled: true });
  });
});
