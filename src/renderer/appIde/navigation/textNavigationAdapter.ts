import type { DocumentNavigationAdapter } from "@renderer/abstractions/DocumentNavigationAdapter";
import type { NavigationEntry, NavigationLocator } from "@renderer/abstractions/NavigationLocation";

/*
 * Navigation for the code and text editors (Monaco).
 *
 * A location is a 1-based line and column. Capture asks the mounted editor first
 * (`EditorApi.getNavigationLocator`); an editor that is not mounted falls back to
 * `ProjectDocumentState.editPosition`, which the editor keeps up to date on every cursor move.
 *
 * Restore goes through `nav`, the same command every source jump uses, after making the chosen
 * document area the active one — `nav` always works in the active area.
 *
 * **Line drift.** An entry recorded at line 120 should still land on the same code after ten lines
 * are inserted above it. While a file's editor model exists, each entry in it is followed by a
 * sticky decoration — Monaco moves decorations with the text — and read back through `resolve`. The
 * editor keeps its models across tab switches (`keepCurrentModel`), so this covers every file opened
 * this session. When a model is disposed, the tracked positions are written back into the entries
 * first; a file never opened keeps the line it was recorded at.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §7 ("Line drift").
 */

/** Lines within this distance of each other are the same place, as in VS Code. */
export const TEXT_NEAR_LINES = 10;

/** `TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges`: the range stays a point as text is typed. */
const NEVER_GROWS_WHEN_TYPING_AT_EDGES = 1;

/** The part of a Monaco text model the tracker uses. */
export type TrackableTextModel = {
  isDisposed(): boolean;
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
  getLineMaxColumn(lineNumber: number): number;
  deltaDecorations(
    oldDecorations: string[],
    newDecorations: {
      range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
      options: { stickiness?: number };
    }[]
  ): string[];
  getDecorationRange(id: string): { startLineNumber: number; startColumn: number } | null;
  onWillDispose(listener: () => void): { dispose(): void };
};

export type TextNavigationAdapterDeps = {
  /** The live editor model of a document, if it has one. */
  getModel?: (documentId: string) => TrackableTextModel | undefined;
};

type Tracked = { model: TrackableTextModel; decorationId: string };

