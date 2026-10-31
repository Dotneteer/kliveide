import { describe, expect, it } from "vitest";

import { maskMatches } from "@renderer/appIde/DocumentPanels/FileManager/FileManagerModel";
import { looksLikeText, viewerKindOf } from "@renderer/appIde/DocumentPanels/FileManager/FileManagerViewModel";
import { intentForKey, type KeyContext } from "@renderer/appIde/DocumentPanels/FileManager/fileManagerKeys";
import { GAME_DSK, HOME, PROJECT, ROOT, file, openFileManager } from "./fakes";

/*
 * The File Manager's Phase 7 (.plans/FILE_MANAGER_PLAN.md): the viewer, Edit, marking by mask, tape
 * order, the right-click menu, drops and the settings.
 */

type H = Awaited<ReturnType<typeof openFileManager>>;
const names = (h: H, side: 0 | 1) => h.vm.panes[side].rows.map((r) => r.cells[0]);
const cursorOn = async (h: H, name: string, side: 0 | 1 = 0) => h.dispatch({ type: "cursorMoved", side, to: names(h, side).indexOf(name) });
const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);

describe("masks", () => {
  it("match with * and ?, several at once, whatever the case", () => {
    expect(maskMatches("*.tap", "GAME.TAP")).toBe(true);
    expect(maskMatches("*.tap", "game.tzx")).toBe(false);
    expect(maskMatches("*.tap;*.tzx", "game.tzx")).toBe(true);
    expect(maskMatches("g?me.*", "game.bin")).toBe(true);
    expect(maskMatches("*.*", "README")).toBe(true);
    expect(maskMatches("a+b.txt", "a+b.txt")).toBe(true);
  });

  it("+ marks the files a mask names, - unmarks them, folders never", async () => {
    const h = await openFileManager({ mask: "*.ta?" });
    await h.dispatch({ type: "maskRequested", mark: true });
    expect(h.ports.dialogs.askMask).toHaveBeenCalledWith({ mark: true });
    expect(h.vm.panes[0].rows.filter((r) => r.marked).map((r) => r.cells[0])).toEqual(["b.tap"]);
    h.ports.dialogs.askMask.mockResolvedValueOnce("*.*");
    await h.dispatch({ type: "maskRequested", mark: true });
    expect(h.state.panes[0].marked).toHaveLength(3);
    h.ports.dialogs.askMask.mockResolvedValueOnce("*.bas");
    await h.dispatch({ type: "maskRequested", mark: false });
    expect(h.vm.panes[0].rows.filter((r) => r.marked).map((r) => r.cells[0])).toEqual(["b.tap", "game.dsk"]);
  });
});

describe("the viewer (F3)", () => {
  it("knows a listing, a picture, text and bytes", () => {
    expect(viewerKindOf(file("LOADER", 14, { spectrum: { kind: "basic" } }), PRINT_42)).toBe("basic");
    expect(viewerKindOf(file("TITLE", 6912, { spectrum: { kind: "code", start: 16384 } }), new Uint8Array(6912))).toBe("screen");
    expect(viewerKindOf(file("title.scr", 6912), new Uint8Array(6912))).toBe("screen");
    expect(viewerKindOf(file("notes.txt", 5), new TextEncoder().encode("hello\n"))).toBe("text");
    expect(viewerKindOf(file("GAME.BIN", 3, { spectrum: { kind: "code", start: 24000 } }), new TextEncoder().encode("abc"))).toBe("hex");
    expect(looksLikeText(Uint8Array.from([65, 0, 66]))).toBe(false);
  });

  it("opens over the active pane, toggles to bytes, opens as memory, and closes", async () => {
    const h = await openFileManager({ fileData: PRINT_42 });
    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    await cursorOn(h, "DISK");
    await h.dispatch({ type: "viewRequested" });
    expect(h.ports.fm.read).toHaveBeenCalledWith(GAME_DSK.id, "DISK");
    expect(h.vm.panes[0].viewer).toMatchObject({ title: "DISK", kind: "basic", facts: "BASIC · 14 bytes · LINE 10", hasListing: true, listingLabel: "Listing" });
    await h.dispatch({ type: "viewerHexToggled" });
    expect(h.vm.panes[0].viewer?.kind).toBe("hex");
    await h.dispatch({ type: "viewerMemoryRequested" });
    expect(h.ports.shell.openMemory).toHaveBeenCalledWith("DISK", PRINT_42, 10);
    expect(intentForKey({ key: "Escape" }, { side: 0, cursor: 0, rowCount: 3, pageSize: 10, menuOpen: false, viewerOpen: true })).toEqual({ type: "viewerClosed" });
    await h.dispatch({ type: "viewerClosed" });
    expect(h.vm.panes[0].viewer).toBeUndefined();
  });

  it("F3 again closes it; a folder has nothing to view; a read that fails says why", async () => {
    const h = await openFileManager();
    await cursorOn(h, "tapes");
    await h.dispatch({ type: "viewRequested" });
    expect(h.vm.panes[0].viewer).toBeUndefined();
    await cursorOn(h, "b.tap");
    h.ports.fm.read.mockRejectedValueOnce(new Error("FmError: [fm:notFound] gone"));
    await h.dispatch({ type: "viewRequested" });
    expect(h.vm.panes[0].viewer?.error).toBe("b.tap does not exist.");
    await h.dispatch({ type: "viewRequested" });
    expect(h.vm.panes[0].viewer).toBeUndefined();
  });

  it("leaving the folder closes it", async () => {
    const h = await openFileManager();
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "viewRequested" });
    await h.dispatch({ type: "rowActivated", side: 0, index: 0 });
    expect(h.vm.panes[0].viewer).toBeUndefined();
  });
});

