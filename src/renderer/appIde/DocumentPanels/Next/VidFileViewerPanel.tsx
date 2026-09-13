import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";
import { NOT_IMPLEMENTED_MESSAGE } from "./notImplemented";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const VidFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".VID Viewer" />
      <EmptyState message={NOT_IMPLEMENTED_MESSAGE} />
    </DataPanel>
  );
};

export const createVidFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <VidFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
