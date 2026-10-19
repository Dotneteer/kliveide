import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Where "Export as source" saves: the `export.sourceFolder` user/project setting, else a suggested
 * default (`<project>/SourceExports`, or `<home>/KliveExports/source` without a project); the folder
 * the user picks is written back to the project's settings, or to the user's without a project.
 */

const env = vi.hoisted(() => ({
  state: {} as any,
  showSaveDialog: vi.fn(),
  applyUserSetting: vi.fn(),
  dispatch: vi.fn(),
  saveKliveProject: vi.fn(async () => undefined),
  mkdirSync: vi.fn()
}));

vi.mock("electron", () => ({ app: { getPath: () => "/home/me" }, dialog: { showSaveDialog: env.showSaveDialog } }));
vi.mock("fs", async (original) => {
  const fs = (await original()) as any;
  return { ...fs, default: { ...fs, mkdirSync: env.mkdirSync }, mkdirSync: env.mkdirSync };
});
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => env.state, dispatch: env.dispatch } }));
vi.mock("@main/settings-utils", () => ({ applyUserSetting: env.applyUserSetting }));
vi.mock("@main/portable", () => ({ getKliveHomeBase: () => "/home/me" }));
vi.mock("@main/projects", () => ({ saveKliveProject: env.saveKliveProject }));

import {
  showSourceExportSaveDialog,
  sourceExportFolder,
  sourceExportFolderToRemember
} from "@main/source-export-folder";

const project = (folderPath = "/work/game") => ({ project: { folderPath, isKliveProject: true } });
const options = { title: "Export as source", defaultName: "game-bank3.kz80.asm", filters: [] };
const homeBase = "/home/me";

beforeEach(() => {
  vi.clearAllMocks();
  env.state = {};
});

describe("the source export folder", () => {
  it("suggests a default: the project's SourceExports, or KliveExports/source", () => {
    expect(sourceExportFolder({ state: project(), homeBase })).toBe(path.join("/work/game", "SourceExports"));
    expect(sourceExportFolder({ state: {} as any, homeBase })).toBe(path.join("/home/me", "KliveExports", "source"));
    // --- A folder that is open but is not a Klive project has no project settings to keep it in
    expect(sourceExportFolder({ state: { project: { folderPath: "/x", isKliveProject: false } } as any, homeBase })).toBe(
      path.join("/home/me", "KliveExports", "source")
    );
  });

  it("reads the project's setting in a project and the user's outside one, a relative one against the project", () => {
    const state = {
      ...project(),
      userSettings: { export: { sourceFolder: "/mine/asm" } },
      projectSettings: { export: { sourceFolder: "src/exported" } }
    } as any;
    expect(sourceExportFolder({ state, homeBase })).toBe(path.join("/work/game", "src/exported"));
    expect(sourceExportFolder({ state: { userSettings: state.userSettings } as any, homeBase })).toBe("/mine/asm");
    // --- The user's folder was picked outside a project: a project without its own keeps SourceExports
    expect(sourceExportFolder({ state: { ...project(), userSettings: state.userSettings } as any, homeBase })).toBe(
      path.join("/work/game", "SourceExports")
    );
  });

  it("remembers a folder in the project relative to it, outside it as it is, and without a project for the user", () => {
    const env2 = { state: project() as any, homeBase };
    expect(sourceExportFolderToRemember("/work/game/src/out/a.asm", env2)).toEqual({ scope: "project", value: "src/out" });
    expect(sourceExportFolderToRemember("/elsewhere/a.asm", env2)).toEqual({ scope: "project", value: "/elsewhere" });
    expect(sourceExportFolderToRemember("/elsewhere/a.asm", { state: {} as any, homeBase })).toEqual({
      scope: "user",
      value: "/elsewhere"
    });
  });

  it("writes nothing back when the file went where the dialog suggested", () => {
    expect(sourceExportFolderToRemember("/work/game/SourceExports/a.asm", { state: project() as any, homeBase })).toBeUndefined();
  });
});

describe("the save dialog of an export", () => {
  it("opens in the folder, creating it, and keeps the choice in the project", async () => {
    env.state = project();
    env.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/work/game/asm/game-bank3.kz80.asm" });
    expect(await showSourceExportSaveDialog({} as any, options)).toBe("/work/game/asm/game-bank3.kz80.asm");
    expect(env.mkdirSync).toHaveBeenCalledWith(path.join("/work/game", "SourceExports"), { recursive: true });
    expect(env.showSaveDialog.mock.calls[0][1]).toMatchObject({
      defaultPath: path.join("/work/game", "SourceExports", "game-bank3.kz80.asm")
    });
    expect(env.dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ id: "export.sourceFolder", value: "asm" }) }));
    expect(env.saveKliveProject).toHaveBeenCalled();
    expect(env.applyUserSetting).not.toHaveBeenCalled();
  });

  it("keeps the choice in the user's settings without a project", async () => {
    env.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/mine/asm/x.kz80.asm" });
    await showSourceExportSaveDialog({} as any, options);
    expect(env.applyUserSetting).toHaveBeenCalledWith("export.sourceFolder", "/mine/asm");
    expect(env.dispatch).not.toHaveBeenCalled();
  });

  it("changes nothing when cancelled", async () => {
    env.showSaveDialog.mockResolvedValue({ canceled: true });
    expect(await showSourceExportSaveDialog({} as any, options)).toBeUndefined();
    expect(env.applyUserSetting).not.toHaveBeenCalled();
    expect(env.dispatch).not.toHaveBeenCalled();
  });
});
