// ====================================================================================================================
// Moving a document between the IDE and a floating window (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.4).
//
// The transfer format is the workspace's saved document: its type, ID, position and view state. Pop
// Out captures it in the IDE, Dock captures it in the floating window, and both ends turn it back into
// a document with `restoreDocument`, the workspace restore's own code path, so the position and view
// state come back the same way they do when a project reopens.
// ====================================================================================================================

import type { MainApi } from "@common/messaging/MainApi";
import {
  canOpenFloatingWindow,
  findFloatingSlot,
  type DockedDocumentRequest,
  type FloatingDocumentResult,
  type FloatingSavedDocument
} from "@common/messaging/floating-documents";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { restoreDocument } from "@renderer/appIde/restoreLastOpenDocuments";
import { getDocumentAreaCommandTarget } from "./documentAreaCommandTarget";
import { isWorkspaceRestorableSpecialDocument } from "./specialDocuments";
import { dropEditorModel } from "@renderer/features/editor/editorModelCache";

/**
 * Why a document cannot pop out; undefined when it can
 */
export type PopOutBlocker = "limit" | "notFloatable" | "noProject";

/**
 * Tells whether a document may pop out into a floating window (plan Q5): a document the workspace
 * can restore (a file of the project, or a restorable special document) whose kind is not marked
 * `floatable: false`, while fewer than `MAX_FLOATING_WINDOWS` windows float.
 */
export function getPopOutBlocker(
  document: Pick<ProjectDocumentState, "id" | "type" | "floatable"> | undefined,
  state: AppState | undefined
): PopOutBlocker | undefined {
  const folderPath = state?.project?.folderPath;
  if (!document) return "notFloatable";
  // --- The hub copies the registry's `floatable: false` onto the document (it owns the registry
  // --- lookup; importing the registry here would pull every panel into the tab strip)
  if ((document as ProjectDocumentState).floatable === false) return "notFloatable";
  const isProjectFile = !!folderPath && document.id.startsWith(`${folderPath}/`);
  if (!isProjectFile && !isWorkspaceRestorableSpecialDocument(document as ProjectDocumentState)) {
    return folderPath ? "notFloatable" : "noProject";
  }
  if (!canOpenFloatingWindow(state)) return "limit";
  return undefined;
}

/**
 * Captures a document of a hub in the transfer format
 */
export function captureSavedDocument(
  hub: IDocumentHubService,
  document: ProjectDocumentState
): FloatingSavedDocument {
  const viewState = hub.getDocumentViewState(document.id);
  return {
    type: document.type,
    id: document.id,
    position: {
      line: document.editPosition?.line ?? 0,
      column: document.editPosition?.column ?? 0
    },
    ...(viewState !== undefined ? { viewState: cloneViewState(viewState) } : {})
  };
}

/**
 * Saves a document's unsaved edits before it moves to another window. The view's own disposal hook
 * does it (the code editor writes its model back to the file); delayed as-you-type saves are flushed
 * too. False when the view refused (the move is then cancelled).
 */
export async function saveDocumentBeforeTransfer(
  hub: IDocumentHubService,
  documentId: string,
  projectService: Pick<IProjectService, "performAllDelayedSavesNow">
): Promise<boolean> {
  await projectService.performAllDelayedSavesNow();
  const api = hub.getDocumentApi(documentId) as { beforeDocumentDisposal?: () => Promise<void | boolean> } | undefined;
  const result = await api?.beforeDocumentDisposal?.();
  return result !== false;
}

type PopOutArgs = {
  hub: IDocumentHubService;
  documentId: string;
  sourceAreaId?: string;
  projectService: IProjectService;
  mainApi: Pick<MainApi, "openFloatingDocument">;
};

/**
 * Pops a document out into a floating window (plan §3.4 step 1): flushes its delayed saves, asks
 * main for a window, and only then lets the tab go. A failure leaves the tab where it was.
 */
export async function popOutDocument({
  hub,
  documentId,
  sourceAreaId,
  projectService,
  mainApi
}: PopOutArgs): Promise<FloatingDocumentResult> {
  const document = hub.getDocument(documentId);
  if (!document) return { error: "failed", message: `Unknown document: ${documentId}` };

  // --- The document's edits must be on disk before the other window reads it
  if (!(await saveDocumentBeforeTransfer(hub, documentId, projectService))) {
    return { error: "failed", message: "The document could not be saved." };
  }

  const result = await mainApi.openFloatingDocument({
    document: captureSavedDocument(hub, document),
    sourceAreaId
  });
  if (result?.slot) {
    // --- The window holds it now; the tab goes without the disposal prompts, its saves are done
    hub.detachDocument(documentId);
  }
  return result;
}

/**
 * Opens a document docked back from a floating window (plan §3.4 step 3): in the area it came from
 * when that still exists, otherwise in the active one; activated, with its view state.
 */
export async function openDockedDocument(
  projectService: IProjectService,
  store: Store<AppState>,
  request: DockedDocumentRequest
): Promise<boolean> {
  const projectPath = store.getState()?.project?.folderPath;
  if (!projectPath) return false;
  // --- The floating window may have changed the file since this window cached it: drop the cached
  // --- text and the cached document's contents (found in the running app: Dock showed the old text)
  projectService.forgetFile?.(request.document.id);
  const cached = projectService.getDocumentById?.(request.document.id);
  if (cached && !cached.usedIn?.length && cached.path) {
    cached.contents = undefined;
  }
  // --- ...and the editor model this window kept for the path (it would win over the new text)
  if (!projectService.getDocumentHubServiceInstances().some((hub) => hub.isOpen(request.document.id))) {
    dropEditorModel(request.document.id);
  }
  const restored = restoreDocument(
    request.document,
    projectPath,
    projectService,
    store.getState()?.workspaceSettings
  );
  if (!restored) return false;

  const grid = getDocumentAreaCommandTarget();
  const sourceHub = request.sourceAreaId ? grid?.getHubForArea?.(request.sourceAreaId) : undefined;
  const hub = sourceHub ?? projectService.getActiveDocumentHubService() ?? projectService.createDocumentHubService();
  // --- The document may still be open in the IDE (a race with a second Dock): activate it there
  const existing = projectService
    .getDocumentHubServiceInstances()
    .find((candidate) => candidate.isOpen(request.document.id));
  if (existing) {
    await existing.setActiveDocument(request.document.id);
    return true;
  }
  await hub.openDocument(restored.document, restored.viewState, false);
  if (sourceHub && request.sourceAreaId) {
    grid?.activateArea?.(request.sourceAreaId);
  } else {
    projectService.setActiveDocumentHubService(hub);
  }
  return true;
}

/**
 * Sends "open this document" to its floating window when it floats (plan §2.3): the window is
 * focused and navigated instead of a second copy opening. True when the document floats.
 */
export async function routeToFloatingDocument(
  store: Store<AppState>,
  mainApi: Pick<MainApi, "focusFloatingDocument">,
  documentId: string,
  line?: number,
  column?: number
): Promise<boolean> {
  if (!findFloatingSlot(store.getState(), documentId)) return false;
  return await mainApi.focusFloatingDocument({ documentId, line, column });
}

function cloneViewState(viewState: any): any {
  if (!viewState || typeof viewState !== "object") return viewState;
  try {
    // --- Through IPC: only structured-cloneable data survives, so drop anything else here
    return JSON.parse(JSON.stringify(viewState));
  } catch {
    return undefined;
  }
}
