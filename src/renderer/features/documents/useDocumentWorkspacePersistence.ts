import { setWorkspaceSettingsAction } from "@common/state/actions";
import { AppState } from "@common/state/AppState";
import { MainApi } from "@common/messaging/MainApi";
import { Store } from "@common/state/redux-light";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { useEffect } from "react";

export const DOCS_WORKSPACE = "docsWorkspace";

export type SavedDocumentInfo = {
  type: string;
  id: string;
  position?: {
    line: number;
    column?: number;
  };
};

export type DocumentWorkspace = {
  documents: SavedDocumentInfo[];
  activeDocumentId?: string;
};

type UseDocumentWorkspacePersistenceArgs = {
  activeDocIndex: number;
  ensureTabVisible: () => void;
  mainApi: MainApi;
  openDocs?: ProjectDocumentState[] | null;
  store: Store<AppState>;
  workspaceLoaded: boolean;
};

/**
 * Persists the document tab workspace for the current project folder, saving only
 * project-scoped documents while remembering the active tab and edit positions.
 */
export function useDocumentWorkspacePersistence({
  activeDocIndex,
  ensureTabVisible,
  mainApi,
  openDocs,
  store,
  workspaceLoaded
}: UseDocumentWorkspacePersistenceArgs): void {
  useEffect(() => {
    const project = store.getState().project;
    const folderPath = project?.folderPath;
    if (!folderPath || !workspaceLoaded) return;

    ensureTabVisible();
    store.dispatch(
      setWorkspaceSettingsAction(
        DOCS_WORKSPACE,
        createDocumentWorkspace(openDocs, activeDocIndex, folderPath)
      ),
      "ide"
    );
    (async () => {
      await mainApi.saveProject();
    })();
  }, [activeDocIndex, ensureTabVisible, mainApi, openDocs, store, workspaceLoaded]);
}

export function createDocumentWorkspace(
  openDocs: ProjectDocumentState[] | null | undefined = [],
  activeDocIndex: number,
  folderPath: string
): DocumentWorkspace {
  const documents = openDocs ?? [];
  return {
    documents: documents
      .filter((d) => d.id.startsWith(folderPath))
      .map((d) => ({
        type: d.type,
        id: d.id,
        position: {
          line: d.editPosition?.line ?? 0,
          column: d.editPosition?.column ?? 0
        }
      })),
    activeDocumentId: documents[activeDocIndex]?.id
  };
}
