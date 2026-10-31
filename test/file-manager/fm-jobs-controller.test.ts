import { describe, expect, it } from "vitest";

import { GAME_DSK, PROJECT, HOME, fakePlan, openFileManager } from "./fakes";

/*
 * The File Manager's commands (.plans/FILE_MANAGER_PLAN.md, Phase 4) through its controller: copy
 * and move with their dialog, conflicts, progress and the notice; delete, new folder, rename.
 */

type H = Awaited<ReturnType<typeof openFileManager>>;
const names = (h: H, side: 0 | 1) => h.vm.panes[side].rows.map((r) => r.cells[0]);
const cursorOn = async (h: H, name: string) => h.dispatch({ type: "cursorMoved", side: 0, to: names(h, 0).indexOf(name) });

describe("copy and move", () => {
  it("copies the marked files to the other pane's folder, shows progress, then says what it did", async () => {
    const h = await openFileManager();
    await cursorOn(h, "a.bas");
    await h.dispatch({ type: "markToggled", side: 0, advance: true });
    await h.dispatch({ type: "markToggled", side: 0, advance: true });
    await h.dispatch({ type: "transferRequested", move: false });

    expect(h.ports.fm.planTransfer).toHaveBeenCalledWith({
      sourceDriveId: PROJECT.id,
      paths: ["/home/me/game/a.bas", "/home/me/game/b.tap"],
      targetDriveId: HOME.id,
      targetDir: "/home/me",
      move: false,
      options: { mode: "auto", codeStart: 32768 }
    });
    expect(h.ports.dialogs.confirmTransfer.mock.calls[0][0]).toMatchObject({ sourceLabel: "2", targetLabel: "/home/me" });
    expect(h.ports.fm.runTransfer).toHaveBeenCalledWith("fm-job-1", {});
    expect(h.eventTypes).toEqual(expect.arrayContaining(["jobStarted", "jobFinished", "noticeShown", "marksCleared"]));
    expect(h.vm.job).toBeUndefined();
    expect(h.vm.notice).toEqual({ tone: "info", text: "2 files copied." });
    expect(h.state.panes[0].marked).toEqual([]);
  });

  it("without marks, copies the file under the cursor", async () => {
    const h = await openFileManager();
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "transferRequested", move: true });
    expect(h.ports.fm.planTransfer.mock.calls[0][0]).toMatchObject({ paths: ["/home/me/game/b.tap"], move: true });
    expect(h.ports.dialogs.confirmTransfer.mock.calls[0][0].sourceLabel).toBe("b.tap");
    expect(h.vm.notice?.text).toBe("2 files moved.");
  });

  it("does nothing on the '..' row or when the dialog is cancelled", async () => {
    const h = await openFileManager({ confirm: "cancel" });
    await h.dispatch({ type: "rowActivated", side: 0, index: 0 });
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.ports.fm.planTransfer).not.toHaveBeenCalled();
    await h.dispatch({ type: "upRequested", side: 0 });
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.ports.dialogs.confirmTransfer).toHaveBeenCalled();
    expect(h.ports.fm.runTransfer).not.toHaveBeenCalled();
  });

  it("remembers the options chosen in the dialog for the next copy", async () => {
    const h = await openFileManager({ confirm: { options: { mode: "raw", codeStart: 24000 } } });
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "transferRequested", move: false });
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.ports.fm.planTransfer.mock.calls[1][0].options).toEqual({ mode: "raw", codeStart: 24000 });
  });

  it("shows why a copy cannot be planned", async () => {
    const h = await openFileManager();
    h.ports.fm.planTransfer.mockRejectedValueOnce(new Error("FmError: [fm:sameFolder] same"));
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.vm.notice).toEqual({ tone: "error", text: "The files are already in that folder." });
    expect(h.ports.dialogs.confirmTransfer).not.toHaveBeenCalled();
  });

  it("words a cancelled copy, a full disk and failed files", async () => {
    const cancelled = await openFileManager({ result: { written: 0, skipped: 0, failed: [], cancelled: true } });
    await cursorOn(cancelled, "b.tap");
    await cancelled.dispatch({ type: "transferRequested", move: false });
    expect(cancelled.vm.notice).toEqual({ tone: "error", text: "No file copied. Cancelled." });

    const full = await openFileManager({ result: { written: 0, skipped: 0, failed: [{ name: "x", code: "diskFull" }], cancelled: false, aborted: "diskFull" } });
    await cursorOn(full, "b.tap");
    await full.dispatch({ type: "transferRequested", move: false });
    expect(full.vm.notice?.text).toBe("The disk is full. Nothing was written.");

    const some = await openFileManager({ result: { written: 3, skipped: 1, failed: [{ name: "LONGNAME", code: "badName" }], cancelled: false } });
    await cursorOn(some, "b.tap");
    await some.dispatch({ type: "transferRequested", move: false });
    expect(some.vm.notice?.text).toBe("3 files copied. 1 skipped. 1 failed: LONGNAME: LONGNAME is not a name the disk takes.");
  });
});

