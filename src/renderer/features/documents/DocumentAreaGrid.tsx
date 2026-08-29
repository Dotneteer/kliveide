import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode
} from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { setWorkspaceSettingsAction } from "@common/state/actions";
import { SplitPanel } from "@renderer/controls/SplitPanel";
import {
  ActiveDocumentAreaIdProvider,
  DocumentAreaGridApiProvider,
  DocumentAreaIdProvider
} from "./DocumentAreaGridContext";
import { DocumentAreaPane } from "./DocumentAreaPane";
import {
  createSingleAreaLayout,
  findAreaIds,
  removeArea,
  splitArea,
  setSplitSize,
  type DocumentAreaId,
  type DocumentAreaLayout,
  type DocumentAreaSplitPath,
  type DocumentAreaSplitDirection
} from "./documentAreaLayout";
import {
  createDocumentAreaWorkspace,
  DOCS_WORKSPACE,
  getMultiAreaDocumentWorkspace
} from "./useDocumentWorkspacePersistence";
import { setDocumentAreaCommandTarget } from "./documentAreaCommandTarget";
import { getLegacySpecialDocumentWorkspaceSettingIds } from "./specialDocuments";

export const DEFAULT_DOCUMENT_AREA_ID = "document-area-1";

export type DocumentAreaGridApi = {
  closeActiveArea(): Promise<void>;
  closeOtherAreas(): Promise<void>;
  getActiveAreaState(): DocumentAreaState;
  splitActiveArea(direction: DocumentAreaSplitDirection): Promise<void>;
  moveActiveDocumentToNextArea(documentId?: string): Promise<void>;
  moveActiveDocumentToPreviousArea(documentId?: string): Promise<void>;
  moveDocumentToArea(
    sourceAreaId: DocumentAreaId,
    targetAreaId: DocumentAreaId,
    documentId: string,
    targetDocumentId?: string,
    after?: boolean
  ): Promise<void>;
};

export type DocumentAreaState = {
  hasActiveDocument: boolean;
  hasNextArea: boolean;
  hasPreviousArea: boolean;
};

type DocumentAreaGridProps = {
  apiLoaded?: (api: DocumentAreaGridApi) => void;
  initialHubs?: Partial<Record<DocumentAreaId, IDocumentHubService>>;
  initialLayout?: DocumentAreaLayout;
};

/**
 * Renders the document-area layout tree. Today it starts with one area; future
 * split commands will update the layout and add hubs for new leaves.
 */
