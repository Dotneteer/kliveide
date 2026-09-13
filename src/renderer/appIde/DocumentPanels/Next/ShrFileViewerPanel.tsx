import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { NOT_IMPLEMENTED_MESSAGE } from "./notImplemented";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShrFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SHR Viewer" />
      <EmptyState message={NOT_IMPLEMENTED_MESSAGE} />
    </DataPanel>
  );
};

export const createShrFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShrFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
