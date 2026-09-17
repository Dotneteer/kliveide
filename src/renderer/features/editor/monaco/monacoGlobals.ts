import type { Store } from "@common/state/redux-light";
import type { AppState } from "@common/state/AppState";
import type { RenameEdit } from "@renderer/appIde/services/z80-providers";

/**
 * Opens `filePath` at a 1-based `line` and, when known, a 1-based Monaco `column`.
 */
type NavigateToFile = (filePath: string, line: number, column?: number) => void;

/** What Monaco hands an editor opener: a selection (definition, reference) or a bare position. */
export type MonacoSelectionOrPosition =
  | {
      startLineNumber?: unknown;
      startColumn?: unknown;
      lineNumber?: unknown;
      column?: unknown;
    }
  | null
  | undefined;

/**
 * The 1-based line and column an editor opener should land on.
 *
 * The column used to be dropped, so every Go to Definition landed on column 1 of the right line.
 * Navigation history (`.plans/NAVIGATION_HISTORY_PLAN.md` §4.1) records where a jump arrives, and an
 * entry that points at the start of the line instead of the symbol is a worse place to come back to.
 * `column` is `undefined` when Monaco supplied none, so callers can tell "column 1" from "unknown".
 */
export function getMonacoNavigationPosition(selectionOrPosition: MonacoSelectionOrPosition): {
  line: number;
  column?: number;
} {
  if (selectionOrPosition) {
    if (typeof selectionOrPosition.startLineNumber === "number") {
      return {
        line: selectionOrPosition.startLineNumber,
        column: positiveOrUndefined(selectionOrPosition.startColumn)
      };
    }
    if (typeof selectionOrPosition.lineNumber === "number") {
      return {
        line: selectionOrPosition.lineNumber,
        column: positiveOrUndefined(selectionOrPosition.column)
      };
    }
  }
  return { line: 1 };
}

function positiveOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && value >= 1 ? value : undefined;
}
type ApplyExternalEdits = (edits: RenameEdit[]) => void;

let navigateToFile: NavigateToFile | null = null;
let applyExternalEdits: ApplyExternalEdits | null = null;
let providerStore: Store<AppState> | null = null;

/**
 * Sets the active Monaco cross-file navigation target and returns a cleanup
 * that only clears the callback if it is still the active one.
 */
export function setMonacoNavigationHandler(handler: NavigateToFile): () => void {
  navigateToFile = handler;
  return () => {
    if (navigateToFile === handler) {
      navigateToFile = null;
    }
  };
}

/**
 * Sets the active Monaco external-edit handler and returns scoped cleanup.
 */
export function setMonacoExternalEditHandler(handler: ApplyExternalEdits): () => void {
  applyExternalEdits = handler;
  return () => {
    if (applyExternalEdits === handler) {
      applyExternalEdits = null;
    }
  };
}

/**
 * Sets the store used by Monaco providers and returns scoped cleanup.
 */
export function setMonacoProviderStore(store: Store<AppState>): () => void {
  providerStore = store;
  return () => {
    if (providerStore === store) {
      providerStore = null;
    }
  };
}

export function applyMonacoExternalEdits(edits: RenameEdit[]): void {
  applyExternalEdits?.(edits);
}

export function getMonacoProjectFolder(): string | undefined {
  return providerStore?.getState()?.project?.folderPath ?? undefined;
}

export function navigateMonacoToFile(filePath: string, line: number, column?: number): boolean {
  if (!navigateToFile) return false;
  if (column === undefined) {
    navigateToFile(filePath, line);
  } else {
    navigateToFile(filePath, line, column);
  }
  return true;
}

export function resetMonacoGlobalsForTests(): void {
  navigateToFile = null;
  applyExternalEdits = null;
  providerStore = null;
}
