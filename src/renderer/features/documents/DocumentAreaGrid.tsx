import { useState, type ReactNode } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { SplitPanel } from "@renderer/controls/SplitPanel";
import { DocumentAreaPane } from "./DocumentAreaPane";
import {
  createSingleAreaLayout,
  findAreaIds,
  type DocumentAreaId,
  type DocumentAreaLayout
} from "./documentAreaLayout";

export const DEFAULT_DOCUMENT_AREA_ID = "document-area-1";

type DocumentAreaGridProps = {
  initialHubs?: Partial<Record<DocumentAreaId, IDocumentHubService>>;
  initialLayout?: DocumentAreaLayout;
};

/**
 * Renders the document-area layout tree. Today it starts with one area; future
 * split commands will update the layout and add hubs for new leaves.
 */
export const DocumentAreaGrid = ({
  initialHubs,
  initialLayout
}: DocumentAreaGridProps) => {
  const { projectService } = useAppServices();
  const [layout] = useState<DocumentAreaLayout>(
    () => initialLayout ?? createSingleAreaLayout(DEFAULT_DOCUMENT_AREA_ID)
  );
  const [hubsByAreaId] = useState(
    () => createInitialHubMap(layout, initialHubs, projectService.getActiveDocumentHubService())
  );

  return renderDocumentAreaLayout(layout, hubsByAreaId);
};

function renderDocumentAreaLayout(
  layout: DocumentAreaLayout,
  hubsByAreaId: Map<DocumentAreaId, IDocumentHubService>
): ReactNode {
  if (layout.type === "leaf") {
    const hub = hubsByAreaId.get(layout.areaId);
    return hub ? <DocumentAreaPane key={layout.areaId} hub={hub} /> : null;
  }

  return (
    <SplitPanel
      primaryLocation={layout.direction === "horizontal" ? "left" : "top"}
      initialPrimarySize={layout.size ?? "50%"}
      minSize={120}
    >
      {renderDocumentAreaLayout(layout.first, hubsByAreaId)}
      {renderDocumentAreaLayout(layout.second, hubsByAreaId)}
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
