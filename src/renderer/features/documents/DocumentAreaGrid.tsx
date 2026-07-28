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
import { useSelector } from "@renderer/core/RendererProvider";
import { SplitPanel } from "@renderer/controls/SplitPanel";
import { DocumentAreaGridApiProvider } from "./DocumentAreaGridContext";
import { DocumentAreaPane } from "./DocumentAreaPane";
import {
  createSingleAreaLayout,
  findAreaIds,
  removeArea,
  splitArea,
  type DocumentAreaId,
  type DocumentAreaLayout,
  type DocumentAreaSplitDirection
} from "./documentAreaLayout";

export const DEFAULT_DOCUMENT_AREA_ID = "document-area-1";

export type DocumentAreaGridApi = {
  splitActiveArea(direction: DocumentAreaSplitDirection): Promise<void>;
  moveActiveDocumentToNextArea(): Promise<void>;
  moveActiveDocumentToPreviousArea(): Promise<void>;
  moveDocumentToArea(
    sourceAreaId: DocumentAreaId,
    targetAreaId: DocumentAreaId,
    documentId: string
  ): Promise<void>;
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
  const documentHubState = useSelector((s) => s.ideView?.documentHubState);
  const nextAreaId = useRef(1);
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
    async (sourceAreaId: DocumentAreaId, targetAreaId: DocumentAreaId, documentId: string) => {
      if (sourceAreaId === targetAreaId) return;
      const sourceHub = hubsByAreaId.get(sourceAreaId);
      const targetHub = hubsByAreaId.get(targetAreaId);
      const document = sourceHub?.getDocument(documentId);
      if (!sourceHub || !targetHub || !document) return;

      const viewState = sourceHub.getDocumentViewState(document.id);
      await targetHub.openDocument(document, viewState, document.isTemporary ?? false);
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

  const moveActiveDocument = useCallback(
    async (offset: -1 | 1) => {
      const areaIds = findAreaIds(layout);
      const sourceIndex = areaIds.indexOf(activeAreaId);
      const targetAreaId = areaIds[sourceIndex + offset];
      const sourceHub = hubsByAreaId.get(activeAreaId);
      const activeDocument = sourceHub?.getActiveDocument();
      if (!targetAreaId || !activeDocument) return;

      await moveDocumentToArea(activeAreaId, targetAreaId, activeDocument.id);
    },
    [activeAreaId, hubsByAreaId, layout, moveDocumentToArea]
  );

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
      splitActiveArea,
      moveActiveDocumentToNextArea: () => moveActiveDocument(1),
      moveActiveDocumentToPreviousArea: () => moveActiveDocument(-1),
      moveDocumentToArea
    }),
    [moveActiveDocument, moveDocumentToArea, splitActiveArea]
  );

  useEffect(() => {
    apiLoaded?.(api);
  }, [api, apiLoaded]);

  return (
    <DocumentAreaGridApiProvider api={api}>
      {renderDocumentAreaLayout(layout, hubsByAreaId, setActiveAreaId)}
    </DocumentAreaGridApiProvider>
  );
};

function renderDocumentAreaLayout(
  layout: DocumentAreaLayout,
  hubsByAreaId: Map<DocumentAreaId, IDocumentHubService>,
  setActiveAreaId: (areaId: DocumentAreaId) => void
): ReactNode {
  if (layout.type === "leaf") {
    const hub = hubsByAreaId.get(layout.areaId);
    return hub ? (
      <DocumentAreaPane
        key={layout.areaId}
        hub={hub}
        onActivated={() => setActiveAreaId(layout.areaId)}
      />
    ) : null;
  }

  return (
    <SplitPanel
      primaryLocation={layout.direction === "horizontal" ? "left" : "top"}
      initialPrimarySize={layout.size ?? "50%"}
      minSize={120}
    >
      {renderDocumentAreaLayout(layout.first, hubsByAreaId, setActiveAreaId)}
      {renderDocumentAreaLayout(layout.second, hubsByAreaId, setActiveAreaId)}
    </SplitPanel>
  );
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
