import { CODE_EDITOR } from "@common/state/common-ids";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { DOCS_WORKSPACE } from "@renderer/features/documents/useDocumentWorkspacePersistence";
import { delay } from "@renderer/utils/timing";

export async function restoreLastOpenDocuments(
  projectService: IProjectService,
  store: Store<AppState>
): Promise<void> {
  const state = store.getState();
  const projectPath = state.project?.folderPath;
  if (!projectPath) return;

  const documentHubService = projectService.getActiveDocumentHubService();
  await documentHubService.closeAllDocuments();

  const lastOpenDocs = (state.workspaceSettings?.[DOCS_WORKSPACE]?.documents ?? []).filter(
    (d: { type: string }) => d.type === CODE_EDITOR
  );
  const activeDocId = state.workspaceSettings?.[DOCS_WORKSPACE]?.activeDocumentId;
  let firstRestoredDocId = "";
  let restoredActiveDocId = "";

  for (const doc of lastOpenDocs) {
    if (!doc.id.startsWith(`${projectPath}/`)) continue;

    const projectNode = projectService.getNodeForFile(doc.id);
    if (!projectNode) continue;

    const document = projectService.getDocumentShellForProjectNode(projectNode.data);
    document.editPosition = {
      line: doc.position?.line ?? 0,
      column: doc.position?.column ?? 0
    };
    await documentHubService.openDocumentTab(document, undefined, false);
    firstRestoredDocId ||= document.id;
    if (document.id === activeDocId) {
      restoredActiveDocId = document.id;
    }
  }

  // --- Give React a chance to paint the restored tabs before loading the active document.
  await delay(0);

  const docToActivate = restoredActiveDocId || firstRestoredDocId;
  if (docToActivate) {
    await documentHubService.setActiveDocument(docToActivate);
  }
}