export const DocumentAreaGrid = ({
  apiLoaded,
  initialHubs,
  initialLayout
}: DocumentAreaGridProps) => {
  const { projectService } = useAppServices();
  const mainApi = useMainApi();
  const { store } = useRendererContext();
  const documentHubState = useSelector((s) => s.ideView?.documentHubState);
  const workspaceLoaded = useSelector((s) => s.project?.workspaceLoaded ?? false);
  const nextAreaId = useRef(1);
  const workspaceRestored = useRef(false);
  const skipNextWorkspaceSave = useRef(false);
  const [layout, setLayout] = useState<DocumentAreaLayout>(
    () => initialLayout ?? createSingleAreaLayout(DEFAULT_DOCUMENT_AREA_ID)
  );
  const [hubsByAreaId, setHubsByAreaId] = useState(
    () => createInitialHubMap(layout, initialHubs, projectService.getActiveDocumentHubService())
  );
  const [activeAreaId, setActiveAreaId] = useState<DocumentAreaId>(
    () => getInitialActiveAreaId(layout, hubsByAreaId, projectService.getActiveDocumentHubService())
  );

  useEffect(() => {
    nextAreaId.current = getNextAreaCounter(findAreaIds(layout));
  }, [layout]);

  useEffect(() => {
    if (!workspaceLoaded || workspaceRestored.current) return;

    const workspace = getMultiAreaDocumentWorkspace(
      store.getState().workspaceSettings?.[DOCS_WORKSPACE]
    );
    if (!workspace || workspace.areas.length <= 1) {
      workspaceRestored.current = true;
      return;
    }

    const hubs = projectService.getDocumentHubServiceInstances();
    const restoredHubs = new Map<DocumentAreaId, IDocumentHubService>();
    workspace.areas.forEach((area, index) => {
      const hub = hubs[index];
      if (hub) {
        restoredHubs.set(area.areaId, hub);
      }
    });

    if (restoredHubs.size <= 0) {
      workspaceRestored.current = true;
      return;
    }

    setLayout(workspace.layout);
    setHubsByAreaId(restoredHubs);
    setActiveAreaId(workspace.activeAreaId ?? workspace.areas[0].areaId);
    workspaceRestored.current = true;
    skipNextWorkspaceSave.current = true;
  }, [projectService, store, workspaceLoaded]);

  useEffect(() => {
    const registeredHubs = new Set(projectService.getDocumentHubServiceInstances());
    const closedAreaIds = findAreaIds(layout).filter((areaId) => {
      const hub = hubsByAreaId.get(areaId);
      return hub && !registeredHubs.has(hub);
    });
    if (closedAreaIds.length <= 0) return;

    const nextHubs = new Map(hubsByAreaId);
    for (const areaId of closedAreaIds) {
      nextHubs.delete(areaId);
    }

    const nextLayout = closedAreaIds.reduce(
      (currentLayout, areaId) => removeArea(currentLayout, areaId),
      layout
    );
    const nextAreaIds = findAreaIds(nextLayout);
    const activeHub = projectService.getActiveDocumentHubService();
    const nextActiveAreaId =
      nextAreaIds.find((areaId) => nextHubs.get(areaId) === activeHub) ??
      (nextAreaIds.includes(activeAreaId) ? activeAreaId : nextAreaIds[0]);

    setHubsByAreaId(nextHubs);
    setLayout(nextLayout);
    setActiveAreaId(nextActiveAreaId ?? DEFAULT_DOCUMENT_AREA_ID);
  }, [activeAreaId, documentHubState, hubsByAreaId, layout, projectService]);

  const moveDocumentToArea = useCallback(
    async (
      sourceAreaId: DocumentAreaId,
      targetAreaId: DocumentAreaId,
      documentId: string,
      targetDocumentId?: string,
      after = false
    ) => {
      if (sourceAreaId === targetAreaId) return;
      const sourceHub = hubsByAreaId.get(sourceAreaId);
      const targetHub = hubsByAreaId.get(targetAreaId);
      const document = sourceHub?.getDocument(documentId);
      if (!sourceHub || !targetHub || !document) return;

      const viewState = sourceHub.getDocumentViewState(document.id);
      await targetHub.openDocument(document, viewState, document.isTemporary ?? false);
      if (targetDocumentId) {
        targetHub.moveDocument(document.id, targetDocumentId, after);
      }
      sourceHub.detachDocument(document.id);

      setActiveAreaId(targetAreaId);
      projectService.setActiveDocumentHubService(targetHub);

      if (sourceHub.getOpenDocuments().length <= 0) {
        setLayout((currentLayout) => removeArea(currentLayout, sourceAreaId));
        setHubsByAreaId((currentHubs) => {
          const nextHubs = new Map(currentHubs);
          nextHubs.delete(sourceAreaId);
          return nextHubs;
        });
      }
    },
    [hubsByAreaId, projectService]
  );

  const moveDocumentToSiblingArea = useCallback(
    async (offset: -1 | 1, documentId?: string) => {
      const areaIds = findAreaIds(layout);
      const sourceIndex = areaIds.indexOf(activeAreaId);
      const targetAreaId = areaIds[sourceIndex + offset];
      const sourceHub = hubsByAreaId.get(activeAreaId);
      const document = documentId ? sourceHub?.getDocument(documentId) : sourceHub?.getActiveDocument();
      if (!targetAreaId || !document) return;

      await moveDocumentToArea(activeAreaId, targetAreaId, document.id);
    },
    [activeAreaId, hubsByAreaId, layout, moveDocumentToArea]
  );

  const closeActiveArea = useCallback(async () => {
    const activeHub = hubsByAreaId.get(activeAreaId);
    if (!activeHub) return;

    await activeHub.closeAllDocuments();
    const areaIds = findAreaIds(layout);
    if (areaIds.length <= 1) return;

    setLayout((currentLayout) => removeArea(currentLayout, activeAreaId));
    setHubsByAreaId((currentHubs) => {
      const nextHubs = new Map(currentHubs);
      nextHubs.delete(activeAreaId);
      return nextHubs;
    });

    const remainingAreaId = areaIds.find((areaId) => areaId !== activeAreaId);
    const remainingHub = remainingAreaId ? hubsByAreaId.get(remainingAreaId) : undefined;
    if (remainingAreaId) {
      setActiveAreaId(remainingAreaId);
    }
    if (remainingHub) {
      projectService.setActiveDocumentHubService(remainingHub);
    }
  }, [activeAreaId, hubsByAreaId, layout, projectService]);

  const closeOtherAreas = useCallback(async () => {
    const activeHub = hubsByAreaId.get(activeAreaId);
    if (!activeHub) return;

    const areaIds = findAreaIds(layout);
    await Promise.all(
      areaIds
        .filter((areaId) => areaId !== activeAreaId)
        .map((areaId) => hubsByAreaId.get(areaId))
        .filter((hub): hub is IDocumentHubService => !!hub)
        .map((hub) => hub.closeAllDocuments())
    );

    setLayout(createSingleAreaLayout(activeAreaId));
    setHubsByAreaId(new Map([[activeAreaId, activeHub]]));
    projectService.setActiveDocumentHubService(activeHub);
  }, [activeAreaId, hubsByAreaId, layout, projectService]);

  const splitActiveArea = useCallback(
    async (direction: DocumentAreaSplitDirection) => {
      const sourceHub = hubsByAreaId.get(activeAreaId);
      if (!sourceHub) return;

      const newAreaId = createNextAreaId(nextAreaId);
      const newHub = projectService.createDocumentHubService();
      const activeDocument = sourceHub.getActiveDocument();
      if (activeDocument) {
        await newHub.openDocument(
          activeDocument,
          sourceHub.getDocumentViewState(activeDocument.id),
          activeDocument.isTemporary ?? false
        );
      }

      setHubsByAreaId((currentHubs) => {
        const nextHubs = new Map(currentHubs);
        nextHubs.set(newAreaId, newHub);
        return nextHubs;
      });
      setLayout((currentLayout) =>
        splitArea(currentLayout, activeAreaId, newAreaId, direction)
      );
      setActiveAreaId(newAreaId);
      projectService.setActiveDocumentHubService(newHub);
    },
    [activeAreaId, hubsByAreaId, projectService]
  );

  const api = useMemo<DocumentAreaGridApi>(
    () => ({
      closeActiveArea,
      closeOtherAreas,
      getActiveAreaState: () => {
        const areaIds = findAreaIds(layout);
        const activeAreaIndex = areaIds.indexOf(activeAreaId);
        return {
          hasActiveDocument: !!hubsByAreaId.get(activeAreaId)?.getActiveDocument(),
          hasNextArea: activeAreaIndex >= 0 && activeAreaIndex < areaIds.length - 1,
          hasPreviousArea: activeAreaIndex > 0
        };
      },
      splitActiveArea,
      moveActiveDocumentToNextArea: (documentId?: string) =>
        moveDocumentToSiblingArea(1, documentId),
      moveActiveDocumentToPreviousArea: (documentId?: string) =>
        moveDocumentToSiblingArea(-1, documentId),
      moveDocumentToArea
    }),
    [
      closeActiveArea,
      closeOtherAreas,
      activeAreaId,
      hubsByAreaId,
      layout,
      moveDocumentToArea,
      moveDocumentToSiblingArea,
      splitActiveArea
    ]
  );

  useEffect(() => {
    apiLoaded?.(api);
  }, [api, apiLoaded]);

  useEffect(() => setDocumentAreaCommandTarget(api), [api]);

  useEffect(() => {
    const project = store.getState().project;
    const folderPath = project?.folderPath;
    if (!folderPath || !workspaceLoaded) return;
    if (!workspaceRestored.current) return;
    if (skipNextWorkspaceSave.current) {
      skipNextWorkspaceSave.current = false;
      return;
    }

    const documentWorkspace = createDocumentAreaWorkspace(
      layout,
      hubsByAreaId,
      activeAreaId,
      folderPath
    );
    for (const settingId of getLegacySpecialDocumentWorkspaceSettingIds()) {
      if (store.getState().workspaceSettings?.[settingId] !== undefined) {
        store.dispatch(setWorkspaceSettingsAction(settingId, undefined), "ide");
      }
    }

    store.dispatch(
      setWorkspaceSettingsAction(
        DOCS_WORKSPACE,
        documentWorkspace
      ),
      "ide"
    );
    (async () => {
      await mainApi.saveProject();
    })();
  }, [
    activeAreaId,
    documentHubState,
    hubsByAreaId,
    layout,
    mainApi,
    store,
    workspaceLoaded
  ]);

  return (
    <DocumentAreaGridApiProvider api={api}>
      <ActiveDocumentAreaIdProvider activeAreaId={activeAreaId}>
        {renderDocumentAreaLayout(layout, hubsByAreaId, setActiveAreaId, (path, ratio) => {
          setLayout((currentLayout) =>
            setSplitSize(currentLayout, path, formatSplitSize(ratio))
          );
        })}
      </ActiveDocumentAreaIdProvider>
    </DocumentAreaGridApiProvider>
  );
};

