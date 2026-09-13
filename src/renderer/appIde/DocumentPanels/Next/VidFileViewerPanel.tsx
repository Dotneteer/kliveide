import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

const VidFileViewerPanel = ({}: DocumentProps) => {
  return (
    <DataPanel>
      <PanelHeader title=".VID Viewer" />
    </DataPanel>
  );
};

export const createVidFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <VidFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
