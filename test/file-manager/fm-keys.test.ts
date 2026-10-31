import { describe, expect, it } from "vitest";

import { intentForKey, type KeyContext } from "@renderer/appIde/DocumentPanels/FileManager/fileManagerKeys";

/* The File Manager's keys (.plans/FILE_MANAGER_PLAN.md D8): a key press to an intent */

const ctx: KeyContext = { side: 1, cursor: 5, rowCount: 40, pageSize: 11, menuOpen: false };

describe("File Manager keys", () => {
  it.each([
    ["ArrowUp", { type: "cursorMoved", side: 1, to: 4 }],
    ["ArrowDown", { type: "cursorMoved", side: 1, to: 6 }],
    ["PageUp", { type: "cursorMoved", side: 1, to: -5 }],
    ["PageDown", { type: "cursorMoved", side: 1, to: 15 }],
    ["Home", { type: "cursorMoved", side: 1, to: 0 }],
    ["End", { type: "cursorMoved", side: 1, to: 39 }],
    ["Enter", { type: "rowActivated", side: 1 }],
    ["Backspace", { type: "upRequested", side: 1 }],
    ["Tab", { type: "paneSwitched" }],
    ["Insert", { type: "markToggled", side: 1, advance: true }],
    [" ", { type: "markToggled", side: 1, advance: true }],
    ["Escape", { type: "marksCleared", side: 1 }]
  ])("%s", (key, intent) => {
    expect(intentForKey({ key }, ctx)).toEqual(intent);
  });

  it("F5 copies, F6 moves, Shift+F6 renames, F7 makes a folder, F8 and Delete delete", () => {
    expect(intentForKey({ key: "F5" }, ctx)).toEqual({ type: "transferRequested", move: false });
    expect(intentForKey({ key: "F6" }, ctx)).toEqual({ type: "transferRequested", move: true });
    expect(intentForKey({ key: "F6", shiftKey: true }, ctx)).toEqual({ type: "renameRequested" });
    expect(intentForKey({ key: "F7" }, ctx)).toEqual({ type: "mkdirRequested" });
    expect(intentForKey({ key: "F8" }, ctx)).toEqual({ type: "deleteRequested" });
    expect(intentForKey({ key: "Delete" }, ctx)).toEqual({ type: "deleteRequested" });
  });

  it("Escape cancels a running job before it clears marks", () => {
    expect(intentForKey({ key: "Escape" }, { ...ctx, jobRunning: true })).toEqual({ type: "jobCancelRequested" });
  });

  it("Alt+F1 and Alt+F2 open the left and right drive menus", () => {
    expect(intentForKey({ key: "F1", altKey: true }, ctx)).toEqual({ type: "driveMenuToggled", side: 0 });
    expect(intentForKey({ key: "F2", altKey: true }, ctx)).toEqual({ type: "driveMenuToggled", side: 1 });
  });

  it("Ctrl+R refreshes, Ctrl+H shows hidden files, Ctrl+A marks all", () => {
    expect(intentForKey({ key: "r", ctrlKey: true }, ctx)).toEqual({ type: "refreshRequested", side: 1 });
    expect(intentForKey({ key: "h", ctrlKey: true }, ctx)).toEqual({ type: "hiddenToggled", side: 1 });
    expect(intentForKey({ key: "a", ctrlKey: true }, ctx)).toEqual({ type: "allMarked", side: 1 });
  });

  it("leaves other keys, and the IDE's Cmd shortcuts, alone", () => {
    expect(intentForKey({ key: "x" }, ctx)).toBeUndefined();
    expect(intentForKey({ key: "ArrowDown", metaKey: true }, ctx)).toBeUndefined();
    expect(intentForKey({ key: "r", metaKey: true }, ctx)).toBeUndefined();
  });

  it("with the drive menu open, only Escape closes it", () => {
    const open = { ...ctx, menuOpen: true };
    expect(intentForKey({ key: "Escape" }, open)).toEqual({ type: "driveMenuClosed" });
    expect(intentForKey({ key: "ArrowDown" }, open)).toBeUndefined();
  });
});