describe("conflicts", () => {
  const conflicting = fakePlan({
    items: fakePlan().items.map((i) => ({ ...i, conflict: true })).concat([
      { id: 2, sourcePath: "/x/c.bin", sourceName: "c.bin", relDir: "", isDirectory: false, targetName: "c.bin", size: 1, becomes: { as: "asIs" }, conflict: true, shortened: false, part: false }
    ])
  });

  it("asks for each, offering a free name, until 'all' answers the rest", async () => {
    const h = await openFileManager({
      plan: conflicting,
      conflictAnswers: [{ kind: "rename", name: "a (2).bas" }, { kind: "replaceAll" }]
    });
    await cursorOn(h, "a.bas");
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.ports.dialogs.resolveConflict).toHaveBeenCalledTimes(2);
    expect(h.ports.dialogs.resolveConflict.mock.calls[0][0]).toMatchObject({ suggestion: "a (2).bas", remaining: 2 });
    expect(h.ports.fm.runTransfer).toHaveBeenCalledWith("fm-job-1", {
      0: { kind: "rename", name: "a (2).bas" },
      1: { kind: "replace" },
      2: { kind: "replace" }
    });
  });

  it("the dialog's choice answers all without asking", async () => {
    const h = await openFileManager({ plan: conflicting, confirm: { onExisting: "skip" } });
    await cursorOn(h, "a.bas");
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.ports.dialogs.resolveConflict).not.toHaveBeenCalled();
    expect(h.ports.fm.runTransfer.mock.calls[0][1]).toEqual({ 0: { kind: "skip" }, 1: { kind: "skip" }, 2: { kind: "skip" } });
  });

  it("cancel in a conflict stops the copy before it runs", async () => {
    const h = await openFileManager({ plan: conflicting, conflictAnswers: [{ kind: "cancel" }] });
    await cursorOn(h, "a.bas");
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.ports.fm.runTransfer).not.toHaveBeenCalled();
  });
});

describe("a running job", () => {
  it("shows its progress, can be cancelled, and blocks other changes", async () => {
    let finish: () => void = () => {};
    const h = await openFileManager();
    h.ports.fm.runTransfer.mockImplementationOnce(
      () => new Promise((resolve) => { finish = () => resolve({ written: 2, skipped: 0, failed: [], cancelled: false }); })
    );
    let waits = 0;
    // --- A real wait yields to the event loop; one that resolved at once would never let the test look
    h.ports.wait.mockImplementation(() => new Promise<void>((resolve) => {
      waits++;
      setTimeout(resolve, 0);
    }));
    await cursorOn(h, "b.tap");
    const running = h.send({ type: "transferRequested", move: false });
    while (waits < 2) await new Promise((r) => setTimeout(r, 0));
    expect(h.vm.job).toMatchObject({ text: "Copying b.tap · 1 of 2", progress: 0.5, canCancel: true });
    expect(h.vm.commands.find((c) => c.key === "copy")?.enabled).toBe(false);

    await h.controller.dispatch({ type: "deleteRequested" });
    expect(h.ports.dialogs.confirmDelete).not.toHaveBeenCalled();

    await h.controller.dispatch({ type: "jobCancelRequested" });
    expect(h.ports.fm.cancelJob).toHaveBeenCalledWith("fm-job-1");
    expect(h.vm.job?.text).toBe("Stopping after the current file…");

    finish();
    await running;
    await h.settle();
    expect(h.vm.job).toBeUndefined();
  });
});

describe("delete, new folder, rename", () => {
  it("deletes after asking, to the trash on the host, for good on an image", async () => {
    const h = await openFileManager();
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "deleteRequested" });
    expect(h.ports.dialogs.confirmDelete).toHaveBeenCalledWith({ names: ["b.tap"], mode: "trash" });
    expect(h.ports.fm.deleteEntries).toHaveBeenCalledWith(PROJECT.id, ["/home/me/game/b.tap"]);

    await h.dispatch({ type: "rowActivated", side: 0, index: names(h, 0).indexOf("game.dsk") });
    await h.dispatch({ type: "cursorMoved", side: 0, to: 1 });
    await h.dispatch({ type: "deleteRequested" });
    expect(h.ports.dialogs.confirmDelete).toHaveBeenLastCalledWith({ names: ["DISK"], mode: "image" });
    expect(h.ports.fm.deleteEntries).toHaveBeenLastCalledWith(GAME_DSK.id, ["DISK"]);
  });

  it("deletes nothing when the question is declined, and says what could not be deleted", async () => {
    const declined = await openFileManager({ deleteOk: false });
    await cursorOn(declined, "b.tap");
    await declined.dispatch({ type: "deleteRequested" });
    expect(declined.ports.fm.deleteEntries).not.toHaveBeenCalled();

    const h = await openFileManager();
    h.ports.fm.deleteEntries.mockResolvedValueOnce({ deleted: 0, failed: [{ name: "b.tap", code: "accessDenied" }] });
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "deleteRequested" });
    expect(h.vm.notice).toEqual({ tone: "error", text: "1 item could not be deleted: b.tap: b.tap cannot be read: access is denied." });
  });

  it("makes a folder in the active pane and renames the file under the cursor", async () => {
    const h = await openFileManager({ newName: "gfx" });
    await h.dispatch({ type: "mkdirRequested" });
    expect(h.ports.dialogs.askFolderName).toHaveBeenCalledWith({ where: "/home/me/game", existing: ["tapes", "game.dsk", "b.tap", "a.bas"] });
    expect(h.ports.fm.mkdir).toHaveBeenCalledWith(PROJECT.id, "/home/me/game", "gfx");

    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "renameRequested" });
    expect(h.ports.dialogs.askNewName).toHaveBeenCalledWith({ oldName: "b.tap" });
    expect(h.ports.fm.rename).toHaveBeenCalledWith(PROJECT.id, "/home/me/game/b.tap", "gfx");
  });

  it("says why a rename failed", async () => {
    const h = await openFileManager({ newName: "a.bas" });
    h.ports.fm.rename.mockRejectedValueOnce(new Error("FmError: [fm:exists] x"));
    await cursorOn(h, "b.tap");
    await h.dispatch({ type: "renameRequested" });
    expect(h.vm.notice).toEqual({ tone: "error", text: "a.bas is already there." });
    await h.dispatch({ type: "noticeDismissed" });
    expect(h.vm.notice).toBeUndefined();
  });
});
