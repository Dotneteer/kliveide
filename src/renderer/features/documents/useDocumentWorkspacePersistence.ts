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
import type {
  FloatingDocumentEntry,
  FloatingWindowBounds
} from "@common/messaging/floating-documents";

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

/**
 * A document that was floating in its own window when the workspace was saved
 * (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` Q3): reopening the project reopens it floating
 */
export type SavedFloatingDocumentInfo = {
  document: SavedDocumentInfo;
  sourceAreaId?: DocumentAreaId;
  bounds?: FloatingWindowBounds;
};

/**
 * Version 2: the document areas. Version 3 adds the floating documents; a version 2 workspace reads
 * as one without any.
 */
export type MultiAreaDocumentWorkspace = {
  version: 2 | 3;
  layout: DocumentAreaLayout;
  areas: SavedDocumentAreaInfo[];
  activeAreaId?: DocumentAreaId;
  floating?: SavedFloatingDocumentInfo[];
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
  folderPath: string,
  floatingDocuments: FloatingDocumentEntry[] = []
): MultiAreaDocumentWorkspace {
  const areaIds = findAreaIds(layout);
  const floating = createSavedFloatingDocuments(floatingDocuments, folderPath);
  return {
    version: floating.length > 0 ? 3 : 2,
    layout,
    activeAreaId,
    ...(floating.length > 0 ? { floating } : {}),
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
  return "version" in workspace && (workspace.version === 2 || workspace.version === 3);
}

/**
 * The floating documents as the workspace saves them: only project-scoped ones, like the tabs
 */
export function createSavedFloatingDocuments(
  entries: FloatingDocumentEntry[],
  folderPath: string
): SavedFloatingDocumentInfo[] {
  return entries
    .filter(
      (entry) =>
        !!entry?.document?.id &&
        (entry.document.id.startsWith(folderPath) ||
          isWorkspaceRestorableSpecialDocument(entry.document as ProjectDocumentState))
    )
    .map((entry) => ({
      document: {
        type: entry.document.type,
        id: entry.document.id,
        position: {
          line: entry.document.position?.line ?? 0,
          column: entry.document.position?.column ?? 0
        },
        ...(entry.document.viewState !== undefined ? { viewState: entry.document.viewState } : {})
      },
      ...(entry.sourceAreaId ? { sourceAreaId: entry.sourceAreaId } : {}),
      ...(entry.bounds ? { bounds: { ...entry.bounds } } : {})
    }));
}

/**
 * The floating documents of a saved workspace (none before version 3)
 */
export function getSavedFloatingDocuments(
  workspace: DocumentWorkspace | undefined
): SavedFloatingDocumentInfo[] {
  if (!workspace || !isMultiAreaDocumentWorkspace(workspace)) return [];
  return Array.isArray(workspace.floating) ? workspace.floating.filter((f) => !!f?.document?.id) : [];
}
