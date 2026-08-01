import { setWorkspaceSettingsAction } from "@common/state/actions";
import { AppState } from "@common/state/AppState";
import { MainApi } from "@common/messaging/MainApi";
import { Store } from "@common/state/redux-light";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { useEffect } from "react";
import {
  createSingleAreaLayout,
  findAreaIds,
  type DocumentAreaId,
  type DocumentAreaLayout
} from "./documentAreaLayout";
import { isWorkspaceRestorableSpecialDocument } from "./specialDocuments";

export const DOCS_WORKSPACE = "docsWorkspace";

export type SavedDocumentInfo = {
  type: string;
  id: string;
  position?: {
    line: number;
    column?: number;
  };
  viewState?: any;
};

export type LegacyDocumentWorkspace = {
  documents: SavedDocumentInfo[];
  activeDocumentId?: string;
};

export type SavedDocumentAreaInfo = {
  areaId: DocumentAreaId;
  documents: SavedDocumentInfo[];
  activeDocumentId?: string;
};

export type MultiAreaDocumentWorkspace = {
  version: 2;
  layout: DocumentAreaLayout;
  areas: SavedDocumentAreaInfo[];
  activeAreaId?: DocumentAreaId;
};

export type DocumentWorkspace = LegacyDocumentWorkspace | MultiAreaDocumentWorkspace;

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
      .filter(
        (d) => d.id.startsWith(folderPath) || isWorkspaceRestorableSpecialDocument(d)
      )
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

export function createDocumentAreaWorkspace(
  layout: DocumentAreaLayout,
  hubsByAreaId: Map<DocumentAreaId, IDocumentHubService>,
  activeAreaId: DocumentAreaId,
  folderPath: string
): MultiAreaDocumentWorkspace {
  const areaIds = findAreaIds(layout);
  return {
    version: 2,
    layout,
    activeAreaId,
    areas: areaIds.map((areaId) => {
      const hub = hubsByAreaId.get(areaId);
      const documents = (hub?.getOpenDocuments() ?? [])
        .filter(
          (d) => d.id.startsWith(folderPath) || isWorkspaceRestorableSpecialDocument(d)
        )
        .map((d) => {
          const viewState = hub?.getDocumentViewState(d.id);
          return {
            type: d.type,
            id: d.id,
            position: {
              line: d.editPosition?.line ?? 0,
              column: d.editPosition?.column ?? 0
            },
            ...(viewState !== undefined ? { viewState } : {})
          };
        });
      const activeDocumentId = hub?.getActiveDocument()?.id;
      return {
        areaId,
        documents,
        activeDocumentId
      };
    })
  };
}

export function getMultiAreaDocumentWorkspace(
  workspace: DocumentWorkspace | undefined,
  defaultAreaId: DocumentAreaId = "document-area-1"
): MultiAreaDocumentWorkspace | undefined {
  if (!workspace) return undefined;

  if (isMultiAreaDocumentWorkspace(workspace)) {
    const areaIds = findAreaIds(workspace.layout);
    const areas = workspace.areas.filter((area) => areaIds.includes(area.areaId));
    return {
      ...workspace,
      areas
    };
  }

  return {
    version: 2,
    layout: createSingleAreaLayout(defaultAreaId),
    activeAreaId: defaultAreaId,
    areas: [
      {
        areaId: defaultAreaId,
        documents: workspace.documents,
        activeDocumentId: workspace.activeDocumentId
      }
    ]
  };
}

function isMultiAreaDocumentWorkspace(
  workspace: DocumentWorkspace
): workspace is MultiAreaDocumentWorkspace {
  return "version" in workspace && workspace.version === 2;
}