export function createTextNavigationAdapter(
  deps: TextNavigationAdapterDeps = {}
): DocumentNavigationAdapter {
  const tracked = new Map<NavigationEntry, Tracked>();
  const disposeListeners = new Map<TrackableTextModel, { dispose(): void }>();

  // --- The tracked position of an entry, or undefined when it is not (or no longer) followed.
  const trackedPosition = (entry: NavigationEntry) => {
    const t = tracked.get(entry);
    if (!t || t.model.isDisposed()) return undefined;
    return t.model.getDecorationRange(t.decorationId) ?? undefined;
  };

  // --- Stop following an entry, writing its last known position into it so nothing is lost.
  const untrack = (entry: NavigationEntry, flush: boolean) => {
    const t = tracked.get(entry);
    if (!t) return;
    if (!t.model.isDisposed()) {
      if (flush) writeBack(entry);
      t.model.deltaDecorations([t.decorationId], []);
    }
    tracked.delete(entry);
    releaseModelListenerIfUnused(t.model);
  };

  const writeBack = (entry: NavigationEntry) => {
    const position = trackedPosition(entry);
    if (position && entry.locator.kind === "text") {
      entry.locator.line = position.startLineNumber;
      entry.locator.column = position.startColumn;
    }
  };

  const releaseModelListenerIfUnused = (model: TrackableTextModel) => {
    for (const t of tracked.values()) if (t.model === model) return;
    disposeListeners.get(model)?.dispose();
    disposeListeners.delete(model);
  };

  const follow = (entry: NavigationEntry, model: TrackableTextModel) => {
    if (entry.locator.kind !== "text") return;
    const line = Math.max(1, Math.min(entry.locator.line, model.getLineCount()));
    const column = Math.max(1, Math.min(entry.locator.column, model.getLineMaxColumn(line)));
    const [decorationId] = model.deltaDecorations(
      [],
      [
        {
          range: { startLineNumber: line, startColumn: column, endLineNumber: line, endColumn: column },
          options: { stickiness: NEVER_GROWS_WHEN_TYPING_AT_EDGES }
        }
      ]
    );
    if (!decorationId) return;
    tracked.set(entry, { model, decorationId });
    if (!disposeListeners.has(model)) {
      disposeListeners.set(
        model,
        model.onWillDispose(() => {
          // --- Keep what the model knew: write every position back before it goes.
          for (const [e, t] of Array.from(tracked.entries())) {
            if (t.model !== model) continue;
            writeBack(e);
            tracked.delete(e);
          }
          disposeListeners.get(model)?.dispose();
          disposeListeners.delete(model);
        })
      );
    }
  };

  return {
    capture(document) {
      const position = document.editPosition;
      return position
        ? { kind: "text", line: position.line, column: position.column }
        : { kind: "text", line: 1, column: 1 };
    },

    isNear(a: NavigationLocator, b: NavigationLocator) {
      if (a.kind !== "text" || b.kind !== "text") return false;
      return Math.abs(a.line - b.line) <= TEXT_NEAR_LINES;
    },

    async restore(entry, hub, services) {
      if (entry.locator.kind !== "text") return false;
      const { projectService, ideCommandsService } = services;
      if (projectService.getActiveDocumentHubService() !== hub) {
        projectService.setActiveDocumentHubService(hub);
      }
      // --- `nav` takes a column one higher than Monaco's (it subtracts one before `setPosition`).
      const { line, column } = entry.locator;
      const result = await ideCommandsService.executeCommand(
        `nav "${entry.documentId}" ${line} ${column + 1}`
      );
      return !!result?.success;
    },

    describe(entry) {
      return entry.locator.kind === "text" ? `line ${entry.locator.line}` : "";
    },

    // --- From the live model when there is one (it has the unsaved edits), else from the document's
    // --- cached contents, so a closed file costs nothing and shows nothing.
    preview(entry, services) {
      if (entry.locator.kind !== "text") return undefined;
      const lineNumber = entry.locator.line;
      const model = deps.getModel?.(entry.documentId);
      if (model && !model.isDisposed()) {
        return lineNumber <= model.getLineCount()
          ? model.getLineContent(lineNumber).trim() || undefined
          : undefined;
      }
      const contents = services.projectService.getDocumentById?.(entry.documentId)?.contents;
      if (typeof contents !== "string") return undefined;
      const line = contents.split(/\r?\n/, lineNumber)[lineNumber - 1];
      return line?.trim() || undefined;
    },

    track(entries) {
      if (!deps.getModel) return;
      const live = new Set(entries);
      for (const entry of Array.from(tracked.keys())) {
        // --- Removed from the history: nothing reads it again, so there is nothing to write back.
        if (!live.has(entry)) untrack(entry, false);
      }
      for (const entry of entries) {
        const t = tracked.get(entry);
        if (t && !t.model.isDisposed()) continue;
        if (t) tracked.delete(entry);
        const model = deps.getModel(entry.documentId);
        if (model && !model.isDisposed()) follow(entry, model);
      }
    },

    resolve(entry) {
      if (entry.locator.kind !== "text") return entry.locator;
      const position = trackedPosition(entry);
      if (!position) return entry.locator;
      if (position.startLineNumber === entry.locator.line && position.startColumn === entry.locator.column) {
        return entry.locator;
      }
      return { kind: "text", line: position.startLineNumber, column: position.startColumn };
    }
  };
}

/** The adapter without an editor to follow lines in (for tests and non-Monaco hosts). */
export const textNavigationAdapter = createTextNavigationAdapter();
