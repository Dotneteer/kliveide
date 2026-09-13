import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { NOT_IMPLEMENTED_MESSAGE } from "./notImplemented";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const ShcFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".SHC Viewer" />
      <EmptyState message={NOT_IMPLEMENTED_MESSAGE} />
    </DataPanel>
  );
};

export const createShcFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <ShcFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
