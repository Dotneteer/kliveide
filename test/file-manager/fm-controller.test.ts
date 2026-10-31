import { describe, expect, it } from "vitest";

import { GAME_DSK, HOME, PROJECT, ROOT, openFileManager } from "./fakes";

/*
 * The File Manager browsing (.plans/FILE_MANAGER_PLAN.md, Phase 2), driven through its controller
 * against a fake main process: what a user does, and what the panes then show.
 */

const names = (h: Awaited<ReturnType<typeof openFileManager>>, side: 0 | 1) => h.vm.panes[side].rows.map((r) => r.cells[0]);

describe("opening", () => {
  it("shows the project on the left and the home folder on the right", async () => {
    const h = await openFileManager();
    expect(h.vm.panes[0].drive).toMatchObject({ label: "Project: game", icon: "project" });
    expect(h.vm.panes[1].drive).toMatchObject({ label: "Home", icon: "home" });
    expect(h.vm.panes[0].active).toBe(true);
    expect(h.vm.panes[1].active).toBe(false);
    // --- Folders first, then files by name; no ".." at a drive's top
    expect(names(h, 0)).toEqual(["tapes", "a.bas", "b.tap", "game.dsk"]);
    // --- Hidden files stay hidden
    expect(names(h, 1)).toEqual(["game", "notes.txt"]);
  });

  it("without a project, both panes start at home", async () => {
    const h = await openFileManager({ listDrives: [ROOT, HOME] });
    expect(h.vm.panes[0].drive?.label).toBe("Home");
    expect(h.vm.panes[1].drive?.label).toBe("Home");
  });

  it("comes back where it was saved, and falls back when that is gone", async () => {
    const h = await openFileManager({}, [
      { driveId: PROJECT.id, dir: "/home/me/game/tapes" },
      { driveId: "host:/Volumes/GONE" }
    ]);
    expect(h.state.panes[0].dir).toBe("/home/me/game/tapes");
    expect(names(h, 0)).toEqual(["..", "music.tzx"]);
    expect(h.state.panes[1].drive?.id).toBe(HOME.id);
  });

  it("restores an image drive it never opened this session", async () => {
    const h = await openFileManager({}, [{ driveId: GAME_DSK.id }, undefined]);
    expect(h.vm.panes[0].drive?.label).toBe("game.dsk");
    expect(h.state.openedImages.map((d) => d.id)).toEqual([GAME_DSK.id]);
  });
});

