import type { FileManagerIntent } from "./FileManagerController";
import type { PaneSide } from "./FileManagerModel";

/*
 * The File Manager's keys (.plans/FILE_MANAGER_PLAN.md D8): a key press to an intent, pure, so the
 * keyboard is tested without a DOM. F3 and F4 come with the viewer (Phase 7).
 */

export type KeyPress = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export type KeyContext = {
  side: PaneSide;
  cursor: number;
  rowCount: number;
  /** Rows that fit the pane, for Page Up/Down */
  pageSize: number;
  menuOpen: boolean;
  /** A job runs: Escape cancels it */
  jobRunning?: boolean;
};

/** The intent a key press means, or undefined when the File Manager leaves it alone */
export function intentForKey (press: KeyPress, ctx: KeyContext): FileManagerIntent | undefined {
  const { side, cursor, rowCount } = ctx;
  const page = Math.max(1, ctx.pageSize - 1);
  const plain = !press.altKey && !press.ctrlKey && !press.metaKey;

  if (ctx.menuOpen) return press.key === "Escape" ? { type: "driveMenuClosed" } : undefined;

  if (press.altKey && !press.ctrlKey && !press.metaKey) {
    if (press.key === "F1") return { type: "driveMenuToggled", side: 0 };
    if (press.key === "F2") return { type: "driveMenuToggled", side: 1 };
    return undefined;
  }
  if (press.ctrlKey && !press.altKey && !press.metaKey) {
    if (press.key === "r" || press.key === "R") return { type: "refreshRequested", side };
    if (press.key === "h" || press.key === "H") return { type: "hiddenToggled", side };
    if (press.key === "a" || press.key === "A") return { type: "allMarked", side };
    return undefined;
  }
  if (!plain) return undefined;

  if (press.key === "Escape" && ctx.jobRunning) return { type: "jobCancelRequested" };
  if (press.shiftKey && press.key === "F6") return { type: "renameRequested" };

  switch (press.key) {
    case "F5":
      return { type: "transferRequested", move: false };
    case "F6":
      return { type: "transferRequested", move: true };
    case "F7":
      return { type: "mkdirRequested" };
    case "F8":
    case "Delete":
      return { type: "deleteRequested" };
    case "ArrowUp":
      return { type: "cursorMoved", side, to: cursor - 1 };
    case "ArrowDown":
      return { type: "cursorMoved", side, to: cursor + 1 };
    case "PageUp":
      return { type: "cursorMoved", side, to: cursor - page };
    case "PageDown":
      return { type: "cursorMoved", side, to: cursor + page };
    case "Home":
      return { type: "cursorMoved", side, to: 0 };
    case "End":
      return { type: "cursorMoved", side, to: rowCount - 1 };
    case "Enter":
      return { type: "rowActivated", side };
    case "Backspace":
      return { type: "upRequested", side };
    case "Tab":
      return { type: "paneSwitched" };
    case "Insert":
    case " ":
      return { type: "markToggled", side, advance: true };
    case "Escape":
      return { type: "marksCleared", side };
    default:
      return undefined;
  }
}