function renderDocumentAreaLayout(
  layout: DocumentAreaLayout,
  hubsByAreaId: Map<DocumentAreaId, IDocumentHubService>,
  setActiveAreaId: (areaId: DocumentAreaId) => void,
  onSplitSizeChanged: (path: DocumentAreaSplitPath, ratio: number) => void,
  path: DocumentAreaSplitPath = []
): ReactNode {
  if (layout.type === "leaf") {
    const hub = hubsByAreaId.get(layout.areaId);
    return hub ? (
      <DocumentAreaIdProvider key={layout.areaId} areaId={layout.areaId}>
        <DocumentAreaPane
          hub={hub}
          onActivated={() => setActiveAreaId(layout.areaId)}
        />
      </DocumentAreaIdProvider>
    ) : null;
  }

  return (
    <SplitPanel
      primaryLocation={layout.direction === "horizontal" ? "left" : "top"}
      initialPrimarySize={layout.size ?? "50%"}
      minSize={120}
      showSplitterBorder={true}
      onPrimarySizeRatioUpdateCompleted={(ratio) => onSplitSizeChanged(path, ratio)}
    >
      {renderDocumentAreaLayout(layout.first, hubsByAreaId, setActiveAreaId, onSplitSizeChanged, [
        ...path,
        "first"
      ])}
      {renderDocumentAreaLayout(layout.second, hubsByAreaId, setActiveAreaId, onSplitSizeChanged, [
        ...path,
        "second"
      ])}
    </SplitPanel>
  );
}