describe("moving around", () => {
  it("enters a folder and goes back up to the folder it came from", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "rowActivated", side: 0, index: 0 });
    expect(h.state.panes[0].dir).toBe("/home/me/game/tapes");
    expect(h.vm.panes[0].crumbs.map((c) => c.label)).toEqual(["/home/me/game", "tapes"]);
    expect(h.vm.panes[0].rows[0]).toMatchObject({ isUp: true, cells: ["..", "<UP>", ""] });

    await h.dispatch({ type: "upRequested", side: 0 });
    expect(h.state.panes[0].dir).toBe("/home/me/game");
    // --- The cursor lands on the folder just left
    expect(h.vm.panes[0].rows[h.vm.panes[0].cursor].cells[0]).toBe("tapes");
  });

  it("goes up from the '..' row too", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "rowActivated", side: 0, index: 0 });
    await h.dispatch({ type: "rowActivated", side: 0, index: 0 });
    expect(h.state.panes[0].dir).toBe("/home/me/game");
  });

  it("enters a disk image like a folder, and leaves it back to the file", async () => {
    const h = await openFileManager();
    const at = names(h, 0).indexOf("game.dsk");
    await h.dispatch({ type: "rowActivated", side: 0, index: at });
    const pane = h.vm.panes[0];
    expect(pane.drive?.label).toBe("game.dsk");
    expect(pane.crumbs.map((c) => [c.label, c.target.kind])).toEqual([["Project: game", "leave"], ["game.dsk", "dir"]]);
    expect(pane.columns.map((c) => c.label)).toEqual(["Name", "Type", "Size", "Start", "Attr.", "User"]);
    expect(pane.rows.map((r) => r.cells)).toEqual([
      ["..", "", "<UP>", "", "", ""],
      ["DISK", "BASIC", "214", "10", "---", "0"],
      ["GAME.BIN", "Code", "11,900", "24000", "R-A", "0"]
    ]);
    expect(pane.statusRight).toBe("+3DOS · 120,000 bytes free");

    await h.dispatch({ type: "upRequested", side: 0 });
    expect(h.state.panes[0].drive?.id).toBe(PROJECT.id);
    expect(h.state.panes[0].returnTo).toEqual([]);
    expect(h.vm.panes[0].rows[h.vm.panes[0].cursor].cells[0]).toBe("game.dsk");
  });

  it("leaves an image from the path's first step", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    await h.dispatch({ type: "crumbChosen", side: 0, target: h.vm.panes[0].crumbs[0].target });
    expect(h.state.panes[0].drive?.id).toBe(PROJECT.id);
  });

  it("does nothing on Enter over a plain file", async () => {
    const h = await openFileManager();
    const before = h.state;
    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("b.tap") });
    expect(h.state.panes[0].dir).toBe(before.panes[0].dir);
    expect(h.ports.fm.openImage).not.toHaveBeenCalled();
  });

  it("shows why a folder cannot be read, and recovers on another drive", async () => {
    const h = await openFileManager();
    h.ports.fm.list.mockImplementationOnce(async () => {
      throw new Error("FmError: [fm:accessDenied] nope");
    });
    await h.dispatch({ type: "refreshRequested", side: 1 });
    expect(h.vm.panes[1].error).toBe("/home/me cannot be read: access is denied.");
    await h.dispatch({ type: "driveChosen", side: 1, driveId: PROJECT.id });
    expect(h.vm.panes[1].error).toBeUndefined();
  });

  it("keeps the latest folder when two loads overlap", async () => {
    const h = await openFileManager();
    let release: () => void = () => {};
    h.ports.fm.list.mockImplementationOnce(
      (driveId, dir) => new Promise((resolve) => { release = () => resolve(fakeSlow(driveId, dir)); })
    );
    const slow = h.send({ type: "rowActivated", side: 0, index: 0 });
    const fast = h.send({ type: "driveChosen", side: 0, driveId: HOME.id });
    await fast;
    release();
    await slow;
    await h.settle();
    expect(h.state.panes[0].drive?.id).toBe(HOME.id);
  });
});

function fakeSlow (driveId: string, dir?: string) {
  // --- The listing that would have arrived late: the project's tapes folder
  return { drive: PROJECT, dir: dir ?? "", parentDir: "/home/me/game", crumbs: [{ label: "", dir: "/" }], columns: "host" as const, entries: [] };
}

