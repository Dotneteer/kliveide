import { CODE_EDITOR } from "@common/state/common-ids";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import {
  DOCS_WORKSPACE,
  getMultiAreaDocumentWorkspace,
  type SavedDocumentAreaInfo,
  type SavedDocumentInfo
} from "@renderer/features/documents/useDocumentWorkspacePersistence";
import {
  createSpecialDocument,
  isWorkspaceRestorableSpecialDocument
} from "@renderer/features/documents/specialDocuments";
import { delay } from "@renderer/utils/timing";

export async function restoreLastOpenDocuments(
  projectService: IProjectService,
  store: Store<AppState>
): Promise<void> {
  const state = store.getState();
  const projectPath = state.project?.folderPath;
  if (!projectPath) return;

  const activeHub = projectService.getActiveDocumentHubService();
  if (!activeHub) return;

  const workspace = getMultiAreaDocumentWorkspace(state.workspaceSettings?.[DOCS_WORKSPACE]);
  if (!workspace) {
    await activeHub.closeAllDocuments();
    return;
  }

  const availableHubs = projectService.getDocumentHubServiceInstances?.() ?? [activeHub];
  for (const hub of availableHubs) {
    await hub.closeAllDocuments();
  }

  const restoredAreas: {
    area: SavedDocumentAreaInfo;
    firstRestoredDocId: string;
    hub: typeof activeHub;
    restoredActiveDocId: string;
  }[] = [];

  for (const [index, area] of workspace.areas.entries()) {
    const hub = availableHubs[index] ?? projectService.createDocumentHubService();
    // --- A single unreadable/locked document (more likely on Windows, e.g. a file still held by
    // --- another process) must not abort restoration of every other area/document - without this,
    // --- an exception here propagates out of restoreLastOpenDocuments entirely, silently dropping
    // --- every remaining tab and preventing the workspace-loaded signal from ever firing.
    let firstRestoredDocId = "";
    let restoredActiveDocId = "";
    try {
      ({ firstRestoredDocId, restoredActiveDocId } = await restoreAreaDocuments(
        area,
        hub,
        projectPath,
        projectService,
        state.workspaceSettings
      ));
    } catch (err) {
      console.error(`Failed to restore documents for area '${area.areaId}':`, err);
    }
    restoredAreas.push({
      area,
      firstRestoredDocId,
      hub,
      restoredActiveDocId
    });
  }

  // --- Give React a chance to paint the restored tabs before loading active documents.
  await delay(0);

  let activeAreaHub = restoredAreas[0]?.hub ?? activeHub;
  for (const restoredArea of restoredAreas) {
    const docToActivate =
      restoredArea.restoredActiveDocId || restoredArea.firstRestoredDocId;
    if (docToActivate) {
      try {
        await restoredArea.hub.setActiveDocument(docToActivate);
      } catch (err) {
        console.error(`Failed to activate document '${docToActivate}':`, err);
      }
    }
    if (restoredArea.area.areaId === workspace.activeAreaId && docToActivate) {
      activeAreaHub = restoredArea.hub;
    }
  }

  projectService.setActiveDocumentHubService(activeAreaHub);
}

async function restoreAreaDocuments(
  area: SavedDocumentAreaInfo,
  documentHubService: ReturnType<IProjectService["getActiveDocumentHubService"]>,
  projectPath: string,
  projectService: IProjectService,
  workspaceSettings: Record<string, any> | undefined
): Promise<{
  firstRestoredDocId: string;
  restoredActiveDocId: string;
}> {
  let firstRestoredDocId = "";
  let restoredActiveDocId = "";
  if (!documentHubService) {
    return { firstRestoredDocId, restoredActiveDocId };
  }

  for (const doc of area.documents) {
    const restoredDocument = restoreDocument(doc, projectPath, projectService, workspaceSettings);
    if (!restoredDocument) continue;

    // --- One document failing to open (e.g. a slow/locked file read) must not prevent the
    // --- remaining documents in this area from being restored.
    try {
      await documentHubService.openDocumentTab(
        restoredDocument.document,
        restoredDocument.viewState,
        false
      );
    } catch (err) {
      console.error(`Failed to restore document '${doc.id}':`, err);
      continue;
    }
    firstRestoredDocId ||= restoredDocument.document.id;
    if (restoredDocument.document.id === area.activeDocumentId) {
      restoredActiveDocId = restoredDocument.document.id;
    }
  }

  return { firstRestoredDocId, restoredActiveDocId };
}

function restoreDocument(
  savedDocument: SavedDocumentInfo,
  projectPath: string,
  projectService: IProjectService,
  workspaceSettings: Record<string, any> | undefined
): { document: ReturnType<IProjectService["getDocumentShellForProjectNode"]>; viewState?: any } | undefined {
  if (savedDocument.type === CODE_EDITOR) {
    if (!savedDocument.id.startsWith(`${projectPath}/`)) return undefined;

    const projectNode = projectService.getNodeForFile(savedDocument.id);
    if (!projectNode) return undefined;

    const document = projectService.getDocumentShellForProjectNode(projectNode.data);
    document.editPosition = {
      line: savedDocument.position?.line ?? 0,
      column: savedDocument.position?.column ?? 0
    };
    return { document, viewState: cloneViewState(savedDocument.viewState) };
  }

  if (!isWorkspaceRestorableSpecialDocument(savedDocument)) return undefined;

  const document = createSpecialDocument(savedDocument.id);
  const legacyViewState = workspaceSettings?.[savedDocument.type];
  return {
    document,
    viewState: cloneViewState(savedDocument.viewState ?? legacyViewState)
  };
}

function cloneViewState(viewState: any): any {
  return viewState && typeof viewState === "object" ? { ...viewState } : viewState;
}