function formatSplitSize(ratio: number): string {
  return `${Number((ratio * 100).toFixed(6))}%`;
}

function createInitialHubMap(
  layout: DocumentAreaLayout,
  initialHubs: Partial<Record<DocumentAreaId, IDocumentHubService>> | undefined,
  activeHub: IDocumentHubService | undefined
): Map<DocumentAreaId, IDocumentHubService> {
  const hubsByAreaId = new Map<DocumentAreaId, IDocumentHubService>();
  Object.entries(initialHubs ?? {}).forEach(([areaId, hub]) => {
    if (hub) {
      hubsByAreaId.set(areaId, hub);
    }
  });

  if (activeHub) {
    for (const areaId of findAreaIds(layout)) {
      if (!hubsByAreaId.has(areaId)) {
        hubsByAreaId.set(areaId, activeHub);
        break;
      }
    }
  }

  return hubsByAreaId;
}

function getInitialActiveAreaId(
  layout: DocumentAreaLayout,
  hubsByAreaId: Map<DocumentAreaId, IDocumentHubService>,
  activeHub: IDocumentHubService | undefined
): DocumentAreaId {
  const areaIds = findAreaIds(layout);
  const activeAreaId = areaIds.find((areaId) => hubsByAreaId.get(areaId) === activeHub);
  return activeAreaId ?? areaIds[0] ?? DEFAULT_DOCUMENT_AREA_ID;
}

function getNextAreaCounter(areaIds: DocumentAreaId[]): number {
  return areaIds.reduce((nextCounter, areaId) => {
    const match = /^document-area-(\d+)$/.exec(areaId);
    return match ? Math.max(nextCounter, Number(match[1]) + 1) : nextCounter;
  }, 1);
}

function createNextAreaId(nextAreaId: MutableRefObject<number>): DocumentAreaId {
  const areaId = `document-area-${nextAreaId.current}`;
  nextAreaId.current += 1;
  return areaId;
}
