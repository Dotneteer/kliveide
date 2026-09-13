import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { NOT_IMPLEMENTED_MESSAGE } from "./notImplemented";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const Sl2FileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SL2 Viewer" />
      <EmptyState message={NOT_IMPLEMENTED_MESSAGE} />
    </DataPanel>
  );
};

export const createSl2FileViewerPanel = ({ document, contents }: DocumentProps) => (
  <Sl2FileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