describe("cursor, marks and order", () => {
  it("moves the cursor within the rows and switches panes", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "cursorMoved", side: 0, to: 99 });
    expect(h.vm.panes[0].cursor).toBe(3);
    await h.dispatch({ type: "cursorMoved", side: 0, to: -5 });
    expect(h.vm.panes[0].cursor).toBe(0);
    await h.dispatch({ type: "paneSwitched" });
    expect(h.vm.panes[1].active).toBe(true);
  });

  it("marks files, counts them, and keeps the marks over a refresh", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "cursorMoved", side: 0, to: 1 });
    await h.dispatch({ type: "markToggled", side: 0, advance: true });
    await h.dispatch({ type: "markToggled", side: 0, advance: true });
    expect(h.vm.panes[0].cursor).toBe(3);
    expect(h.vm.panes[0].rows.filter((r) => r.marked).map((r) => r.cells[0])).toEqual(["a.bas", "b.tap"]);
    expect(h.vm.panes[0].statusLeft).toBe("2 of 4 marked, 13,614 bytes");
    await h.dispatch({ type: "refreshRequested", side: 0 });
    expect(h.state.panes[0].marked).toHaveLength(2);
    await h.dispatch({ type: "marksCleared", side: 0 });
    expect(h.vm.panes[0].statusLeft).toBe("4 items");
  });

  it("marks every file, never a folder", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "allMarked", side: 0 });
    expect(h.vm.panes[0].rows.filter((r) => r.marked).map((r) => r.cells[0])).toEqual(["a.bas", "b.tap", "game.dsk"]);
  });

  it("sorts by a column, again reverses it, and the cursor stays on its file", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "cursorMoved", side: 0, to: 1 });
    await h.dispatch({ type: "sortChosen", side: 0, key: "size" });
    expect(names(h, 0)).toEqual(["tapes", "a.bas", "b.tap", "game.dsk"]);
    await h.dispatch({ type: "sortChosen", side: 0, key: "size" });
    expect(names(h, 0)).toEqual(["tapes", "game.dsk", "b.tap", "a.bas"]);
    expect(h.vm.panes[0].columns.find((c) => c.key === "size")?.sorted).toBe("descending");
    expect(h.vm.panes[0].rows[h.vm.panes[0].cursor].cells[0]).toBe("a.bas");
  });

  it("shows hidden files on request", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "hiddenToggled", side: 1 });
    expect(names(h, 1)).toEqual(["game", ".profile", "notes.txt"]);
  });
});

describe("the drive menu", () => {
  it("lists this computer's drives and the project, with the pane's drive selected", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "driveMenuToggled", side: 1 });
    const menu = h.vm.menu!;
    expect(menu.side).toBe(1);
    expect(menu.groups.map((g) => [g.title, g.items.map((i) => i.label)])).toEqual([
      ["This computer", ["Macintosh HD", "Home"]],
      ["Project", ["Project: game"]]
    ]);
    expect(menu.groups[0].items.find((i) => i.selected)?.label).toBe("Home");
    expect(menu.groups[0].items[0].free).toBe("2 GB");
    expect(h.vm.panes[1].active).toBe(true);

    await h.dispatch({ type: "driveChosen", side: 1, driveId: ROOT.id });
    expect(h.vm.menu).toBeUndefined();
    expect(h.state.panes[1].drive?.id).toBe(ROOT.id);
  });

  it("opens an image as a drive and lists it among the disk images", async () => {
    const h = await openFileManager({ pickFile: GAME_DSK.root });
    await h.dispatch({ type: "driveMenuToggled", side: 0 });
    await h.dispatch({ type: "openImageRequested", side: 0 });
    expect(h.state.panes[0].drive?.id).toBe(GAME_DSK.id);
    // --- Chosen from the menu, not entered: no way "up" out of it
    expect(h.vm.panes[0].rows[0].isUp).toBe(false);
    await h.dispatch({ type: "driveMenuToggled", side: 0 });
    expect(h.vm.menu!.groups.map((g) => g.title)).toContain("Disk images");
  });

  it("saves the panes' places as they change, an entered image as the folder holding it", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    expect(h.saved.at(-1)).toEqual([
      { driveId: PROJECT.id, dir: "/home/me/game" },
      { driveId: HOME.id, dir: "/home/me" }
    ]);
  });
});

describe("sizes", () => {
  it("are bytes below 1 MB, then MB, GB and TB", async () => {
    const { formatSize, formatSizeWithUnit } = await import("@renderer/appIde/DocumentPanels/FileManager/FileManagerViewModel");
    expect([0, 1023, 1_048_575].map(formatSize)).toEqual(["0", "1,023", "1,048,575"]);
    expect(formatSize(1.5 * 1024 ** 2)).toBe("1.5 MB");
    expect(formatSize(3443.2 * 1024 ** 3)).toBe("3.4 TB");
    expect([1, 2, 120_000].map(formatSizeWithUnit)).toEqual(["1 byte", "2 bytes", "120,000 bytes"]);
  });
});