describe("Edit (F4) and Reveal", () => {
  it("opens a project file in its editor, and says when a file is not one", async () => {
    const h = await openFileManager({ editOk: false });
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "editRequested" });
    expect(h.ports.shell.edit).toHaveBeenCalledWith("/home/me/game/b.tap");
    expect(h.vm.notice?.text).toBe("b.tap is not a project file: only the open project's files open in the editor.");

    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    await cursorOn(h, "DISK");
    await h.dispatch({ type: "editRequested" });
    expect(h.ports.shell.edit).toHaveBeenCalledTimes(1);
  });

  it("reveals this computer's files only", async () => {
    const h = await openFileManager();
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "revealRequested" });
    expect(h.ports.shell.reveal).toHaveBeenCalledWith("/home/me/game/b.tap");
  });
});

describe("the right-click menu", () => {
  it("offers what the row under the cursor allows", async () => {
    const h = await openFileManager();
    await cursorOn(h, "tapes");
    const folder = Object.fromEntries(h.vm.panes[0].context.map((c) => [c.key, c.enabled]));
    expect(folder).toMatchObject({ view: false, edit: false, copy: true, rename: true, delete: true, reveal: true });
    expect(folder.moveUp).toBeUndefined();

    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    await cursorOn(h, "DISK");
    const onImage = h.vm.panes[0].context.map((c) => c.key);
    expect(onImage).not.toContain("reveal");
  });
});

describe("tape order", () => {
  it("Alt+Up and Alt+Down move a tape's file, and the cursor follows it", async () => {
    const h = await openFileManager();
    const { fakeListing } = await import("./fakes");
    h.ports.fm.list.mockImplementation(async (id: string, dir?: string) => ({
      ...fakeListing(id, dir),
      columns: id === GAME_DSK.id ? "tape" : fakeListing(id, dir).columns,
      ordered: id === GAME_DSK.id ? true : undefined
    }));
    expect(intentForKey({ key: "ArrowUp", altKey: true }, { side: 0, cursor: 2, rowCount: 3, pageSize: 10, menuOpen: false })).toEqual({ type: "tapeMoveRequested", by: -1 });
    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    await cursorOn(h, "GAME.BIN");
    expect(h.vm.panes[0].context.find((c) => c.key === "moveUp")?.enabled).toBe(true);
    await h.dispatch({ type: "tapeMoveRequested", by: -1 });
    expect(h.ports.fm.moveOnTape).toHaveBeenCalledWith(GAME_DSK.id, "GAME.BIN", -1);
    expect(h.ports.fm.list).toHaveBeenLastCalledWith(GAME_DSK.id, "");
  });

  it("does nothing off a tape", async () => {
    const h = await openFileManager();
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "tapeMoveRequested", by: 1 });
    expect(h.ports.fm.moveOnTape).not.toHaveBeenCalled();
  });
});

describe("drops", () => {
  it("rows dropped from the other pane copy there (Shift moves)", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "dropReceived", side: 1, source: { kind: "pane", driveId: PROJECT.id, paths: ["/home/me/game/b.tap"] }, move: true });
    expect(h.ports.fm.planTransfer.mock.calls[0][0]).toMatchObject({
      sourceDriveId: PROJECT.id,
      paths: ["/home/me/game/b.tap"],
      targetDriveId: HOME.id,
      targetDir: "/home/me",
      move: true
    });
    expect(h.vm.panes[1].active).toBe(true);
  });

  it("this computer's files (Project Explorer, Finder) copy from the host drive that holds them", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "dropReceived", side: 1, source: { kind: "host", paths: ["/Users/x/a.scr", "/Users/x/b.scr"] }, move: false });
    expect(h.ports.fm.planTransfer.mock.calls[0][0]).toMatchObject({ sourceDriveId: ROOT.id, paths: ["/Users/x/a.scr", "/Users/x/b.scr"], move: false });
    expect(h.ports.dialogs.confirmTransfer.mock.calls[0][0].sourceLabel).toBe("2");
  });
});

describe("settings", () => {
  it("show hidden files in the panes a document opens with", async () => {
    const { makePorts } = await import("./fakes");
    const { FileManagerController } = await import("@renderer/appIde/DocumentPanels/FileManager/FileManagerController");
    const { ports } = makePorts();
    const c = new FileManagerController(ports);
    await c.dispatch({ type: "activated", showHidden: true });
    await c.settle();
    expect(c.viewModel.panes[1].rows.map((r) => r.cells[0])).toContain(".profile");
  });

  it("delete permanently changes what the delete dialog says on this computer", async () => {
    const h = await openFileManager();
    await h.dispatch({ type: "deleteModeChanged", permanently: true });
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "deleteRequested" });
    expect(h.ports.dialogs.confirmDelete).toHaveBeenCalledWith({ names: ["b.tap"], mode: "permanent" });
  });
});

describe("keys", () => {
  const ctx: KeyContext = { side: 0, cursor: 1, rowCount: 5, pageSize: 10, menuOpen: false };
  it("F3 views, F4 edits, + and - mark and unmark by mask", () => {
    expect(intentForKey({ key: "F3" }, ctx)).toEqual({ type: "viewRequested" });
    expect(intentForKey({ key: "F4" }, ctx)).toEqual({ type: "editRequested" });
    expect(intentForKey({ key: "+", shiftKey: true }, ctx)).toEqual({ type: "maskRequested", mark: true });
    expect(intentForKey({ key: "-" }, ctx)).toEqual({ type: "maskRequested", mark: false });
  });
});
