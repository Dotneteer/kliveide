import { useMemo } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { getDuplicateDocumentNames } from "@renderer/features/documents/DocumentTabs";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";

/**
 * One row of the Open Editors panel: a document plus the hub that holds it.
 *
 * The hub travels with the document because a document can be open in more than one hub (both
 * halves of a split view), and clicking a row has to activate the right one — the document ID
 * alone cannot say which.
 */
export type OpenEditorEntry = {
  /** The open document. */
  document: ProjectDocumentState;
  /** The hub holding this document. */
  hub: IDocumentHubService;
  /** Is this the active document of its own hub? */
  isActive: boolean;
  /** Is this the editor the user is in — the active document of the active hub? */
  isCurrent: boolean;
  /** Does the document have unsaved edits? */
  isDirty: boolean;
  /** Opened as a preview tab (shown in italics, the way the tab strip shows it). */
  isTemporary: boolean;
  /** The row's label: the document name. */
  label: string;
  /** The containing folder, supplied only when the name alone would be ambiguous. */
  detail?: string;
};

/**
 * The open documents of every document hub, most recently activated first.
 *
 * Both the Open Editors panel and its header badge read from here, which is the point: a badge
 * counting one thing while the list below it shows another is the kind of discrepancy nobody
 * notices until they are debugging something else.
 *
 * The order is by activation stamp (see `IDocumentHubService.getActivationStamp`), descending, with
 * one override: the active document of the active hub always comes first. The override earns its
 * place in the split-view case — clicking into the other pane changes which editor the user is in
 * without re-activating any document, so that pane's active document is the current editor while
 * carrying an older stamp. `Array.prototype.sort` is stable, so documents sharing a stamp — every
 * document opened as a background tab carries 0 — stay in tab order rather than shuffling.
 */
export function useOpenEditors(): OpenEditorEntry[] {
  const { projectService } = useAppServices();

  // --- Hubs sign every change that matters here: documents opened, closed, reordered, activated,
  // --- and hubs created or closed.
  const documentHubState = useSelector((s) => s.ideView?.documentHubState);

  // --- Dirty flags live on the hub-owned document objects, which no action copies into the store,
  // --- so the hub version above never moves when one is edited. `editorVersion` is that signal.
  const editorVersion = useSelector((s) => s.ideView?.editorVersion);

  // --- Folder paths are shown relative to the project root when there is one.
  const folderPath = useSelector((s) => s.project?.folderPath);

  return useMemo(() => {
    const hubs = projectService?.getDocumentHubServiceInstances() ?? [];
    const activeHub = projectService?.getActiveDocumentHubService();

    const entries: OpenEditorEntry[] = [];
    for (const hub of hubs) {
      const openDocs = hub.getOpenDocuments() ?? [];
      const activeIndex = hub.getActiveDocumentIndex();
      openDocs.forEach((document, index) => {
        const isActive = index === activeIndex;
        entries.push({
          document,
          hub,
          isActive,
          isCurrent: isActive && hub === activeHub,
          isDirty: document.editVersionCount !== document.savedVersionCount,
          isTemporary: !!document.isTemporary,
          label: document.name
        });
      });
    }

    // --- Two files called `code.asm` are told apart by their folder, exactly as the tab strip
    // --- tells them apart by their path. Unambiguous names stay bare: a folder on every row is
    // --- noise that makes the names themselves harder to scan.
    const duplicateNames = getDuplicateDocumentNames(entries.map((entry) => entry.document));
    for (const entry of entries) {
      if (duplicateNames.has(entry.document.name)) {
        entry.detail = getDocumentFolder(entry.document, folderPath);
      }
    }

    const rank = (entry: OpenEditorEntry) =>
      entry.isCurrent
        ? Number.MAX_SAFE_INTEGER
        : entry.hub.getActivationStamp(entry.document.id);
    return entries.sort((a, b) => rank(b) - rank(a));
    // `documentHubState` and `editorVersion` are not read in the body: they are the store signals
    // that the hub-owned data below has changed, and hence the reason to recompute.
  }, [documentHubState, editorVersion, folderPath, projectService]);
}

/**
 * The folder a document lives in, relative to the project root when it is inside one.
 *
 * Returns `undefined` for a document with no path (a memory view, a disassembly) and for one
 * sitting in the project root, where the folder would be an empty string rather than information.
 */
function getDocumentFolder(
  document: ProjectDocumentState,
  folderPath?: string
): string | undefined {
  if (!document.path) return undefined;
  const separator = Math.max(document.path.lastIndexOf("/"), document.path.lastIndexOf("\\"));
  if (separator < 0) return undefined;
  const folder = document.path.substring(0, separator);
  if (folderPath && folder.startsWith(folderPath)) {
    const relative = folder.substring(folderPath.length).replace(/^[/\\]+/, "");
    return relative || undefined;
  }
  return folder || undefined;
}
