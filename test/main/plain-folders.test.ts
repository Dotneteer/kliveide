import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appSettings: Record<string, any> = {};
const saveAppSettings = vi.fn();

vi.mock("@main/settings-utils", () => ({ appSettings, saveAppSettings }));

/** The folders kept plain (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.2, Q3) */
describe("plain folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete appSettings.plainFolders;
  });

  it("remembers a folder once, in Klive's settings", async () => {
    const { isRememberedPlainFolder, rememberPlainFolder } = await import("@main/plain-folders");
    const folder = path.resolve("/work/game");

    expect(isRememberedPlainFolder(folder)).toBe(false);
    rememberPlainFolder(folder);
    rememberPlainFolder(folder + "/");

    expect(isRememberedPlainFolder(folder)).toBe(true);
    expect(appSettings.plainFolders).toHaveLength(1);
    expect(saveAppSettings).toHaveBeenCalledTimes(1);
  });

  it("treats spellings of the same folder alike", async () => {
    const { isRememberedPlainFolder, rememberPlainFolder } = await import("@main/plain-folders");
    rememberPlainFolder(path.resolve("/work/game"));

    expect(isRememberedPlainFolder(path.resolve("/work/sub/../game"))).toBe(true);
    expect(isRememberedPlainFolder(path.resolve("/work/game2"))).toBe(false);
  });

  it("forgets a folder once it became a project", async () => {
    const { forgetPlainFolder, isRememberedPlainFolder, rememberPlainFolder } = await import(
      "@main/plain-folders"
    );
    rememberPlainFolder(path.resolve("/work/game"));
    rememberPlainFolder(path.resolve("/work/other"));

    forgetPlainFolder(path.resolve("/work/game"));

    expect(isRememberedPlainFolder(path.resolve("/work/game"))).toBe(false);
    expect(isRememberedPlainFolder(path.resolve("/work/other"))).toBe(true);
  });

  it("ignores an empty folder name", async () => {
    const { rememberPlainFolder } = await import("@main/plain-folders");
    rememberPlainFolder("");
    expect(appSettings.plainFolders).toBeUndefined();
  });
});
